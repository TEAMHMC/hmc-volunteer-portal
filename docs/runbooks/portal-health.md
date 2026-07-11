# Volunteer Portal -- Health Check and Incident Response

**Service:** hmc-volunteer-portal
**Project:** hmc-prod-473121
**Region:** us-central1
**Escalation:** Erica Robinson -- erica@healthmatters.clinic

---

## Health Endpoints

These two endpoints must return HTTP 200 at all times during normal operation.

| Endpoint | Expected Response |
|---|---|
| `GET /health` | `200 {"status":"ok"}` |
| `GET /api/health` | `200 {"status":"ok","firestore":"connected","auth":"configured","email":"configured"}` |

Run a quick check:

```bash
curl -sf https://volunteer.healthmatters.clinic/health && echo "OK"
curl -sf https://volunteer.healthmatters.clinic/api/health
```

A non-200 response or connection timeout means the service is degraded or
down. Proceed to incident response below.

---

## Check Cloud Run Metrics

1. Open https://console.cloud.google.com/run/detail/us-central1/hmc-volunteer-portal/metrics?project=hmc-prod-473121
2. Review the following panels:
   - **Request count** -- sudden drop to zero indicates service is not receiving
     traffic.
   - **Request latency (p99)** -- sustained values above 2 seconds indicate a
     performance problem.
   - **Container instance count** -- values above 10 indicate unexpected load or
     a runaway loop.
   - **Error rate** -- any sustained 5xx rate above 1% requires investigation.
3. Adjust the time range to "Last 1 hour" to catch recent spikes.

---

## Check Cloud Build History

If an incident coincides with a recent deploy, check whether the build
succeeded and whether the correct revision is serving traffic.

1. Open https://console.cloud.google.com/cloud-build/builds?project=hmc-prod-473121
2. Look for builds in the last 30 minutes.
3. A failed build with status "Error" will not push a new revision, so the
   previous revision continues serving. A successful build pushes a new
   revision automatically.

To confirm which revision is currently live:

```bash
~/google-cloud-sdk/bin/gcloud run services describe hmc-volunteer-portal \
  --project=hmc-prod-473121 \
  --region=us-central1 \
  --format="value(status.traffic)"
```

---

## Check Firestore

1. Open https://console.cloud.google.com/firestore/data?project=hmc-prod-473121
2. Verify the top-level collections are visible: `volunteers`, `events`, `rsvps`.
3. If you see "Permission denied" in the console, your user account may not
   have the Firestore Viewer role. Check IAM at
   https://console.cloud.google.com/iam-admin/iam?project=hmc-prod-473121

To confirm Firestore security rules are deployed:

```bash
~/google-cloud-sdk/bin/gcloud firestore operations list \
  --project=hmc-prod-473121
```

Security rules are deployed via `firebase deploy --only firestore:rules`. If
rules were accidentally omitted from a recent deploy, restore them from
`firestore.rules` in the repo and redeploy.

---

## Check Secret Manager

The portal depends on two secrets. Confirm they exist and have active versions:

```bash
~/google-cloud-sdk/bin/gcloud secrets list --project=hmc-prod-473121

~/google-cloud-sdk/bin/gcloud secrets versions list EMAIL_SERVICE_URL \
  --project=hmc-prod-473121

~/google-cloud-sdk/bin/gcloud secrets versions list APPS_SCRIPT_URL \
  --project=hmc-prod-473121
```

Each secret must have at least one version with status `ENABLED`. A `DISABLED`
or missing version will cause the service to fail at startup or when the secret
is first accessed.

To view the current value of a secret (handle with care):

```bash
~/google-cloud-sdk/bin/gcloud secrets versions access latest \
  --secret=EMAIL_SERVICE_URL \
  --project=hmc-prod-473121
```

---

## Common Incidents

### 5xx Spike

**Symptoms:** Error rate above 1%, users see 500 or 502 errors.

**Steps:**

1. Pull recent logs:

```bash
~/google-cloud-sdk/bin/gcloud run services logs read hmc-volunteer-portal \
  --project=hmc-prod-473121 \
  --region=us-central1 \
  --limit=100
```

2. Search for `OOMKilled` or `out of memory`. If found, the container is
   exceeding its memory limit. Increase memory allocation in Cloud Run service
   settings or identify the leak.
3. Search for `cold start` latency exceeding 10 seconds. If found, consider
   setting a minimum instance count of 1 to eliminate cold starts.
4. If a recent deploy is correlated, roll back using the procedure in
   `portal-deploy.md`.

### Firestore Permission Denied

**Symptoms:** API returns 403 or logs show `PERMISSION_DENIED` from Firestore.

**Steps:**

1. Confirm `firestore.rules` in the repo matches what is deployed. Run
   `firebase deploy --only firestore:rules` to redeploy.
2. Check the Firestore security rules audit log:
   https://console.cloud.google.com/logs/query?project=hmc-prod-473121
   Filter: `resource.type="firestore_instance" severity=ERROR`
3. Confirm the Cloud Run service account has the `Cloud Datastore User` IAM
   role in project hmc-prod-473121.

### Auth Failures

**Symptoms:** Users cannot log in; logs show OAuth errors or 401 responses.

**Steps:**

1. Confirm the `GOOGLE_CLIENT_ID` environment variable in the Cloud Run
   service matches the OAuth 2.0 client in GCP Console:
   https://console.cloud.google.com/apis/credentials?project=hmc-prod-473121
2. Confirm `volunteer.healthmatters.clinic` is listed as an authorized
   JavaScript origin and redirect URI on that OAuth client.
3. If the OAuth client was recently rotated, update `GOOGLE_CLIENT_ID` in
   the Cloud Run service environment variables and redeploy.

### Email Not Sending

**Symptoms:** RSVP confirmations or notifications are not received; logs show
email errors.

**Steps:**

1. Retrieve the current `EMAIL_SERVICE_URL` secret value and confirm it matches
   the live Google Apps Script deployment URL.
2. Open the GAS deployment URL in a browser. If it returns an error or 404,
   the GAS script needs to be redeployed from the Google Apps Script editor.
3. After updating the GAS deployment URL, update the secret:

```bash
echo -n "NEW_GAS_URL" | \
  ~/google-cloud-sdk/bin/gcloud secrets versions add EMAIL_SERVICE_URL \
  --data-file=- \
  --project=hmc-prod-473121
```

4. Redeploy the Cloud Run service so it picks up the new secret version, or
   restart instances if the service is configured to pull the secret at runtime.

---

## Escalation Path

If an incident cannot be resolved within 30 minutes, or if it involves data
loss, security breach, or clinical tool failure, escalate immediately:

**Erica Robinson** -- erica@healthmatters.clinic
