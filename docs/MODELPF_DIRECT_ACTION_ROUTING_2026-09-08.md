# Direct model-portfolio action review — 8 September 2026

Source: `a2cadc0`. Regression checks: 61 passing, including 20 real
handler-level routing checks with mocked broker responses.

Primary actions now check the broker session, refresh the selected model's
Repair evidence, and open the required review directly:

- Remaining approved orders: exact Repair review.
- Saved allocation: reopen that plan; do not call Calculate.
- Verified new/fresh allocation: Calculate then basket review, without the
  obligatory full holdings screen.
- Ownership recovery: retain the existing holdings resolution screen.
- Unknown evidence/working orders: verify or show status; do not mint a new plan.
- Completed recommendation: no new review or reconnect journey.

Connection events and updated credentials reverify a pending selection before
resuming. A restart/unmount discards this in-memory navigation intent; another
tap verifies again. Opening a review never automatically dispatches orders.
Pending work in another model does not block this model's verified action.

Direct calculation carries explicit model identity and uses live broker
credentials/funds, avoiding stale parent selection and DummyBroker fallback.
Account-recovery blockers and saved allocations survive response normalization.
The saved-plan trade-list setter is wired through the parent in all three apps.

This navigation release does not retire the backend holdings-recovery
`fresh_calculate_required` flag. The separate evidence-based completion fix
must be verified independently. Explicit holdings editing and manual/no-broker
flows remain available.

## Verified Production OTA

| Platform | Production | Native target | Signed Staging | Package SHA-256 |
| --- | --- | --- | --- | --- |
| Android | v28 | 3.9.119 | v6 | `24e001cf4f6ac299b13c3caca1c093c71e20989dae69c115e242490235ba224d` |
| iOS | v9 | 2.4 | v5 | `5c0baaafb7a8dc9ed61747942c03bedc835c2e7af8eadc7542a51f1096b0c63a` |

Downloaded Staging packages passed RS256 signature verification and their signed
content hashes matched package metadata. Production was then checked against
those exact hashes: enabled, optional, 100% rollout. Existing launch/restart
installation policy is unchanged; publication does not prove installed uptake.
Earlier routing packages stayed in Staging and were not promoted; final builds
include the selected-model pending gate. Build output used isolated temporary
directories and the existing large-onboarding-asset advisory override.
No native files/dependencies changed; no real-device broker order was tested.
