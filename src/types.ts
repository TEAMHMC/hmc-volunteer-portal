// HMC Volunteer Portal v4.0 - Updated Types with Critical Gap Fixes

export type TenantId = 'hmc-health';
export type Language = 'en' | 'es';

export interface TrainingModule {
  id: string;
  title: string;
  duration: string;
  isRequired: boolean;
  status: 'pending' | 'completed';
}

export interface TrainingPlan {
  role: string;
  orientationModules: {
    id: string;
    title: string;
    objective: string;
    estimatedMinutes: number;
    embed?: string;
    readingContent?: string;
  }[];
  completionGoal?: string;
  coachSummary?: string;
}

export interface RoleAssessment {
  question: string;
  answer: string;
}

export interface ComplianceStep {
  id: string;
  label: string;
  status: 'pending' | 'completed' | 'verified';
  dateCompleted?: string;
}

export interface Skill {
  name: string;
  validated: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  assignedDate: string;
  dueDate?: string;
}

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  dateEarned: string;
}

export interface Opportunity {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  category: string;
  serviceLocation: string;
  address?: string;
  locationCoordinates?: { lat: number; lng: number };
  date: string;
  dateDisplay?: string;
  time?: string;
  staffingQuotas: { role: string; count: number; filled: number }[];
  isPublic: boolean;
  isPublicFacing: boolean;
  urgency: 'low' | 'medium' | 'high';
  requiredSkills: string[];
  requiredSkillsRaw?: string;
  slotsTotal: number;
  slotsFilled: number;
  surveyKitId?: string;
  estimatedAttendees?: number;
  supplyList?: string;
  serviceOfferingIds?: string[];
  equipment?: { equipmentId: string; name: string; quantity: number }[];
  checklist?: { text: string; done: boolean }[];
  checklistOverride?: {
    name: string;
    stages: { [key: string]: { title: string; items: { id: string; text: string }[] } };
  };
  requiresClinicalLead?: boolean;
  flyerUrl?: string;
  flyerBase64?: string;
  // Approval workflow - events need admin approval before being visible to all volunteers
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  createdBy?: string;
  createdAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface Shift {
  id: string;
  tenantId: string;
  opportunityId: string;
  startTime: string;
  endTime: string;
  roleType: string;
  slotsTotal: number;
  slotsFilled: number;
  assignedVolunteerIds: string[];
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  email: string;
  cellPhone: string;
  homePhone?: string;
}

// ============================================================
// HMC v4.0 VOLUNTEER INTERFACE - CRITICAL GAP FIXES
// ============================================================
// KEY FIXES:
// 1. Separated identityLabel (universal) from volunteerRole (specific)
// 2. Added coreVolunteerStatus as distinct training milestone
// 3. Made HIPAA training mandatory for ALL after approval
// 4. Added eventEligibility gates for event deployment
// 5. Made availability required for ALL volunteers
// ============================================================

export interface Volunteer {
  id: string;
  tenantId: TenantId;
  
  // Personal Information
  legalFirstName: string;
  middleName?: string;
  legalLastName: string;
  preferredFirstName?: string;
  preferredLastName?: string;
  dob: string;
  gender: string;
  ssn?: string; 
  school?: string;
  degree?: string;
  
  // Contact Information
  email: string;
  phone: string;
  homePhone?: string;

  // Languages (for matching with community needs)
  languagesSpoken?: string[];

  // Demographics (for grant reporting purposes)
  demographics?: {
    race?: string[];
    ethnicity?: string;
    veteranStatus?: boolean;
    disabilityStatus?: boolean;
  };
  
  // Address
  address: string;
  addressApt?: string;
  city: string;
  state: string;
  zipCode: string;
  mailingAddressSame: boolean;
  mailingAddress?: string;
  mailingCity?: string;
  
  // Emergency Contact
  emergencyContact: EmergencyContact;
  
  // Affiliation & Background
  hmcAffiliation: string[];
  isEmployed: boolean;
  isStudent: boolean;
  tshirtSize: string;
  gainFromExperience: string;
  howDidYouHear: string;

  // ============================================================
  // RETURNING VOLUNTEER & GROUP AFFILIATION
  // ============================================================
  // Track if this is a returning volunteer
  isReturningVolunteer?: boolean;
  previousVolunteerPeriod?: string; // e.g., "2023", "2022-2023"
  previousVolunteerRole?: string;

