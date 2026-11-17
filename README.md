# NEXORA AI v2 — Backend integration foundation

This package adds a Node.js/Express API, Supabase authentication entry point, PostgreSQL schema, server-side OpenAI chat endpoint, contact CRUD API and Paddle webhook signature verification.

## Run locally
1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env` and fill in Supabase settings.
3. In Supabase SQL Editor, run `supabase-schema.sql`.
4. Install dependencies: `npm install`
5. Start: `npm run dev`
6. Open `http://localhost:3000/login.html`

## Required external accounts and secrets
- Supabase project: URL, anon key, service-role key.
- OpenAI API key (server only).
- Paddle seller account approval, client token, webhook secret and price IDs.

Never put `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `PADDLE_API_KEY` or `PADDLE_WEBHOOK_SECRET` in browser JavaScript or public repositories.

## Important implementation status
This is a backend integration foundation, not a fully audited production SaaS:
- Supabase signup/login page is wired to Supabase Auth.
- Server validates Supabase access tokens for protected API routes.
- Contacts API persists records to Supabase with owner filtering.
- AI API calls OpenAI on the server and applies a basic per-user monthly request limit.
- Paddle webhook signature verification and subscription event persistence are included.
- The existing dashboard pages are still a UI preview and are not yet fully wired to these APIs; the auth screen currently signs in users and redirects to the dashboard, but production route gating, logout UI, full CRM/AI frontend wiring, plan entitlements and full Paddle checkout creation still need completion.
- The SQL includes a basic profile and contact ownership model; conduct a security review and add organization/team membership policies before multi-tenant team features.
- AI usage counters need a scheduled monthly reset and stronger atomic metering before paid production use.
- Webhook handling should be extended with event idempotency, full event coverage, retries and reconciliation before accepting live payments.
- No provider account is created or activated by this code. Payment checkout is not enabled in this build.

## Suggested payment provider for a Pakistan-based founder
Paddle's published unsupported-country list does not list Pakistan, but approval is not guaranteed; confirm eligibility directly with Paddle before integrating live checkout. Stripe's official supported-country list does not currently list Pakistan. Lemon Squeezy has closed new sign-ups and announced it will stop processing transactions on 31 March 2027, so it is not a good new-project choice.
