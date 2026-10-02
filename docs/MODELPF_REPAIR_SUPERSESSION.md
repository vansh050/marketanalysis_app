# Fresh rebalance supersedes outdated Repair

Policy and implementation update: 6 September 2026.

A newer advisor model rebalance or a newer authorised customer investment instruction replaces the old unfilled Repair basket. Customers should not execute outdated trades before calculating the current allocation. Changing only a displayed `toExecute` status does not establish either event.

## Decision order

1. Reconcile broker positions, model ownership, cash and previous fills. Calculate retains the account-wide reconciliation barrier.
2. Live/open orders, partial fills with an active remainder, and unknown broker outcomes take priority. Wait for broker confirmation; do not submit a replacement order or clear their history.
3. When the prior orders are terminal and the model revision or authorised funding instruction is newer, retire eligible unconsumed Repair plans and offer one fresh Calculate. The customer reviews and accepts the new basket before placement.
4. When allocation and funding intent are unchanged, continue exact Repair for genuine approved unfilled quantities.

Already-filled quantities remain in holdings and execution history. Fresh Calculate uses reconciled holdings and attributable cash, the latest model, the authorised capital instruction, and 100% estimated sale proceeds. It does not add old failed quantities to a new basket. A broker-account deposit alone is not automatically an instruction to allocate that money to this model.

## Implementation

`repair_supersession.py` compares the latest advisor `model_Id` with the source execution/plan identity. Legacy records without matching identities require a provably newer publication timestamp; missing evidence does not invent a new allocation. Existing capital-intent comparison handles top-ups, changed full targets and explicit newer instructions.

Repair discovery returns `requiresFreshRebalance`, no executable old `failedTrades`, and `MODEL_REBALANCE_CHANGED` or `CAPITAL_INTENT_CHANGED` only when eligible. Unknown/live broker evidence prevents retirement. Only unconsumed Repair plans in the same customer, broker and execution scope are marked superseded; historical fills are retained. Previously consumed/partial plans remain historical evidence and their eligibility is rechecked before any new Repair placement.

Frozen Repair placement repeats the check. A stale tab receives a fresh-calculation response without orders when its instruction has changed; live orders receive a pending response first. The web handoff likewise prioritises pending broker confirmation, independent of the Repair freeze flag. App source supports the fresh-calculation response; app OTA publication is separate and was explicitly excluded from this release.

## Simulation interpretation

A historical Partial/Repair card is not proof that the customer must finish its old basket. With a newer model or funding instruction, it can resolve into fresh Calculate after reconciliation. A fresh-basket spreadsheet is still conditional on verified holdings, cash and absence of unresolved broker orders. Quantity fitting (for example, 7 planned shares becoming 5 affordable shares) happens in Calculate; the two omitted shares are not failed orders.

No manual customer holdings/cash changes, bulk status resets, migrations or orders are part of this release. New runtime transitions use the existing scoped plan writer and reconciliation workflow.

## Validation

Pure tests cover new/same model identities, legacy dates, ordering, invalid history and live/unknown evidence. Tests execute the actual async Repair method with in-memory records for changed-model, changed-capital, unchanged, open-order and unavailable-broker cases, verifying that prior fills remain unchanged and only eligible unconsumed plans are retired. Placement and UI routing tests enforce pending-before-fresh precedence.