  // Track group volunteering (student orgs, corporate teams, etc.)
  isGroupVolunteer?: boolean;
  groupType?: 'Student Organization' | 'Corporate Team' | 'Faith-Based Group' | 'Community Group' | 'School Class' | 'Other';
  groupName?: string; // e.g., "UCLA Pre-Med Society", "Google Volunteer Team"
  groupSize?: number; // How many people in their group
  groupContactEmail?: string; // Point of contact for the group

  // ============================================================
  // HMC v4.0 IDENTITY SYSTEM (CRITICAL GAP FIX #1)
  // ============================================================
  // Universal identity label - ALL volunteers have this
  identityLabel: 'HMC Champion';
  
  // Specific volunteer role - ONE primary role per volunteer
  // Roles are now organized into:
  // - Primary: Core Volunteer (community-facing)
  // - Specialized: Board, Medical, Tech, etc. (separate tracks)
  volunteerRole: 'Core Volunteer' | 'Board Member' | 'Community Advisory Board' |
                 'Licensed Medical Professional' | 'Medical Admin' | 'Tech Team' |
                 'Data Analyst' | 'Development Coordinator' | 'Grant Writer' |
                 'Fundraising Volunteer' | 'Newsletter & Content Writer' | 'Content Writer' | 'Social Media Team' |
                 'Events Lead' | 'Events Coordinator' | 'Program Coordinator' |
                 'General Operations Coordinator' | 'Operations Coordinator' |
                 'Outreach & Engagement Lead' | 'Outreach Volunteer' |
                 'Volunteer Lead' | 'Student Intern' | 'System Administrator';
  
  // Legacy field for backwards compatibility
  name: string;
  role: string;
  
  // ============================================================
  // CORE VOLUNTEER STATUS (CRITICAL GAP FIX #2)
  // Training milestone - separate from role
  // Once approved, volunteer can deploy to events
  // ============================================================
  coreVolunteerStatus: boolean;
  coreVolunteerApprovedDate?: string;
  
  // ============================================================
  // HIPAA TRAINING (CRITICAL GAP FIX #3)
  // MANDATORY for ALL volunteers after Core Volunteer approval
  // Required BEFORE shift registration
  // ============================================================
  completedHIPAATraining?: boolean;
  hipaaTrainingDate?: string;
  
  // Role application tracking
  appliedRole?: string;
  appliedRoleStatus?: 'pending' | 'approved' | 'rejected';
  
  // Status Management
  status: 'applicant' | 'onboarding' | 'active' | 'inactive';
  joinedDate: string;
  onboardingProgress: number;
  isAdmin: boolean;
  points: number;
  avatarUrl?: string;
  profilePhoto?: string;
  hoursContributed: number;
  hasCompletedSystemTour?: boolean;
  isNewUser?: boolean;
  interestedIn?: string;
  timeCommitment?: string;
  
  // Compliance Tracking
  compliance: {
    application: ComplianceStep;
    backgroundCheck: ComplianceStep;
    hipaaTraining: ComplianceStep;
    training: ComplianceStep;
    orientation: ComplianceStep;
    liveScan?: ComplianceStep;
  };

  // ============================================================
  // AVAILABILITY SYSTEM (CRITICAL GAP FIX #4)
  // REQUIRED for ALL volunteers - no exceptions
  // Supports CSV bulk import with availability data
  // ============================================================
  availability: {
    days: string[]; // Mon, Tue, Wed, etc.
    preferredTime: string; // Legacy: Morning, Afternoon, Evening
    dayTimeSlots?: Record<string, { start: string; end: string }>; // Per-day hours e.g. { "Mon": { start: "09:00", end: "14:00" } }
    timezone?: string; // e.g. "America/Los_Angeles"
    startDate: string; // When volunteer can start
    servicePreference?: 'in-person' | 'hybrid' | 'virtual';
    unavailableDates?: string[]; // Dates they cannot volunteer
    notes?: string;
    hoursPerWeek?: string; // Expected hours per week
    lastUpdated?: string; // For weekly reminder tracking
  };

  // ============================================================
  // EVENT DEPLOYMENT ELIGIBILITY GATES (CRITICAL GAP FIX #5)
  // Enforces training requirements for different event types
  // ============================================================
  eventEligibility: {
    canDeployCore: boolean; // Requires: Core Volunteer + HIPAA
    streetMedicineGate: boolean; // Specific training gate
    clinicGate: boolean; // Specific training gate
    healthFairGate: boolean; // Specific training gate
    naloxoneDistribution: boolean; // Specific certification gate
    oraQuickDistribution: boolean; // Specific certification gate
    qualifiedEventTypes: string[]; // List of event types volunteer can deploy to
  };

