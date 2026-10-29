# Deterministic fixture verification only. Never enables live AI or invokes a model.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
@'
import json
import math
import os
import socket
from pathlib import Path

network_attempts = 0
def blocked(*args: object, **kwargs: object) -> None:
    global network_attempts
    network_attempts += 1
    raise AssertionError('Network is forbidden during offline preparation.')

socket.socket.connect = blocked
socket.socket.connect_ex = blocked
socket.create_connection = blocked
os.environ['POLICYFORGE_ENABLE_LIVE_AI'] = 'false'

from policyforge.compiler import check_source_grounding, _build_system_prompt
from policyforge.engine import PolicyEngine
from policyforge.detectors import create_default_invariant_registry
from policyforge.live_compile import PolicyEnvelope
from policyforge.models import Event, FindingType
from policyforge.scenarios import validate_scenario
from policyforge.shrink import get_finding_signature, is_valid_journey, shrink_journey

root = Path.cwd()
cases = json.loads((root / 'tests/fixtures/advanced_live/policy_cases.json').read_text(encoding='utf-8'))
report = {'origin': 'Synthetic offline fixtures, NOT real Nemotron responses.',
          'max_output_tokens':1536, 'live_provider_requests':0, 'cases':[]}
for case in cases:
    compact = json.dumps({'rules':case['rules']}, separators=(',',':'))
    entry = {'test_id':case['id'], 'compact_fixture_json_characters':len(compact),
             'rough_json_only_token_range':[math.ceil(len(compact)/4), math.ceil(len(compact)/3)],
             'token_estimate_warning':'Character heuristic, not Nemotron tokenizer; excludes reasoning/formatting.',
             'compiler_prompt_characters':len(_build_system_prompt()), 'checks':[]}
    if not case['rules']:
        try:
            PolicyEnvelope.model_validate_json(compact)
        except ValueError:
            entry['expected_local_rejection'] = True
        else:
            raise AssertionError('Ambiguous fixture must be rejected.')
        report['cases'].append(entry)
        continue
    rules = PolicyEnvelope.model_validate_json(compact).rules
    assert all(check_source_grounding(r.source.verbatim_sentence, case['document_text'])
               and r.source.doc_name == case['doc_name'] for r in rules)
    engine = PolicyEngine(rules, invariant_registry=create_default_invariant_registry())
    for check in case['checks']:
        assert validate_scenario(check['journey']) == (True, None)
        journey = [Event.model_validate(e) for e in check['journey']]
        assert is_valid_journey(journey)
        result = engine.run(journey)
        outcome = result.outcomes[-1]
        assert outcome.outcome.value == check['outcome']
        assert outcome.resolution_type == check['resolution']
        assert [f.type.value for f in outcome.findings] == check['final_findings']
        entry['checks'].append({'check_id':check['id'],'outcome':outcome.outcome.value,
                               'resolution':outcome.resolution_type,
                               'final_findings':[f.type.value for f in outcome.findings],
                               'all_journey_findings':[f.model_dump(mode='json') for f in result.findings]})
        if case['id'] == 'ADV-06' and check['id'] == 'damaged_refund_10':
            finding = next(f for f in result.findings if f.type == FindingType.CONTRADICTION)
            shrunk = shrink_journey(engine, journey, get_finding_signature(finding))
            replay = engine.run(shrunk.minimal_journey)
            assert is_valid_journey(shrunk.minimal_journey)
            assert any(get_finding_signature(f) == get_finding_signature(finding) for f in replay.findings)
            report['complex_counterexample'] = {
                'original_journey':check['journey'],
                'minimal_journey':[e.model_dump(mode='json') for e in shrunk.minimal_journey],
                'shrink_engine_runs':shrunk.engine_runs,
                'signature':[finding.type.value,sorted(finding.rule_ids)],
                'replay':replay.model_dump(mode='json')}
    report['cases'].append(entry)
assert network_attempts == 0
report['network_attempts'] = network_attempts
report['total_deterministic_checks'] = sum(len(c['checks']) for c in report['cases'])
target = root / 'docs/ADVANCED_OFFLINE_PREFLIGHT.json'
target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'cases':len(cases),'deterministic_checks':report['total_deterministic_checks'],
                  'network_attempts':network_attempts,'provider_requests':0}))
'@ | & 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe' -
if ($LASTEXITCODE -ne 0) { throw 'Offline preparation failed.' }
