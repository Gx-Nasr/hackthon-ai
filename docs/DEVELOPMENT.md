# UniRadar development

## Requirements and local setup

Use Node.js 22 or newer and pnpm 11; the repository pins pnpm through `packageManager` and declares allowed install scripts.

```sh
pnpm install
cp .env.example .env
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm dev
```

Open `http://localhost:3000`, create an account and complete required onboarding. New accounts receive a unique student ID; home campus, school/college, interests and all seven days of unavailable time are saved with the authenticated user. Profile and availability use the real authenticated Express API even while events/chat use demo providers.

Keep `COOKIE_MODE=local` for plain HTTP localhost (`SameSite=Lax`, not Secure). The app serves React UI and `/api/*` from Express on port 3000. SQLite is `dev.db` at the project root (`DATABASE_URL=file:../dev.db` relative to `prisma/schema.prisma`) and is ignored by Git. There are no default account credentials.

## Build and schema changes

```sh
pnpm typecheck
pnpm build
pnpm start
```

The build generates Prisma Client, compiles Express to `dist/server` and builds Vite assets to `dist/client`. Add schema changes using `pnpm exec prisma migrate dev --name <short-description>`; deploy committed migration files using `pnpm db:deploy`. The weekly student-profile migration is additive and backfills legacy student IDs; it does not delete accounts or sessions.

## Preview and cookies

The public Preview is HTTPS and embedded cross-site. Set the server-only `COOKIE_MODE=preview`; this sets `SameSite=None; Secure` on `uniradar_sid`. Do not infer cookie flags from `NODE_ENV`, `req.secure` or internal HTTP. Browser third-party-cookie policy can still affect embedded sessions.

## Demo and real services

`VITE_USE_MOCKS=true` controls replaceable event, AI/chat and announcement providers only; mocked campus data is labelled. The account-linked profile and availability always use the authenticated database API. Set `VITE_USE_MOCKS=false` when teammate endpoints are configured and restart Vite. `VITE_API_BASE_URL` must contain no credentials. See [API_CONTRACTS.md](./API_CONTRACTS.md).

## Local SQLite limitation

SQLite is suitable for local/hackathon persistence, but a SQLite file on ephemeral hosted/container storage is not durable. Migrate accounts and profiles to durable storage before relying on a published deployment. No managed database was enabled for this existing project.
