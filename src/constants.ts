
import { Opportunity, Volunteer, Shift, ClinicEvent, SupportTicket, ChecklistTemplate, Script, SurveyKit, ServiceOffering } from './types';

export const I18N = {
  en: {
    submit_btn: 'Sign Up Now',
  },
  es: {
    submit_btn: 'Inscribirse Ahora',
  }
};

export const SURVEY_KITS: SurveyKit[] = [
  {
    id: 'sk_default_health_fair_2026',
    name: 'Default Health Fair Survey Kit',
    eventTypesAllowed: ['Health Fair', 'Wellness'],
    formStructure: [
      { id: 'q1', type: 'Rating', question: 'How would you rate your overall experience today?', options: ['1', '2', '3', '4', '5'], required: true },
      { id: 'q2', type: 'Short Text', question: 'What was the most valuable part of your visit?', required: false },
      { id: 'q3', type: 'Multiple Choice', question: 'Would you recommend our services to a friend or family member?', options: ['Yes', 'No', 'Maybe'], required: true },
    ],
    volunteerScript: {
      en: `"Welcome! Today we are collecting community feedback on health and wellness. The survey takes approximately two minutes. Your responses are confidential."`,
      es: `"¡Bienvenido/a! Hoy estamos recopilando comentarios de la comunidad sobre salud y bienestar. La encuesta dura aproximadamente dos minutos. Sus respuestas son confidenciales."`
    },
    tabletSetupChecklist: ['Enable Screen Pinning', 'Load Survey Link in Kiosk Mode', 'Ensure Tablet is Charged'],
    dedupeRules: { messageEn: 'Please ensure only one survey per person.', messageEs: 'Por favor, asegúrese de que sea solo una encuesta por persona.', uniqueIdentifiers: ['phone', 'email'] }
  },
  {
    id: 'sk_street_medicine_outreach_2026',
    name: 'Street Medicine Outreach Survey Kit',
    eventTypesAllowed: ['Street Medicine'],
    formStructure: [
      { id: 'sm1', type: 'Checkboxes', question: 'What services are you most interested in today? (Select all that apply)', options: ['Medical Check-up', 'Wound Care', 'Food/Water', 'Housing Information', 'Mental Health Support'], required: true },
      { id: 'sm2', type: 'Short Text', question: 'Is there anything else we can help you with today?', required: false },
    ],
    volunteerScript: {
      en: `"Hi, we're with Health Matters Clinic. We're offering services and asking a few confidential questions to understand community needs. Would you be willing to participate?"`,
      es: `"Hola, somos de Health Matters Clinic. Ofrecemos servicios y hacemos algunas preguntas confidenciales para entender las necesidades de la comunidad. ¿Le gustaría participar?"`
    },
    tabletSetupChecklist: ['Enable Screen Pinning', 'Load Survey Link in Kiosk Mode', 'Connect to Mobile Hotspot'],
    dedupeRules: { messageEn: 'Please ensure only one survey per person.', messageEs: 'Por favor, asegúrese de que sea solo una encuesta por persona.', uniqueIdentifiers: ['name', 'dob'] }
  }
];

// FIX: Merged "Community Health Worker" into "Core Volunteer" role as per new requirements.
export const SERVICE_OFFERINGS: ServiceOffering[] = [
  {
    id: 'so-screening',
    name: 'Health Screenings',
    description: 'Blood pressure, glucose, and BMI checks.',
    requiredRoles: [
      { role: 'Licensed Medical Professional', count: 2 },
      { role: 'Core Volunteer', count: 2 },
    ],
  },
  {
    id: 'so-intake',
    name: 'Client Intake & Registration',
    description: 'Registering community members for services and referrals.',
    requiredRoles: [
      { role: 'Core Volunteer', count: 3 },
    ],
  },
  {
    id: 'so-education',
    name: 'Health Education',
    description: 'Distributing information on nutrition, exercise, and wellness.',
    requiredRoles: [
      { role: 'Core Volunteer', count: 2 },
    ],
  },
  {
    id: 'so-vaccine',
    name: 'Vaccinations',
    description: 'Administering flu shots and other immunizations.',
    requiredRoles: [
      { role: 'Licensed Medical Professional', count: 2 },
    ],
  },
  {
    id: 'so-mental-health',
    name: 'Mental Health Support',
    description: 'Providing brief consultations and referrals for mental wellness.',
    requiredRoles: [
      { role: 'Licensed Medical Professional', count: 1 },
    ],
  },
  {
    id: 'so-general',
    name: 'General Event Support',
    description: 'Assisting with logistics, setup, and participant flow.',
    requiredRoles: [
      { role: 'Core Volunteer', count: 4 },
    ],
  },
  {
    id: 'so-outreach',
    name: 'Community Outreach & Engagement',
    description: 'Grassroots outreach, tabling, event promotion, and resource distribution.',
    requiredRoles: [
      { role: 'Outreach & Engagement Lead', count: 1 },
      { role: 'Outreach Volunteer', count: 2 },
    ],
  },
];

// ============================================================
// TRAINING MODULE SYSTEM — 4-TIER ARCHITECTURE
// Status determines foundation. Role determines eligibility.
// Training determines clearance. Permissions determine actions.
// ============================================================

export type TrainingFormat = 'screenpal' | 'recorded_video' | 'read_ack';
export type TrainingTier = 1 | 2 | 3 | 4;
export type ProgramAssociation = null | 'community_wellness' | 'community_health_outreach' | 'street_medicine' | 'clinical';

export interface TrainingModule {
  id: string;
  title: string;
  desc: string;
  dur: number;
  embed: string;                    // Video embed URL or empty for read_ack
  format: TrainingFormat;
  tier: TrainingTier;
  programAssociation: ProgramAssociation;
  isBlocking: boolean;              // true = blocks progression, false = deadline-tracked
  deadlineDays: number | null;      // null for blocking, 30 for tier 4
  isAIGenerated: boolean;
  req: boolean;                     // legacy compat — true if blocking
}

