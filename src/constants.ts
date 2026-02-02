
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
      { role: 'Core Volunteer', count: 1 },
      { role: 'Outreach Volunteer', count: 1 },
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
      { role: 'General Volunteer', count: 4 },
    ],
  },
];

export const HMC_MODULES = {
  /* HMC Core Orientation */
  hmcIntro: { id: 'hmc_get_to_know_us', title: 'Get to Know Health Matters Clinic', desc: 'Who we are, who we serve in Los Angeles, and how our programs work together.', dur: 12, embed: 'https://hmc.screencasthost.com/player/cTQ6cDnowch?width=100%&height=100%&ff=1&title=0', req: true },
  champion: { id: 'hmc_because_champion', title: 'Because You’re a Champion', desc: 'Our values, expectations, and what it means to show up for community with HMC.', dur: 6, embed: 'https://hmc.screencasthost.com/player/cTQQcxnoth6?width=100%&height=100%&ff=1&title=0', req: true },

  /* HMC Program-Specific Trainings */
  hivOraquick: { id: 'hmc_hiv_oraquick', title: 'HIV OraQuick Self-Test Kit Distribution', desc: 'How to safely distribute and support HIV OraQuick self-testing in community settings.', dur: 15, embed: 'https://hmc.screencasthost.com/player/cTfv1pnQIIL?width=100%&height=100%&ff=1&title=0', req: true },
  surveyTraining: { id: 'hmc_survey_training', title: 'HMC Survey Training & Data Collection', desc: 'How to administer HMC surveys, collect SDOH data, and respect privacy in the process.', dur: 20, embed: 'https://hmc.screencasthost.com/player/cTftF4nQesE?width=100%&height=100%&ff=1&title=0', req: true },

  /* Community Mental Health Worker Training (YouTube) */
  cmhwPart1: { id: 'cmhw_part1', title: 'Community Mental Health Worker Training – Part 1', desc: 'Foundations of community mental health work, trauma-informed principles, and working with vulnerable populations.', dur: 23, embed: 'https://www.youtube.com/embed/xEoJ4FmBUG8', req: true },
  cmhwPart2: { id: 'cmhw_part2', title: 'Community Mental Health Worker Training – Part 2', desc: 'De-escalation, communication skills, cultural humility, and field-based mental health engagement.', dur: 28, embed: 'https://www.youtube.com/embed/FCDOH6KNep4', req: true },
  
  /* External – HIPAA & data privacy */
  hipaa2025: { id: 'hipaa_staff_2025', title: 'Complete HIPAA Staff Training 2025', desc: 'Updated HIPAA staff training covering privacy, security, and real-world scenarios.', dur: 30, embed: 'https://www.youtube.com/embed/CdUUfVOP4bE', req: true },
  hipaaCyber2024: { id: 'hipaa_cyber_2024', title: 'HIPAA Training: 2024 Cybersecurity Standards', desc: 'Cybersecurity performance goals and safeguards to protect PHI and systems.', dur: 39, embed: 'https://www.youtube.com/embed/2tBs65yi7yk', req: false },

  /* External - Street Medicine Core */
  streetMedIntro: { id: 'street_med_intro', title: 'Street Medicine Part 1: Introduction', desc: 'Theory, skills, and practice of street medicine for unsheltered communities.', dur: 55, embed: 'https://www.youtube.com/embed/FqgDTk2-ypk', req: false },

  /* External – CHW Role Overview */
  chwRole: { id: 'chw_role_overview', title: 'Understanding the Community Health Worker Role', desc: 'Overview of CHWs as trusted frontline health workers in the community.', dur: 4, embed: 'https://www.youtube.com/embed/dqIk0ECpWzU', req: false },

  /* External – Health equity / SDOH */
  sdohShort: { id: 'sdoh_short', title: 'What Makes Us Healthy? Social Determinants of Health', desc: 'How housing, income, environment, and policy shape health outcomes.', dur: 6, embed: 'https://www.youtube.com/embed/8PH4JYfF4Ns', req: false },
  
  /* Board & governance */
  board101: { id: 'board_governance_101', title: 'Board of Directors 101: Roles & Responsibilities', desc: 'Legal duties, governance, and oversight for nonprofit board members.', dur: 60, embed: 'https://www.youtube.com/embed/zADB9U5TK0A', req: true },
  boardChange2025: { id: 'board_change_2025', title: 'Beyond Board Training: How to Create Real Change (2025)', desc: 'How modern boards can drive equity, culture, and strategy.', dur: 30, embed: 'https://www.youtube.com/embed/nTUM9NCydM4', req: false },
  cabRoles: { id: 'cab_roles', title: 'Advisory Boards: Roles, Voice, and Community Power', desc: 'How community advisory boards shape programs and accountability.', dur: 20, embed: 'https://www.youtube.com/embed/K6mgnRbiiqM', req: true },

  /* Storytelling / content */
  npStorytelling: { id: 'np_storytelling', title: 'Storytelling for Nonprofits: How to Share Impact with Dignity', desc: 'How to write stories that center dignity, consent, and impact—not trauma.', dur: 22, embed: 'https://www.youtube.com/embed/ZFh3yq_u7aE', req: true },

  /* Fundraising / development */
  fundraisingBasics: { id: 'fundraising_basics', title: 'Fundraising Basics for Small & Community Nonprofits', desc: 'Core donor strategy, campaigns, and building a culture of giving.', dur: 52, embed: 'https://www.youtube.com/embed/bMf3HUtxbw4', req: true },
  grantTipsMillions: { id: 'grant_tips_millions', title: 'Grant Writing Tips: How I Secured Millions in Funding', desc: 'Positioning, alignment, and writing grants that actually get funded.', dur: 18, embed: 'https://www.youtube.com/embed/wS_p_1wR8rE', req: true },
  p2pFundraising: { id: 'p2p_fundraising', title: 'How to Run a Peer-to-Peer Fundraising Campaign', desc: 'Setting up a page, telling your story, and inviting your network to give.', dur: 18, embed: 'https://www.youtube.com/embed/4_IES6QeYrl', req: true },
  
  /* Social media */
  smHowUse2024: { id: 'sm_how_use_2024', title: 'How You Should Be Using Social Media in 2024 (Nonprofits)', desc: "What content works, what doesn't, and how to show up online as a nonprofit.", dur: 9, embed: 'https://www.youtube.com/embed/-j9qVki1_EM', req: true },
  smStrategy1: { id: 'sm_strategy_1', title: '#1 Social Media Strategy for Nonprofits', desc: 'Live, real, human-centered content that builds trust and donations.', dur: 7, embed: 'https://www.youtube.com/embed/VG_IT0ct1ig', req: true },
  smPlan2024: { id: 'sm_plan_2024', title: 'Create a Nonprofit Social Media Strategy & Content Calendar', desc: "How to plan content, campaigns, and a posting rhythm that's sustainable.", dur: 18, embed: 'https://www.youtube.com/embed/bF3eMIKnRVg', req: false },
  
  /* Ops / program / events */
  npOps: { id: 'np_ops', title: 'Building Simple, Effective Nonprofit Operations', desc: 'How to design processes, checklists, and systems that actually work.', dur: 24, embed: 'https://www.youtube.com/embed/x8gYQ8oQn9g', req: true },
  npEvents: { id: 'events_for_np', title: 'How to Plan a Nonprofit Event Step by Step', desc: 'Logistics, timelines, and roles for smooth nonprofit events.', dur: 20, embed: 'https://www.youtube.com/embed/s7KJ4qPp1kM', req: true },
  npProgramMgmt: { id: 'np_program_mgmt', title: 'Program Management for Nonprofits', desc: 'Designing, running, and evaluating community programs.', dur: 28, embed: 'https://www.youtube.com/embed/S1v964E64-s', req: true },
  
  /* Volunteer Management */
  recruitManageVols: { id: 'recruit_manage_vols', title: 'How to Successfully Recruit and Manage Volunteers', desc: 'Practical strategies for supporting, appreciating, and retaining volunteers.', dur: 45, embed: 'https://www.youtube.com/embed/SWLDdEkr9EM', req: true },
  volMgmtTop5: { id: 'vol_mgmt_top5', title: 'Top 5 Volunteer Management Strategies Every Nonprofit Needs', desc: 'High-level approaches to building a strong volunteer culture.', dur: 12, embed: 'https://www.youtube.com/embed/eBGINprwFM0', req: false },
};

