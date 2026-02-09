/**
 * HMC Volunteer Portal v4.0 - Configuration
 * 
 * CRITICAL CHANGES:
 * - Roles organized into Primary (Core Volunteer) and Specialized Tracks
 * - HIPAA training now mandatory for ALL after approval
 * - Event deployment gates clearly defined
 * - CSV bulk import validation rules
 */

export const APP_CONFIG = {
  APP_NAME: "Health Matters Clinic",
  VERSION: "4.0.0-PROD-HMC",
  BRAND: {
    primary: "#233dff",
    secondary: "#ff6e40",
    accent: "#f9c74f",
    logoUrl: "https://cdn.prod.website-files.com/67359e6040140078962e8a54/690707bad1dd547278086592_Untitled%20(256%20x%20256%20px)-2.png"
  },
  TENANTS: {
    'hmc-health': {
      emailQuota: 500,
      smsQuota: 500
    }
  },
  SAAS_SECURITY: {
    hostingRegion: "United States (West Coast)",
    encryptionStandard: "AES-256 Bit GCM",
    auditProtocol: "Real-time SIEM Audit"
  },
  
  // ============================================================
  // HMC ROLES CONFIGURATION v4.0
  // ============================================================
  // STRUCTURE:
  // - One PRIMARY community role: Core Volunteer
  // - Multiple SPECIALIZED parallel tracks (not add-ons)
  // Each role has its own:
  // - Compliance requirements
  // - Training pathway
  // - Application questions
  // - Event eligibility
  // ============================================================
  
  HMC_ROLES: [
    // ============================================================
    // PRIMARY COMMUNITY ROLE
    // ============================================================
    { 
      id: "core_volunteer", 
      label: "Core Volunteer", 
      description: "Community-based care event support - our primary volunteer pathway",
      icon: "HeartPulse",
      category: "community",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'],
      trainingModules: [
        'hmc_orientation',
        'hmc_champion',
        'hipaa_nonclinical',
        'cmhw_part1',
        'cmhw_part2',
        'survey_general',
        'portal_howto',
        'emergency_protocols_general',
      ],
      applicationQuestions: [
        "Describe your experience working with diverse or vulnerable populations in a community setting.", 
        "This role often involves handling sensitive client information. How do you approach maintaining confidentiality?", 
        "Why are you specifically interested in a frontline role like Core Volunteer at Health Matters Clinic?"
      ],
      eventEligibility: {
        streetMedicineGate: false, // Requires additional training
        clinicGate: false,
        healthFairGate: true, // Can deploy to health fairs
        naloxoneDistribution: false, // Requires certification
      }
    },
    
    // ============================================================
    // SPECIALIZED ROLES (SEPARATE TRACKS)
    // ============================================================
    { 
      id: "board_member", 
      label: "Board Member", 
      description: "Governance, strategic planning, fiduciary oversight",
      icon: "Briefcase",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'], 
      trainingModules: ['board_governance', 'hipaa_training'],
      applicationQuestions: [
        "What experience do you have with non-profit governance, strategic planning, or fiduciary oversight?", 
        "Why are you passionate about Health Matters Clinic's mission, and what unique perspective or expertise would you bring to the board?", 
        "Describe your understanding of a board member's fundraising responsibilities."
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "community_advisory_board", 
      label: "Community Advisory Board", 
      description: "Community voice and accountability",
      icon: "Shield",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'], 
      trainingModules: ['community_advocacy', 'hipaa_training'],
      applicationQuestions: [
        "What is your connection to the communities served by Health Matters Clinic?", 
        "In your opinion, what is the most pressing health challenge facing our community, and how can HMC help address it?", 
        "How would you ensure that the community's voice is heard and incorporated into HMC's planning?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "licensed_medical", 
      label: "Licensed Medical Professional", 
      description: "Licensed provider (MD, RN, NP, PA, etc.)",
      icon: "Stethoscope",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation', 'liveScan'], 
      trainingModules: ['medical_field_protocols', 'hipaa_training', 'scope_of_practice'],
      applicationQuestions: [
        "Please provide your medical license type (e.g., RN, MD, NP) and state/number.", 
        "Describe your experience in triage or providing care in low-resource or field settings.", 
        "How do you handle situations where you must operate within a limited scope of practice at a community event?"
      ],
      eventEligibility: {
        streetMedicineGate: true,
        clinicGate: true,
        healthFairGate: true,
        naloxoneDistribution: false, // Requires separate cert
      }
    },
    
    { 
      id: "medical_admin", 
      label: "Medical Admin", 
      description: "Medical records and healthcare administration",
      icon: "FilePlus",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation', 'liveScan'], 
      trainingModules: ['hipaa_training', 'medical_records', 'patient_privacy'],
      applicationQuestions: [
        "Describe your experience with medical records, patient intake, or healthcare administration.", 
        "How do you ensure accuracy and patient confidentiality while handling administrative tasks?", 
        "This role is crucial for clinic flow. How do you handle pressure in a fast-paced environment?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: true,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "tech_team", 
      label: "Tech Team", 
      description: "Software development, IT support, data engineering",
      icon: "Code",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'], 
      trainingModules: ['hipaa_training', 'tech_security'],
      applicationQuestions: [
        "Describe your technical skills (e.g., software development, IT support, data management). What are you most proficient in?", 
        "Have you ever developed or supported a system for a non-profit? If so, please describe it.", 
        "How would you explain a technical issue to a non-technical volunteer or staff member?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "data_analyst", 
      label: "Data Analyst", 
      description: "Data analysis and visualization",
      icon: "BarChart",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'], 
      trainingModules: ['hipaa_training', 'data_privacy'],
      applicationQuestions: [
        "What experience do you have with data analysis or visualization tools (e.g., SQL, Python, Tableau)?", 
        "How would you approach analyzing our volunteer engagement data to provide actionable insights?", 
        "Describe a time you used data to tell a story or influence a decision."
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "development_coordinator", 
      label: "Development Coordinator", 
      description: "Fundraising and donor relations",
      icon: "TrendingUp",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'], 
      trainingModules: ['fundraising_ethics', 'hipaa_training'],
      applicationQuestions: [
        "What experience do you have in fundraising, donor relations, or development operations?", 
        "How would you approach cultivating relationships with potential donors?", 
        "Describe your experience with fundraising CRMs or databases."
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "grant_writer", 
      label: "Grant Writer", 
      description: "Grant proposal writing and research",
      icon: "Feather",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'], 
      trainingModules: ['grant_writing', 'hipaa_training'],
      applicationQuestions: [
        "Please summarize your experience in grant writing, including the types of funders you've written for (e.g., foundation, corporate, government).", 
        "Can you describe your process for researching and identifying new funding opportunities?", 
        "How do you collaborate with program staff to gather the necessary information for a compelling grant proposal?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "fundraising_volunteer", 
      label: "Fundraising Volunteer", 
      description: "Peer-to-peer and community fundraising",
      icon: "Gift",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'], 
      trainingModules: ['peer_fundraising', 'hipaa_training'],
      applicationQuestions: [
        "What interests you about fundraising for Health Matters Clinic?", 
        "Are you comfortable reaching out to your personal network to support our mission?", 
        "Have you participated in a peer-to-peer fundraising campaign before?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    {
      id: "content_writer",
      label: "Newsletter & Content Writer",
      description: "Craft donor newsletters, blog posts, and impact stories that connect supporters to our mission of health equity",
      icon: "FileText",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'],
      trainingModules: ['storytelling', 'hipaa_training', 'client_privacy'],
      applicationQuestions: [
        "Please provide a link to a portfolio or 1-2 writing samples (e.g., newsletters, blog posts, or impact stories).",
        "How do you approach translating complex healthcare topics or program data into accessible, compelling narratives?",
        "Describe your experience with newsletter platforms (Mailchimp, Constant Contact) and gathering authentic stories through interviews while respecting privacy."
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "social_media_team", 
      label: "Social Media Team", 
      description: "Content creation and social media management",
      icon: "ThumbsUp",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'], 
      trainingModules: ['social_media_policy', 'hipaa_training'],
      applicationQuestions: [
        "Which social media platforms are you most experienced with for professional or organizational use?", 
        "Can you share a link to a social media account you have managed or significantly contributed to?", 
        "How would you tailor a message about a sensitive health topic for a public platform like Instagram?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    {
      id: "events_coordinator",
      label: "Events Lead",
      description: "Plan and coordinate pop-up clinics, wellness meetups, and community activations — lead volunteers, manage logistics, and keep every event running smoothly",
      icon: "Calendar",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'],
      trainingModules: ['event_logistics', 'hipaa_training'],
      applicationQuestions: [
        "Describe your experience planning and coordinating community events, health fairs, wellness activities, or similar gatherings.",
        "How do you approach leading pre-event briefings and ensuring volunteers feel supported and prepared on the day of an event?",
        "Events rarely go exactly as planned. Describe a time you had to troubleshoot an issue on the spot and keep things running smoothly."
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: true,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "program_coordinator", 
      label: "Program Coordinator", 
      description: "Program management and delivery",
      icon: "ClipboardList",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'], 
      trainingModules: ['program_management', 'hipaa_training'],
      applicationQuestions: [
        "Describe your experience managing or coordinating community-based programs.", 
        "How would you track program success and suggest improvements?", 
        "What is your approach to ensuring programs are delivered with cultural competency?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    {
      id: "operations_coordinator",
      label: "General Operations Coordinator",
      description: "Scheduling, communications, data entry, and project coordination to keep programs and events running smoothly",
      icon: "Settings",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'],
      trainingModules: ['operations', 'hipaa_training'],
      applicationQuestions: [
        "Describe your experience coordinating schedules, managing data, or supporting operational workflows for a team or organization.",
        "What tools are you comfortable with (e.g., Google Workspace, Notion, Trello, Asana) and how have you used them to stay organized?",
        "This role requires wearing many hats — from tracking supplies to sending logistics updates. How do you prioritize when juggling multiple responsibilities?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "volunteer_lead", 
      label: "Volunteer Lead", 
      description: "Volunteer team leadership and management",
      icon: "Users",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation', 'liveScan'], 
      trainingModules: ['volunteer_management', 'hipaa_training', 'leadership'],
      applicationQuestions: [
        "What is your philosophy on leading and motivating a team of volunteers?", 
        "Describe a time you had to manage a conflict or a difficult situation within a team.", 
        "How would you onboard and train a new volunteer to ensure they feel prepared and valued?"
      ],
      eventEligibility: {
        streetMedicineGate: true,
        clinicGate: true,
        healthFairGate: true,
        naloxoneDistribution: false,
      }
    },
    
    {
      id: "outreach_lead",
      label: "Outreach & Engagement Lead",
      description: "Community outreach strategy, partnership building, and grassroots engagement",
      icon: "Megaphone",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'],
      trainingModules: ['outreach_strategy', 'hipaa_training', 'community_engagement'],
      applicationQuestions: [
        "Describe your experience with community outreach, grassroots engagement, or partnership development.",
        "How would you approach connecting with local schools, churches, and community organizations to promote HMC's programs?",
        "What strategies would you use to build trust and long-term relationships with underserved communities?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: true,
        naloxoneDistribution: false,
      }
    },

    {
      id: "outreach_volunteer",
      label: "Outreach Volunteer",
      description: "Grassroots community outreach, event promotion, and resource distribution",
      icon: "Globe",
      category: "community",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'],
      trainingModules: ['outreach_basics', 'hipaa_training'],
      applicationQuestions: [
        "Why are you interested in community outreach with Health Matters Clinic?",
        "Are you comfortable approaching people in public settings to share information about health resources?",
        "Do you have any experience with community engagement, tabling, or canvassing?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: true,
        naloxoneDistribution: false,
      }
    },

    {
      id: "student_intern",
      label: "Student Intern",
      description: "Academic internship or skill-building",
      icon: "BookOpen",
      category: "specialized",
      complianceRequirements: ['application', 'backgroundCheck', 'hipaaTraining', 'training', 'orientation'], 
      trainingModules: ['hipaa_training', 'intern_onboarding'],
      applicationQuestions: [
        "What school/university are you attending and what is your field of study?", 
        "How does this internship support your academic goals?", 
        "What specific skills are you hoping to develop through this experience?"
      ],
      eventEligibility: {
        streetMedicineGate: false,
        clinicGate: false,
        healthFairGate: false,
        naloxoneDistribution: false,
      }
    },
    
    { 
      id: "system_admin", 
      label: "System Administrator", 
      description: "System administration (internal only)",
      icon: "Cog",
      category: "admin",
      complianceRequirements: [], 
      trainingModules: [],
      applicationQuestions: [] 
    }
  ],
  
  GAMIFICATION: {
    fundraisingGoal: 10,
    rewards: [
      { id: 'rew1', title: 'HMC Branded T-Shirt', points: 2500, icon: 'shirt' },
      { id: 'rew2', title: 'Insulated Water Bottle', points: 5000, icon: 'glass-water' },
      { id: 'rew3', title: 'Clinic Zip-Up Hoodie', points: 10000, icon: 'user' },
      { id: 'rew4', title: 'Letter of Rec from CEO', points: 25000, icon: 'award' }
    ],
    socialLinks: {
      instagram: "https://instagram.com/healthmatters.clinic",
      linkedin: "https://www.linkedin.com/company/healthmattersclinic",
      youtube: "https://www.youtube.com/@HEALTHMATTERS.CLINIC"
    }
  },
  
  TENANT_ID: 'hmc-health' as const
};

// ============================================================
// BUSINESS RULES v4.0
// ============================================================

export const BUSINESS_RULES = {
  // Shift Registration - CRITICAL v4.0
  SHIFT_REGISTRATION: {
    REQUIRES_CORE_VOLUNTEER: true, // Must have coreVolunteerStatus = true
    REQUIRES_HIPAA: true, // Must have completedHIPAATraining = true
    REQUIRES_CORE_ACADEMY: true, // Must have core training modules complete
    MIN_HOURS_BEFORE_REGISTRATION: 0,
    // Validation will check eventEligibility gates before allowing registration
  },
  
  // Compliance - CRITICAL v4.0
  COMPLIANCE: {
    BACKGROUND_CHECK_REQUIRED: true,
    HIPAA_TRAINING_REQUIRED: true, // Mandatory for ALL after approval
    ORIENTATION_REQUIRED: true,
    LIVESCAN_FOR_MEDICAL_ROLES: true,
  },
  
  // CSV Import - CRITICAL v4.0
  CSV_IMPORT: {
    MAX_VOLUNTEERS_PER_IMPORT: 1000,
    REQUIRE_AVAILABILITY: true, // Days, time, start date mandatory
    REQUIRE_ROLE: true,
    AUTO_ASSIGN_HMC_CHAMPION: true, // identityLabel = 'HMC Champion'
    VALIDATE_EMAIL_UNIQUE: true,
    COLUMNS_REQUIRED: [
      'legalFirstName',
      'legalLastName',
      'email',
      'phone',
      'volunteerRole',
      'availability_days',
      'availability_preferredTime',
      'availability_startDate'
    ]
  }
};
