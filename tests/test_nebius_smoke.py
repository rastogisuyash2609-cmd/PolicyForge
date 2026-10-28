"""All smoke-test requests below use HTTPX MockTransport; real HTTP is forbidden."""

from concurrent.futures import ThreadPoolExecutor
import json
from typing import Any

import httpx
import pytest
from pydantic import SecretStr
from pytest import CaptureFixture, MonkeyPatch

from policyforge import nebius_smoke as smoke
from policyforge.compiler import PolicyCompiler
from policyforge.models import Rule

OFFLINE_SECRET = "offline-unit-test-secret-never-a-real-credential"


@pytest.fixture(autouse=True)
def forbid_real_http(monkeypatch: MonkeyPatch) -> None:
    def blocked(*args: Any, **kwargs: Any) -> None:
        raise AssertionError("Real HTTP is prohibited in the offline smoke tests.")
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", blocked)


@pytest.fixture
def configuration() -> smoke.SmokeConfiguration:
    return smoke.SmokeConfiguration(
        model="nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
        base_url="https://api.tokenfactory.nebius.com/v1/",
        api_key=SecretStr(OFFLINE_SECRET),
    )


def valid_rule() -> dict[str, Any]:
    return {
        "id": "refund_30_days", "name": "Refund within 30 days",
        "decision": "REFUND", "trigger": "REFUND_REQUESTED", "effect": "ALLOW",
        "when": {"all": [
            {"field": "item_delivered", "op": "IS_TRUE", "value": True},
            {"field": "days_since_delivery", "op": "LTE", "value": 30},
        ]},
        "source": {"doc_name": smoke.DOC_NAME, "verbatim_sentence": smoke.POLICY_TEXT},
    }


def completion(content: str, *, finish: str = "stop", usage: bool = True) -> httpx.Response:
    data: dict[str, Any] = {
        "id": "offline-response", "object": "chat.completion", "created": 0,
        "model": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
        "choices": [{"index": 0, "finish_reason": finish,
                     "message": {"role": "assistant", "content": content}}],
    }
    if usage:
        data["usage"] = {"prompt_tokens": 123, "completion_tokens": 80, "total_tokens": 203}
    return httpx.Response(200, json=data)


def test_default_preflight_never_constructs_sdk_or_sends_http(
    configuration: smoke.SmokeConfiguration, monkeypatch: MonkeyPatch,
) -> None:
    def forbidden(*args: Any, **kwargs: Any) -> None:
        pytest.fail("Preflight attempted SDK construction.")
    monkeypatch.setattr(smoke, "SingleRequestClient", forbidden)
    result = smoke.run_smoke(configuration=configuration)
    assert result["status"] == "prepared_live_disabled"
    assert result["provider_requests"] == 0
    assert result["validation"] == "not_run"
    assert result["max_output_tokens"] == 512
    assert result["timeout_seconds"] == 30.0
    assert result["sdk_retries"] == result["wrapper_retries"] == result["compiler_repairs"] == 0
    assert OFFLINE_SECRET not in json.dumps(result)


def test_cli_without_flag_is_local_only(
    configuration: smoke.SmokeConfiguration, monkeypatch: MonkeyPatch,
    capsys: CaptureFixture[str],
) -> None:
    monkeypatch.setattr(smoke, "read_configuration", lambda: configuration)
    assert smoke.main([]) == 0
    output = capsys.readouterr()
    assert json.loads(output.out)["provider_requests"] == 0
    assert output.err == ""
    assert OFFLINE_SECRET not in output.out


def test_success_uses_one_bounded_request_and_existing_compiler(
    configuration: smoke.SmokeConfiguration, monkeypatch: MonkeyPatch,
) -> None:
    requests: list[httpx.Request] = []
    compilers: list[int] = []
    original_init = PolicyCompiler.__init__
    def track_compiler(self: PolicyCompiler, *args: Any, **kwargs: Any) -> None:
        compilers.append(kwargs["max_repairs"])
        original_init(self, *args, **kwargs)
    monkeypatch.setattr(PolicyCompiler, "__init__", track_compiler)
    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        body = json.loads(request.content)
        assert request.method == "POST"
        assert request.url.path == "/v1/chat/completions"
        assert body["max_tokens"] == 512
        assert body["n"] == 1 and body["stream"] is False
        assert body["temperature"] == 0
        assert body["model"] == configuration.model
        assert body["response_format"] == {"type": "json_object"}
        assert len(body["messages"]) == 2
        assert smoke.POLICY_TEXT in body["messages"][1]["content"]
        assert set(request.extensions["timeout"].values()) == {30.0}
        return completion(json.dumps({"rules": [valid_rule()]}))
    result = smoke.run_smoke(execute=True, configuration=configuration,
                             offline_transport=httpx.MockTransport(handle))
    assert len(requests) == result["provider_requests"] == 1
    assert compilers == [0]
    assert result["status"] == "succeeded" and result["validation"] == "passed"
    assert Rule.model_validate(result["validated_rules"][0]).id == "refund_30_days"
    assert result["token_usage"] == {"prompt_tokens": 123, "completion_tokens": 80, "total_tokens": 203}


