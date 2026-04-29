# User Zero

User Zero is a Nuxt 4 and Nuxt UI app for AI-powered QA/customer simulation. Users sign in with GitHub, verify ownership of a site, optionally connect a GitHub repo for context, start a browser run against a verified URL, and review screenshots, issues, trace steps, and a markdown report.

## Stack

- Nuxt 4
- Nuxt UI dashboard template
- Supabase Auth, Postgres, and Storage
- Playwright Chromium
- OpenAI Responses API with image input and structured output
- Railway Docker deployment

## Setup

Install dependencies and the Chromium browser used by the QA runner:

```bash
pnpm install
pnpm setup:browsers
```

Copy `.env.example` to `.env` and set:

```bash
NUXT_PUBLIC_APP_BASE_URL=http://localhost:3000
NUXT_PUBLIC_SUPABASE_URL=
NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
API_KEY_ENCRYPTION_SECRET=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_SLUG=
GITHUB_APP_WEBHOOK_SECRET=
```

Apply the Supabase migration in `supabase/migrations`.

OpenAI API keys are saved per user from the Setup page. `API_KEY_ENCRYPTION_SECRET` must be a high-entropy server-only secret of at least 32 characters, for example the output of `openssl rand -base64 32`. Keep this value stable; changing it makes saved API keys undecryptable.

Enable GitHub in Supabase Auth and configure:

- GitHub OAuth callback: `https://<project-ref>.supabase.co/auth/v1/callback`
- Supabase redirect URL: `http://localhost:3000/auth/callback`
- Production redirect URL: `https://<your-domain>/auth/callback`

Create a GitHub App for repository connections. In GitHub, go to the organization or account that should own the app, then open **Settings → Developer settings → GitHub Apps → New GitHub App**.

- GitHub App name: choose a unique name, for example `User Zero`.
- Homepage URL: your deployed app URL.
- Post installation setup URL: `https://<your-domain>/api/github/app/callback`
- Webhook URL: `https://<your-domain>/api/github/app/webhook`
- Webhook secret: generate one with `openssl rand -hex 32`, paste it into GitHub, and use the same value for `GITHUB_APP_WEBHOOK_SECRET`.
- Repository permissions: Contents read, Issues write, Pull requests write. Metadata read is included by GitHub.
- Subscribe to events: Installation, Installation repositories.

After creating the GitHub App, set these environment variables:

- `GITHUB_APP_ID`: from the app settings page, next to **App ID**.
- `GITHUB_APP_PRIVATE_KEY`: on the app settings page, under **Private keys**, click **Generate a private key**. Copy the downloaded `.pem` contents into the env var. If your host requires a single-line value, replace line breaks with `\n`; the app converts those back at runtime.
- `GITHUB_APP_SLUG`: the app URL slug from `https://github.com/apps/<slug>` or `https://github.com/settings/apps/<slug>`. For an app named `User Zero`, this will usually look like `user-zero`.
- `GITHUB_APP_WEBHOOK_SECRET`: the random secret you entered in the GitHub App webhook settings.

For local GitHub App callback or webhook testing, expose your local server with a tunnel and use the tunnel URL in the GitHub App settings.

## Development

```bash
pnpm dev
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Site Ownership

Users must verify a site before testing it. User Zero accepts either:

```html
<meta name="userzero-site-verification" content="uzv_<token>">
```

or:

```txt
_userzero.example.com TXT "userzero-site-verification=uzv_<token>"
```
