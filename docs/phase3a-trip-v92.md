# Trip outer navigation — v92

User accepted v91 after independent 375×812 and1280×800 checks. v92 extends only the approved Trip navigation, retaining v91 as rollback.

## Changes

- `lib/trip-navigation.ts`: permission-filtered destinations and URL routes, legacy simple/activity compatibility.
- `app/trip-navigation.tsx`: five primary entries, accessible current-page indication and permission-filtered More.
- `app/trip-app.tsx`: same-group Money links, Trip URL initialization/refresh/history under existing dirty guard; Trip tools moved to its More destination. Existing Itinerary day/booking modes unchanged.
- `app/workspace-design.tsx`: Trip sidebar uses the same five destinations and group picker. Reuses scoped v91 240px sidebar/mobile safe-area styles.
- `app/space-navigation.tsx`: recognizes secondary Trip destinations without altering roles.
- `tests/trip-navigation.test.mjs`: route roundtrips, legacy links, forbidden destinations and rendered navigation.

No database/schema/financial calculation changes. No data edits or messages. Dashboard's five inner tabs retained.

## Fixed monetary snapshot

The historical KL House snapshot remains food20Oct1640sen, toll25Sep0, pair offset32974 each way, ET→YH1640sen. Current live data may legitimately differ after user payments; regression uses the approved fixed fixture.

## Deferred, explicitly approved backlog

3b: add System lighting as default; explicit user lighting choice takes precedence. Submit the site-wide copy rewrite table separately for review before3b.

3c: mobile header <=160px; move New Trip/Daily Group into group switcher menu; compact Trip/Money segmented control. No header restructuring in v92.

## Verification limit

Browser exposes no viewport resize/device emulation capability. Real live screenshots will be recorded at the browser's actual dimensions, never labelled375×812 or1280×800 unless those dimensions were observed. Static rendering/unit checks do not replace mobile device QA.

## Engineering review

KEEP: original roles, personal isolation, shared links, editor recovery, accounting, Money navigation and inner tabs.
CHANGE NOW: approved Trip outer destinations and More grouping.
IMPROVE LATER: System lighting and header changes in their assigned phases; copy approval before3b.
DO NOT ADD: schema migrations, duplicated Money bills, new permissions, financial logic changes or unrelated redesign.
