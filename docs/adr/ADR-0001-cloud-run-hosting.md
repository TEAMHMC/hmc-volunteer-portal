# ADR-0001: Use Google Cloud Run for Backend Hosting

## Status

Accepted

## Context

The HMC volunteer portal backend is a Node.js/Express API serving a React SPA. The team
needed a hosting platform that could:

- Scale automatically under variable event-day traffic spikes
- Stay within a near-zero cost envelope during low-traffic periods
- Integrate with the existing GCP footprint (Firebase Auth, Firestore, Secret Manager)
- Support container-based deployments from Cloud Build CI/CD

The team had no existing AWS or Azure footprint. Heroku was previously used for a prototype.
The backend handles authenticated routes, Firestore reads/writes, GAS webhook callbacks,
and PHI-adjacent endpoints (SUD intake, Check-Yourself relay) covered by the GCP BAA.

## Decision

Use **Google Cloud Run** for all backend API deployments.

## Options Considered

| Option | Pros | Cons |
|---|---|---|
| Heroku | Simple deploy; developer-friendly | Higher cost at scale; vendor lock-in; no GCP IAM integration |
| AWS ECS (Fargate) | Industry standard; flexible | Requires separate AWS account and IAM; no native Firebase integration; more complex networking |
| Google Cloud Run | Pay-per-request; GCP-native; container-based; integrates with Cloud Build, Secret Manager, and GCP IAM | Cold starts on zero-instance config; GCP IAM learning curve for new contributors |

## Decision Outcome

Cloud Run was selected. The key factors were:

- **Cost model**: pay-per-request means idle periods cost nothing beyond minimum instances.
- **GCP-native integration**: Secret Manager, Firestore, Firebase Auth, and Cloud Build all
  work without cross-provider credential management.
- **Container portability**: the same Dockerfile runs locally and in production.
- **HIPAA coverage**: GCP BAA already covers Cloud Run; no additional BAA negotiation needed.

Cold start latency is mitigated by setting `min-instances=1` on the production service,
keeping one container warm at all times.

## Consequences

**Positive**

- Zero ops overhead for server patching or VM management.
- Autoscaling handles event-day spikes without pre-provisioning.
- Deployment is a single `gcloud run deploy` or Cloud Build trigger.
- PHI endpoints inherit GCP BAA coverage automatically.

**Negative**

- Contributors need GCP IAM familiarity; no simple Heroku-style GUI onboarding.
- Cold starts on staging (min-instances=0 to save cost) can slow PR preview testing.
- Cloud Run does not support WebSockets natively; any future real-time feature requires
  Cloud Run with HTTP/2 streaming or a separate service.

**Neutral**

- A staging Cloud Run service must be maintained alongside production.
- Cloud Build pipeline configuration lives in `cloudbuild.yaml` at repo root.
- Service account least-privilege roles must be documented and enforced via Terraform or
  manual IAM policy review.
