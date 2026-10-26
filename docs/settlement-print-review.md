# Print summary review — 26 October 2026

KEEP: canonical integer calculate/ledger results, pairwise creditor relationships, bills, payment history, existing export permissions and CSV. No live data writes, schema, dependency, secret or audience change.

CHANGE NOW: final transfer summary, member consumption/supplier-payment totals, Excel-style item matrices with one person per row, and original pair obligations/offsets/applied payments/remaining amounts. Actual item names supply Food/Add-on columns; no guessed categories. Original FX item currency remains labeled separately from settlement totals. Zero adjustments are omitted; long matrices continue five item columns at a time without truncation. MYT timestamp, A4 print styles, aligned amounts and escaped HTML are provided. Mismatched/duplicate transfer suggestions fail with a visible refresh message.

Privacy: Mine filters all sections to the selected member and their related pairs. Personal-only exports use the existing server-authorized projection, without revealing another member's full bill. Reports exclude private bank details, credentials and session links. The file is a static local snapshot; no anonymous financial hosting or automatic sharing is introduced.

48 focused print/experience/settlement SSR checks passed; new tests cover canonical numbers, partial repayment, source-deletion review, personal isolation, escaping, MYT date, FX labels and continuation. TypeScript and whitespace checks passed. Production build is the packaging gate. Browser inspection of a temporary fictitious statement verified hierarchy and amount data; the native print preview did not appear in the managed browser. The fixture was removed before packaging. No actual printer, saved PDF, mobile download, or live financial transaction is claimed.

IMPROVE LATER: actual printer/PDF pagination and handset download acceptance. Whole-group HTML creation and repeated bill calculation are the first likely memory/latency bottlenecks for very large reports; measure before adding report infrastructure.

DO NOT ADD: a second financial engine, guessed food classifications, rerouted payees, fabricated payments, new permissions, or unrelated redesign.
