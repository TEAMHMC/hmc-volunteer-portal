# Volunteer Portal -- Deploy and Rollback

**Service:** hmc-volunteer-portal
**Project:** hmc-prod-473121
**Region:** us-central1
**Production URL:** https://volunteer.healthmatters.clinic

---

## Prerequisites

Ensure the Google Cloud SDK is installed and authenticated before running any
commands.

```bash
~/google-cloud-sdk/bin/gcloud auth login
~/google-cloud-sdk/bin/gcloud config set project hmc-prod-473121
~/google-cloud-sdk/bin/gcloud config set run/region us-central1
```

Confirm your active project and account:

```bash
~/google-cloud-sdk/bin/gcloud config list
```

You must have the Cloud Run Admin and Cloud Build Editor roles in project
hmc-prod-473121.

---

## Standard Deploy

Deployments are triggered automatically when commits are pushed to the `main`
branch of github.com/TEAMHMC/hmc-volunteer-portal. Cloud Build picks up the
push and runs the steps defined in `cloudbuild.yaml`.

```bash
git pull origin main
# make your changes, commit, then:
git push origin main
```

### Watch the build in Cloud Console

1. Open https://console.cloud.google.com/cloud-build/builds?project=hmc-prod-473121
2. The most recent build will appear at the top with status "Running."
3. Click the build ID to stream logs in real time.
4. A green checkmark indicates success. A red X indicates failure -- check the
   logs for the failing step.

To tail build logs from the CLI, copy the build ID from the console and run:

```bash
~/google-cloud-sdk/bin/gcloud builds log BUILD_ID --stream
```

---

## Verify Deployment

After a successful build, confirm the new revision is serving traffic.

```bash
curl -sf https://volunteer.healthmatters.clinic/health
# Expected: HTTP 200 with JSON body {"status":"ok",...}

curl -sf https://volunteer.healthmatters.clinic/api/health
# Expected: HTTP 200 with JSON body showing Firestore, auth, and email status
```

If either endpoint returns non-200, proceed to rollback.

---

## Check Revision List

List the last 10 revisions for the production service:

```bash
~/google-cloud-sdk/bin/gcloud run revisions list \
  --service=hmc-volunteer-portal \
  --project=hmc-prod-473121 \
  --region=us-central1 \
  --limit=10
```

The `TRAFFIC` column shows which revision currently serves 100% of requests.
The `DEPLOYED` column shows the timestamp of each revision.

---

## Rollback to Previous Revision

Identify the last known-good revision from the list above, then route all
traffic to it:

```bash
~/google-cloud-sdk/bin/gcloud run services update-traffic hmc-volunteer-portal \
  --to-revisions=REVISION_NAME=100 \
  --project=hmc-prod-473121 \
  --region=us-central1
```

Replace `REVISION_NAME` with the actual revision identifier, for example
`hmc-volunteer-portal-00042-xyz`.

Verify traffic has shifted:

```bash
~/google-cloud-sdk/bin/gcloud run services describe hmc-volunteer-portal \
  --project=hmc-prod-473121 \
  --region=us-central1 \
  --format="value(status.traffic)"
```

---

## Rollback to a Specific Commit

Each Cloud Run revision is built from a container image tagged with the Git
commit SHA. To roll back to a specific commit:

1. Find the commit SHA: `git log --oneline`
2. List images in Artifact Registry filtered by that SHA:

```bash
~/google-cloud-sdk/bin/gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/hmc-prod-473121/cloud-run-source-deploy/hmc-volunteer-portal \
  --filter="tags:SHA" \
  --project=hmc-prod-473121
```

3. Find the revision that references that image digest in the revision list.
4. Route traffic to that revision using the update-traffic command above.

---

## Emergency Rollback

If the site is down, do not investigate first -- roll back immediately, then
diagnose.

```bash
# Step 1: identify the last good revision
~/google-cloud-sdk/bin/gcloud run revisions list \
  --service=hmc-volunteer-portal \
  --project=hmc-prod-473121 \
  --region=us-central1 \
  --limit=5

# Step 2: route 100% traffic to it
~/google-cloud-sdk/bin/gcloud run services update-traffic hmc-volunteer-portal \
  --to-revisions=REVISION_NAME=100 \
  --project=hmc-prod-473121 \
  --region=us-central1

# Step 3: verify recovery
curl -sf https://volunteer.healthmatters.clinic/health
```

Total target time from detection to rollback: under 5 minutes.

---

## After Any Rollback

1. Open a GitHub issue in TEAMHMC/hmc-volunteer-portal titled:
   `[Rollback] <date> -- <brief description of incident>`
2. Label it `incident` and `needs-postmortem`.
3. Complete a postmortem within 48 hours of the incident. The postmortem must
   cover: timeline, root cause, impact scope, fix, and prevention steps.
4. Do not re-deploy the reverted code until the root cause is identified and
   the fix is verified in staging (hmc-volunteer-portal-staging).
