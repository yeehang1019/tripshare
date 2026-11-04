# UI correction v113

Presentation and interaction only. No changes to ledger calculations, permissions, API routes, schema or stored financial data.

- Shared text tokens (12/13/15px), minimum 44px controls, spacing, accessible notification count.
- Expenses: current-month summary, date groups, sticky headings, 20-row progressive rendering, skeletons, whole-row sheet, mobile swipe actions, filter sheet and removable chips. Existing edit/delete permission callbacks and delete confirmation remain unchanged.
- Settlement: one counterparty card in Mine, explicit receive/pay arrows and colors, deferred bill details, existing recording/reminder/batch/source controls, success check and five-second Undo that reuses existing batch reversal.
- Existing reduced-motion-aware 350ms entrance and 600ms counters retained; press updated to 120ms / .97. Sidebar/context/overlay use unblurred surfaces so a sheet cannot exceed the three-plane budget.

## Focused verification

Actual browser rendering of the production components in an isolated, interactive QA harness (synthetic memory-only data; no production writes). Expenses and Settlement, light and dark, iframe viewports 375x812 and 1280x800:

| Page | Theme | Width | Text under12px | Targets under44px | Unnamed icon buttons | Horizontal overflow | Blur planes |
|---|---|---:|---:|---:|---:|---|---:|
| Expenses | Light |375|0|0|0|No|2|
| Expenses | Light |1280|0|0|0|No|1|
| Expenses | Dark |375|0|0|0|No|2|
| Expenses | Dark |1280|0|0|0|No|1|
| Settlement (expanded) | Light |375|0|0|0|No|2|
| Settlement (expanded) | Light |1280|0|0|0|No|1|
| Settlement (expanded) | Dark |375|0|0|0|No|2|
| Settlement (expanded) | Dark |1280|0|0|0|No|1|

Whole-row sheet exposes Edit/Delete. Filter selection produces a chip that can be removed individually. Progressive list starts at20 and grows to40 when its sentinel enters view; adjacent row gap measured9px. Card expansion directly opens its existing bill table. Success/Undo UI tested with an in-memory transport stub, via pointer and keyboard: Undo calls the existing undoPaymentBatch action and shows the reversed receipt. This is an interaction test, not a repeated financial regression.

Already accepted Trip/History/Settings/Tools/Pocket Ledger and ledger arithmetic were not regression-tested. Synthetic harness files live only in ignored local QA directories and are not published. Physical device performance and real OS reduced-motion emulation were not measured; reduced-motion CSS/WAAPI guards were inspected.
