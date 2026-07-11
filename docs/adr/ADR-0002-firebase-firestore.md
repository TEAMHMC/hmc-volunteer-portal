# ADR-0002: Use Firestore as Primary Database

## Status

Accepted

## Context

The volunteer portal stores several categories of data:

- Volunteer profiles (name, contact, availability, skills, badges)
- Partner organization profiles and approval state
- SUD intake forms (PHI -- covered by GCP BAA)
- Health credit ledger (read-heavy, append-only writes)
- Notification preferences and session tokens

The data model is document-oriented: each entity is largely self-contained and the query
patterns are lookup-by-UID rather than complex relational joins. Firebase Authentication is
already in use, which means every authenticated user has a Firebase UID that can serve as a
natural document key without a separate user table.

The team has no existing PostgreSQL or MySQL infrastructure on GCP. Real-time listener
support is a future nice-to-have for partner dashboards.

## Decision

Use **Cloud Firestore** (Native mode) as the primary database for volunteer, partner, and
PHI data.

## Options Considered

| Option | Pros | Cons |
|---|---|---|
| Cloud SQL (PostgreSQL) | Relational model; strong typing; JOINs; mature tooling; full ACID | Requires always-on instance (cost); ORM complexity; Firebase Auth UID not a native key |
| Cloud Firestore | NoSQL documents; Firebase Auth UID as natural key; real-time listeners; serverless; GCP BAA covers PHI | No JOINs; denormalization required; security rules are the auth layer (must be tested carefully) |
| MongoDB Atlas | Flexible document model; strong ecosystem | Third-party vendor; separate BAA process; not GCP-native; additional cost |

## Decision Outcome

Firestore was selected. The decisive factors were:

- **Firebase Auth integration**: the UID returned by Firebase Auth maps directly to a
  Firestore document path (`/volunteers/{uid}`), eliminating a join between users and
  profiles.
- **Serverless**: no instance to manage or pay for when the portal is idle.
- **GCP BAA**: Firestore is covered under the GCP Business Associate Agreement, satisfying
  HIPAA requirements for SUD intake documents stored at `/intakes/{uid}`.
- **Document model fit**: volunteer and partner records are retrieved by UID; complex
  relational queries are not required at current scale.

## Consequences

**Positive**

- No ORM or migration tooling required; schema evolves document-by-document.
- Real-time listeners are available for future partner dashboards without additional
  infrastructure.
- Firestore security rules provide a declarative, testable authorization layer that enforces
  data isolation between volunteers and partners.
- HIPAA coverage is inherited from existing GCP BAA.

**Negative**

- No JOIN support; queries that would be a single SQL JOIN must be handled with multiple
  reads or denormalized fields.
- Security rules are the primary authorization boundary; a misconfigured rule exposes data
  directly. Rules must be reviewed on every schema change.
- Firestore does not enforce field types; application-level validation (Zod) is required.
- Point-in-time recovery and export schedules must be configured explicitly via Cloud
  Scheduler and Firestore export to Cloud Storage.

**Neutral**

- Health credit ledger uses a sub-collection pattern to keep append-only writes from
  bloating the volunteer document.
- Firestore indexes for composite queries must be declared in `firestore.indexes.json` and
  deployed with the Firebase CLI.
- The Firestore emulator is used in local development and CI to avoid writing to production.
