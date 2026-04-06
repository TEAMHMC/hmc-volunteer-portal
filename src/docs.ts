import { KnowledgeBaseArticle } from './types';

export const KNOWLEDGE_BASE_ARTICLES: KnowledgeBaseArticle[] = [
    {
        id: 'policy-001',
        category: 'Policies & Procedures',
        title: 'Volunteer Code of Conduct',
        content: `## Volunteer Code of Conduct

All volunteers at Health Matters Clinic are expected to adhere to the following principles to ensure a safe, respectful, and effective environment for everyone.

### Respect and Dignity
- Treat all clients, staff, and fellow volunteers with respect, dignity, and cultural sensitivity.
- Maintain confidentiality of all client information in accordance with HIPAA and HMC policies.

### Professionalism
- Arrive on time for scheduled shifts and notify your coordinator in advance if you are unable to attend.
- Wear appropriate attire, including your volunteer badge, at all times during your shift.
- Refrain from using personal mobile devices for non-emergency purposes while on duty.

### Safety
- Follow all safety protocols and procedures outlined for your specific role and event.
- Report any accidents, injuries, or safety concerns to your shift lead immediately.
- Do not perform tasks outside the scope of your assigned role or training.`,
        tags: ['conduct', 'policy', 'professionalism', 'safety']
    },
    {
        id: 'policy-002',
        category: 'Policies & Procedures',
        title: 'HIPAA and Client Confidentiality',
        content: `## HIPAA and Client Confidentiality

Protecting client privacy is a top priority at Health Matters Clinic.

### What is PHI?
Protected Health Information (PHI) includes any identifiable information about a client's health status, provision of health care, or payment for health care. This includes names, dates, addresses, and medical details.

### Key Rules
1.  **Do Not Disclose:** Never share client PHI with anyone who is not authorized to receive it.
2.  **Minimum Necessary:** Only access or use the minimum amount of PHI necessary to perform your volunteer duties.
3.  **Secure Handling:** Ensure any physical or digital documents containing PHI are handled and stored securely.
4.  **Social Media:** Do not post any information or photos that could identify a client on social media.`,
        tags: ['hipaa', 'privacy', 'confidentiality', 'phi']
    },
    {
        id: 'glossary-001',
        category: 'Glossary of Terms',
        title: 'CHW (Community Health Worker)',
        content: `### CHW (Community Health Worker)
A Community Health Worker is a frontline public health worker who is a trusted member of and/or has an unusually close understanding of the community served. This trusting relationship enables the CHW to serve as a liaison/link/intermediary between health/social services and the community to facilitate access to services and improve the quality and cultural competence of service delivery.`,
        tags: ['glossary', 'role', 'chw']
    },
    {
        id: 'glossary-002',
        category: 'Glossary of Terms',
        title: 'SDOH (Social Determinants of Health)',
        content: `### SDOH (Social Determinants of Health)
The social determinants of health are the non-medical factors that influence health outcomes. They are the conditions in which people are born, grow, work, live, and age, and the wider set of forces and systems shaping the conditions of daily life. These forces and systems include economic policies and systems, development agendas, social norms, social policies and political systems.

Examples include:
- Safe housing, transportation, and neighborhoods
- Racism, discrimination, and violence
- Education, job opportunities, and income
- Access to nutritious foods and physical activity opportunities
- Polluted air and water
- Language and literacy skills`,
        tags: ['glossary', 'sdoh', 'health equity']
    },
    {
        id: 'program-001',
        category: 'Program Overviews',
        title: 'Street Medicine Program',
        content: `## Street Medicine Program Overview

### Mission
The HMC Street Medicine program provides direct, on-the-street medical care, social support, and referral services to unsheltered individuals in Los Angeles County.

### Services Offered
- Basic wound care and first aid
- Health screenings (blood pressure, glucose)
- Distribution of hygiene kits and basic supplies
- Referrals to housing, mental health, and substance use treatment services
- Building trust and consistent relationships with our unhoused neighbors.`,
        tags: ['program', 'street medicine', 'outreach']
    },
    {
        id: 'protocol-001',
        category: 'Volunteer Protocols & References',
        title: 'Volunteer Field Reference',
        content: 'Comprehensive field reference covering screening protocols (blood pressure, glucose, BMI, HIV, naloxone, emergency response) and the traffic-light escalation system for volunteer operations.',
        documentUrl: '/documents/HMC-Volunteer-Field-Reference.html',
        tags: ['protocol', 'field reference', 'screening', 'escalation', 'volunteer']
    },
    {
        id: 'protocol-002',
        category: 'Volunteer Protocols & References',
        title: 'Clinical Onboarding Guide',
        content: 'Step-by-step onboarding guide for clinical volunteers including orientation, compliance requirements, scope of practice, and supervision protocols.',
        documentUrl: '/documents/clinical-onboarding-guide.html',
        tags: ['protocol', 'clinical', 'onboarding', 'guide'],
        visibleTo: ['Licensed Medical Professional']
    },
    {
        id: 'protocol-003',
        category: 'Volunteer Protocols & References',
        title: 'Clinical Policies & Procedures Manual',
        content: 'Full clinical policies and procedures manual covering governance structure, volunteer expectations, compliance standards, and operational protocols.',
        documentUrl: '/documents/HMC-Clinical-Policies-Procedures-Manual-v1.0.html',
        tags: ['protocol', 'clinical', 'policies', 'procedures', 'manual'],
        visibleTo: ['Licensed Medical Professional']
    },
    {
        id: 'protocol-004',
        category: 'Volunteer Protocols & References',
        title: 'Standing Orders v3.0',
        content: 'Current standing orders for clinical procedures and protocols used during health screenings, wellness events, and street medicine operations.',
        documentUrl: '/documents/HMC-Standing-Orders-v3.0.html',
        tags: ['protocol', 'standing orders', 'clinical', 'procedures'],
        visibleTo: ['Licensed Medical Professional']
    },
    {
        id: 'protocol-005',
        category: 'Volunteer Protocols & References',
        title: 'General Screening Consent Form',
        content: 'Standard consent form template used for health screenings and clinical services at HMC events.',
        documentUrl: '/documents/HMC-General-Screening-Consent-Form.html',
        tags: ['protocol', 'consent', 'screening', 'form'],
        visibleTo: ['Licensed Medical Professional']
    },
    {
        id: 'runbook-001',
        category: 'Runbooks & Tutorials',
        title: 'New Volunteer Quick Start Guide',
        content: `## New Volunteer Quick Start Guide

Welcome to Health Matters Clinic! This guide walks you through everything you need to know to get started in the volunteer portal.

### Step 1: Logging In
Go to the HMC Volunteer Portal URL you received in your welcome email. Sign in with the email address you used when you applied. If you forgot your password, use the "Forgot Password" link on the login screen.

### Step 2: What Each Section Does

The sidebar on the left (or the hamburger menu on mobile) is your main navigation. Here is what each section is for:

- **Overview** — Your home dashboard. Shows your upcoming events, XP level, hours contributed, and daily quests.
- **My Missions** — The events you are signed up for. Click any event to see details or enter Event Ops Mode on the day of the event.
- **Calendar** — See all upcoming HMC events and your personal schedule in one view.
- **Training Academy** — Complete required orientation videos and optional skill modules. You must finish the 2 Tier 1 orientation videos before you can sign up for events.
- **Doc Hub** — Policies, protocols, glossary, and guides (including this one). Searchable.
- **Communication Hub** — Send and receive direct messages, view org-wide announcements, and submit support tickets if you need help.
- **Impact Hub** — See your personal volunteer stats, badges, achievements, and the org-wide impact leaderboard.
- **Referral Hub** — Share HMC resources and community health information with people in your network.

### Step 3: Logging Volunteer Hours
Hours are logged automatically when you check in and check out through Event Ops Mode on the day of an event. Here is how:
1. Open **My Missions** and click the event you are attending.
2. Tap **"Enter Event Ops Mode"** (you will see this button on the event card once the event is active).
3. Tap the green **"I'm Here"** button at the top of the screen to check in. Your hours start counting from this moment.
4. At the end of the event, tap **"Check Out"** in the header. Your hours are automatically recorded and added to your profile.
5. You will also be prompted to complete a short end-of-day debrief survey — this helps us improve future events.

If you missed checking in/out, contact your event lead or submit a support ticket via the Communication Hub.

### Step 4: Accessing Training
1. Click **Training Academy** in the sidebar.
2. Complete the two Tier 1 orientation modules first: **HMC Orientation** and **Because You're a Champion**.
3. Once both are complete and your role is approved by an admin, you will be cleared to sign up for community missions.
4. Additional Tier 2 training modules cover specific skills like health screenings, street medicine, and community surveys. Complete them to unlock advanced event roles.

### Step 5: Using the Calendar
Click **Calendar** in the sidebar to see a full calendar view of all upcoming HMC events. You can switch between month, week, and list views. Events you are signed up for are highlighted. Click any event to see details.

### Step 6: Submitting a Support Ticket
If you have a technical issue, a question for staff, or need help with something in the portal:
1. Click **Communication Hub** in the sidebar.
2. Select the **Support** tab.
3. Click **New Ticket**, fill in the subject and description, and choose a priority level.
4. Submit — a coordinator will respond within 1–2 business days.
You will receive a notification when your ticket is updated.

### Step 7: What is Event Ops Mode and When Do You Use It?
Event Ops Mode is the real-time work environment you use on the day of a community health event. Think of it as your digital clipboard and sign-in sheet combined. You only enter it on the actual day of an event you are signed up for.

**What you do in Event Ops Mode:**
- Check in when you arrive (tap "I'm Here") — this starts your hour tracking and assigns you a buddy pair.
- Review the **Brief** tab to see your mission summary, goals, your assigned role, and the team roster.
- Use the **Survey**, **Intake**, **Health**, and **Tracker** tabs during the event to log every client interaction.
- Report any safety issues using the **Alerts** tab — your lead is notified immediately.
- When done, tap **"Check Out"** and then complete the **Finish** tab to sign off. This saves your hours.

**You do NOT need Event Ops Mode for:** browsing training, viewing the calendar, sending messages, or submitting support tickets. Those all live in the main portal sidebar.`,
        tags: ['runbook', 'onboarding', 'new volunteer', 'quick start', 'tutorial', 'hours', 'training', 'event ops', 'calendar', 'support ticket']
    },
    {
        id: 'runbook-002',
        category: 'Runbooks & Tutorials',
        title: 'HMC Champion Ambassador Guide',
        content: `## HMC Champion Ambassador Guide

### What is an HMC Champion?
An HMC Champion is a community outreach ambassador — someone who cares about health equity and wants to connect people in their community to resources, but may not be a fully onboarded clinical or operational volunteer. HMC Champions are the trusted faces of Health Matters Clinic in neighborhoods across Los Angeles.

Champions typically:
- Spread awareness of HMC programs and upcoming events in their personal and professional networks
- Share health resources with friends, family, neighbors, and community members
- Direct people to HMC services using the Referral Hub
- Attend community events as ambassadors (not as operational staff)
- Optionally, support HMC by promoting Take Action LA and other advocacy campaigns

You do not need clinical training to be an HMC Champion. The role is designed for people who want to make a difference through relationship and community trust.

### How to Share Resources
The **Referral Hub** (in the sidebar under COMMUNITY) is your primary tool for sharing HMC resources:

1. Click **Referral Hub** in the left sidebar.
2. Browse the available resource cards — these include HMC event listings, health education materials, community services, and referral links.
3. Click **Share** on any card to copy a shareable link or open a pre-filled message you can send via text, email, or social media.
4. Your personal **referral code** is embedded in your sharing links. When someone signs up through your link, the referral is tracked to you and you earn XP.

You can also download printable resource flyers from the **Doc Hub** to hand out in person.

### How to Use the Referral Hub
The Referral Hub tracks all your referral activity and shows you:
- Your **referral code** (unique to you — share this with people you refer)
- A count of how many people have used your referral link
- XP earned from referrals
- Available resources organized by category (health, housing, mental health, food access, etc.)

**Tips for effective outreach:**
- Be personal: share your own story of why you got involved with HMC.
- Be specific: when someone has a need (food, mental health support, housing), find the closest-matching resource card and share it directly.
- Follow up: if someone you referred attended an event, check in with them afterward.
- Stay informed: watch the **Calendar** and the **Communication Hub** for new events and announcements you can share with your network.

### Questions?
Reach out through the **Communication Hub** — submit a support ticket or message your HMC Champion coordinator directly. You can also attend a Champion check-in call (dates posted in the Calendar and Announcements).`,
        tags: ['runbook', 'hmc champion', 'ambassador', 'outreach', 'referral hub', 'community', 'sharing']
    },
    {
        id: 'admin-checklist-001',
        category: 'Admin & Operations',
        title: 'Pre-Launch Security Checklist',
        content: `## Pre-Launch Security Checklist — HMC Volunteer Portal
### To be verified by admin before launching to 800 volunteers

1. **Role-based access control (RBAC) is enforced server-side.** Confirm that admin-only API routes (e.g., /api/volunteers, /api/audit-logs, /api/referrals) validate the requesting user's isAdmin flag on the backend — client-side role checks in Dashboard.tsx are UI conveniences only and must not be the sole guard.

2. **PHI is not exposed to unauthorized roles.** Verify that health screening records, client intake/referral records, and any form data containing Protected Health Information are only retrievable by users with the appropriate clinical or admin role — both in the API response and in the UI (HealthScreeningsView and IntakeReferralsView are role-gated in the sidebar, but confirm the underlying API endpoints enforce the same).

3. **Volunteer directory data is admin-only.** The AdminVolunteerDirectory and the /api/volunteers list endpoint should return full volunteer profiles (including email, phone, compliance status) only to isAdmin users. Non-admin users should not be able to enumerate other volunteers' PII.

4. **Analytics data does not leak volunteer PII.** The AnalyticsDashboard is visible to Board, Advisory Board, Tech Team, Data Analyst, and Admin roles. Confirm the underlying /api/volunteer-feedback and /api/survey-stats endpoints return only aggregate data — no individual names, emails, or identifiable responses.

5. **Audit logs are admin-only.** The Audit Trail tab in Event Ops Mode is rendered only for isAdmin users in the UI. Confirm the /api/audit-logs endpoints are similarly restricted and that logs do not surface in any non-admin API response.

6. **Session tokens expire and are invalidated on logout.** Verify the authentication system (Firebase Auth or equivalent) invalidates or expires tokens on sign-out, and that the /auth/me endpoint rejects expired tokens — stale sessions should not persist access for former volunteers.

7. **File/document uploads are scanned and access-controlled.** If volunteers can upload documents (compliance files, signatures), confirm uploads are stored in a private bucket, not publicly accessible URLs, and that the serving endpoint validates the requester's identity before returning files.

8. **Presence tracking does not expose location data.** The presence ping (/api/volunteer/presence) records online status. Confirm it does not store or expose geolocation data beyond what is strictly needed, and that presence data is only visible to admins/coordinators — not to other volunteers.

9. **Support ticket contents are scoped per user.** The CommunicationHub shows each volunteer only their own tickets. Verify that the /api/support-tickets endpoint enforces this server-side and that an authenticated volunteer cannot enumerate another volunteer's ticket IDs or read their content.

10. **Rate limiting and input validation are in place on all write endpoints.** Before 800 simultaneous users hit the system at event time, confirm that endpoints handling concurrent writes (check-in, checkout, screening logs, incident reports) have rate limiting, input sanitization, and idempotency guards to prevent double-submissions and data corruption.`,
        tags: ['admin', 'security', 'checklist', 'pre-launch', 'privacy', 'hipaa', 'rbac']
    },
];
