"""Offline checks for deterministic backend configuration loading."""

import os
from pathlib import Path

from pytest import MonkeyPatch

from policyforge.llm import ENV_FILE, LLMClient, load_backend_environment


def test_environment_file_is_checkout_root() -> None:
    assert ENV_FILE == Path(__file__).resolve().parents[1] / ".env"


def test_dotenv_loads_from_explicit_path_outside_working_directory(
    tmp_path: Path, monkeypatch: MonkeyPatch
) -> None:
    settings = tmp_path / "local.env"
    settings.write_text("NEBIUS_MODEL=file-model\n", encoding="utf-8")
    other = tmp_path / "other"
    other.mkdir()
    monkeypatch.chdir(other)
    monkeypatch.delenv("NEBIUS_MODEL", raising=False)
    assert load_backend_environment(settings)
    assert os.environ["NEBIUS_MODEL"] == "file-model"


def test_inherited_environment_wins_over_file(
    tmp_path: Path, monkeypatch: MonkeyPatch
) -> None:
    settings = tmp_path / "local.env"
    settings.write_text("NEBIUS_MODEL=file-model\n", encoding="utf-8")
    monkeypatch.setenv("NEBIUS_MODEL", "inherited-model")
    assert load_backend_environment(settings)
    assert os.environ["NEBIUS_MODEL"] == "inherited-model"


def test_default_settings_do_not_create_a_provider_client(
    monkeypatch: MonkeyPatch,
) -> None:
    for name in (
        "NEBIUS_API_KEY", "OPENAI_API_KEY", "NEBIUS_MODEL", "OPENAI_MODEL",
        "NEBIUS_BASE_URL", "OPENAI_BASE_URL", "MAX_RETRIES",
    ):
        monkeypatch.delenv(name, raising=False)
    client = LLMClient()
    assert client.api_key == ""
    assert client._client is None
    assert client.model == "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
    assert client.base_url == "https://api.tokenfactory.nebius.com/v1/"
    assert client.max_retries == 0
