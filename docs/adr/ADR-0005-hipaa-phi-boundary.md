# ADR-0005: HIPAA PHI Boundary Definition

## Status

Accepted

## Context

HMC operates in the community health space. Several digital tools collect or process
information that may constitute Protected Health Information (PHI) under HIPAA:

- Check-Yourself: GAD-7 and PHQ-9 mental health screeners
- CalmKit: one-on-one coaching session notes and GPS-correlated wellness check-ins
- Volunteer Portal: SUD (substance use disorder) intake forms submitted by clients

Other tools collect no clinical data:

- Event Finder: community event listings and RSVPs (name, email, attendance)
- Unstoppable: program marketing and registration (name, email)
- Resource Directory: static resource listings, no user data collected
- sunny-harper: public-facing chatbot, no authentication, no stored user data
- Partner and volunteer profiles: contact info, skills, availability (PII, not PHI)

Without an explicit boundary decision, there is a risk of PHI drifting into systems not
covered by the GCP Business Associate Agreement (BAA), such as GitHub Pages-hosted apps,
third-party analytics, or unencrypted browser storage.

## Decision

Define a formal PHI boundary. PHI is permitted only in services covered by the GCP BAA.
PHI must never be stored or transmitted through GitHub Pages-hosted frontends, browser
localStorage/sessionStorage, or third-party analytics tools.

## PHI Services (inside the boundary)

| Service | PHI Type | Storage Location | BAA Coverage |
|---|---|---|---|
| Check-Yourself | GAD-7 / PHQ-9 screener results | Client-only in current implementation; no server persistence | GCP BAA applies if persisted to Firestore |
| CalmKit | Coaching session content, GPS wellness check-ins | Cloud Run session relay; Firestore if saved | GCP BAA (Cloud Run + Firestore) |
| Volunteer Portal | SUD intake forms | Firestore `/intakes/{uid}` | GCP BAA (Firestore) |

## Non-PHI Services (outside the boundary)

| Service | Data Collected | Notes |
|---|---|---|
| Event Finder | Name, email, RSVP status | PII only; no clinical data |
| Unstoppable | Name, email, program registration | PII only |
| Resource Directory | No user data | Static listings |
| sunny-harper | Conversation text | No auth; sessions not persisted |
| Partner / volunteer profiles | Contact info, skills, availability | PII only; stored in Firestore but not PHI |

## Decision Outcome

PHI is stored only in Cloud Run and Firestore, both covered by the GCP BAA. GitHub Pages
frontends are classified as non-PHI by design. Screener results (Check-Yourself) are
client-only until explicit user consent and server-side encryption at rest are implemented.

The GCP BAA must be signed and on file before any PHI is written to production Firestore.
A signed copy is required to be stored in the HMC legal folder in Google Drive.

## Consequences

**Positive**

- Clear guidance for every new feature: if it touches clinical data, it goes through Cloud
  Run and Firestore, not a static frontend.
- Eliminates the risk of PHI being committed to a GitHub repository or served from a
  GitHub Pages domain.
- HIPAA audit scope is limited to GCP services, reducing compliance surface area.

**Negative**

- Screener results (GAD-7, PHQ-9) cannot be persisted server-side in the current
  Check-Yourself implementation without adding a Cloud Run proxy endpoint, consent UI,
  and encryption-at-rest verification. Until those are built, longitudinal tracking is
  not possible.
- CalmKit GPS data constitutes PHI when combined with session content; any future offline
  sync feature must route through Cloud Run, not a direct Firestore client SDK call from
  the browser, to preserve audit logging.
- PHI endpoints on Cloud Run require audit logging (Cloud Logging sink to BigQuery or
  Cloud Storage) before the system can be considered HIPAA-ready. This work is tracked
  separately.

**Neutral**

- PII collected by Event Finder and Unstoppable (name, email) is subject to HMC Privacy
  Policy and standard data retention rules but does not require BAA coverage.
- The sunny-harper chatbot must include a visible disclaimer that it does not store
  personal health information and that users should not share PHI in the chat window.
- This boundary decision is reviewed whenever a new data collection feature is proposed.
  Any feature that crosses the boundary requires a security review before deployment.
