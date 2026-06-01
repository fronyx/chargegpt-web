# ChargeGPT Web

Open-source frontend for the ChargeGPT demo.

## Setup

1. Install dependencies with `npm ci`.
2. Update the files in `src/environments/` with your local values.
3. Start the app with `npm run start`.

## Environment

The app expects these values in the environment files:

- `API_TOKEN`
- `SENTRY_DSN`
- `BACKEND_API`
- `ENABLE_USER_LOCATION`
- `MAP_ID`
- `PUBLIC_APP_URL`
- `PRIVACY_POLICY_URL`
- `LEGAL_NOTICE_URL`
- `BRAND_NAME`
- `COOKIE_DOMAIN`

`environment.ts` is the production/default file, `environment.development.ts` is used for local development, and `environment.staging.ts` is available for a staging build.

## Build

Run `npm run build` for a production build or `npm run build:staging` for a staging build.
