# UniRadar

**Your campus, without the chaos.** UniRadar is a responsive campus workspace for UM6P students in Morocco, built on React, Vite, Express, TypeScript and Prisma/SQLite.

## What’s included

- Responsive dashboard, Smart Radar, AI Assistant, Calendar, student Profile, Settings, Login, Sign Up and required multi-step onboarding.
- Unique student IDs; onboarding-gated dashboard access; server-backed profile, home campus, college, interests and editable Monday–Sunday unavailable-time calendar, stored per authenticated account.
- Light, dark and system themes with the orange UniRadar brand `#FF6A00`.
- Express + TypeScript auth/profile APIs, additive Prisma/SQLite migrations, bcryptjs password hashing, HTTP-only server-managed sessions and server-side profile ownership checks.
- Image-capable chat composer with previews and a proposed teammate API contract. Campus events, AI, extraction and ingestion stay explicitly demo-labelled until their providers are connected.

## Start locally

```sh
pnpm install
cp .env.example .env
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm dev
```

Open `http://localhost:3000`, create an account, and complete the required student onboarding before entering the dashboard. For local plain HTTP, keep `COOKIE_MODE=local`. SQLite is created at `dev.db` in the project root and ignored by Git.

## Check and production build

```sh
pnpm typecheck
pnpm build
pnpm start
```

## Configuration and docs

- [Development setup and Preview cookies](docs/DEVELOPMENT.md)
- [Implemented profile and proposed teammate API contracts](docs/API_CONTRACTS.md)
- [Implementation and design plan](plan.md)
- [Delivery outcomes](TODO.md)

`VITE_USE_MOCKS` only controls replaceable event/chat integrations; the account-linked profile and availability use authenticated server APIs. For embedded HTTPS Preview, set server-only `COOKIE_MODE=preview` (`SameSite=None; Secure`).

## Storage note

SQLite is suitable for local and hackathon persistence. A hosted ephemeral filesystem is not durable; migrate account and profile records to durable storage before depending on a production deployment.
