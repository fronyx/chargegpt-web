# ChargeGPT Web

ChargeGPT Web is the browser client for ChargeGPT. It provides the chat interface and connects to the ChargeGPT API backend.

## Setup

1. Install dependencies with `npm ci`.
2. Update the files in `src/environments/` with your local configuration.
3. Start the app with `npm run start`.

## Environment

The app reads its runtime configuration from the environment files:

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

`environment.ts` is the default production configuration, `environment.development.ts` is used for local development, and `environment.staging.ts` is available for staging builds.

## Build

Run `npm run build` for a production build or `npm run build:staging` for a staging build.
