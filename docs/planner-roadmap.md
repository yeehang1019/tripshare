# Trip / Event Planner review — 2026-10-19

Reviewed official product pages, not anonymous demos or third-party feature lists:

- Wanderlog: https://wanderlog.com/plan-a-trip — mapped day/category itinerary, route distance and travel times, offline itinerary.
- TripIt: https://www.tripit.com/web/free — consolidated reservations, travel documents, point-to-point transport, calendar sync.
- Partiful: https://help.partiful.com/en-us/articles/15525422-can-i-poll-or-survey-my-guests — date/time votes (Yes / No / Maybe), RSVP conversion, host-only RSVP questionnaires.
- Spond: https://www.spond.com/en-us/events/ — meeting time, attendance confirmation, waitlists, repeating events and time polls.

The recommendations below are our fit assessment for a private group of friends, not claims that every reference app implements the exact proposed behavior. They are a proposed next phase; they are not shipped as part of the approved A–D work.

| Priority | Suggested addition | Concrete example | Existing capability and boundary |
| --- | --- | --- | --- |
| Next | Availability poll and RSVP | Friends vote Sat 10am / Sun 2pm; owner chooses and creates the final event | Current attendee selection is organizer-entered. Voting must not grant planning/admin access or automatically add a bill. |
| Next | Travel time and buffer between stops | Lunch 12:30, drive 40 minutes, flight check-in 14:00; show a tight connection | Existing warnings use explicitly entered overlapping times only. Begin with entered travel durations and map links; don't imply live traffic without a provider. |
| Next | Calendar export | Export this trip or one day as .ics, omitting cancelled plans | Start with manual export. This is not automatic calendar sync. Explicit timezone handling is required for flights and multi-country trips. |
| Next | Reusable day / trip / event plan | Copy a Bangkok weekend or dinner event, review dates and attendees once | Single-plan duplicate already exists. Never copy actual bills, repayment history, access grants, or private payout details. |
| Soon | Today / Next travel view | “Leave hotel at 09:30”, confirmation number and next destination in one compact screen | Current planner already has upcoming plans and day selection. Improve prioritization, not another long dashboard. |
| Soon | Timezones per flight leg | Depart KL 20:00 MYT, arrive Tokyo 04:00 JST (+1 day) | Current times are entered local times; no inferred timezone conversion. Store explicit IANA timezones and clarify date boundaries. |
| Soon | Private participation preferences | Dietary restrictions visible only to the organizer | Shared traveller roster is not a suitable store for private answers. Requires a separate permission-checked projection. |
| Soon | Attendance with capacity | Eight car seats, six confirmed, two pending; optional waiting list | Capacity and RSVP do not determine financial split automatically. Organizer reviews the actual bill participants. |
| Later | Repeat event series | Badminton every Friday, with “this date only” changes | Current Quick Picks repeat expenses manually; event recurrence is separate. No scheduled charges or automatic expenses. |
| Later | Complete offline travel pack | Download itinerary plus selected uploaded booking PDFs before leaving | Current handbook is already offline HTML; uploaded private documents are not bundled. Let the user choose files explicitly. |
| Later | Per-plan comments and decision log | Discuss the hotel under its booking, show the final organizer decision | Existing audit history records changes; it isn't a discussion thread. Keep comments scoped to authorized trip members. |
| Later | Plan alternatives without clutter | Wet-weather backup for the same afternoon; one chosen itinerary | Existing Idea / Booked / Cancelled states remain. Avoid copying alternatives into actual spending. |

Recommended order: availability + RSVP, travel buffers, calendar export, whole-day/trip templates. Design changes should be shown as small selectable samples before implementation, as requested by the owner.

Keep Trip and Money independently navigable. Trip estimates and RSVP choices do not post ledger records. Only saved expenses contribute consumption. Supplier bill payments update the same expense; repayments between friends reduce balances without adding consumption.

Do not add AI, receipt OCR, voice parsing, full inbox access, commercial ticketing, CRM, or paid routing dependencies by default. Email import is a real competitor feature, but the owner's preference for predictable templates and low maintenance makes it lower priority here.
