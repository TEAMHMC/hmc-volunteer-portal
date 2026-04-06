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
        id: 'portal-overview-001',
        category: 'Portal Features & Navigation',
        title: 'HMC Volunteer Portal — Feature Overview',
        content: `## HMC Volunteer Portal — Feature Overview

The HMC Volunteer Portal is your all-in-one hub for everything related to your experience as a Health Matters Clinic volunteer or Champion. Below is a summary of every major section.

**Take an interactive tour:** [volunteer.healthmatters.clinic/tour](/tour)

---

### Overview (Home Dashboard)
Your personal home screen. Shows your current XP level, volunteer hours, upcoming events, active announcements, daily quests, and quick-access shortcuts.

### My Missions
A list of every HMC event or community mission you are registered for. On the day of an event, the **Enter Event Ops Mode** button appears here so you can check in, log interactions, and check out.

### Calendar
A full calendar view of all scheduled HMC events — month, week, or list format. Events you are signed up for are highlighted. Click any event to view details or register.

### Training Academy
All required orientation modules and optional skill tracks. Tier 1 modules (HMC Orientation + Because You're a Champion) must be completed before you can sign up for community missions. Tier 2 modules cover advanced skills (screenings, street medicine, community surveys).

### Doc Hub
This documentation system. Search policies, protocols, glossary terms, runbooks, and reference guides. Admins can add and edit articles directly from the Doc Hub interface.

### Communication Hub
Three tools in one:
- **Announcements** — Org-wide broadcasts from HMC coordination staff.
- **Direct Messages** — Private conversations with other portal members.
- **Support Tickets** — Submit a help request; coordinators respond within 1–2 business days.

### Impact Hub
Your personal volunteer stats: total hours, events attended, XP, badges earned, and your rank on the community leaderboard.

### Referral Hub
Browse and share HMC health resources, event listings, and community services. Your personal referral link (with your unique code) is shown here — when someone signs up through your link, you earn XP and the referral is tracked to you.

### Event Ops Mode
The real-time work environment used on the day of an event. Contains: Check-In / Check-Out, the Mission Brief, Client Survey, Health Screening, Intake, Tracker, Alerts, and end-of-day Debrief.

### Project Board *(admin/lead roles)*
Track HMC team projects and tasks. Create projects, assign them, add notes, mark complete, or delete.

### Analytics *(senior roles)*
Volunteer engagement metrics, event data, survey results, and system health monitoring.

### Client Intake / Referrals *(clinical roles)*
Manage intake forms for clients seen at HMC events and track referrals to partner organizations.

### Admin Panel *(admin only)*
Volunteer directory, new applicant review, role assignment, compliance status, and CSV import tools.`,
        tags: ['portal', 'overview', 'navigation', 'features', 'tour', 'guide']
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
        id: 'glossary-003',
        category: 'Glossary of Terms',
        title: 'HMC Champion',
        content: `### HMC Champion
An HMC Champion is a community outreach ambassador — someone who shares HMC resources and spreads awareness of HMC programs within their personal and professional networks. Champions have access to the Referral Hub, Resource Hub, and Calendar, and earn XP through referrals and engagement activities.

HMC Champions are not clinical or operational volunteers but are a recognized and valued part of the HMC community. Anyone who creates a portal account may receive Champion access; full volunteer roles are available by application through the portal.`,
        tags: ['glossary', 'hmc champion', 'ambassador', 'role', 'referral']
    },
    {
        id: 'glossary-004',
        category: 'Glossary of Terms',
        title: 'XP (Experience Points)',
        content: `### XP (Experience Points)
XP is the portal's engagement currency. You earn XP by completing training modules, checking into events, logging hours, making referrals, and finishing daily quests. XP accumulates to raise your volunteer Level, which unlocks badges and appears on the Impact Hub leaderboard.

XP does not affect your operational role or event eligibility — it is a recognition system to celebrate participation and community impact.`,
        tags: ['glossary', 'xp', 'experience points', 'gamification', 'level', 'badges']
    },
    {
        id: 'glossary-005',
        category: 'Glossary of Terms',
        title: 'Event Ops Mode',
        content: `### Event Ops Mode
Event Ops Mode is the real-time work interface activated on the day of a community event. It replaces paper check-in sheets and clipboards with a digital workflow covering:

- **Check-In / Check-Out** — records your hours automatically
- **Brief** — your mission summary, role, and team roster
- **Survey / Intake / Health** — tools for logging client interactions during the event
- **Alerts** — flag safety issues to your event lead in real time
- **Debrief** — end-of-day sign-off and feedback form

Event Ops Mode is only accessible on the day of an event you are registered for.`,
        tags: ['glossary', 'event ops', 'check-in', 'check-out', 'event day', 'ops']
    },
    {
        id: 'glossary-006',
        category: 'Glossary of Terms',
        title: 'Referral Code',
        content: `### Referral Code
A unique code assigned to every portal user. When you share your personal referral link (found in the Referral Hub or your Champion dashboard), the code is embedded in the URL. If someone creates a portal account through your link, the referral is attributed to you and you earn XP.

Your referral link format: \`volunteer.healthmatters.clinic?ref=YOUR_CODE\``,
        tags: ['glossary', 'referral', 'referral code', 'link', 'champion', 'xp']
    },
    {
        id: 'glossary-007',
        category: 'Glossary of Terms',
        title: 'Take Action LA',
        content: `### Take Action LA
Take Action LA is an HMC initiative in partnership with LACDMH (Los Angeles County Department of Mental Health) focused on community health outreach and wellness events across Los Angeles. HMC volunteers and Champions can attend Take Action LA events as part of their community mission work.

Upcoming Take Action LA events are listed on the Calendar and on the public event page at healthmatters.clinic/takeactionla.`,
        tags: ['glossary', 'take action la', 'lacdmh', 'event', 'outreach']
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
        id: 'runbook-003',
        category: 'Runbooks & Tutorials',
        title: 'Training Progression & Event Eligibility — How It Works',
        content: `## Training Progression & Event Eligibility

Training in the HMC Volunteer Portal is structured into tiers. Each tier you complete unlocks the next level of access — including event registration, program participation, and specialized roles. This guide explains the full progression.

---

### The Tier System

**Tier 1 — Orientation (Required for everyone)**
This is where every new volunteer starts. Tier 1 includes the foundational HMC modules:
- HMC Orientation
- Because You're a Champion
- Volunteer Rights & Ethics
- HIPAA Overview (non-clinical version)

You must complete all Tier 1 modules before anything else unlocks. Until Tier 1 is finished, you cannot register for events, access your Missions list, or proceed to higher tiers. Completing Tier 1 during your initial application (the onboarding flow) counts — you will not need to repeat it.

---

**Tier 2A — Core Baseline (Required for active field volunteers)**
Tier 2A unlocks after your application is reviewed and approved by an admin. These modules prepare you for real community health events:
- Community Mental Health & Wellness (Parts 1 and 2)
- Survey Data Collection
- De-escalation

Completing Tier 2A activates your **Core Volunteer Status** — the internal flag that enables event registration. You will not see the "Sign Up" option on events until this status is active.

---

**Tier 2B — Field Readiness (Recommended before your first in-person event)**
These modules are not strictly required before registration, but are expected before you participate:
- Safety & Personal Health
- Street Medicine Introduction
- Health Screening Basics

Completing Tier 2B, combined with Tier 2A, fully activates your **Health Fair Gate** — which unlocks general community health events.

---

**Tier 3 — Program-Specific Clearance (Required for specialized work)**
These modules unlock access to specific program tracks and event types:
- **Street Medicine training** — required before attending Street Medicine events
- **Clinical Services training** — required for Licensed Medical Professional roles (also unlocks the Clinical Gate)
- **Community Wellness / Health Outreach tracks** — unlock program-specific event types

Completing program training is tracked on your profile. Events tied to a specific program (e.g., Street Medicine pop-ups) will only appear as registerable once the corresponding gate is open.

---

**Tier 4 — Governance (Board and Community Advisory Board roles only)**
Board members and CAB members skip Tier 2A/2B and instead complete governance-specific modules:
- Board Policies & Procedures
- Meeting Conduct & Confidentiality
- Fiduciary Responsibilities

Governance roles still complete Tier 1. Field training (Tier 2B) is optional for them.

---

### What Each Gate Controls

| Gate | What It Unlocks | How to Open It |
|------|-----------------|----------------|
| Core Volunteer Status | Event registration ("My Missions" active) | Tier 2A complete + application approved |
| Health Fair Gate | General community health events | Core Volunteer Status + Tier 2B complete |
| Street Medicine Gate | Street medicine and outreach events | Role eligibility + Street Medicine training |
| Clinical Gate | Clinical services events | Licensed Medical/Admin role + Clinical training |
| Naloxone Distribution | Naloxone-related event roles | Separate request + specific compliance training |

---

### Governance and HMC Champion Exceptions

- **HMC Champions**: Only Tier 1 is shown until your application is approved and a full volunteer role is assigned. After approval, Tier 2 and beyond unlock automatically.
- **Governance roles**: Skip Tier 2 field training requirements. Event eligibility for governance roles is based on Tier 1 completion + role assignment.

---

### How Training Completion Is Tracked

- Progress auto-saves as you complete each module. If you close the browser mid-module, your progress is preserved.
- Some modules end with a short quiz (video modules) or an AI-generated knowledge check (read modules). You must pass the check to mark the module complete.
- Modules requiring a legal signature (governance or clinical policy modules) ask you to type your full legal name to confirm.
- Your Training Academy page shows which tiers are complete, which are in progress, and what is locked next.

---

### FAQ

**Why can I not sign up for events yet?**
Check your Training Academy. If your Tier 2A Core modules are incomplete, event registration is locked. If they are complete but you still cannot register, your application may not yet be approved — contact your coordinator or submit a support ticket.

**I completed training but the event still says I am not eligible.**
Some events require program-specific training (Tier 3) in addition to Core Volunteer Status. Check the event listing for any listed requirements, then look for the corresponding training module in the Academy.

**Can I skip ahead to a higher tier?**
No. Tiers must be completed in order. Lower tiers unlock higher ones — there is no bypass.

**I completed orientation during my application. Does it count?**
Yes. If you watched the HMC Orientation and HMC Champion videos during the onboarding flow, they are marked complete automatically on your training record.`,
        tags: ['runbook', 'training', 'tiers', 'event eligibility', 'gates', 'core volunteer', 'tier 1', 'tier 2', 'missions', 'unlock']
    },
    {
        id: 'runbook-004',
        category: 'Runbooks & Tutorials',
        title: 'Project Board — How to Use It',
        content: `## Project Board — How to Use It

The Project Board is HMC's internal task and project management tool. It is accessible to all volunteers (view only) and editable by coordinators, leads, and admins.

---

### Who Can Do What

| Role | Can View | Can Create/Edit Tasks | Can Create/Delete Projects |
|------|----------|----------------------|---------------------------|
| All volunteers | Yes (read only) | No | No |
| Events Lead, Program Coordinator, General/Operations Coordinator, Development Coordinator, Outreach & Engagement Lead, Volunteer Lead | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes |

---

### Projects vs. Tasks

**Projects** are the top-level containers. Each project has:
- A title and description
- A status (Active or Completed)
- An optional due date
- A list of milestones/phases (used to group tasks)
- A list of assigned team members

**Tasks** live inside projects. Each task has:
- Title and description
- Status: **To Do → In Progress → Review → Done**
- Priority: Low, Medium, High, or Urgent
- An assignee (any active volunteer)
- An optional phase/milestone label
- Start and due dates
- Notes

---

### Creating a Project

1. Click **New Project** in the top right of the Project Board.
2. Enter a title, description, and (optionally) a due date.
3. Add milestones to break the project into phases — for example: "Planning", "Outreach", "Event Day", "Follow-Up."
4. Save. The project appears in the Active tab.

---

### Adding Tasks

1. Open a project and click **Add Task**.
2. Fill in the title, description, priority, and assignee.
3. Choose a phase (if the project has milestones) or leave it unphased.
4. Set a due date if the task has a deadline.
5. Save. The task appears in the **To Do** column on the Kanban view.

---

### Moving Tasks Through the Workflow

**Kanban view**: Drag and drop cards between columns (To Do, In Progress, Review, Done).

**List/Timeline view**: Use the status dropdown on each task to update its stage.

Overdue tasks (due date passed, not marked Done) are flagged automatically with a red indicator.

---

### Completing or Deleting a Project

- **Mark Complete**: Click the **...** menu on the project card → "Mark as Complete." The project moves to the Completed tab. Completed projects cannot be edited.
- **Delete Project**: Click the **...** menu → "Delete Project." This permanently removes the project and all its tasks. Admins only.

---

### Tips for Coordinators

- Use **phases/milestones** to organize multi-week campaigns. Group all week-1 tasks under a "Week 1" phase so nothing gets lost.
- Assign tasks at the start of a project cycle so everyone knows their responsibilities before the event.
- Check the Project Board during your weekly coordination meeting — overdue tasks show a visual flag so they are easy to catch.
- Use the **Notes** field on tasks to leave context or blockers so the next person knows where things stand.`,
        tags: ['runbook', 'project board', 'tasks', 'kanban', 'coordinator', 'projects', 'milestones', 'phases']
    },
    {
        id: 'runbook-005',
        category: 'Runbooks & Tutorials',
        title: 'Communication Hub — Broadcasts, Messaging & Tickets',
        content: `## Communication Hub — Broadcasts, Messaging & Tickets

The Communication Hub has three tools: **Broadcasts** (org-wide announcements), **Briefing** (direct messages and team chat), and **Support Tickets**. Here is how to use each one.

---

## Broadcasts (Announcements)

### Who Can Send Broadcasts
Broadcasts can be sent by: Admins, Volunteer Leads, Events Leads, and Operations Leads.

All other volunteers see the Broadcasts tab in read-only mode — they receive and can read announcements but cannot compose or send them.

### Sending a Broadcast

1. Go to **Communication Hub → Broadcasts**.
2. Click **New Announcement** (visible only to broadcast-eligible roles).
3. Write a **title** and **body**. Keep the body clear and actionable — recipients see this directly.
4. Set your **target audience**:
   - **Role filter**: Choose a specific volunteer role ("Events Lead," "Core Volunteer," etc.) or leave as "All" to reach everyone.
   - **Status filter**: Target active volunteers, those still in onboarding, or a custom status group.
   - **Skill filter**: Target volunteers with specific tags (e.g., bilingual, healthcare_worker).
5. Choose **delivery method**: Email, SMS (if phone numbers are on file), or both.
6. Review the recipient count shown before sending.
7. Click **Send**. A delivery summary confirms how many messages were sent successfully.

### When to Use Broadcasts
- Pre-event reminders (shift confirmation, location, what to bring)
- Role-specific training deadlines
- Org-wide policy updates
- Volunteer appreciation or milestone announcements
- Urgent cancellations or schedule changes

---

## Briefing (Direct Messages & Team Chat)

### Channels
- **#general** — A team-wide channel. All volunteers can read and post. Use this for non-urgent questions, sharing resources, and community conversation.
- **Direct Messages (1:1)** — Private conversations between two portal users. Search for any volunteer by name to start a conversation.

### Using the Chat
1. Go to **Communication Hub → Briefing**.
2. Select **#general** for team-wide chat or use the search bar to find a specific person for a DM.
3. Type your message and press Enter (or click Send).
4. Use **@Name** to mention someone — they will receive a notification.

### Real-Time Messaging
Messages appear in real time. If your connection drops, the system falls back to checking for new messages every 5 seconds automatically.

Unread DM conversations show a badge count. Clicking into a conversation marks all messages as read.

---

## Support Tickets

### Who Should Use Tickets
Any volunteer who has a technical issue, access problem, scheduling question, compliance question, or feedback to submit should use the Support Ticket system — not DMs. Tickets create a trackable record that coordinators can manage and prioritize.

### Submitting a Ticket (Volunteers)

1. Go to **Communication Hub → Support**.
2. Click **New Ticket**.
3. Fill in:
   - **Subject**: A clear one-line summary of the issue.
   - **Description**: Full details — what you were trying to do, what happened, any error messages.
   - **Category**: Choose the closest match (Technical Issue, Account/Access, Training, Scheduling, Compliance, Feedback, Task, Project, Other).
   - **Priority**: Low, Medium, High, or Urgent.
4. Submit. You will receive a notification when a coordinator responds.

### Ticket Statuses
- **Open** — Submitted, not yet assigned.
- **In Progress** — Assigned to a coordinator who is actively working on it.
- **Closed** — Resolved.

### Managing Tickets (Coordinators & Admins)

1. Go to **Communication Hub → Support**. Admins see all tickets; volunteers only see their own.
2. Open a ticket to view full details.
3. **Assign** the ticket to yourself or another coordinator using the assignment dropdown.
4. Change status to **In Progress** once you begin work.
5. Add **Notes** to communicate with the volunteer (public notes) or document internal context (internal notes — hidden from the volunteer).
6. When resolved, mark as **Closed**.

**Internal Notes**: Only visible to admins and the assigned coordinator. Use these to document troubleshooting steps, escalation decisions, or sensitive context that should not be visible to the volunteer.

### Ticket Features
- **Attachments**: Volunteers and admins can attach screenshots, PDFs, or documents (up to 5MB) to help explain or resolve an issue.
- **Activity Log**: Every status change, assignment, edit, and note addition is recorded with a timestamp. This creates a full audit trail for compliance purposes.
- **@Mentions in Notes**: Tag a specific coordinator in a note (type @Name) to notify them directly.`,
        tags: ['runbook', 'communication hub', 'broadcast', 'announcements', 'messages', 'direct messages', 'support tickets', 'coordinator', 'admin']
    },
    {
        id: 'runbook-006',
        category: 'Runbooks & Tutorials',
        title: 'Admin Runbook: Reviewing & Approving New Volunteer Applications',
        content: `## Admin Runbook: Reviewing & Approving New Volunteer Applications

This guide is for HMC system administrators and senior coordinators who review incoming volunteer applications and manage the approval workflow.

---

### Where Applications Land

When a new volunteer submits their application through the onboarding flow, their record is created with:
- **Role**: "HMC Champion" (default until you assign a full role)
- **Application Status**: "Pending Review"
- **Training**: Tier 1 orientation auto-marked if they completed it during signup

New applications appear in:
1. **Admin Panel → Applicants tab** (primary review location)
2. The overview dashboard notification badge (new applicants count)

---

### Step-by-Step: Reviewing an Application

1. Go to **Admin Panel** in the left sidebar.
2. Click the **Applicants** tab.
3. Use the filters to sort by applied role, group vs. individual, or returning volunteer status.
4. Click on an applicant to open their full profile.

**What you will see in the review modal:**
- Personal details: name, email, phone, address, DOB
- Applied role and resume (downloadable)
- Availability: days, hours per week, start date, scheduling notes
- Role-specific assessment answers (the questions they were asked during signup)
- Compliance checklist status (what is verified vs. pending)
- Demographics and background context
- Referral code (if they joined through a Champion's link)

---

### Approving a Volunteer

1. After reviewing, click **Approve**.
2. Optionally add a note (e.g., "Approved for Events Lead role — bilingual asset").
3. Confirm. The system will:
   - Set \`applicationStatus\` → "approved"
   - Unlock Tier 2 training modules for the volunteer
   - Send an automated email notification to the volunteer
4. After approval, assign the volunteer their official role in the **Directory tab** → edit their profile → update the Role field from "HMC Champion" to their assigned role.

**Important**: Approving unlocks training but does not auto-assign a role. You must manually update the role in their profile after approval. Core Volunteer Status (event registration access) activates after they complete Tier 2A training.

---

### Rejecting an Application

1. Click **Reject**.
2. Add a rejection note explaining the reason (this is for internal records — it is not automatically sent to the applicant).
3. Confirm. The volunteer's portal access remains at Champion level. They cannot proceed to full volunteer status.

If the rejection is due to missing documents or incomplete information rather than a disqualification, consider reaching out via email before rejecting — they may be able to resubmit.

---

### Managing Active Volunteers (Directory Tab)

The **Directory** tab shows all approved/active volunteers. From here you can:

- **Edit a profile**: Update role, contact info, name, team lead status, demographics.
- **Manage tags**: Add or remove skill/status tags (e.g., "bilingual", "healthcare_worker", "street_medicine_trained").
- **Assign tasks**: Create a task directly on a volunteer's record with a title, description, and due date.
- **View compliance status**: Check which requirements (background check, HIPAA, training, Live Scan) are verified vs. pending.
- **Deactivate a volunteer**: Removes them from shift assignments and event eligibility without deleting their record. Use this for leaves of absence or inactive periods.
- **Delete a volunteer**: Permanently removes the record. Requires confirmation. Use only for duplicate records or explicit data deletion requests.

---

### Bulk Import

To add multiple volunteers at once (e.g., migrating from a spreadsheet):

1. Go to **Admin Panel → Bulk Import**.
2. Download the CSV template to see required column format.
3. Fill in: Name, Email, Role, Phone (minimum required fields).
4. Upload the file. The system will create accounts, assign the specified roles, and send welcome emails to each imported volunteer.
5. A success summary shows how many records were created and any rows that failed validation.

---

### Compliance Overview

The **Compliance tab** in the Directory view shows a matrix of all volunteers × compliance requirements:
- Background Check
- HIPAA Acknowledgment
- Orientation Training
- Live Scan (where required)
- Role-specific certifications

Green checkmark = verified. Red X = pending. Use this view before events to confirm your team is compliant.

---

### Common Issues

**Volunteer says they cannot register for events after approval.**
Make sure you updated their role from "HMC Champion" to a full volunteer role. Also confirm they have completed Tier 2A Core training in the Training Academy — both are required.

**Applicant did not receive approval email.**
Check their email address in the profile for typos. If correct, ask them to check spam. You can resend by editing and re-saving their profile, which triggers a re-notification.

**Duplicate accounts.**
If two records exist for the same person, deactivate the duplicate and ensure training completion from both records is manually reconciled before deleting.`,
        tags: ['admin', 'runbook', 'onboarding', 'applications', 'approval', 'reject', 'directory', 'compliance', 'bulk import', 'role assignment'],
        visibleTo: ['System Administrator', 'Events Lead', 'Program Coordinator', 'General Operations Coordinator', 'Volunteer Lead']
    },
    {
        id: 'runbook-007',
        category: 'Runbooks & Tutorials',
        title: 'Coordinator Guide: Walking New Volunteers Through Onboarding',
        content: `## Coordinator Guide: Walking New Volunteers Through Onboarding

This guide is for HMC coordinators helping new volunteers navigate the signup and onboarding process — whether in person, by phone, or via a shared screen session.

---

### Before They Start: What They Need

Make sure the new volunteer has:
- A valid email address they can access during signup (for the verification code)
- Their resume file (PDF or Word document) — this is required to complete the application
- About 15–20 minutes for the full flow (without rushing)

---

### The 8 Steps of the Onboarding Flow

Walk them through each step:

**Step 1 — Account**
They create their email and password (13+ characters, must include uppercase, lowercase, number, and special character). Or they can sign up with Google, which skips this step. A 6-digit verification code is sent to their email — they need to enter it before proceeding.

*Common issue*: Code goes to spam. Ask them to check their junk folder.

**Step 2 — Personal**
Legal name, preferred name (optional), date of birth, gender, phone, address, emergency contact. All fields are required. Address must be complete — street, city, state, zip.

*Common issue*: They enter a nickname in the legal name field. Remind them this needs to match their ID for background check purposes.

**Step 3 — Background**
Employment status, education, HMC history, availability (days, hours/week, start date), timezone, languages spoken, and optional demographic information. SSN is collected here (encrypted) for background check processing — this is standard and secure.

*Common question*: "Why do you need my SSN?" Explain it is used only for the background check process, encrypted immediately, and not stored in readable form.

**Step 4 — Availability**
Confirm specific days and time preferences (morning/afternoon/evening). They should also note any scheduling limitations here.

**Step 5 — Role**
This is where they upload their resume and select the volunteer role they are interested in. The role list includes all available HMC positions. Help them choose the best match based on their background and your current staffing needs.

*Common issue*: They skip the resume upload. This is required — the system will not let them proceed without it.

**Step 6 — Details**
AI-generated questions tailored to their selected role. These will be different for a Licensed Medical Professional vs. a Social Media volunteer. They just need to answer honestly and in some detail — minimum answer length is required.

**Step 7 — Compliance**
Checkboxes for age verification, background check consent, SSN authorization, Terms of Service, and HIPAA (if applicable to their role). Final step: they type their full legal name as a digital signature to confirm all agreements.

*Common issue*: Their typed name does not match their legal name exactly. It is case-insensitive, but spacing and spelling must match what they entered in Step 2.

**Step 8 — Orientation**
They watch (or acknowledge) the HMC Orientation video and the HMC Champion video. Completing these here means they are automatically marked off in the Training Academy — they will not have to repeat them.

---

### After They Submit

Once the application is submitted:
1. Their account is created with the role **HMC Champion** and status **Pending Review**.
2. They can log in immediately and access the portal at Champion level.
3. They will see the Training Academy with Tier 1 unlocked. Encourage them to complete any Tier 1 modules they did not finish during signup.
4. An admin will review their application and approve them. Once approved, Tier 2 training unlocks.

Tell them: **"You will receive an email when your application is reviewed. After approval, go back to Training Academy and you will see new modules to complete. Those unlock your ability to sign up for events."**

---

### If They Get Stuck or Need to Stop

The application auto-saves after every step. If they need to stop, they can click **Save & Return Later** and their progress is preserved. Next time they log in, they will see a "Welcome Back" prompt and can pick up where they left off.

If they want to start over entirely (e.g., they made an error on an early step), they can click **Start Over** to clear all saved data.

---

### Using a Referral Link

If you are recruiting someone through an HMC Champion's referral link (volunteer.healthmatters.clinic?ref=CODE), the signup flow automatically attributes the new account to that Champion. No extra action needed — the referral is tracked automatically.

If you want to make sure credit goes to a specific Champion, share their personal link (found in their portal dashboard or the Referral Hub) rather than the general portal URL.

---

### After Approval: What Coordinators Should Do

Once you approve an application (see the Admin Runbook for approval steps), follow up with:

1. **Update their role** in Admin Panel → Directory → Edit Profile. Change from "HMC Champion" to their assigned role.
2. **Send a welcome message** via the Communication Hub → Briefing (DM) or Broadcasts to the relevant role group.
3. **Assign orientation tasks** if your team uses the Project Board to track onboarding checklists.
4. **Check Tier 2 progress** within the first week. Core Volunteer Status (event registration access) activates only after they complete all Tier 2A modules. Follow up if they have not started.
5. **Add them to the event roster** once Core Volunteer Status is confirmed.`,
        tags: ['runbook', 'coordinator', 'onboarding', 'new volunteer', 'walkthrough', 'application', 'training', 'signup', 'approval'],
        visibleTo: ['System Administrator', 'Events Lead', 'Program Coordinator', 'General Operations Coordinator', 'Volunteer Lead', 'Outreach & Engagement Lead']
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
