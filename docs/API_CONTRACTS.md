# UniRadar API contracts

These contracts distinguish implemented account/profile persistence from teammate-owned AI and campus services. Authentication and student-profile endpoints run in Express and use server-side sessions. Campus event, chat and announcement integrations remain replaceable and visibly demo-labelled until connected.

## Authentication and mandatory onboarding

All responses use JSON. Auth failures return `message`, optional `code` and optional `fieldErrors`. Password-reset email is not implemented; the UI explains this rather than claiming delivery. Passwords are bcrypt-hashed; the HTTP-only `uniradar_sid` cookie is `SameSite=Lax` for plain HTTP local mode and `SameSite=None; Secure` for HTTPS Preview.

- `POST /api/auth/signup`: `{ name, email, password, termsAccepted: true }` → `201 { user: { id, studentId, name, email, onboardingComplete: false } }` plus an authenticated session. A unique `UR-…` student ID is generated for new accounts.
- `POST /api/auth/login`: `{ email, password, rememberMe?: boolean }` → `{ user: { id, studentId, name, email, onboardingComplete } }` plus a new session.
- `GET /api/auth/me`: same authenticated user shape or `401`; onboarding status and ID come from the database.
- `POST /api/auth/logout`: revoke the hashed server session, clear cookie and return `{ success: true }`.

A successful signup does not grant dashboard access. The authenticated user must complete `/onboarding`; Express persists the profile and sets `onboardingCompletedAt`. Unfinished accounts and legacy accounts without onboarding completion are redirected to onboarding by the UI. Authorization for profile API calls is still enforced server-side.

## Student profile and weekly availability (implemented)

`GET /api/profile` requires the current session and returns `{ profile }` for that session's user only:

```ts
interface StudentProfile {
  studentId: string;
  fullName: string;
  homeCampus: 'Rabat' | 'Ben Guerir' | null;
  school: string;
  interests: string[];
  unavailableBlocks: Array<{
    id: string;
    dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO weekday: Monday=1, Sunday=7
    startTime: string; // 24-hour HH:mm
    endTime: string; // later than startTime, same day
    activityName: string | null;
  }>;
  onboardingComplete: boolean;
}
```

`PUT /api/profile` accepts the profile fields except server-generated `studentId`/`onboardingComplete`; successful save returns the full profile. Campus, school, full name and at least one interest are validated. Times must be valid `HH:mm`, end later than start, and blocks on the same day must not overlap. Empty days and an entirely empty schedule are valid. The server derives user ownership from the session, never from a client-supplied user ID. User profile, interests and unavailable-time rows are updated transactionally. Database rows reference the authenticated user with cascading ownership; existing accounts/sessions are preserved by an additive migration.

The structured schedule is available for future relevance scoring and schedule-conflict detection. No scoring service is presumed connected.

## Events

- `GET /api/events` → `{ events: CampusEvent[] }` when the team connects the campus feed.
- Only return source-grounded dates, relevance scores, conflict flags, registration URLs and citations. Demo values are labelled and are not verified university data.

## Chat (proposed teammate integration)

`POST /api/chat` uses `multipart/form-data`: `message`, optional `conversationId`, and repeated binary `images`. Success: `{ conversationId, message, sources?, attachments? }`. The real service should return grounded answers and citations. The UI does not infer them; demo mode does not claim AI or image analysis. PDFs remain in announcement intake.

## Announcements (proposed)

`POST /api/announcements` accepts an image/PDF or pasted text. Return extraction details only if real processing occurred; demo output must say it is a placeholder.