  // Skills & Development
  skills: Skill[];
  tasks: Task[];
  achievements: Achievement[];
  trainingPlan?: TrainingPlan;
  roleAssessment?: RoleAssessment[];
  completedTrainingIds?: string[];
  trainingSignatures?: Record<string, { fullName: string; signedAt: string; }>;
  assignedShiftIds?: string[];
  
  // Notifications
  notificationPrefs?: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    opportunityUpdates: boolean;
    trainingReminders: boolean;
    eventInvitations: boolean;
  };

  // Additional Fields
  managedBy?: string;
  registeredOpportunityIds?: string[];
  applicationStatus?: 'pendingReview' | 'approved' | 'rejected';
  resume?: { name: string; type: string; data?: string; storagePath?: string; uploadedAt?: string; };
  tags?: string[];
  rsvpedEventIds?: string[];
  trainingFlags?: {
    surveySOPComplete?: boolean;
    clientPortalOrientationComplete?: boolean;
    screeningCompetencyVerified?: boolean;
  };

  // Clinical Onboarding (for Licensed Medical Professionals)
  clinicalOnboarding?: {
    completed: boolean;
    completedAt?: string;
    // Document acknowledgments with signatures
    documents: {
      clinicalOnboardingGuide?: { signed: boolean; signedAt?: string; signatureData?: string; };
      policiesProcedures?: { signed: boolean; signedAt?: string; signatureData?: string; };
      screeningConsent?: { signed: boolean; signedAt?: string; signatureData?: string; };
      standingOrders?: { signed: boolean; signedAt?: string; signatureData?: string; };
    };
    // License & Credentials
    credentials: {
      npi?: string;
      licenseNumber?: string;
      licenseState?: string;
      licenseExpiration?: string;
      licenseFileUrl?: string;
      deaNumber?: string;
      deaExpiration?: string;
      deaFileUrl?: string;
      boardCertification?: string;
      boardCertExpiration?: string;
      malpracticeInsurance?: boolean;
      malpracticeFileUrl?: string;
    };
  };

  // Social Media Points (earned by following HMC on social platforms)
  claimedSocialPoints?: string[];

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  lastActiveAt?: string;

  // Online status for messaging
  isOnline?: boolean;
}

// ============================================================
// ADDITIONAL TYPES
// ============================================================

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  tags?: string[];
  visibleTo?: string[];
}

export interface FormField {
  id: string;
  type: 'Short Text' | 'Multiple Choice' | 'Checkboxes' | 'Rating';
  question: string;
  options?: string[];
  required?: boolean;
}

export interface SurveyKit {
  id: string;
  name: string;
  formStructure: FormField[];
  volunteerScript: { en: string, es: string };
  eventTypesAllowed?: string[];
  tabletSetupChecklist?: string[];
  dedupeRules?: { 
    messageEn: string; 
    messageEs: string; 
    uniqueIdentifiers: string[]; 
  };
}

export interface AuditLog {
    id: string;
    timestamp: string; 
    actionType: string;
    summary: string;
    actorUserId: string;
    actorRole: string;
    shiftId: string;
    eventId: string;
    targetSystem?: string;
    targetId?: string;
}

export interface ClinicEvent {
  id: string;
  title: string;
  program: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  date: string;
  dateDisplay: string;
  time: string;
  surveyKitId?: string;
}

export interface TicketNote {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt: string;
    isInternal?: boolean; // Internal notes only visible to admins
}

export interface TicketActivity {
    id: string;
    type: 'created' | 'status_change' | 'assigned' | 'note_added' | 'priority_change';
    description: string;
    performedBy: string;
    performedByName: string;
    timestamp: string;
    oldValue?: string;
    newValue?: string;
}

export type TicketCategory =
    | 'technical'
    | 'account'
    | 'training'
    | 'scheduling'
    | 'compliance'
    | 'feedback'
    | 'other';

export interface SupportTicket {
    id: string;
    volunteerId?: string;
    submittedBy?: string;
    submitterName?: string;
    submitterEmail?: string;
    submitterRole?: string;
    subject: string;
    description: string;
    status: 'open' | 'closed' | 'in_progress';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: TicketCategory;
    visibility?: 'public' | 'team' | 'private';
    createdAt: string;
    updatedAt?: string;
    closedAt?: string;
    assignedTo?: string;
    assignedToName?: string;
    notes?: TicketNote[];
    activity?: TicketActivity[];
    responses?: any[];
}

export interface ChecklistItem {
    id: string;
    text: string;
}

