# Holdings confirmation safety — 2026-09-06

A confirmation screen could resubmit stale unedited rows with an intentional edit, replacing a newer reconciliation/backfill without a broker execution. This is a shared frontend/backend contract defect, not broker-specific.

GET latest portfolio now returns holdings_version. PUT confirmation is read-only. Explicit edits require that exact source version; missing/stale versions return HTTP 409 HOLDINGS_CHANGED. The source history is compared atomically when saving. Book and capital projection publish in one transaction under the account lease; unaccepted previews are superseded. Accepted/executing plans block editing. Existing execution evidence and book metadata are retained when quantities/prices are edited.

All three web and native holdings modals fetch the broker-scoped current book, including Edit entry. They pass the source version and explicit edit/confirm intent, clear old transient edit markers and do not populate holdings from rejected order attempts. Parent confirmation calls explicitly declare confirm intent.

Native changes are source-only pending a future release: NO OTA. Installed apps can still confirm ordinary screens without mutating holdings. Legacy explicit edits without a version are rejected; use the updated website to edit until the native release.

Audit: today's retained Markup confirmation snapshots identify one affected customer, Shikha on Definedge, with three confirmation writes. A LAURUSLABS edit carried stale APARINDS/M&MFIN/RADICO rows. A later confirmation already restored 1/42/3, with LAURUSLABS 8. The two reported obsolete previews are superseded. Do not replay a quantity backfill over that corrected current snapshot. This audit does not clear unrelated historical reconciliation exceptions.