@pytest.mark.parametrize("content", [
    "not JSON", '{"rules": []}', '{"rules": null}',
    json.dumps({"rules": [{**valid_rule(), "decision": "UNKNOWN"}]}),
    json.dumps({"rules": [{**valid_rule(), "when": {"field": "unknown", "op": "LTE", "value": 30}}]}),
    json.dumps({"rules": [{**valid_rule(), "unexpected": True}]}),
    json.dumps({"rules": [valid_rule(), valid_rule()]}),
])
def test_json_or_pydantic_errors_do_not_trigger_a_second_request(
    configuration: smoke.SmokeConfiguration, content: str,
) -> None:
    calls: list[httpx.Request] = []
    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return completion(content)
    result = smoke.run_smoke(execute=True, configuration=configuration,
                             offline_transport=httpx.MockTransport(handle))
    assert len(calls) == result["provider_requests"] == 1
    assert result["status"] == "failed" and result["validation"] == "failed"
    assert result["validated_rules"] == [] and result["errors"]
    assert all("input" not in error and "ctx" not in error for error in result["errors"])


def test_source_grounding_rejection_is_local_only(configuration: smoke.SmokeConfiguration) -> None:
    rule = valid_rule()
    rule["source"]["verbatim_sentence"] = "A sentence absent from the synthetic policy."
    result = smoke.run_smoke(execute=True, configuration=configuration,
        offline_transport=httpx.MockTransport(lambda request: completion(json.dumps({"rules": [rule]}))))
    assert result["provider_requests"] == 1 and result["status"] == "failed"
    assert result["errors"][0]["type"] == "compiler_rejection"


@pytest.mark.parametrize("status", [401, 429, 500, 503, 307])
def test_http_failures_and_redirects_never_retry(
    configuration: smoke.SmokeConfiguration, status: int,
) -> None:
    calls: list[httpx.Request] = []
    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(status, headers={"location": "https://api.tokenfactory.nebius.com/v1/chat/completions"},
                              json={"error": {"message": OFFLINE_SECRET}})
    result = smoke.run_smoke(execute=True, configuration=configuration,
                             offline_transport=httpx.MockTransport(handle))
    assert len(calls) == result["provider_requests"] == 1
    assert result["status"] == "failed" and result["token_usage"] is None
    assert result["errors"] == [{"type": "provider_http_error", "status_code": status}]
    assert OFFLINE_SECRET not in json.dumps(result)


def test_timeout_consumes_attempt_and_redacts_errors(
    configuration: smoke.SmokeConfiguration, caplog: pytest.LogCaptureFixture,
    capsys: CaptureFixture[str],
) -> None:
    calls: list[httpx.Request] = []
    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        raise httpx.ReadTimeout(OFFLINE_SECRET, request=request)
    result = smoke.run_smoke(execute=True, configuration=configuration,
                             offline_transport=httpx.MockTransport(handle))
    assert len(calls) == result["provider_requests"] == 1
    assert result["status"] == "failed" and result["token_usage"] is None
    assert OFFLINE_SECRET not in json.dumps(result)
    assert OFFLINE_SECRET not in caplog.text
    assert OFFLINE_SECRET not in repr(capsys.readouterr())


@pytest.mark.parametrize("finish", ["length", "content_filter", "tool_calls"])
def test_incomplete_completion_stops_without_repair(
    configuration: smoke.SmokeConfiguration, finish: str,
) -> None:
    result = smoke.run_smoke(execute=True, configuration=configuration,
        offline_transport=httpx.MockTransport(lambda request: completion("", finish=finish)))
    assert result["provider_requests"] == 1 and result["status"] == "failed"
    assert result["token_usage"]["total_tokens"] == 203


def test_missing_usage_is_unknown_not_zero(configuration: smoke.SmokeConfiguration) -> None:
    result = smoke.run_smoke(execute=True, configuration=configuration,
        offline_transport=httpx.MockTransport(lambda request: completion(json.dumps({"rules": [valid_rule()]}), usage=False)))
    assert result["status"] == "succeeded" and result["token_usage"] is None