// --- TIER 1: UNIVERSAL (Champion Level) ---
// Required for ALL users. Unlocks core portal experience.
export const TIER_1_MODULES: TrainingModule[] = [
  { id: 'hmc_orientation', title: 'Get to Know Health Matters Clinic', desc: 'Who we are, who we serve in Los Angeles, and how our programs work together.', dur: 12, embed: 'https://hmc.screencasthost.com/player/cTQ6cDnowch?width=100%&height=100%&ff=1&title=0', format: 'screenpal', tier: 1, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  { id: 'hmc_champion', title: 'Because You\u2019re a Champion', desc: 'Our values, expectations, and what it means to show up for community with HMC.', dur: 6, embed: 'https://hmc.screencasthost.com/player/cTQQcxnoth6?width=100%&height=100%&ff=1&title=0', format: 'screenpal', tier: 1, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
];

// --- TIER 2: BASELINE OPERATIONAL ---
// Unlocks Core Volunteer status + My Missions (requires role approval first)
export const TIER_2_MODULES: TrainingModule[] = [
  { id: 'hipaa_nonclinical', title: 'HIPAA (Non-Clinical)', desc: 'Data protection, privacy obligations, and handling protected health information as a non-clinical volunteer.', dur: 10, embed: '', format: 'read_ack', tier: 2, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  { id: 'cmhw_part1', title: 'Community Mental Health Worker Training \u2013 Part 1', desc: 'Foundations of community mental health work, trauma-informed principles, and working with vulnerable populations.', dur: 23, embed: 'https://www.youtube.com/embed/FCDOH6KNep4', format: 'recorded_video', tier: 2, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  { id: 'cmhw_part2', title: 'Community Mental Health Worker Training \u2013 Part 2', desc: 'Applied engagement, de-escalation, communication skills, and field-based mental health work.', dur: 28, embed: 'https://www.youtube.com/embed/nq9UBUJIAEQ', format: 'recorded_video', tier: 2, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  { id: 'survey_general', title: 'Survey & Research Data Collection (General HMC)', desc: 'Consent practices, data accuracy, neutrality, and privacy for all HMC survey and research activities.', dur: 8, embed: '', format: 'read_ack', tier: 2, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
  { id: 'portal_howto', title: 'How to Use the HMC Volunteer Portal', desc: 'Dashboard overview, training and clearance logic, My Missions, and Event Ops.', dur: 8, embed: '', format: 'read_ack', tier: 2, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
  { id: 'emergency_protocols_general', title: 'Emergency Awareness for Volunteers', desc: 'What to do in a medical emergency, how to call for help, when to call 911, and who to escalate to at HMC events.', dur: 8, embed: '', format: 'read_ack', tier: 2, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
];

// --- TIER 3: PROGRAM-SPECIFIC CLEARANCE ---
// Controls which shifts a Core Volunteer can register for.

// Community Wellness (Unstoppable, workshops, movement, reflection)
export const PROGRAM_COMMUNITY_WELLNESS: TrainingModule[] = [
  // CMHW 1 & 2 shared from Tier 2 — tracked by ID, not duplicated
  { id: 'accessibility_inclusion', title: 'Accessibility & Inclusion', desc: 'Creating welcoming, accessible spaces for participants of all abilities, identities, and backgrounds.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: 'community_wellness', isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
  { id: 'participant_support', title: 'Participant Support & Escalation', desc: 'How to support participants in distress, when to escalate, and maintaining appropriate boundaries.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: 'community_wellness', isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
];

// Community Health Outreach (pop-ups, education, non-clinical screenings, tabling)
export const PROGRAM_COMMUNITY_HEALTH_OUTREACH: TrainingModule[] = [
  { id: 'consent_data_handling', title: 'Consent & Data Handling', desc: 'Obtaining informed consent, handling sensitive data, and maintaining participant trust in community settings.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: 'community_health_outreach', isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
  { id: 'community_safety', title: 'Community Safety Basics', desc: 'Situational awareness, personal safety, and emergency protocols for community outreach events.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: 'community_health_outreach', isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
];

// Street Medicine Outreach (SMO)
export const PROGRAM_STREET_MEDICINE: TrainingModule[] = [
  { id: 'smo_orientation', title: 'Welcome to Your Street Medicine Outreach Shift', desc: 'HMC-specific orientation for street medicine outreach volunteers.', dur: 20, embed: 'https://www.youtube.com/embed/htO9SJXUJ18', format: 'recorded_video', tier: 3, programAssociation: 'street_medicine', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  { id: 'naloxone_distribution', title: 'Naloxone Distribution', desc: 'How to safely distribute naloxone and support overdose prevention in the field.', dur: 15, embed: 'https://www.youtube.com/embed/NYF89-WR3v4', format: 'recorded_video', tier: 3, programAssociation: 'street_medicine', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  { id: 'hiv_selftest', title: 'HIV Self-Test Kit Distribution', desc: 'How to safely distribute and support HIV OraQuick self-testing in community settings.', dur: 15, embed: 'https://hmc.screencasthost.com/player/cTfv1pnQIIL?width=100%&height=100%&ff=1&title=0', format: 'recorded_video', tier: 3, programAssociation: 'street_medicine', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  { id: 'survey_smo', title: 'Survey Training (Street Medicine Specific)', desc: 'How to administer HMC street medicine surveys, collect SDOH data, and respect privacy. Distinct from general survey training.', dur: 20, embed: 'https://hmc.screencasthost.com/player/cTftF4nQesE?width=100%&height=100%&ff=1&title=0', format: 'recorded_video', tier: 3, programAssociation: 'street_medicine', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  { id: 'field_safety', title: 'Field Safety Protocols', desc: 'Safety procedures, hazard awareness, and emergency response for non-clinical field operations.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: 'street_medicine', isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
  { id: 'environmental_awareness', title: 'Environmental Awareness', desc: 'Understanding environmental conditions, terrain hazards, and weather-related risks during outreach.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: 'street_medicine', isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
];

// Clinical Services (Licensed providers only)
export const PROGRAM_CLINICAL: TrainingModule[] = [
  { id: 'credential_verification', title: 'Credential Verification', desc: 'License upload, verification process, and maintaining current credentials with HMC.', dur: 10, embed: '', format: 'read_ack', tier: 3, programAssociation: 'clinical', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  { id: 'scope_of_practice', title: 'Scope of Practice Acknowledgment', desc: 'Understanding and acknowledging the boundaries of your clinical role within HMC programs.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: 'clinical', isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
  { id: 'clinical_sops', title: 'Clinical Standard Operating Procedures', desc: 'HMC clinical protocols, documentation requirements, and care standards.', dur: 15, embed: '', format: 'read_ack', tier: 3, programAssociation: 'clinical', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  { id: 'emergency_protocols', title: 'Emergency Protocols', desc: 'Emergency response procedures, escalation paths, and crisis management for clinical settings.', dur: 10, embed: '', format: 'read_ack', tier: 3, programAssociation: 'clinical', isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
];

// --- TIER 4: REQUIRED BUT NON-BLOCKING ---
// Tracked with 30-day deadline. After deadline, blocks advanced missions.
export const TIER_4_MODULES: TrainingModule[] = [
  { id: 'deescalation_1', title: 'How to De-escalate Someone', desc: 'Practical techniques for calming tense situations in community settings.', dur: 10, embed: 'https://www.youtube.com/embed/4qsfBCatgX8', format: 'recorded_video', tier: 4, programAssociation: null, isBlocking: false, deadlineDays: 30, isAIGenerated: false, req: false },
  { id: 'deescalation_2', title: '21 Phrases to De-escalate Angry Patients', desc: 'Communication tools for defusing anger and building rapport under pressure.', dur: 8, embed: 'https://www.youtube.com/embed/5t6ez8N86qk', format: 'recorded_video', tier: 4, programAssociation: null, isBlocking: false, deadlineDays: 30, isAIGenerated: false, req: false },
  { id: 'sdoh_tedx', title: 'Social Determinants of Health', desc: 'How housing, income, environment, and policy shape health outcomes.', dur: 15, embed: 'https://www.youtube.com/embed/rKo8Sv99MkM', format: 'recorded_video', tier: 4, programAssociation: null, isBlocking: false, deadlineDays: 30, isAIGenerated: false, req: false },
  { id: 'community_context', title: 'Skid Row Explained', desc: 'Understanding the history, conditions, and lived experiences in Los Angeles Skid Row.', dur: 12, embed: 'https://www.youtube.com/embed/xEoJ4FmBUG8', format: 'recorded_video', tier: 4, programAssociation: null, isBlocking: false, deadlineDays: 30, isAIGenerated: false, req: false },
];

// --- PROGRAM-SPECIFIC TRAINING REQUIREMENTS ---
// Each program requires Tier 2 baseline + these specific module IDs
export const PROGRAM_TRAINING_REQUIREMENTS: Record<string, string[]> = {
  community_wellness: ['cmhw_part1', 'cmhw_part2', 'accessibility_inclusion', 'participant_support'],
  community_health_outreach: ['consent_data_handling', 'community_safety'],
  street_medicine: ['smo_orientation', 'naloxone_distribution', 'hiv_selftest', 'survey_smo', 'field_safety', 'environmental_awareness'],
  clinical: ['credential_verification', 'scope_of_practice', 'clinical_sops', 'emergency_protocols'],
};

// --- ALL MODULES (flat list for lookups) ---
export const ALL_TRAINING_MODULES: TrainingModule[] = [
  ...TIER_1_MODULES,
  ...TIER_2_MODULES,
  ...PROGRAM_COMMUNITY_WELLNESS,
  ...PROGRAM_COMMUNITY_HEALTH_OUTREACH,
  ...PROGRAM_STREET_MEDICINE,
  ...PROGRAM_CLINICAL,
  ...TIER_4_MODULES,
];

// --- TIER ID LISTS (for quick checks) ---
export const TIER_1_IDS = TIER_1_MODULES.map(m => m.id);
export const TIER_2_IDS = TIER_2_MODULES.map(m => m.id);
export const TIER_4_IDS = TIER_4_MODULES.map(m => m.id);

// --- TIER 2 SPLIT: Core Baseline vs Field Readiness ---
export const TIER_2_CORE_MODULES = TIER_2_MODULES.filter(m =>
  ['hipaa_nonclinical', 'survey_general', 'portal_howto'].includes(m.id));
export const TIER_2_FIELD_MODULES = TIER_2_MODULES.filter(m =>
  ['cmhw_part1', 'cmhw_part2', 'emergency_protocols_general'].includes(m.id));
export const TIER_2_CORE_IDS = TIER_2_CORE_MODULES.map(m => m.id);
export const TIER_2_FIELD_IDS = TIER_2_FIELD_MODULES.map(m => m.id);

// --- LEGACY ID MAPPING ---
// Maps old module IDs (stored in existing user data) to new IDs
export const LEGACY_MODULE_ID_MAP: Record<string, string> = {
  'hmc_get_to_know_us': 'hmc_orientation',
  'hmc_because_champion': 'hmc_champion',
  'hipaa_staff_2025': 'hipaa_nonclinical',
  'hmc_survey_training': 'survey_general',
};

// Helper: check if a user has completed a module, accounting for legacy IDs
export const hasCompletedModule = (completedIds: string[], moduleId: string): boolean => {
  if (completedIds.includes(moduleId)) return true;
  for (const [legacyId, newId] of Object.entries(LEGACY_MODULE_ID_MAP)) {
    if (newId === moduleId && completedIds.includes(legacyId)) return true;
  }
  return false;
};

// Helper: check if ALL modules in a list are completed (with legacy compat)
export const hasCompletedAllModules = (completedIds: string[], moduleIds: string[]): boolean => {
  return moduleIds.every(id => hasCompletedModule(completedIds, id));
};

// --- LEGACY COMPAT EXPORTS ---
export const ORIENTATION_MODULES = TIER_1_MODULES;
export const ALL_REQUIRED_MODULES = [...TIER_1_MODULES, ...TIER_2_MODULES];

// HMC_MODULES compat export (used by MigrationFlow, OnboardingFlow)
export const HMC_MODULES = {
  hmcIntro: TIER_1_MODULES[0],
  champion: TIER_1_MODULES[1],
};

// --- ROLE-SPECIFIC TRAINING (specialized roles, NOT program gates) ---
// These are additional modules for specialized roles beyond the operational tiers
export const ROLE_SPECIFIC_MODULES: Record<string, TrainingModule[]> = {
  board_member: [
    { id: 'board_governance_101', title: 'Board of Directors 101: Roles & Responsibilities', desc: 'Legal duties, governance, and oversight for nonprofit board members.', dur: 60, embed: 'https://www.youtube.com/embed/zADB9U5TK0A', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'board_change_2025', title: 'Beyond Board Training: How to Create Real Change (2025)', desc: 'How modern boards can drive equity, culture, and strategy.', dur: 30, embed: 'https://www.youtube.com/embed/nTUM9NCydM4', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: false, deadlineDays: null, isAIGenerated: false, req: false },
    // Governance policy documents (real content served from static map)
    { id: 'gov_coi_policy', title: 'Conflict of Interest Policy', desc: 'Official HMC Conflict of Interest Policy. Covers duties to disclose, recusal procedures, and annual acknowledgment requirements.', dur: 15, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_code_of_ethics', title: 'Code of Ethics', desc: 'Official HMC Code of Ethics. Covers values, conduct, confidentiality, conflicts, use of assets, and compliance.', dur: 10, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_board_agreement', title: 'Board Member Agreement', desc: 'Official Board Member Agreement covering duties, participation, ethics, confidentiality, support, reimbursement, and term of service.', dur: 10, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_roles_expectations', title: 'Governance Roles & Expectations', desc: 'Time commitments, participation requirements, fiduciary duties, and ambassadorial responsibilities for governance members.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_bod_structure', title: 'Board of Directors: Structure & Committees', desc: 'BOD composition, term lengths, and seven standing committee descriptions.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: false, deadlineDays: null, isAIGenerated: false, req: false },
    { id: 'gov_meetings_schedule', title: 'Meetings & Schedule', desc: 'Board and CAB meeting schedules, notice requirements, standard agenda, and meeting expectations.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: false, deadlineDays: null, isAIGenerated: false, req: false },
    { id: 'gov_coi_disclosure', title: 'Annual Conflict of Interest Disclosure', desc: 'Annual disclosure form requirements. Must be completed annually and upon changes in circumstances.', dur: 5, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    // Organizational governance documents (downloadable + read_ack)
    { id: 'gov_bylaws', title: 'HMC Bylaws', desc: 'The governing document of Health Matters Clinic outlining organizational structure, Board composition, officer duties, meeting procedures, committees, and amendment process.', dur: 20, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_strategic_plan', title: 'Strategic Plan 2024-2027', desc: 'HMC\'s three-year strategic goals, objectives, and key performance indicators across five priority areas.', dur: 15, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: false, deadlineDays: null, isAIGenerated: false, req: false },
    { id: 'gov_board_handbook', title: 'Board Member Handbook', desc: 'Comprehensive guide to Board roles, fiduciary duties, time commitments, committee descriptions, meeting preparation, and onboarding checklist.', dur: 20, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_financial_policies', title: 'Financial Policies & Procedures', desc: 'Financial management policies including approval thresholds, budget process, internal controls, audit procedures, and expense reimbursement.', dur: 15, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_whistleblower', title: 'Whistleblower Policy', desc: 'Procedures for reporting suspected fraud, waste, or misconduct, investigation process, and protection against retaliation.', dur: 10, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_committee_charters', title: 'Committee Charters', desc: 'Scope, composition, responsibilities, and meeting expectations for all seven HMC standing committees.', dur: 15, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: false, deadlineDays: null, isAIGenerated: false, req: false },
    { id: 'gov_dno_insurance', title: 'D&O Insurance Summary', desc: 'Overview of Directors and Officers liability insurance coverage, what is and is not covered, and your protections as a Board member.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: false, deadlineDays: null, isAIGenerated: false, req: false },
  ],
  community_advisory_board: [
    { id: 'cab_roles', title: 'Advisory Boards: Roles, Voice, and Community Power', desc: 'How community advisory boards shape programs and accountability.', dur: 20, embed: 'https://www.youtube.com/embed/K6mgnRbiiqM', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'board_change_2025', title: 'Beyond Board Training: How to Create Real Change (2025)', desc: 'How modern boards can drive equity, culture, and strategy.', dur: 30, embed: 'https://www.youtube.com/embed/nTUM9NCydM4', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: false, deadlineDays: null, isAIGenerated: false, req: false },
    // Governance policy documents (real content served from static map)
    { id: 'gov_coi_policy', title: 'Conflict of Interest Policy', desc: 'Official HMC Conflict of Interest Policy. Covers duties to disclose, recusal procedures, and annual acknowledgment requirements.', dur: 15, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_code_of_ethics', title: 'Code of Ethics', desc: 'Official HMC Code of Ethics. Covers values, conduct, confidentiality, conflicts, use of assets, and compliance.', dur: 10, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_cab_scope', title: 'CAB Scope & Responsibilities', desc: 'Community Advisory Board composition, terms, scope of advisory role, and working group participation.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_roles_expectations', title: 'Governance Roles & Expectations', desc: 'Time commitments, participation requirements, fiduciary duties, and ambassadorial responsibilities for governance members.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_meetings_schedule', title: 'Meetings & Schedule', desc: 'Board and CAB meeting schedules, notice requirements, standard agenda, and meeting expectations.', dur: 8, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: false, deadlineDays: null, isAIGenerated: false, req: false },
    { id: 'gov_coi_disclosure', title: 'Annual Conflict of Interest Disclosure', desc: 'Annual disclosure form requirements. Must be completed annually and upon changes in circumstances.', dur: 5, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    // Organizational governance documents (shared with Board where applicable)
    { id: 'gov_bylaws', title: 'HMC Bylaws', desc: 'The governing document of Health Matters Clinic outlining organizational structure, Board composition, officer duties, meeting procedures, committees, and amendment process.', dur: 20, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'gov_whistleblower', title: 'Whistleblower Policy', desc: 'Procedures for reporting suspected fraud, waste, or misconduct, investigation process, and protection against retaliation.', dur: 10, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  content_writer: [
    { id: 'np_storytelling', title: 'Storytelling for Nonprofits: How to Share Impact with Dignity', desc: 'How to write stories that center dignity, consent, and impact\u2014not trauma.', dur: 22, embed: 'https://www.youtube.com/embed/ZFh3yq_u7aE', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  social_media_team: [
    { id: 'sm_how_use_2024', title: 'How You Should Be Using Social Media in 2024 (Nonprofits)', desc: 'What content works, what doesn\'t, and how to show up online as a nonprofit.', dur: 9, embed: 'https://www.youtube.com/embed/-j9qVki1_EM', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'sm_strategy_1', title: '#1 Social Media Strategy for Nonprofits', desc: 'Live, real, human-centered content that builds trust and donations.', dur: 7, embed: 'https://www.youtube.com/embed/VG_IT0ct1ig', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'sm_plan_2024', title: 'Create a Nonprofit Social Media Strategy & Content Calendar', desc: 'How to plan content, campaigns, and a posting rhythm that\'s sustainable.', dur: 18, embed: 'https://www.youtube.com/embed/bF3eMIKnRVg', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: false, deadlineDays: null, isAIGenerated: false, req: false },
  ],
  development_coordinator: [
    { id: 'fundraising_basics', title: 'Fundraising Basics for Small & Community Nonprofits', desc: 'Core donor strategy, campaigns, and building a culture of giving.', dur: 52, embed: 'https://www.youtube.com/embed/bMf3HUtxbw4', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  grant_writer: [
    { id: 'grant_tips_millions', title: 'Grant Writing Tips: How I Secured Millions in Funding', desc: 'Positioning, alignment, and writing grants that actually get funded.', dur: 18, embed: 'https://www.youtube.com/embed/wS_p_1wR8rE', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  fundraising_volunteer: [
    { id: 'p2p_fundraising', title: 'How to Run a Peer-to-Peer Fundraising Campaign', desc: 'Setting up a page, telling your story, and inviting your network to give.', dur: 18, embed: 'https://www.youtube.com/embed/4_IES6QeYrl', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  events_coordinator: [
    { id: 'events_for_np', title: 'How to Plan a Nonprofit Event Step by Step', desc: 'Logistics, timelines, and roles for smooth nonprofit events.', dur: 20, embed: 'https://www.youtube.com/embed/s7KJ4qPp1kM', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  program_coordinator: [
    { id: 'np_program_mgmt', title: 'Program Management for Nonprofits', desc: 'Designing, running, and evaluating community programs.', dur: 28, embed: 'https://www.youtube.com/embed/S1v964E64-s', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  operations_coordinator: [
    { id: 'np_ops', title: 'Building Simple, Effective Nonprofit Operations', desc: 'How to design processes, checklists, and systems that actually work.', dur: 24, embed: 'https://www.youtube.com/embed/x8gYQ8oQn9g', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  volunteer_lead: [
    { id: 'recruit_manage_vols', title: 'How to Successfully Recruit and Manage Volunteers', desc: 'Practical strategies for supporting, appreciating, and retaining volunteers.', dur: 45, embed: 'https://www.youtube.com/embed/SWLDdEkr9EM', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'vol_mgmt_top5', title: 'Top 5 Volunteer Management Strategies Every Nonprofit Needs', desc: 'High-level approaches to building a strong volunteer culture.', dur: 12, embed: 'https://www.youtube.com/embed/eBGINprwFM0', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: false, deadlineDays: null, isAIGenerated: false, req: false },
  ],
  tech_team: [
    { id: 'hipaa_cyber_2024', title: 'HIPAA Training: 2024 Cybersecurity Standards', desc: 'Cybersecurity performance goals and safeguards to protect PHI and systems.', dur: 39, embed: 'https://www.youtube.com/embed/2tBs65yi7yk', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  data_analyst: [
    { id: 'hipaa_cyber_2024', title: 'HIPAA Training: 2024 Cybersecurity Standards', desc: 'Cybersecurity performance goals and safeguards to protect PHI and systems.', dur: 39, embed: 'https://www.youtube.com/embed/2tBs65yi7yk', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  outreach_lead: [
    { id: 'outreach_strategy_np', title: 'Community Outreach Strategy for Nonprofits', desc: 'How to plan, execute, and measure grassroots outreach campaigns that connect communities to services.', dur: 22, embed: 'https://www.youtube.com/embed/m4I-YDhgQ_8', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'partnership_building', title: 'Partnership Building & Community Engagement', desc: 'Building and maintaining relationships with schools, churches, and community organizations to expand HMC\'s reach.', dur: 12, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
    { id: 'outreach_messaging', title: 'Health Equity Messaging & Cultural Sensitivity', desc: 'Communicating about health services in culturally appropriate, trust-building ways for underserved communities.', dur: 10, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
  ],
  outreach_volunteer: [
    { id: 'outreach_basics_np', title: 'Grassroots Outreach: Connecting Communities to Care', desc: 'Fundamentals of community outreach, event promotion, and resource sharing for HMC volunteers.', dur: 15, embed: '', format: 'read_ack', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: true, req: true },
  ],
  licensed_medical: [
    { id: 'lmp_hipaa_clinical', title: 'HIPAA for Clinical Volunteers', desc: 'HIPAA compliance specific to licensed providers handling PHI in community health settings.', dur: 30, embed: 'https://www.youtube.com/embed/jdGhezryMgI', format: 'recorded_video', tier: 3, programAssociation: 'clinical', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'lmp_field_medicine', title: 'Field Medicine & Community Health Basics', desc: 'Adapting clinical skills to field conditions, mobile clinics, and limited-resource environments.', dur: 25, embed: 'https://www.youtube.com/embed/T_rC0GPyq60', format: 'recorded_video', tier: 3, programAssociation: 'clinical', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'lmp_scope_review', title: 'Scope of Practice in Volunteer Settings', desc: 'Understanding practice boundaries, liability, and Good Samaritan protections for licensed volunteers.', dur: 15, embed: '', format: 'read_ack', tier: 3, programAssociation: 'clinical', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'lmp_triage_protocols', title: 'Community Triage & Escalation Protocols', desc: 'HMC triage workflows, when to escalate, and coordinating with EMS for community events.', dur: 20, embed: '', format: 'read_ack', tier: 3, programAssociation: 'clinical', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
  medical_admin: [
    { id: 'hipaa_cyber_2024', title: 'HIPAA Training: 2024 Cybersecurity Standards', desc: 'Cybersecurity performance goals and safeguards to protect PHI and systems.', dur: 39, embed: 'https://www.youtube.com/embed/2tBs65yi7yk', format: 'recorded_video', tier: 3, programAssociation: null, isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
    { id: 'medical_records_basics', title: 'Medical Records & Documentation for Community Health', desc: 'Proper documentation, record handling, and compliance for healthcare admin in community settings.', dur: 20, embed: '', format: 'read_ack', tier: 3, programAssociation: 'clinical', isBlocking: true, deadlineDays: null, isAIGenerated: false, req: true },
  ],
};

// Append role-specific modules to flat lookup list
ALL_TRAINING_MODULES.push(...Object.values(ROLE_SPECIFIC_MODULES).flat());

export const EVENTS: ClinicEvent[] = [];
export const OPPORTUNITIES: Opportunity[] = [];
export const SHIFTS: Shift[] = [];
export const INITIAL_VOLUNTEERS: Volunteer[] = [];
export const SUPPORT_TICKETS: SupportTicket[] = [];

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'health-fair-ops',
    name: 'Health Fair Operations',
    stages: {
      setup: {
        title: 'Pre-Event Setup',
        items: [
          { id: 'hf-s-1', text: 'Set up canopy/tent, tables, chairs, and signage' },
          { id: 'hf-s-2', text: 'Prepare registration and intake station' },
          { id: 'hf-s-3', text: 'Set up health screening stations (BP, glucose, BMI)' },
          { id: 'hf-s-4', text: 'Test all medical equipment and confirm supplies' },
          { id: 'hf-s-5', text: 'Distribute volunteer role assignments and lanyards' },
        ],
      },
      live_ops: {
        title: 'During Event',
        items: [
          { id: 'hf-lo-1', text: 'Greet and register participants at intake' },
          { id: 'hf-lo-2', text: 'Guide participants through screening stations' },
          { id: 'hf-lo-3', text: 'Conduct health screenings per clinical protocols' },
          { id: 'hf-lo-4', text: 'Distribute health education materials' },
          { id: 'hf-lo-5', text: 'Track attendance and screening counts' },
          { id: 'hf-lo-6', text: 'Take photos (only with consent)' },
        ],
      },
      breakdown: {
        title: 'Post-Event Breakdown',
        items: [
          { id: 'hf-b-1', text: 'Collect all sign-in sheets and screening records' },
          { id: 'hf-b-2', text: 'Properly dispose of medical waste (sharps, gloves)' },
          { id: 'hf-b-3', text: 'Pack up medical equipment and supplies' },
          { id: 'hf-b-4', text: 'Clean and sanitize all surfaces' },
          { id: 'hf-b-5', text: 'Debrief with clinical lead and event coordinator' },
        ],
      },
    },
  },
  {
    id: 'street-medicine-ops',
    name: 'Street Medicine Outreach Operations',
    stages: {
      setup: {
        title: 'Pre-Outreach Preparation',
        items: [
          { id: 'sm-s-1', text: 'Review route plan and safety briefing' },
          { id: 'sm-s-2', text: 'Pack medical supplies, naloxone kits, and OraQuick tests' },
          { id: 'sm-s-3', text: 'Confirm mobile hotspot and tablets are charged' },
          { id: 'sm-s-4', text: 'Prepare resource cards and referral information' },
          { id: 'sm-s-5', text: 'Distribute PPE (gloves, masks, hand sanitizer)' },
        ],
      },
      live_ops: {
        title: 'During Outreach',
        items: [
          { id: 'sm-lo-1', text: 'Approach community members respectfully and introduce HMC' },
          { id: 'sm-lo-2', text: 'Offer available services (wound care, screenings, supplies)' },
          { id: 'sm-lo-3', text: 'Distribute naloxone kits with verbal instructions' },
          { id: 'sm-lo-4', text: 'Conduct surveys with informed consent' },
          { id: 'sm-lo-5', text: 'Document encounters and services provided' },
          { id: 'sm-lo-6', text: 'Provide referral cards for follow-up care' },
        ],
      },
      breakdown: {
        title: 'Post-Outreach Wrap-Up',
        items: [
          { id: 'sm-b-1', text: 'Log total encounters, services, and supplies distributed' },
          { id: 'sm-b-2', text: 'Properly dispose of medical waste' },
          { id: 'sm-b-3', text: 'Account for all equipment and unused supplies' },
          { id: 'sm-b-4', text: 'Complete post-outreach safety check-in' },
          { id: 'sm-b-5', text: 'Debrief with team lead on observations and follow-ups' },
        ],
      },
    },
  },
  {
    id: 'community-run-walk-ops',
    name: 'Community Run & Walk Operations',
    stages: {
      setup: {
        title: 'Pre-Event Setup',
        items: [
          { id: 'rw-s-1', text: 'Set up start/finish line, course markers, and signage' },
          { id: 'rw-s-2', text: 'Prepare registration and bib distribution table' },
          { id: 'rw-s-3', text: 'Set up water stations along the route' },
          { id: 'rw-s-4', text: 'Position first aid station with medical supplies' },
          { id: 'rw-s-5', text: 'Test PA system and music' },
        ],
      },
      live_ops: {
        title: 'During Event',
        items: [
          { id: 'rw-lo-1', text: 'Register participants and distribute bibs/materials' },
          { id: 'rw-lo-2', text: 'Staff water stations and cheer points along route' },
          { id: 'rw-lo-3', text: 'Monitor participant safety and course conditions' },
          { id: 'rw-lo-4', text: 'Distribute finisher medals/goodie bags' },
          { id: 'rw-lo-5', text: 'Take photos at key moments (with consent)' },
          { id: 'rw-lo-6', text: 'Track participation count' },
        ],
      },
      breakdown: {
        title: 'Post-Event Breakdown',
        items: [
          { id: 'rw-b-1', text: 'Remove all course markers and signage' },
          { id: 'rw-b-2', text: 'Collect all registration forms and waivers' },
          { id: 'rw-b-3', text: 'Clean up water stations and dispose of waste' },
          { id: 'rw-b-4', text: 'Pack up all equipment and supplies' },
          { id: 'rw-b-5', text: 'Debrief with event coordinator' },
        ],
      },
    },
  },
  {
    id: 'wellness-workshop-ops',
    name: 'Wellness Workshop / Education Operations',
    stages: {
      setup: {
        title: 'Pre-Event Setup',
        items: [
          { id: 'ww-s-1', text: 'Set up venue: tables, chairs, and presentation equipment' },
          { id: 'ww-s-2', text: 'Prepare registration table: sign-in sheets, materials, pens' },
          { id: 'ww-s-3', text: 'Confirm all workshop materials and handouts are ready' },
        ],
      },
      live_ops: {
        title: 'During Workshop',
        items: [
          { id: 'ww-lo-1', text: 'Greet and sign-in participants' },
          { id: 'ww-lo-2', text: 'Distribute workshop materials and handouts' },
          { id: 'ww-lo-3', text: 'Track attendance count' },
          { id: 'ww-lo-4', text: 'Take photos (only with consent)' },
          { id: 'ww-lo-5', text: 'Maintain a tidy and welcoming environment' },
        ],
      },
      breakdown: {
        title: 'Post-Workshop Breakdown',
        items: [
          { id: 'ww-b-1', text: 'Collect all sign-in sheets and feedback forms' },
          { id: 'ww-b-2', text: 'Track final count of distributed materials' },
          { id: 'ww-b-3', text: 'Pack up all materials and supplies' },
          { id: 'ww-b-4', text: 'Clean up the venue' },
          { id: 'ww-b-5', text: 'Debrief with event lead' },
        ],
      },
    },
  },
  {
    id: 'survey-station-ops',
    name: 'Survey Station Operations',
    stages: {
      setup: {
        title: 'Setup',
        items: [
          { id: 'ss-s-1', text: 'Set up table, chairs, and Survey Station signage' },
          { id: 'ss-s-2', text: 'Power on and test tablet, ensure survey form is loaded' },
          { id: 'ss-s-3', text: 'Confirm tablet is secure (screen pinning, PIN set)' },
          { id: 'ss-s-4', text: 'Organize goodie bags for distribution' },
        ],
      },
      live_ops: {
        title: 'Live Ops',
        items: [
          { id: 'ss-lo-1', text: 'Welcome participants using the approved script' },
          { id: 'ss-lo-2', text: 'Ensure one survey per participant' },
          { id: 'ss-lo-3', text: 'Maintain participant confidentiality' },
          { id: 'ss-lo-4', text: 'Distribute one goodie bag per completed survey' },
          { id: 'ss-lo-5', text: 'Refresh survey form after each submission' },
        ],
      },
      breakdown: {
        title: 'Breakdown',
        items: [
          { id: 'ss-b-1', text: 'Log final total of survey responses' },
          { id: 'ss-b-2', text: 'Log final total of SMS opt-ins' },
          { id: 'ss-b-3', text: 'Power down and securely store tablet' },
          { id: 'ss-b-4', text: 'Return all remaining supplies and goodie bags' },
        ],
      },
    },
  },
  {
    id: 'tabling-outreach-ops',
    name: 'Tabling & Community Outreach Operations',
    stages: {
      setup: {
        title: 'Setup',
        items: [
          { id: 'to-s-1', text: 'Set up table, banner, and display materials' },
          { id: 'to-s-2', text: 'Organize flyers, brochures, and resource cards' },
          { id: 'to-s-3', text: 'Prepare sign-up sheets and QR codes' },
          { id: 'to-s-4', text: 'Set out giveaway items (pens, totes, etc.)' },
        ],
      },
      live_ops: {
        title: 'During Outreach',
        items: [
          { id: 'to-lo-1', text: 'Engage passersby and share HMC mission' },
          { id: 'to-lo-2', text: 'Distribute flyers and resource information' },
          { id: 'to-lo-3', text: 'Collect contact info from interested community members' },
          { id: 'to-lo-4', text: 'Answer questions about upcoming events and programs' },
          { id: 'to-lo-5', text: 'Track engagement count and materials distributed' },
        ],
      },
      breakdown: {
        title: 'Breakdown',
        items: [
          { id: 'to-b-1', text: 'Collect all sign-up sheets and contact forms' },
          { id: 'to-b-2', text: 'Count remaining materials and note restock needs' },
          { id: 'to-b-3', text: 'Pack up table, banner, and supplies' },
          { id: 'to-b-4', text: 'Debrief with outreach lead' },
        ],
      },
    },
  },
];

// Map event categories to their checklist template IDs
export const EVENT_TYPE_TEMPLATE_MAP: Record<string, string> = {
  'Health Fair': 'health-fair-ops',
  'Wellness': 'health-fair-ops',
  'Street Medicine': 'street-medicine-ops',
  'Community Run': 'community-run-walk-ops',
  'Community Walk': 'community-run-walk-ops',
  'Run & Walk': 'community-run-walk-ops',
  'Community Run & Walk': 'community-run-walk-ops',
  '5K': 'community-run-walk-ops',
  'Workshop': 'wellness-workshop-ops',
  'Wellness Education': 'wellness-workshop-ops',
  'Education': 'wellness-workshop-ops',
  'Survey': 'survey-station-ops',
  'Survey Collection': 'survey-station-ops',
  'Tabling': 'tabling-outreach-ops',
  'Outreach': 'tabling-outreach-ops',
  'Community Outreach': 'tabling-outreach-ops',
};

// Ordered list of event categories for EventBuilder dropdown
export const EVENT_CATEGORIES = [
  'Health Fair',
  'Street Medicine',
  'Wellness',
  'Wellness Education',
  'Community Run & Walk',
  'Community Outreach',
  'Tabling',
  'Survey Collection',
  'Workshop',
  'Community Event',
] as const;

// Board Member Governance Documents & Required Forms
export const BOARD_GOVERNANCE_DOCS = {
  meetingSchedule: {
    boardMeetings: {
      frequency: 'Quarterly',
      schedule: 'First Monday of January, April, July, and October',
      time: '5:30 PM - 7:30 PM PT',
      location: 'HMC Conference Room / Hybrid (Zoom)',
      noticeRequired: '7 days advance notice with agenda and materials'
    },
    cabMeetings: {
      frequency: 'Quarterly',
      schedule: 'Third Monday of March, June, September, and December',
      time: '6:00 PM - 7:30 PM PT',
      location: 'Community Room / Hybrid (Zoom)',
      noticeRequired: '7 days advance notice with agenda'
    },
    committeeMeetings: {
      frequency: 'Monthly or as needed',
      committees: [
        'Executive Committee',
        'Governance & Nominations',
        'Finance, Audit & Risk',
        'Programs, Quality & Clinical Oversight',
        'Workforce Development & Education',
        'Development & Community Partnerships',
        'Community Engagement & Advocacy'
      ]
    },
    attendanceExpectation: '75% of scheduled meetings',
    standardAgenda: [
      'Call to Order; Quorum',
      'Approval of Agenda & Prior Minutes',
      'Executive & Program Reports',
      'Financial Report & Audit/Compliance Updates',
      'Governance & Nominations',
      'Strategic Items / New Business',
      'Public Comment (as applicable)',
      'Adjournment'
    ]
  },
  requiredForms: [
    {
      id: 'coi-disclosure',
      title: 'Conflict of Interest Disclosure Form',
      description: 'Annual disclosure of potential conflicts of interest as required by nonprofit governance standards.',
      dueDate: 'Annual - Due by January 31st',
      type: 'form',
      downloadUrl: '#',
      required: true
    },
    {
      id: 'confidentiality-agreement',
      title: 'Board Confidentiality Agreement',
      description: 'Agreement to maintain confidentiality of board discussions, strategic plans, and organizational information.',
      dueDate: 'Upon appointment',
      type: 'form',
      downloadUrl: '#',
      required: true
    },
    {
      id: 'code-of-conduct',
      title: 'Board Member Code of Conduct',
      description: 'Acknowledgment of ethical standards and expectations for board service.',
      dueDate: 'Upon appointment',
      type: 'form',
      downloadUrl: '#',
      required: true
    },
    {
      id: 'commitment-agreement',
      title: 'Board Service Commitment Agreement',
      description: 'Commitment to attendance, participation, and annual giving/fundraising expectations.',
      dueDate: 'Upon appointment',
      type: 'form',
      downloadUrl: '#',
      required: true
    },
    {
      id: 'media-authorization',
      title: 'Media & Public Relations Authorization',
      description: 'Authorization for HMC to use your name, photo, and bio for organizational purposes.',
      dueDate: 'Upon appointment',
      type: 'form',
      downloadUrl: '#',
      required: false
    }
  ],
  governanceDocs: [
    {
      id: 'bylaws',
      title: 'HMC Bylaws',
      description: 'The governing document of Health Matters Clinic outlining organizational structure and procedures.',
      type: 'document',
      moduleId: 'gov_bylaws'
    },
    {
      id: 'strategic-plan',
      title: 'Strategic Plan 2024-2027',
      description: 'HMC\'s three-year strategic goals, objectives, and key performance indicators.',
      type: 'document',
      moduleId: 'gov_strategic_plan'
    },
    {
      id: 'board-handbook',
      title: 'Board Member Handbook',
      description: 'Comprehensive guide to board roles, responsibilities, committees, and processes.',
      type: 'document',
      moduleId: 'gov_board_handbook'
    },
    {
      id: 'financial-policies',
      title: 'Financial Policies & Procedures',
      description: 'Financial management policies including approval thresholds, audit procedures, and fiscal controls.',
      type: 'document',
      moduleId: 'gov_financial_policies'
    },
    {
      id: 'whistleblower-policy',
      title: 'Whistleblower Policy',
      description: 'Procedures for reporting suspected fraud, waste, or misconduct.',
      type: 'document',
      moduleId: 'gov_whistleblower'
    },
    {
      id: 'board-calendar',
      title: 'Board Meeting Calendar',
      description: 'Annual schedule of board meetings, committee meetings, and key events.',
      type: 'document',
      moduleId: 'gov_meetings_schedule'
    },
    {
      id: 'committee-charters',
      title: 'Committee Charters',
      description: 'Scope and responsibilities for Executive, Finance, Governance, and Program committees.',
      type: 'document',
      moduleId: 'gov_committee_charters'
    },
    {
      id: 'd-o-insurance',
      title: 'D&O Insurance Summary',
      description: 'Overview of Directors and Officers liability insurance coverage.',
      type: 'document',
      moduleId: 'gov_dno_insurance'
    }
  ]
};

export const SCRIPTS: Script[] = [
    {
        id: 'survey-script-en',
        title: 'Survey Collection Script (EN)',
        notice: 'IMPORTANT: Do not deviate. Maintain confidentiality. No medical advice.',
        content: `
"Welcome! Today we are collecting community feedback on health and wellness. 

The survey takes approximately two minutes. Upon completion, you will receive a goodie bag and be entered into our raffle for tablets.

You can use the tablet or scan the QR code. Your responses are confidential. There is an option to opt-in for SMS updates, which gives you early access to our new app.

Do you have any questions before starting?"
        `
    },
    {
        id: 'survey-script-es',
        title: 'Survey Collection Script (ES)',
        notice: 'IMPORTANTE: No se desvíe. Mantenga la confidencialidad. No dé consejos médicos.',
        content: `
"¡Bienvenido/a! Hoy estamos recopilando comentarios de la comunidad sobre salud y bienestar.

La encuesta dura aproximadamente dos minutos. Al completarla, recibirá una bolsa de regalos y participará en nuestra rifa de tabletas.

Puede usar la tableta o escanear el código QR. Sus respuestas son confidenciales. Hay una opción para recibir actualizaciones por SMS, lo que le da acceso anticipado a nuestra nueva aplicación.

¿Tiene alguna pregunta antes de comenzar?"
        `
    }
];
