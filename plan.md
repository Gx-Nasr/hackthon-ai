# UniRadar — Implementation and Design Plan

## Product and scope

Extend the existing UniRadar application—not recreate it—with a mandatory post-registration onboarding flow, typed weekly unavailability calendar, database-backed editable student profile, and the newly specified orange brand `#FF6A00` throughout brand-accent usage. Preserve the existing React/Vite/Express/TypeScript/Prisma/SQLite architecture, sign-in and session behavior, event Radar, chat, calendar, settings, routes and unrelated working features. The established white/off-white light surfaces and charcoal dark surfaces stay; lemon/lime brand coloring is replaced by orange.

AI reasoning, OCR/extraction, announcement ingestion, real university events and campus intelligence remain team-owned and are not simulated. The new profile and schedule, however, are real authenticated application data, not mock/demo persistence.

## Implementation approach

- Reuse the current React + TypeScript + Vite frontend, React Router, Tailwind, shared UI, React Hook Form/Zod, TanStack Query, contexts, Express API and existing authenticated session architecture.
- After account creation, send the signed-in student to protected `/onboarding`. Use a polished three-step flow: required full name/home campus/school/interests, required calendar step, and a review step summarizing all saved unavailable periods. Do not allow dashboard access until a successful profile transaction marks onboarding complete. Existing accounts with no profile completion are sent through onboarding on their next authenticated visit; profile edits remain available later.
- Reuse one accessible `WeeklyAvailabilityCalendar` in onboarding and My Profile. It shows a Monday–Sunday time-axis week on desktop, an obvious single-day switcher on small screens, multi-block day columns, 24-hour start/end times, optional activity labels, add/edit/delete interactions, overlap/range validation and a selected-period summary. Empty days (including a completely empty schedule) are valid. Explain that blocks mean busy/unavailable, not free.
- Persist profile fields in the existing SQLite/Prisma database linked to the authenticated user. Use additive migrations that preserve existing accounts, sessions and profile data. Generate a stable unique student ID; represent each unavailability as a typed row with ISO weekday, start/end `HH:mm` and optional activity. Persist profile name, campus, school, interests and availability transactionally. Validate and reject overlaps both in the client and server. Profile APIs must use session-derived ownership and never accept a target user ID for authorization.
- Expose `GET /api/profile` and authenticated `PUT /api/profile` with typed request/response shapes, including student ID, profile fields, onboarding status and all weekly blocks, to support future AI relevance/conflict work. Stop routing account-linked profile saves through localStorage demo services; preserve unrelated app demo boundaries.
- Replace `#D7F36A`, `#FF7B00` and other lime/yellow/old orange values used as UniRadar brand accents throughout the frontend, tailwind config, favicon/wordmark and platform logo asset with `#FF6A00` plus accessible derived orange shades/tints. Keep semantic success/warning/error colors distinct. Maintain dark charcoal/light neutral structure, sufficient contrast and visible focus in both themes.
- Keep `.env.example`, migration/setup instructions, README, route manifest, API contracts and the completed outcome tracker accurate. Preserve server-only values and cookie behavior (`SameSite=None; Secure` for HTTPS embedded Preview; local plain HTTP separate).

## Information architecture and project structure

