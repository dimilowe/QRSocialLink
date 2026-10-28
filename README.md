# QRSocialLink

## Local development

Requires Node.js 20+ and Docker with Compose. Start Docker before running these commands.

```sh
npm install
cp .env.example .env
npm run db:up
npm run db:push
npm run dev
```

Open http://localhost:3000. Set `PORT` in `.env` to use another port.

The app and Drizzle CLI load `.env` automatically. The local PostgreSQL database
listens on `127.0.0.1:55439`, with database, username, and password all set to
`qrsociallink`. This port avoids conflicts with a system PostgreSQL installation.
Use these credentials only for local development. Add your Clerk and other service
credentials to `.env` as needed; authentication still requires Clerk configuration.
Stripe is optional locally: without `STRIPE_SECRET_KEY`, payment endpoints return
503 while the rest of the app can run. To test payments, set Stripe test values for
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `VITE_STRIPE_PUBLIC_KEY`, then
restart the app. Production still requires `STRIPE_SECRET_KEY`.

`npm run db:push` applies `shared/schema.ts` to the database selected by
`DATABASE_URL`. Check that URL before applying schema changes.

```sh
npm run db:logs   # Show database logs
npm run db:down   # Stop the database; keep its data
```

Data persists in the Compose `postgres_data` volume across restarts.
For a hosted PostgreSQL database, set `DATABASE_URL` to the provider's connection
string, including `sslmode=require` when required by the provider.

## QR design studio

Creation and editing share one renderer. Choose from six palettes, three pattern
styles, three corner-eye styles, and independent corner colors. Plain PNGs export
at 1600 × 1600; framed designs at 1560 pixels wide (1860 high for polaroid).
The renderer preserves functional QR patterns, a four-module quiet zone, and uses
high error correction. Contrast guidance helps with custom colors; always scan-test
finished designs, especially on photographic or animated backgrounds.

New style fields are saved with each QR. `npm run db:push` adds them locally.
For deployments using manual SQL migrations, apply
`db/migrations/20261028_qr_design.sql` before deploying this version. Existing QR
records default to square modules and eyes.

Enable **Transparent QR background** in either editor to let an uploaded image
show through between modules and inside corner openings. With no background image,
plain PNG downloads retain transparency for use in other design tools. Transparent
backgrounds are saved with the design; contrast depends on the image beneath.