// Core Training Modules - Required for ALL volunteers to unlock operational features
// These 5 modules must be completed for event eligibility
const CORE_TRAINING = [
  HMC_MODULES.hmcIntro,        // hmc_get_to_know_us
  HMC_MODULES.hipaa2025,       // hipaa_staff_2025
  HMC_MODULES.cmhwPart1,       // cmhw_part1
  HMC_MODULES.cmhwPart2,       // cmhw_part2
  HMC_MODULES.surveyTraining,  // hmc_survey_training
];

// Helper to merge core training with role-specific modules (avoids duplicates)
const withCoreTraining = (roleModules: any[]) => {
  const coreIds = CORE_TRAINING.map(m => m.id);
  const additionalModules = roleModules.filter(m => !coreIds.includes(m.id));
  return [...CORE_TRAINING, ...additionalModules];
};

export const ROLE_MODULES: { [key: string]: any[] } = {
  // All roles now include the 5 core training modules + their role-specific modules
  general_volunteer: withCoreTraining([ HMC_MODULES.sdohShort ]),
  core_volunteer: withCoreTraining([ HMC_MODULES.hivOraquick, HMC_MODULES.chwRole, HMC_MODULES.sdohShort ]),
  licensed_medical: withCoreTraining([ HMC_MODULES.hipaaCyber2024, HMC_MODULES.hivOraquick, HMC_MODULES.streetMedIntro ]),
  tech_team: withCoreTraining([ HMC_MODULES.hipaaCyber2024 ]),
  board_member: withCoreTraining([ HMC_MODULES.board101, HMC_MODULES.boardChange2025 ]),
  community_advisory_board: withCoreTraining([ HMC_MODULES.cabRoles, HMC_MODULES.boardChange2025 ]),
  content_writer: withCoreTraining([ HMC_MODULES.npStorytelling, HMC_MODULES.sdohShort ]),
  data_analyst: withCoreTraining([ HMC_MODULES.hipaaCyber2024 ]),
  development_coordinator: withCoreTraining([ HMC_MODULES.fundraisingBasics ]),
  events_coordinator: withCoreTraining([ HMC_MODULES.npEvents ]),
  fundraising_volunteer: withCoreTraining([ HMC_MODULES.p2pFundraising ]),
  grant_writer: withCoreTraining([ HMC_MODULES.grantTipsMillions ]),
  medical_admin: withCoreTraining([]),
  operations_coordinator: withCoreTraining([ HMC_MODULES.npOps, HMC_MODULES.streetMedIntro ]),
  outreach_volunteer: withCoreTraining([ HMC_MODULES.sdohShort, HMC_MODULES.streetMedIntro ]),
  program_coordinator: withCoreTraining([ HMC_MODULES.npProgramMgmt, HMC_MODULES.sdohShort ]),
  social_media_team: withCoreTraining([ HMC_MODULES.smHowUse2024, HMC_MODULES.smStrategy1, HMC_MODULES.smPlan2024 ]),
  volunteer_lead: withCoreTraining([ HMC_MODULES.recruitManageVols, HMC_MODULES.volMgmtTop5 ]),
};