export interface ChecklistStage {
    title: string;
    items: ChecklistItem[];
}

export interface ChecklistTemplate {
    id: string;
    name: string;
    stages: {
        [key: string]: ChecklistStage;
    };
}

export interface Script {
    id: string;
    title: string;
    notice: string;
    content: string;
}

export interface ServiceOffering {
    id: string;
    name: string;
    description: string;
    requiredRoles: { role: string; count: number }[];
}

export interface Message {
    id: string;
    senderId: string;
    sender?: string;
    recipientId: string;
    content: string;
    timestamp: string;
    read: boolean;
    readAt?: string;
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    date: string;
    category: string;
    status: 'pending' | 'approved';
    targetRoles?: string[];
}

export interface VolunteerSurveyResponse {
    id: string;
    volunteerId: string;
    volunteerRole: string;
    eventId: string;
    rating: number;
    feedback: string;
    submittedAt: string;
}

export interface ClientRecord {
    id?: string;

    // Basic Info
    firstName: string;
    lastName: string;
    dob: string;
    phone: string;
    email?: string;

    // Demographics (for matching & grant reporting)
    gender?: string;
    pronouns?: string;
    primaryLanguage?: string;
    race?: string[];
    ethnicity?: string;
    veteranStatus?: boolean;
    lgbtqiaIdentity?: boolean;
    homelessnessStatus?: 'Currently Homeless' | 'At Risk' | 'Recently Housed' | 'Stably Housed';

    // Location
    address?: string;
    city?: string;
    zipCode?: string;
    spa?: string; // Service Planning Area (LA County)

    // Social Determinant Needs (for AI matching)
    needs?: {
        housing?: boolean;
        food?: boolean;
        healthcare?: boolean;
        mentalHealth?: boolean;
        substanceUse?: boolean;
        employment?: boolean;
        legal?: boolean;
        transportation?: boolean;
        utilities?: boolean;
        childcare?: boolean;
        domesticViolence?: boolean;
        other?: string;
    };

    // Eligibility factors
    incomeLevel?: string;
    insuranceStatus?: string;
    documentationStatus?: string;

    // Consent & Privacy
    consentToShare?: boolean;
    consentDate?: string;

    // AI-generated fields
    aiEligibilitySummary?: string;
    aiIntakeSummary?: string;

    // Tracking
    intakeDate?: string;
    intakeBy?: string;
    lastServiceDate?: string;
    totalReferrals?: number;

    // Status
    status?: 'Active' | 'Inactive' | 'Closed';
    createdAt?: string;
    updatedAt?: string;
}

export interface ScreeningRecord {
  id?: string;
  clientId: string;
  systolic: number;
  diastolic: number;
  heartRate: number;
  oxygenSaturation: number;
  glucose?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  abnormalFlag: boolean;
  abnormalReason?: string;
  performedBy: string;
  shiftId: string;
  eventId: string;
  timestamp: string;
}

export interface MissionOpsRun {
    id: string;
    shiftId: string;
    volunteerId: string;
    completedItems: string[];
    signoffSignature?: string;
    signoffTimestamp?: string;
}

export interface IncidentReport {
  id: string;
  shiftId: string;
  volunteerId: string;
  timestamp: string; 
  type: 'EMS activation' | 'Exposure incident' | 'Safety/security issue' | 'Other';
  description: string;
  actionsTaken: string;
  whoNotified: string;
  status: 'reported' | 'resolved';
}

export interface ReferralRecord {
    id: string;
    clientId: string;
    clientName: string;
    referralDate: string;
    referredBy: string;
    referredByName?: string;
    serviceNeeded: string;
    serviceCategory?: string;
    notes?: string;
    status: 'Pending' | 'In Progress' | 'Completed' | 'Withdrawn' | 'No Show';
    urgency: 'Standard' | 'Urgent' | 'Emergency';
    referredTo: string; // Primary resource name
    referredToId?: string; // Resource ID
    createdAt: string;
    eventId?: string;

    // SLA Tracking (72-hour standard)
    slaDeadline?: string;
    slaComplianceStatus?: 'Compliant' | 'Non-Compliant' | 'On Track' | 'Excluded';
    firstContactDate?: string;
    firstContactBy?: string;

    // AI Matching
    aiMatchedResources?: {
        resourceId: string;
        resourceName: string;
        matchScore: number;
        matchReason: string;
    }[];
    aiMatchSummary?: string;

    // Follow-up & Outcome
    followUpDate?: string;
    followUpNotes?: string;
    outcome?: 'Successful' | 'Unsuccessful' | 'Partial' | 'Pending';
    outcomeDetails?: string;
    outcomeDate?: string;

