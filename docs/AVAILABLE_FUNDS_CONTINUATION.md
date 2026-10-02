# Available funds continuation

The advice modal, portfolio review modal and navigation review all offer
**Continue with available funds**. The existing tenant-aware Calculate request
receives `continueWithAvailableFunds: true`, `forceRefresh: true`, and
`userFund: "0"`. This is not a capital instruction: it does not call
`reduce-to-funded`, change the saved investment target, cancel remaining
funding authorization or place orders.

A ₹10 lakh target therefore stays ₹10 lakh when only ₹6,89,370 can fund this
calculation. Review shows target, current calculation budget and remaining
funding. The server's `fundingContinuation` carries those values. Its selected
flag clears the legacy funding prompt only alongside a nonblocking EXECUTE
action; all broker, ownership, freshness and frozen-plan checks still apply.
The customer separately accepts the refreshed basket. Retry after adding funds
is a fresh broker read, without replaying the continuation choice automatically.

The existing exact funding-pending legs remain unchanged. This update does not
invent a full-target stock basket when Calculate returned only affordable legs.
When live available funds are zero, the app may offer an explicit review and
attempt of the BUY basket, but it must never offer **Update total investment to
₹0** or imply that continuing mutates the saved target. Funding-continuation
and funding-consent parity tests cover all three review entry points, request
semantics, refusal paths, and the forbidden zero-target copy.

## Release-boundary invariant

The source-level behavior is not sufficient if an older OTA can replace it.
Android 3.9.156 contained the correct embedded implementation, but enabled
Production OTA v93 targeted `>=3.9.129` and restored the older zero-target UI
after launch. From 3.9.157 onward, Android clears retained OTA packages on a
native version transition and downloads only exact-version OTA packages. Every
release must audit enabled Revopush targets and inspect the final embedded
bundle for both the positive continuation action and the forbidden legacy copy.

## Implementation review

Reviewed the three review surfaces and their parent callbacks. Continuation
preserves tenant headers and broker credentials, refreshes live broker evidence,
and returns a replacement basket rather than invoking execution. The advice
callback explicitly requests direct review so a continuation cannot fall into
the unrelated Repair-routing branch. The two modal execution guards reject the
old plan after a continuation attempt until a different frozen plan arrives;
the navigation review clears acceptance and disables execution during loading.
Server refusals keep priority over the legacy funding-consent display. No change
to allocation math, capital authorization settlement, or frozen Repair sizing.
This is an implementation review, not an independent architect sign-off.
