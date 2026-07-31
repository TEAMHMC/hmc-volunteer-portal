# Staging & CI/CD Pipeline — Volunteer Portal

This portal has a full staging service already defined in `cloudbuild-staging.yaml`
(a separate `hmc-volunteer-portal-staging` Cloud Run service behind HTTP Basic Auth).
This runbook wires it into a real feature → PR → staging → prod flow.

## Target flow

```
feature branch ──PR──▶ main
      │                 │
   CI checks         (merge, protected)
 (ci.yml gate)          │
      │                 ▼
  push to  ──▶ staging service ──manual verify──▶ prod service
  staging      (Basic Auth)                       (public)
```

- **Every change** starts on a feature branch and opens a PR into `main`.
- `ci.yml` runs typecheck + build + secret-scan on the PR. Merge is blocked until it passes.
- Pushing to the `staging` branch deploys the **staging** Cloud Run service for manual verification.
- Merging to `main` deploys **prod** (existing trigger + `cloudbuild.yaml`, which now also typechecks before building).

## One-time setup (GCP / GitHub admin — requires owner access)

Run these once. Project: `hmc-prod-473121`, region `us-central1`.

### 1. Create the staging secret (Basic Auth credentials for the staging service)

```bash
# Choose a username:password. This gates the entire staging site.
printf 'hmc:CHOOSE_A_STRONG_PASSWORD' | \
  gcloud secrets create STAGING_AUTH --data-file=- --project=hmc-prod-473121
# If it already exists, add a new version instead:
# printf 'hmc:...' | gcloud secrets versions add STAGING_AUTH --data-file=- --project=hmc-prod-473121

# Let Cloud Build's service account read it (same SA that reads EMAIL_SERVICE_URL):
PROJ_NUM=$(gcloud projects describe hmc-prod-473121 --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding STAGING_AUTH \
  --member="serviceAccount:${PROJ_NUM}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" --project=hmc-prod-473121
```

### 2. Create the `staging` branch

```bash
git checkout main && git pull
git checkout -b staging && git push -u origin staging
```

### 3. Create the Cloud Build trigger for staging

Console → Cloud Build → Triggers → Create trigger:
- **Name:** `deploy-staging`
- **Event:** Push to a branch
- **Source:** this repo, branch `^staging$`
- **Configuration:** Cloud Build config file → `cloudbuild-staging.yaml`

Or via CLI (adjust `--repo-*` to your connected repo):

```bash
gcloud builds triggers create github \
  --name=deploy-staging \
  --repo-name=hmc-volunteer-portal --repo-owner=TEAMHMC \
  --branch-pattern='^staging$' \
  --build-config=cloudbuild-staging.yaml \
  --project=hmc-prod-473121
```

### 4. Turn on branch protection for `main` (GitHub)

Repo → Settings → Branches → Add rule for `main`:
- Require a pull request before merging (1 approval).
- Require status checks to pass → select **`build-and-check`** (from `ci.yml`).
- Require branches to be up to date before merging.
- (Recommended) Include administrators.

Once this is on, no one — including a direct `git push origin main` — can deploy to
prod without a green CI check and a merged PR. That closes the "push-to-main = instant
unreviewed prod deploy" gap.

## Daily use (after setup)

```bash
git checkout main && git pull
git checkout -b fix/my-change
# ... edit, commit ...
git push -u origin fix/my-change          # opens PR; CI runs
# To preview on staging before merging:
git checkout staging && git merge fix/my-change && git push   # deploys staging
# Verify at the staging URL (Basic Auth), then merge the PR to main → prod.
```

## Staging URL

After the first staging deploy:

```bash
gcloud run services describe hmc-volunteer-portal-staging \
  --region=us-central1 --project=hmc-prod-473121 --format='value(status.url)'
```

Log in with the `username:password` you stored in `STAGING_AUTH`.