export const ADVANCED_MODULES = [
    { id: 'adv-conflict-resolution', title: 'Advanced Conflict Resolution', objective: 'Master de-escalation techniques for high-stress community interactions.', estimatedMinutes: 15, type: 'ai' },
    { id: 'adv-grant-writing', title: 'Introduction to Grant Writing', objective: 'Learn the basics of finding and responding to grant opportunities for HMC programs.', estimatedMinutes: 15, type: 'ai' },
    { id: 'adv-leadership', title: 'Community Leadership Principles', objective: 'Develop skills for leading volunteer teams and managing mission logistics effectively.', estimatedMinutes: 10, type: 'ai' },
    { id: 'adv-mental-health-first-aid', title: 'Mental Health First Aid', objective: 'An overview of how to assist someone experiencing a mental health crisis.', estimatedMinutes: 55, type: 'video' },
];

export const EVENTS: ClinicEvent[] = [];
export const OPPORTUNITIES: Opportunity[] = [];
export const SHIFTS: Shift[] = [];
export const INITIAL_VOLUNTEERS: Volunteer[] = [];
export const SUPPORT_TICKETS: SupportTicket[] = [];

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'workshop-event-ops',
    name: 'Workshop / Event Operations',
    stages: {
      setup: {
        title: 'Pre-Event Setup',
        items: [
          { id: 'we-s-1', text: 'Assist with event space setup (tables, chairs, signage)' },
          { id: 'we-s-2', text: 'Prepare registration table: sign-in sheets, materials, pens' },
          { id: 'we-s-3', text: 'Confirm all materials are available and organized' },
        ],
      },
      live_ops: {
        title: 'During Event',
        items: [
          { id: 'we-lo-1', text: 'Greet and sign-in participants' },
          { id: 'we-lo-2', text: 'Distribute event materials and goodie bags' },
          { id: 'we-lo-3', text: 'Track attendance count' },
          { id: 'we-lo-4', text: 'Take photos (only with consent)' },
          { id: 'we-lo-5', text: 'Maintain a tidy and welcoming environment' },
        ],
      },
      breakdown: {
        title: 'Post-Event Breakdown',
        items: [
          { id: 'we-b-1', text: 'Collect all sign-in sheets and feedback forms' },
          { id: 'we-b-2', text: 'Track final count of distributed incentives/goodie bags' },
          { id: 'we-b-3', text: 'Pack up all materials and supplies' },
          { id: 'we-b-4', text: 'Wipe down tables and clean up the area' },
          { id: 'we-b-5', text: 'Debrief with event lead' },
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
];

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
