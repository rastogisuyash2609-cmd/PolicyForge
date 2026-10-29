# Owner-operated release checklist

Preparation is committed locally. Nothing is deployed, purchased, pushed or merged.

- [ ] Review the exact commit and `git status`; preserve existing work/history.
- [ ] Obtain repository-owner permission for GitHub integration and choose licensing
      before claiming an open-source grant. No LICENSE has been invented.
- [ ] Personally push the reviewed branch, without force; merge only if desired/approved.
- [ ] Run the prepared Linux offline CI and inspect every job. Windows success alone
      does not establish Linux execution. Keep all provider secrets out of CI.
- [ ] Repeat full dependency audits; release only with reviewed results.
- [ ] Follow DEPLOYMENT_GUIDE.md manually; approve hosting costs personally.
- [ ] Static export uses actual HTTPS API origin; exact per-route rewrites verified.
- [ ] API runs from repository root, Python 3.11, one worker, no reload, no debug logs.
- [ ] Public demo guard ON, live AI OFF, provider/workspace keys omitted.
- [ ] Exact frontend CORS, HTTPS, private persistent volume and backup verified.
- [ ] Public health/default fixtures, activation, simulation, Stress, Issues replay,
      What-if and Markdown/JSON reports verified on actual hosted URLs.
- [ ] Compile returns 503 without inference; untrusted CORS origin receives no allow header.
- [ ] Do not claim ADV-01 success: historical result remains UNCONFIRMED.
- [ ] Record resolved runtimes, release SHA, actual URLs, limits and audit date.
- [ ] Check billing alerts/usage, manual rollback procedure and judge instructions.

Initial public release is a deterministic demo. A real simple-refund compilation
has prior evidence; advanced live cases are not claimed to have passed. A live
test requires separate explicit authorization, never an automatic release check.