def test_rule_key_echo_is_redacted(configuration: smoke.SmokeConfiguration) -> None:
    rule = valid_rule()
    rule["name"] = OFFLINE_SECRET
    result = smoke.run_smoke(execute=True, configuration=configuration,
        offline_transport=httpx.MockTransport(lambda request: completion(json.dumps({"rules": [rule]}))))
    assert result["status"] == "succeeded"
    assert result["validated_rules"][0]["name"] == "[REDACTED]"
    assert OFFLINE_SECRET not in json.dumps(result) and OFFLINE_SECRET not in repr(configuration)


def test_client_rejects_second_invocation_even_after_validation_error(
    configuration: smoke.SmokeConfiguration,
) -> None:
    guard = smoke.OneRequestTransport(configuration.base_url,
        httpx.MockTransport(lambda request: completion('{"rules":[]}')))
    client = smoke.SingleRequestClient(configuration, guard)
    assert client._client is not None and client._client.max_retries == 0
    assert client.max_retries == 0 and client.timeout == 30
    messages = [{"role": "system", "content": "Extract"}, {"role": "user", "content": smoke.POLICY_TEXT}]
    try:
        with pytest.raises(smoke.ValidationError):
            client.chat_complete(messages, response_format={"type": "json_object"})
        with pytest.raises(smoke.SmokeGuardError, match="second model invocation"):
            client.chat_complete(messages, response_format={"type": "json_object"})
        assert guard.attempts == 1
    finally:
        client.close()


def test_transport_budget_is_atomic_and_blocks_all_other_endpoints(
    configuration: smoke.SmokeConfiguration,
) -> None:
    calls: list[httpx.Request] = []
    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200)
    guard = smoke.OneRequestTransport(configuration.base_url, httpx.MockTransport(handle))
    for request in [httpx.Request('GET', configuration.base_url+'models'),
                    httpx.Request('POST', 'https://example.com/v1/chat/completions')]:
        with pytest.raises(smoke.SmokeGuardError):
            guard.handle_request(request)
    assert guard.attempts == 0
    def invoke(_: int) -> bool:
        try:
            guard.handle_request(httpx.Request('POST', configuration.base_url+'chat/completions'))
            return True
        except smoke.SmokeGuardError:
            return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(invoke, range(2))) == [False, True]
    assert len(calls) == guard.attempts == 1
    guard.close()


def test_missing_nebius_credentials_never_fall_back_or_send_http(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.delenv('NEBIUS_API_KEY', raising=False)
    monkeypatch.setenv('OPENAI_API_KEY', OFFLINE_SECRET)
    result = smoke.run_smoke(execute=True)
    assert result['status'] == 'failed' and result['provider_requests'] == 0
    assert result['errors'][0]['type'] == 'guard'
    assert OFFLINE_SECRET not in json.dumps(result)


def test_explicit_cli_flag_uses_only_injected_offline_transport(
    configuration: smoke.SmokeConfiguration, monkeypatch: MonkeyPatch,
    capsys: CaptureFixture[str],
) -> None:
    original = smoke.run_smoke
    calls: list[httpx.Request] = []
    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return completion(json.dumps({"rules": [valid_rule()]}))
    def offline_run(*, execute: bool = False) -> dict[str, Any]:
        return original(execute=execute, configuration=configuration,
                        offline_transport=httpx.MockTransport(handle))
    monkeypatch.setattr(smoke, 'run_smoke', offline_run)
    assert smoke.main(['--execute-one-request']) == 0
    output = capsys.readouterr()
    assert len(calls) == 1 and json.loads(output.out)['validation'] == 'passed'
    assert output.err == '' and OFFLINE_SECRET not in output.out


def test_invalid_cli_arguments_never_echo_credentials(capsys: CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc:
        smoke.main(['--api-key', OFFLINE_SECRET])
    assert exc.value.code == 2
    output = capsys.readouterr()
    assert OFFLINE_SECRET not in output.out + output.err


@pytest.mark.parametrize('endpoint', [
    'http://api.tokenfactory.nebius.com/v1/',
    'https://example.com/v1/',
    'https://api.tokenfactory.nebius.com/v1/?api_key=hidden',
    'https://user:password@api.tokenfactory.nebius.com/v1/',
    'https://api.tokenfactory.nebius.com:8443/v1/',
])
def test_configuration_refuses_unsafe_provider_endpoint(endpoint: str) -> None:
    with pytest.raises(smoke.SmokeGuardError):
        smoke.SmokeConfiguration(model='nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B',
                                 base_url=endpoint, api_key=SecretStr(OFFLINE_SECRET))