- `src/main.tsx`, `src/App.tsx`: app bootstrap, existing routes, new `/onboarding`, and guards that keep incomplete students out of `/app`.
- `src/pages/SignupPage.tsx`, `OnboardingPage.tsx`: existing registration and mandatory multi-step onboarding.
- `src/pages/ProfilePage.tsx`: database-restored and editable account name/student ID, home campus, school, interests and availability.
- `src/components/profile/WeeklyAvailabilityCalendar.tsx`: reusable responsive week/day time grid, accessible block editor, validation and summaries used by onboarding and profile.
- `src/components/layout/`: preserve responsive shell, navigation and account/theme controls.
- `src/components/ui/`: preserve shared controls/dialogs; reuse the existing accessible dialog primitive.
- `src/contexts/AuthContext.tsx`, `src/types/`, `src/services/profileService.ts`: expose onboarding state and typed user/profile/availability API shapes.
- `server/src/routes/auth.ts`, new `profile.ts`, `server/src/middleware/requireAuth.ts`: preserve auth and enforce session-derived user ownership for profile operations.
- `prisma/schema.prisma`, a new additive migration: student identity, onboarding/profile fields, interests and normalized unavailability rows, with legacy-data-safe backfill.
- `src/index.css`, `tailwind.config.cjs`, `src/components/ui/Brand.tsx`, `public/favicon.svg`, `app.config.ts`: consistent orange brand tokens and assets.
- `public/manus-routes.json`, README and `docs/API_CONTRACTS.md`: synchronized onboarding route, startup/migration details and typed profile contracts.

## Design direction

### Design Movement

Contemporary Swiss-influenced SaaS editorial design with a calm, precise campus-operations feel.

### Core Principles

1. Keep density calm with strong hierarchy, generous whitespace and clear page-level focus.
2. Use UniRadar orange for brand actions, selections and relevant state—not as a blanket surface color.
3. Make functional states honest and explicit; use text and shape as well as color.
4. Keep every screen keyboard accessible and touch-friendly, with reduced-motion support.

### Color Philosophy

Warm off-white and charcoal surfaces sustain the focused workspace. The ownable signal is UniRadar orange `#FF6A00`, replacing lemon/lime brand coloring. Use a deep orange for small text on light surfaces and near-black text on orange fills; use warm pale-orange selection surfaces and clear orange focus rings. Light surfaces remain `#FAFBF7` / white / `#191C16`; dark surfaces remain `#111110` / `#181817` / `#1E1D1B` / `#F4F5EF`. Semantic success, warning, and error colors remain distinct from branding.

### Layout Paradigm

An anchored desktop navigation rail frames the flexible workspace. The onboarding calendar uses a time axis with seven weekday columns; on mobile it becomes a single-day calendar with an explicit day switcher. Profile and onboarding share the same calendar component.

### Signature Elements

- A compact radar-sweep emblem paired with the UniRadar wordmark, with an orange sweep.
- Orange selected-route/action markers and a quiet warm-tinted selection surface.
- Availability shown as orange time blocks with readable day/time/activity labels.

### Interaction Philosophy

Direct and reassuring. Calendar blocks open a focused accessible editor; add/edit/delete actions respond immediately in the draft, overlapping ranges are rejected with a clear explanation, and the final review names every busy period before submission. Save is explicit, transactional and tied to the signed-in student.

### Animation

Use brief 140–220ms opacity/position transitions for navigation, drawers, menus and block feedback. Respect `prefers-reduced-motion`; do not animate essential status indefinitely.

### Typography System

Use DM Sans for navigation/body and Manrope for display headings, with medium/semibold weights and tabular numerals for time values. Keep labels readable, including on mobile.

### Brand Essence

A trustworthy campus signal desk for UM6P students, separating useful campus context from announcement noise. Personality: clear, capable, grounded.

### Brand Voice

Short, helpful, direct; never overclaim what data or AI has done. Example lines: “Your campus, without the chaos.” “Mark when you’re busy. UniRadar will leave that time alone.”

### Wordmark & Logo

A custom SVG mark combines a broken circular radar ring, an orange sweep wedge and a pinpoint, paired with the carefully weighted UniRadar wordmark. Keep it legible at favicon size and update the platform logo asset as well as the website favicon.

### Signature Brand Color

UniRadar orange `#FF6A00`.

## Explicit constraints and trade-offs

The existing project has server capability enabled and uses local SQLite/Prisma; do not enable a new managed database or replace this chosen architecture. The migration must be additive and retain existing user/session rows. Existing non-profile campus/event/AI demo boundaries remain visibly demo-labelled; account-linked profile and availability are real database-backed data. Never authorize by client-supplied user ID or leak server secrets. Do not publish the site unless separately requested.
