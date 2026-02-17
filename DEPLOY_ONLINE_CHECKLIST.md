# Deploy Online Checklist (GitHub -> Vercel)

## 1) Safety first
- Ensure backup exists and restore test is verified.
- Never upload `.env`, `prisma/dev.db`, or `public/uploads` to GitHub.

## 2) Branch workflow
- `main` = production
- `develop` = staging
- Create feature branches from `develop`

## 3) Create cloud resources
- Neon: create 2 databases (`staging`, `production`)
- Vercel: create 2 projects connected to same repo:
  - `taboola-rassa-staging` (tracks `develop`)
  - `taboola-rassa-prod` (tracks `main`)

## 4) Set Vercel environment variables
Required:
- `DATABASE_URL`
- `AUTH_SECRET`
- `APP_BASE_URL`

Rules:
- In production/staging, `DATABASE_URL` must be Postgres (not `file:...`).
- `AUTH_SECRET` should be long random value (32+ chars).

## 5) Deploy preflight
Run locally before each release:

```bash
npm run preflight:deploy
npm run lint
npm run build
```

## 6) First deploy
- Push `develop` and verify staging works:
  - login/register
  - patients/sessions/tasks
  - research/guidance/receipts
- Then merge `develop` -> `main` and verify production.

## 7) Post-deploy smoke checks
- `/login` returns 200
- unauthenticated `/` redirects to `/login`
- unauthenticated `/api/tasks` returns 401

## 8) Known current blocker before public multi-user launch
Current codebase still has partial multi-tenant gaps in research/expenses scope.
Before inviting real users, complete tenant isolation hardening and move uploads to object storage.
