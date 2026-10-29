# PolicyForge Benchmark Report

*Generated: 2026-10-29T04:15:38Z*

> All numbers are computed from real simulation runs and (when available) > live LLM API calls. Nothing is fabricated or hardcoded.

## Scenario Suite

| Metric | Value |
| :--- | ---: |
| Total labeled scenarios | 50 |
| Scenarios with ALLOW expectation | 29 |
| Scenarios with DENY expectation | 20 |
| Scenarios expecting POLICY_GAP finding | 1 |
| Scenarios expecting CONTRADICTION finding | 1 |

## Outcome Accuracy

| Metric | PolicyForge Engine |
| :--- | ---: |
| Scenarios evaluated | 50 |
| Correct outcomes | 49 |
| Outcome accuracy | 100.0% |
| Precision (ALLOW) | 100.0% |
| Recall (ALLOW) | 100.0% |
| F1 (ALLOW) | 100.0% |
| Precision (DENY) | 100.0% |
| Recall (DENY) | 100.0% |
| F1 (DENY) | 100.0% |
| Consistency rate | 100.0% |

## Finding Detection (PolicyForge Engine)

The baseline cannot emit structured findings; all finding metrics are engine-only.

| Finding Type | TP | FP | FN | Precision | Recall | F1 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| `CONTRADICTION` | 1 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `POLICY_GAP` | 1 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| `AMBIGUITY` | 0 | 0 | 0 | 0.0% | 0.0% | 0.0% |
| `INVARIANT_VIOLATION` | 1 | 0 | 0 | 100.0% | 100.0% | 100.0% |

## Performance

| Metric | PolicyForge Engine |
| :--- | ---: |
| Avg latency (ms) | 0.2 |
| p95 latency (ms) | 0.5 |
| Total LLM tokens | 0 |
| Avg tokens / scenario | 0.0 |

## Per-Scenario Engine Results

| ID | Expected | Engine | Correct | Findings | Latency (ms) |
| :--- | :---: | :---: | :---: | :--- | ---: |
| `ls_001` | `ALLOW` | `ALLOW` | ✓ | none | 0.31 |
| `ls_002` | `DENY` | `DENY` | ✓ | none | 0.34 |
| `ls_003` | `ALLOW` | `ALLOW` | ✓ | none | 0.12 |
| `ls_004` | `DENY` | `DENY` | ✓ | none | 0.14 |
| `ls_005` | `ALLOW` | `ALLOW` | ✓ | none | 0.14 |
| `ls_006` | `DENY` | `DENY` | ✓ | none | 0.24 |
| `ls_007` | `ALLOW` | `ALLOW` | ✓ | none | 0.23 |
| `ls_008` | `DENY` | `DENY` | ✓ | none | 0.15 |
| `ls_009` | `DENY` | `DENY` | ✓ | CONTRADICTION | 0.36 |
| `ls_010` | `DENY` | `DENY` | ✓ | none | 0.18 |
| `ls_011` | `ALLOW` | `ALLOW` | ✓ | none | 0.17 |
| `ls_012` | `DENY` | `DENY` | ✓ | none | 0.15 |
| `ls_013` | `DENY` | `DENY` | ✓ | none | 0.12 |
| `ls_014` | `DENY` | `DENY` | ✓ | none | 0.20 |
| `ls_015` | `DENY` | `DENY` | ✓ | none | 0.15 |
| `ls_016` | `ALLOW` | `ALLOW` | ✓ | none | 0.13 |
| `ls_017` | `DENY` | `DENY` | ✓ | none | 0.15 |
| `ls_018` | `ALLOW` | `ALLOW` | ✓ | none | 0.14 |
| `ls_019` | `ALLOW` | `ALLOW` | ✓ | none | 0.11 |
| `ls_020` | `ALLOW` | `ALLOW` | ✓ | none | 0.09 |
| `ls_021` | `ALLOW` | `ALLOW` | ✓ | none | 0.13 |
| `ls_022` | `ALLOW` | `ALLOW` | ✓ | none | 0.20 |
| `ls_023` | `ALLOW` | `ALLOW` | ✓ | none | 0.14 |
| `ls_024` | `DENY` | `DENY` | ✓ | POLICY_GAP | 0.09 |
| `ls_025` | `DENY` | `DENY` | ✓ | none | 0.17 |
| `ls_026` | `DENY` | `DENY` | ✓ | none | 0.11 |
| `ls_027` | `DENY` | `DENY` | ✓ | none | 0.11 |
| `ls_028` | `DENY` | `DENY` | ✓ | none | 0.09 |
| `ls_029` | `ALLOW` | `ALLOW` | ✓ | none | 0.63 |
| `ls_030` | `ALLOW` | `ALLOW` | ✓ | none | 0.28 |
| `ls_031` | `DENY` | `DENY` | ✓ | none | 0.30 |
| `ls_032` | `ALLOW` | `ALLOW` | ✓ | none | 0.36 |
| `ls_033` | `ALLOW` | `ALLOW` | ✓ | none | 0.41 |
| `ls_034` | `ALLOW` | `ALLOW` | ✓ | none | 0.55 |
| `ls_035` | `ALLOW` | `ALLOW` | ✓ | none | 0.30 |
| `ls_036` | `DENY` | `DENY` | ✓ | none | 0.36 |
| `ls_037` | `DENY` | `DENY` | ✓ | none | 0.30 |
| `ls_038` | `ALLOW` | `ALLOW` | ✓ | none | 0.57 |
| `ls_039` | `ALLOW` | `ALLOW` | ✓ | INVARIANT_VIOLATION | 0.27 |
| `ls_040` | `ALLOW` | `ALLOW` | ✓ | none | 0.13 |
| `ls_041` | `ALLOW` | `ALLOW` | ✓ | none | 0.09 |
| `ls_042` | `ALLOW` | `ALLOW` | ✓ | none | 0.13 |
| `ls_043` | `ALLOW` | `ALLOW` | ✓ | none | 0.10 |
| `ls_044` | `ALLOW` | `ALLOW` | ✓ | none | 0.12 |
| `ls_045` | `ALLOW` | `ALLOW` | ✓ | none | 0.10 |
| `ls_046` | `ALLOW` | `ALLOW` | ✓ | none | 0.10 |
| `ls_047` | `ALLOW` | `ALLOW` | ✓ | none | 0.12 |
| `ls_048` | `ALLOW` | `ALLOW` | ✓ | none | 0.21 |
| `ls_049` | `—` | `—` | — | none | 0.06 |
| `ls_050` | `DENY` | `DENY` | ✓ | none | 0.11 |

## ✓ No Engine Disagreements

All labeled scenarios matched the engine's deterministic outcome.
