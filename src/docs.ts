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
];
