# UniRadar delivery outcomes

Existing unrelated application outcomes remain complete; all modified/new requirements remain open until implemented and checked.

## 1. Mandatory post-registration onboarding
- [x] After registration, show a polished, user-friendly, multi-step onboarding form that collects full name, home campus (Rabat or Ben Guerir), school or college, interests (Open Source, Artificial Intelligence, Low-Level Systems, Competitive Programming, and the ability to add custom interests), and a weekly schedule. Validate all required answers and require users to complete onboarding before granting access to the main dashboard. Allow days with no commitments to remain empty. Match the existing UniRadar design system and use #FF6A00 brand accents.
- [x] Generate a unique student ID for every user and save onboarding answers in the existing database, linked to their authenticated account.
- [x] Integrate this flow with the current authentication, session, database, routing and UI. Do not recreate the app, replace its tech stack, remove working features, or destroy existing user/session/profile data.

## 2. Weekly unavailability calendar
- [x] During sign-up onboarding display all seven days, Monday to Sunday, in a clear calendar-style interface with time slots and a time axis. Allow students to select or add multiple unavailable time blocks per day. Each block has start time, end time and optional activity name (for example Lectures, Labs, Studying, Personal Commitments). Support the example Monday 08:00–12:00 Lectures and 14:00–16:00 Labs; allow a different schedule per day, including days with no commitments.
- [x] Let students add, edit and delete time blocks easily. Prevent invalid time ranges and clearly handle overlapping blocks. Make the calendar responsive and easy on desktop and mobile; include an intuitive weekly overview and a clear way to switch days on smaller screens.
- [x] Clearly explain that students should mark periods when they are busy or unavailable, not when free. Use #FF6A00 for selected blocks, buttons and calendar accents. Show a summary of selected unavailable periods before onboarding completion.
- [x] Save every block in the existing database linked to the authenticated student, storing day of week, start time, end time and optional activity name using consistent typed structures. Restore the complete week on My Profile; let students edit it after registration. Expose it through the typed API for future AI relevance scoring and schedule-conflict detection.

## 3. Student profile persistence and authorization
- [x] My Profile lets students view/edit campus, school or college, interests and complete weekly schedule; add/update/delete changes persist to the database and restore for the same account after login.
- [x] Secure profile APIs and enforce server-side authorization so users can only view/update their own profiles; never rely solely on frontend checks for access control or trust a client-supplied user ID.
- [x] Apply the database/schema update with an additive migration that preserves all existing user and session rows and any existing data. Backfill a unique student ID for every legacy account.

## 4. Official orange brand color throughout the existing app
- [x] Replace #FF7B00, #D7F36A and any other orange, yellow or accent colors used as the current UniRadar brand with #FF6A00 (and accessible derived tints/shades). Apply across buttons, links, active navigation, icons, badges, highlights, borders, hover/focus/selected states, calendar blocks, favicon and platform logo; leave no unwanted lemon/lime or outdated orange brand accents.
- [x] Keep Light Mode white-and-orange and Dark Mode charcoal-and-orange. Ensure accessible contrast and appropriate foreground text on orange backgrounds; preserve semantically distinct status colors. Preserve the current layout and design structure.

## 5. Typed API and current project behavior
- [x] Expose typed profile/schedule requests and responses; validate all profile fields, weekday values, HH:mm ranges, duplicate interests and same-day overlap on the server. Associate rows only with the authenticated account and persist transactionally.
- [x] Existing app routes/functions remain `/login`, `/signup`, `/app`, `/app/radar`, `/app/chat`, `/app/calendar`, `/app/profile`, `/app/settings`; existing React/Vite, Express, Prisma/SQLite, password/session backend, theme, event/chat demo boundaries and teammate API structure were delivered before this extension.

## 6. Implementation and verification
- [x] Before changing code, inspect existing app components/styles/auth/database/API/routes and reuse current components/patterns. Completed: project/auth/profile/database routes and design tokens inspected.
- [ ] Finish browser-only checks of the final onboarding review submission/dashboard gate, profile edit/delete and reload/re-login, overlap/range inline errors, and the calendar's 390px breakpoint. The authenticated API and database checks are verified separately.
- [x] Desktop HTTPS Preview check: registered a disposable student; confirmed the mandatory onboarding route, profile step, seven-day calendar/time axis and busy-not-free instruction; added Monday 08:00–12:00 Lectures and 14:00–16:00 Labs; saw the six-hour summary. Captured login/signup at 390px and removed the disposable account.
- [x] Verify server-side ownership by attempting another account’s profile access/update; ensure one user cannot view/change another user’s data.
- [x] Search the whole codebase for outdated branding colors. Run tests/lint/type checks and production build; fix introduced errors. Verify migrations retain existing data and update setup/API docs and route manifest.
