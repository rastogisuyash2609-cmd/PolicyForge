# Offline release evidence only. Run from any directory with the verified Python 3.11 runtime.
param([string]$Python = 'C:\Users\Suyash Rastogi\AppData\Local\Temp\policyforge-venv\Scripts\python.exe')
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$env:PYTHONPATH = Join-Path (Get-Location) 'backend'
$env:POLICYFORGE_ENABLE_LIVE_AI = 'false'
@'
import json
import os
import runpy
import socket
import sys
import time
from collections import Counter
from dataclasses import asdict
from pathlib import Path
import httpx

blocked_attempts = []
def blocked(*args, **kwargs):
    blocked_attempts.append(True)
    raise AssertionError('External network is prohibited in the deterministic benchmark.')
async def blocked_async(*args, **kwargs):
    return blocked(*args, **kwargs)
httpx.HTTPTransport.handle_request = blocked
httpx.AsyncHTTPTransport.handle_async_request = blocked_async
socket.socket.connect = blocked
socket.socket.connect_ex = blocked
os.environ['POLICYFORGE_ENABLE_LIVE_AI'] = 'false'

output = Path('benchmark/phase9c')
started = time.perf_counter()
sys.argv = ['benchmark/run_benchmark.py', '--engine-only', '--output-dir', str(output)]
runpy.run_path(sys.argv[0], run_name='__main__')
cli_elapsed = time.perf_counter() - started

from benchmark.schema import load_labeled_scenarios
from benchmark.engine_runner import EngineRunner
from policyforge.diff import _compute_coverage
from policyforge.engine import PolicyEngine
from policyforge.models import Event, Rule
from policyforge.scenarios import Scenario, run_suite
from policyforge.shrink import get_finding_signature, is_valid_journey

labeled = load_labeled_scenarios('benchmark/labeled_scenarios.json')
runner = EngineRunner()
scenarios = [Scenario(id=s.id, name=s.description, description=s.description,
    journey=[Event(event_type=e.event_type, day=e.day, payload=e.payload) for e in s.journey]) for s in labeled]
simulations = [runner.engine.run(s.journey) for s in scenarios]
suite = run_suite(runner.engine.rules, scenarios)
coverage = _compute_coverage(runner.engine.rules, scenarios, simulations)
counterexamples = []
for signature, reduced in suite.minimal_counterexamples.items():
    replay = runner.engine.run(reduced.minimal_journey)
    preserved = any(get_finding_signature(f) == signature for f in replay.findings)
    counterexamples.append({'finding_type':signature[0].value,'rule_ids':list(signature[1]),
        'original_steps':len(reduced.original_journey),'minimal_steps':len(reduced.minimal_journey),
        'shrink_engine_runs':reduced.engine_runs,'replay_preserves_signature':preserved,
        'domain_valid':is_valid_journey(reduced.minimal_journey),
        'minimal_journey':[e.model_dump(mode='json') for e in reduced.minimal_journey],
        'finding':reduced.final_finding.model_dump(mode='json')})

fixture = next(c for c in json.loads(Path('tests/fixtures/stage2/policy_cases.json').read_text()) if c['id']=='simple_refund')
simple = PolicyEngine([Rule.model_validate_json(json.dumps(r)) for r in fixture['rules']])
boundaries = []
for day in (0,30,31):
    result = simple.run([Event(event_type='ITEM_DELIVERED',day=0),Event(event_type='REFUND_REQUESTED',day=day)])
    trace = result.trace.event_traces[-1]
    boundaries.append({'day':day,'outcome':result.outcomes[-1].outcome.value,
        'resolution':trace.resolution_type,'rules_fired':trace.rules_fired,
        'findings':[f.type.value for f in result.findings]})

raw = json.loads((output/'results.json').read_text())
assert raw['baseline'] is None
results = raw['engine']['results']
summary = {'mode':'engine_only_network_blocked','provider_requests':0,
    'blocked_network_attempts':len(blocked_attempts),'labeled_cases_available':len(labeled),
    'labeled_cases_executed':len(results),'outcome_label_passed':sum(r['correct'] is True for r in results),
    'outcome_label_failed':sum(r['correct'] is False for r in results),
    'outcome_not_scored':sum(r['correct'] is None for r in results),
    'finding_counts':dict(Counter(f.type.value for r in simulations for f in r.findings)),
    'journeys_with_contradictions':sum(any(f.type.value=='CONTRADICTION' for f in r.findings) for r in simulations),
    'suite_journeys_without_findings':suite.passed_scenarios,'suite_journeys_with_findings':suite.failed_scenarios,
    'suite_finding_occurrences':suite.total_findings,'unique_finding_signatures':len(suite.deduplicated_findings),
    'counterexamples_generated':len(counterexamples),
    'counterexamples_replayed_successfully':sum(c['replay_preserves_signature'] and c['domain_valid'] for c in counterexamples),
    'counterexamples':counterexamples,'coverage':asdict(coverage),'simple_refund_boundaries':boundaries,
    'benchmark_cli_wall_seconds':round(cli_elapsed,6),
    'benchmark_plus_coverage_shrink_replay_wall_seconds':round(time.perf_counter()-started,6),
    'limitations':['Label accuracy and finding-free journeys are different metrics.',
        'Coverage counts fired rules, including subsequently suppressed rules.',
        'Finding identity is type plus sorted rule IDs; it can conflate invariant failures.',
        'Counterexamples preserve that signature; global shortestness is not established.',
        'The CLI suite has 50 labeled cases; supplemental replay/shrink runs are not new labeled cases.',
        'No live baseline or extraction-quality benchmark was run.']}
(output/'verification.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
(output/'suite.md').write_text(suite.summary_table()+'\n',encoding='utf-8')
assert not blocked_attempts
assert len(results)==len(labeled)
assert all(c['replay_preserves_signature'] and c['domain_valid'] for c in counterexamples)
assert [b['outcome'] for b in boundaries]==['ALLOW','ALLOW','DENY']
assert boundaries[-1]['rules_fired']==[] and boundaries[-1]['resolution']=='DEFAULT_DENY'
print(json.dumps({k:v for k,v in summary.items() if k not in ('counterexamples','limitations')},indent=2))
'@ | & $Python -
exit $LASTEXITCODE
