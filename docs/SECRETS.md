# Secrets Provisioning for hmc-volunteer-portal

This document describes the Secret Manager entries the Cloud Run service
expects, how to create them, and the IAM grants required for both Cloud Build
and the Cloud Run runtime service account.

GCP project: `hmc-prod-473121`
Cloud Run service: `hmc-volunteer-portal`
Region: `us-central1`

## Order of operations

READ THIS FIRST. The next Cloud Build deploy will FAIL if the secrets below
are not created before the build runs.

1. Create every secret listed in "Secrets expected by the app" below using the
   `gcloud secrets create` commands. At minimum, `EMAIL_SERVICE_URL` and
   `APPS_SCRIPT_URL` must exist (those are the two referenced in the current
   `cloudbuild.yaml`).
2. Grant `roles/secretmanager.secretAccessor` to both the Cloud Build service
   account and the Cloud Run runtime service account (commands below).
3. Only then trigger a new build (push to `main` or run `gcloud builds submit`).
4. After the deploy succeeds, rotate the Apps Script webhook URLs (publish new
   GAS deployments, add new secret versions with `gcloud secrets versions add`,
   redeploy). The old URLs in git history should be considered burned.

## Secrets expected by the app

The Cloud Run runtime expects these secrets to be mounted as environment
variables. `cloudbuild.yaml` currently wires up the first two. The remaining
entries are provisioned for sibling agents and future builds. Erica should
create all of them in one pass.

| Secret name             | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `EMAIL_SERVICE_URL`     | Apps Script webhook for transactional email   |
| `APPS_SCRIPT_URL`       | Apps Script webhook for RSVP / sheet writes   |
| `BACKFILL_SECRET`       | Shared secret for the RSVP backfill endpoint  |
| `RECAPTCHA_SECRET_KEY`  | reCAPTCHA v3 server-side secret               |
| `GEMINI_API_KEY`        | Google Gemini API key                         |
| `WEBFLOW_API_TOKEN`     | Webflow CMS API token                         |
| `ANTHROPIC_BAA_ENABLED` | Feature flag (string `true` or `false`)       |

## Create the secrets

Run these commands once. Replace the placeholder strings with the real
values. Use `printf` rather than `echo` to avoid a trailing newline in the
secret payload.

```bash
PROJECT=hmc-prod-473121

printf 'https://script.google.com/macros/s/AKfycbzNXenW0AYsfGY0_7x4rPpziEs5CWGtdRF9U5quU59V1TI7eBTV-CS5zH45_l-0cyN5_g/exec' | \
  gcloud secrets create EMAIL_SERVICE_URL --project=$PROJECT --replication-policy=automatic --data-file=-

printf 'https://script.google.com/macros/s/AKfycbyM6jD_8ePyk4_M2Ki0gKFjq0AKZZSonZFqirvygPDlFv06lz6tFtDE0BBGhAc95FZsBA/exec' | \
  gcloud secrets create APPS_SCRIPT_URL --project=$PROJECT --replication-policy=automatic --data-file=-

printf 'REPLACE_ME' | \
  gcloud secrets create BACKFILL_SECRET --project=$PROJECT --replication-policy=automatic --data-file=-

printf 'REPLACE_ME' | \
  gcloud secrets create RECAPTCHA_SECRET_KEY --project=$PROJECT --replication-policy=automatic --data-file=-

printf 'REPLACE_ME' | \
  gcloud secrets create GEMINI_API_KEY --project=$PROJECT --replication-policy=automatic --data-file=-

printf 'REPLACE_ME' | \
  gcloud secrets create WEBFLOW_API_TOKEN --project=$PROJECT --replication-policy=automatic --data-file=-

printf 'false' | \
  gcloud secrets create ANTHROPIC_BAA_ENABLED --project=$PROJECT --replication-policy=automatic --data-file=-
```

## Rotate a secret (add a new version)

When an Apps Script webhook is rotated or an API key changes, add a new
version. Cloud Run picks it up on the next deploy because `cloudbuild.yaml`
references `:latest`.

```bash
PROJECT=hmc-prod-473121

printf 'https://script.google.com/macros/s/NEW_DEPLOYMENT_ID/exec' | \
  gcloud secrets versions add EMAIL_SERVICE_URL --project=$PROJECT --data-file=-

printf 'https://script.google.com/macros/s/NEW_DEPLOYMENT_ID/exec' | \
  gcloud secrets versions add APPS_SCRIPT_URL --project=$PROJECT --data-file=-
```

After adding new versions, trigger a redeploy (push a commit or
`gcloud builds submit`) so the Cloud Run revision picks them up.

## IAM grants

Both the Cloud Build service account (used during `gcloud run deploy`) and
the Cloud Run runtime service account need `roles/secretmanager.secretAccessor`
on each secret. The simplest grant is project-level; per-secret grants are
also supported if a tighter scope is preferred.

Find the account numbers:

```bash
PROJECT=hmc-prod-473121
PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')

CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
CLOUD_RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

If the Cloud Run service uses a dedicated runtime service account instead
of the default Compute Engine account, substitute that address for
`CLOUD_RUN_SA`. Check with:

```bash
gcloud run services describe hmc-volunteer-portal \
  --project=$PROJECT --region=us-central1 \
  --format='value(spec.template.spec.serviceAccountName)'
```

Grant the role:

```bash
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:${CLOUD_RUN_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

## Verify before triggering a build

```bash
gcloud secrets list --project=hmc-prod-473121
gcloud secrets versions list EMAIL_SERVICE_URL --project=hmc-prod-473121
gcloud secrets versions list APPS_SCRIPT_URL --project=hmc-prod-473121
```

Each of the two GAS URL secrets should show at least one ENABLED version.
Then push to `main` to trigger the build.

## What `cloudbuild.yaml` does

- Public-safe values (`GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`) are passed
  to Cloud Run via `--update-env-vars`. These are the OAuth client IDs and
  are intentionally visible in the browser.
- Sensitive values (`EMAIL_SERVICE_URL`, `APPS_SCRIPT_URL`) are passed via
  `--update-secrets`. Cloud Run mounts the latest version of each secret as
  an environment variable inside the container. The values never appear in
  build logs, deploy commands, or the repo.

## Local development

Do not commit local `.env` files. `.env*` and `cloudbuild.local.yaml` are
already in `.gitignore`. For local runs, export the same variable names in
your shell or use a personal `.env.local` that is never committed.