    // Client feedback
    clientSatisfaction?: number; // 1-5
    clientFeedback?: string;

    // Partner response
    partnerResponseDate?: string;
    partnerNotes?: string;

    updatedAt?: string;
}

export interface ServiceFeedback {
    id: string;
    type: 'service' | 'event';
    referralId?: string;
    eventId?: string;
    clientId?: string;
    resourceId?: string;
    resourceName?: string;
    rating: number; // 1-5
    comments?: string;
    wouldRecommend?: boolean;
    submittedAt: string;
    submittedBy?: string;
}

export interface PartnerAgency {
    id: string;
    name: string;
    type: 'Healthcare' | 'Housing' | 'Food' | 'Legal' | 'Employment' | 'Mental Health' | 'Other';
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    website?: string;
    spa?: string;
    servicesProvided?: string[];
    languagesSupported?: string[];
    targetPopulations?: string[];
    portalAccess?: boolean;
    portalUserId?: string;
    performanceScore?: number;
    totalReferrals?: number;
    successfulOutcomes?: number;
    avgResponseTime?: number; // in hours
    status: 'Active' | 'Inactive' | 'Pending';
    partnerSince?: string;
    lastActivityDate?: string;
    notes?: string;
}

export interface ClientDocument {
    id: string;
    clientId: string;
    type: 'Legal' | 'Medical' | 'Intake' | 'Referral' | 'ID' | 'Income' | 'Other';
    name: string;
    description?: string;
    fileUrl?: string;
    fileBase64?: string;
    uploadedBy: string;
    uploadedAt: string;
    expirationDate?: string;
    verified?: boolean;
    verifiedBy?: string;
    verifiedAt?: string;
}

export interface ReferralResource {
    id?: string;
    "Resource Name": string;
    "Service Category": string;
    "Key Offerings": string;
    "Eligibility Criteria": string;
    "Languages Spoken": string;
    "Target Population": string;
    "Operation Hours": string;
    "Contact Phone": string;
    "Contact Email": string;
    "Address": string;
    "Website": string;
    "SPA": string;
    "Active / Inactive": "checked" | "unchecked";

    // AI-verified fields
    aiVerifiedAddress?: string;
    aiVerifiedPhone?: string;
    aiVerifiedEmail?: string;
    aiBusinessSummary?: string;
    contactInfoVerified?: boolean;
    lastVerifiedAt?: string;

    // Quality Metrics
    averageRating?: number;
    totalReferrals?: number;
    successfulOutcomes?: number;
    avgResponseTimeHours?: number;
    slaComplianceRate?: number;

    // Feedback summary
    feedbackSummary?: string;
    lastFeedbackDate?: string;

    // Partner agency link
    partnerAgencyId?: string;

    createdAt?: string;
    updatedAt?: string;
}

// ============================================================
// CSV BULK IMPORT SUPPORT
// ============================================================
// For bulk import, required CSV columns are:
// - legalFirstName, legalLastName, email, phone
// - availability_days (comma-separated: Mon,Tue,Wed)
// - availability_preferredTime (Morning/Afternoon/Evening)
// - availability_startDate (YYYY-MM-DD)
// - availability_hoursPerWeek (optional)
// - volunteerRole (must match allowed roles)
// ============================================================

export interface OrgCalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;              // YYYY-MM-DD
  startTime: string;         // "10:00 AM" or ISO
  endTime?: string;          // "11:00 AM" or ISO
  type: 'all-hands' | 'committee' | 'training' | 'social' | 'community-event' | 'board' | 'mission' | 'other';
  location?: string;         // Physical or "Virtual"
  meetLink?: string;         // Google Meet / Zoom
  visibleTo?: string[];      // Roles; empty/undefined = everyone
  rsvps?: { odId: string; odName: string; status: 'attending' | 'tentative' | 'declined' }[];
  isRecurring?: boolean;
  recurrenceNote?: string;   // Human-readable: "Every 1st Monday"
  createdBy?: string;
  source?: 'org-calendar' | 'board-meeting' | 'event-finder' | 'mission';
}

export interface CSVImportRow {
  legalFirstName: string;
  legalLastName: string;
  email: string;
  phone: string;
  volunteerRole: string;
  availability_days: string; // "Mon,Tue,Wed"
  availability_preferredTime: string;
  availability_startDate: string;
  availability_hoursPerWeek?: string;
  dob?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  tshirtSize?: string;
  howDidYouHear?: string;
}
