# PolicyForge Scenario Suite Execution Summary

- **Total Scenarios Evaluated**: 50
- **Passed Scenarios**: 47
- **Failed Scenarios (with Findings)**: 3
- **Total Diagnostic Findings**: 3
- **Unique Finding Signatures**: 3

| Finding Type | Severity | Rule IDs | Original Steps | Minimal Steps | Minimal Journey |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `CONTRADICTION` | `HIGH` | `rule_refund_after_replacement_cancelled, rule_refund_past_deadline` | 4 | **4** | `ITEM_DELIVERED@d0 -> REPLACEMENT_REQUESTED@d0 -> REPLACEMENT_CANCELLED@d0 -> REFUND_REQUESTED@d31` |
| `POLICY_GAP` | `MEDIUM` | `None` | 2 | **1** | `REPLACEMENT_REQUESTED@d0` |
| `INVARIANT_VIOLATION` | `CRITICAL` | `None` | 4 | **1** | `REFUND_COMPLETED@d0` |
