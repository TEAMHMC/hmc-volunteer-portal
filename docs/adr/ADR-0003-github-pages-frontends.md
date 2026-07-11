# ADR-0003: Static Frontends Hosted on GitHub Pages

## Status

Accepted

## Context

Several HMC projects are purely client-side React/Vite applications with no server-side
logic or secrets at build time:

- Event Finder Tool
- Unstoppable program site
- CalmKit progressive web app
- Resource Directory

These apps call backend APIs at runtime (the portal Cloud Run service, GAS endpoints, or
publicly documented third-party APIs with client-safe keys). They do not require a server
process, session management, or private environment variables baked into the build artifact.

All source code already lives in GitHub under the TEAMHMC organization, so a GitHub-native
hosting solution avoids introducing a second vendor for deployment.

## Decision

Host all static frontend projects (no server-side secrets, no SSR) on **GitHub Pages**.

## Options Considered

| Option | Pros | Cons |
|---|---|---|
| Cloud Run (static serve) | Same GCP footprint; HTTPS automatic | Overkill for static assets; costs money even at low traffic; container build overhead |
| Netlify / Vercel | Excellent DX; preview deploys; edge functions available | Third-party vendor; vendor lock-in; another set of credentials and billing to manage |
| GitHub Pages | Free; zero additional vendor; deploys from the same repo via Actions; HTTPS via GitHub's CDN | No server-side execution; no secret injection at serve time; 1 GB soft size limit per site |

## Decision Outcome

GitHub Pages was selected for any frontend repository that meets both conditions:

1. No server-side rendering is required.
2. No private API keys or secrets need to be available at serve time.

Deployments are automated via a GitHub Actions workflow (typically `actions/deploy-pages`)
triggered on push to `main`. Custom domains are configured via CNAME records pointing to
`<org>.github.io`.

## Consequences

**Positive**

- Zero hosting cost for all static frontends.
- Deployment is part of the existing GitHub workflow; no separate CI/CD platform credentials.
- Preview builds can be served from feature branches using branch-specific Pages deployments.
- No additional vendor agreements or billing accounts.

**Negative**

- No server-side rendering; all data fetching is client-side. SEO for dynamic content relies
  on prerendering or structured data schemas in static HTML.
- Private API keys (Gemini, Google Maps, any key that must not be public) cannot be used
  directly in a GitHub Pages app. These calls must be proxied through the portal Cloud Run
  API, which adds a round-trip but keeps keys out of the browser bundle.
- The 1 GB soft limit per repository requires keeping build artifacts lean; large media
  assets should be served from Cloud Storage or a CDN, not committed to the repo.

**Neutral**

- Each frontend repository maintains its own `gh-pages` branch or uses the `docs/` folder
  convention, depending on project structure.
- API base URLs are configured via Vite environment variables (`VITE_API_BASE`) at build
  time; the production value is set in the GitHub Actions environment.
- CalmKit's Capacitor native builds (iOS/Android) follow a separate build and signing
  process and are not affected by this decision.
