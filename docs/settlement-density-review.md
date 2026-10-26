# Settlement density — 26 October 2026

The user identified three oversized areas: the linked Trip/across-groups overview, repeated debtor cards, and sync/Money actions launchers. The change is bounded to layout, disclosure defaults and shorter labels.

Money's linked Trip view keeps its existing Open Trip callback in a small link row. Across my groups becomes a native, initially closed disclosure. Its per-currency pay/receive totals and count of excluded owner groups remain in the visible summary; the original detailed list, member-binding explanation and currency/no-offset notes remain inside. The current group's hero is smaller, with the same WhatsApp action (short Share text on mobile, explicit accessible name).

The payment workspace keeps all checkboxes, bill filters, partial states, Record/Remind actions and batch dialogs. Default rows have a light separator rather than large cards. Calculation remains the same current-only data, under a short Details label with the full accessible pair name. Desktop puts identity, amount and actions on one row; mobile keeps names/amount on the first line and touch controls below. The existing disclosure expands the same source details. No allocation, repayment, API, permission, database, network or monetary transformation changed.

SaveStatus is a small inline status with MYT confirmation time; failure/offline states retain a visible warning surface, retry and problem-reference controls. Money actions is still the same guarded dialog, now labeled Money tools with a smaller launcher. All three light/dark themes use existing tokens; scoped selectors override the older card styles without changing other expense/planner cards.

- KEEP: amounts, source-bound recording, history/Undo, batch conflict and retry behavior, personal/group boundaries, original creditor netting and existing Trip/Money navigation.
- CHANGE NOW: collapsed cross-group overview, compact linked Trip/status/tools surfaces, smaller hero and payment list rows. Do not hide incomplete-total scope information.
- IMPROVE LATER: physical phone/font scaling/keyboard acceptance remains unverified. Existing global CSS has accumulated overlapping theme rules; this change scopes its overrides, while a measured stylesheet consolidation is separate work. Backend ledger replay remains the existing performance bottleneck; native disclosures do not add calculations or requests.
- DO NOT ADD: deleted functionality, new financial states, a theme reset, new navigation, automatic payments or another accounting calculation.

63 focused settlement/experience/workflow checks passed, with TypeScript and whitespace checks. Final production build/Worker smoke are packaging gates. Browser fixture QA with the real root visual/light selectors confirmed approximately 55px default desktop payment rows, approximately 113px two-line phone rows at a 390px embedded viewport, a closed cross-group disclosure and no horizontal page overflow. Details remained expandable and showed the same amounts. Temporary invented fixture routes were removed before publication. No signed-in production mutation, live repayment, physical handset or native print action was tested.
