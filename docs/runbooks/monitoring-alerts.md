# Cloud Monitoring -- Alert Response Guide

**Project:** hmc-prod-473121
**Monitoring Console:** https://console.cloud.google.com/monitoring?project=hmc-prod-473121
**Primary Contact:** erica@healthmatters.clinic

---

## Alert Channels

Alerts are delivered by email to erica@healthmatters.clinic when notification
channels are configured in Cloud Monitoring. To verify or update the channel:

1. Open https://console.cloud.google.com/monitoring/alerting/notifications?project=hmc-prod-473121
2. Confirm an email channel exists for erica@healthmatters.clinic.
3. Click "Send test notification" to verify delivery.

Additional channels (SMS, PagerDuty, Slack) can be added from the same page.

---

## Configured Alert Policies

The following alert policies should be active for hmc-volunteer-portal. If any
are missing, create them using the procedure at the end of this runbook.

| Alert | Threshold | Severity |
|---|---|---|
| 5xx error rate | Greater than 1% over 5 minutes | High |
| p99 request latency | Greater than 2 seconds over 5 minutes | High |
| Instance count | Greater than 10 instances | Medium |
| Firestore errors | Greater than 5 errors per minute | High |
| Auth failure rate | Greater than 10 failures per minute | High |

---

## When You Receive a 5xx Alert

5xx errors indicate the server is failing to process requests.

**Immediate steps:**

1. Check whether a deploy happened in the last 30 minutes:

```bash
~/google-cloud-sdk/bin/gcloud builds list \
  --project=hmc-prod-473121 \
  --limit=5 \
  --format="table(id,status,createTime,finishTime)"
```

2. Pull recent Cloud Run logs and look for errors:

```bash
~/google-cloud-sdk/bin/gcloud run services logs read hmc-volunteer-portal \
  --project=hmc-prod-473121 \
  --region=us-central1 \
  --limit=200
```

3. Look for `OOMKilled`, `out of memory`, unhandled exceptions, or failed
   secret reads.
4. If a recent deploy correlates with the spike, roll back immediately using
   the procedure in `portal-deploy.md`.
5. If no recent deploy, check Cloud Run memory and CPU metrics. If a container
   is OOMKilling, increase the memory limit in the Cloud Run service settings
   and redeploy.

---

## When You Receive a Latency Alert

p99 latency above 2 seconds degrades user experience and may indicate a
resource constraint or upstream API problem.

**Steps:**

1. Open the Cloud Run Metrics tab and check CPU utilization and memory:
   https://console.cloud.google.com/run/detail/us-central1/hmc-volunteer-portal/metrics?project=hmc-prod-473121
   If CPU is pegged at 100%, increase the CPU allocation or minimum instance
   count.

2. Check Firestore for slow queries. Open:
   https://console.cloud.google.com/firestore/data?project=hmc-prod-473121
   Review whether composite indexes exist for the query patterns used in the
   portal. Missing indexes cause Firestore to perform full collection scans.

3. Check whether Gemini API calls or Google Maps API calls are contributing to
   latency. Search logs for slow external call durations:

```bash
~/google-cloud-sdk/bin/gcloud run services logs read hmc-volunteer-portal \
  --project=hmc-prod-473121 \
  --region=us-central1 \
  --limit=200 \
  --filter="textPayload:gemini OR textPayload:maps"
```

4. If latency is caused by cold starts, set the minimum instance count to 1:

```bash
~/google-cloud-sdk/bin/gcloud run services update hmc-volunteer-portal \
  --min-instances=1 \
  --project=hmc-prod-473121 \
  --region=us-central1
```

---

## When You Receive an Auth Alert

Auth failures above 10 per minute indicate a configuration problem, not a
normal user error rate.

**Steps:**

1. Confirm the Google OAuth client is active:
   https://console.cloud.google.com/apis/credentials?project=hmc-prod-473121
   The OAuth 2.0 client for the portal must have status "Enabled."

2. Confirm the `GOOGLE_CLIENT_ID` environment variable in the Cloud Run service
   matches the client ID shown in the credentials console:

```bash
~/google-cloud-sdk/bin/gcloud run services describe hmc-volunteer-portal \
  --project=hmc-prod-473121 \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

3. Confirm `volunteer.healthmatters.clinic` is listed as an authorized
   JavaScript origin and authorized redirect URI on the OAuth client. A missing
   redirect URI will cause all logins to fail.

4. Check Firestore security rules if auth is succeeding but reads are failing:

```bash
firebase deploy --only firestore:rules --project hmc-prod-473121
```

---

## Silence an Alert During Maintenance

If you are performing planned maintenance and want to suppress alerts:

1. Open https://console.cloud.google.com/monitoring/alerting?project=hmc-prod-473121
2. Click "Alerting" in the left nav, then "Incidents."
3. Find the active incident and click "Snooze."
4. Set a snooze duration no longer than the planned maintenance window.
5. Add a note describing the maintenance being performed.

Do not snooze production alerts for more than 2 hours without a documented
reason.

---

## Add a New Alert Policy

Write an alert policy definition in YAML and apply it with the CLI:

```bash
~/google-cloud-sdk/bin/gcloud alpha monitoring policies create \
  --policy-from-file=policy.yaml \
  --project=hmc-prod-473121
```

Example `policy.yaml` for a 5xx rate alert:

```yaml
displayName: "hmc-volunteer-portal 5xx error rate"
conditions:
  - displayName: "5xx rate > 1%"
    conditionThreshold:
      filter: >
        resource.type="cloud_run_revision"
        AND resource.labels.service_name="hmc-volunteer-portal"
        AND metric.type="run.googleapis.com/request_count"
        AND metric.labels.response_code_class="5xx"
      comparison: COMPARISON_GT
      thresholdValue: 0.01
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
notificationChannels:
  - projects/hmc-prod-473121/notificationChannels/CHANNEL_ID
alertStrategy:
  notificationRateLimit:
    period: 3600s
```

Replace `CHANNEL_ID` with the ID from the notification channel list:

```bash
~/google-cloud-sdk/bin/gcloud alpha monitoring channels list \
  --project=hmc-prod-473121
```

Store all policy YAML files in `infra/monitoring/` in the
hmc-volunteer-portal repository so they can be version-controlled and
reapplied after project recreation.
