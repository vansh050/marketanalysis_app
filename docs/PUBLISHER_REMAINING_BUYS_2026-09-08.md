# Publisher remaining-order recovery — 8 September 2026

After eight sells and nine buys completed in a 20-leg attempt, three absent buys
were incorrectly labelled WAITING_FOR_SELLS. The shared backend now scopes broker
orders to the exact attempt and reports canonical NOT_OBSERVED legs separately.
The app displays these as NOT SENT, shows verification as VERIFYING WITH BROKER,
and explains that the portfolio must refresh to review verified remaining work.
No order is automatically submitted by this change.

This patch is based on the latest release branch including today's per-batch
Publisher authorization, selected-model review routing, recovered allocation
review, foreground refresh and backend-owned completion fixes. It changes no
native files or dependencies. Backend commits: 66e96ba (Node), b6f96310c,
00f7cb8f1, 0b311c57e (Python).

Validation: order status/label and rebalance-review regression suites pass;
check-publisher-completion-authority.cjs passes. Production bundling is tracked
in the incident report. No on-device broker transaction was performed.

OTA publication is pending: this workstation has no Revopush login or signing
private keys, and the configured GitHub ota-release environment is unavailable.
Do not describe this source commit as an installed or published OTA release.
