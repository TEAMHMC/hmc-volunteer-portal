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
  locationCoordinates?: { lat: number; lng: number };
  date: string;
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
  flyerUrl?: string;
  flyerBase64?: string;
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
                 'Fundraising Volunteer' | 'Content Writer' | 'Social Media Team' | 
                 'Events Coordinator' | 'Program Coordinator' | 'Operations Coordinator' | 
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
    preferredTime: string; // Morning, Afternoon, Evening
    startDate: string; // When volunteer can start
    servicePreference?: 'in-person' | 'hybrid' | 'virtual';
    timezone?: string;
    unavailableDates?: string[]; // Dates they cannot volunteer
    notes?: string;
    hoursPerWeek?: string; // Expected hours per week
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
  resume?: { name: string; type: string; data?: string; };
  tags?: string[];
  rsvpedEventIds?: string[];
  trainingFlags?: {
    surveySOPComplete?: boolean;
    clientPortalOrientationComplete?: boolean;
    screeningCompetencyVerified?: boolean;
  };
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  lastActiveAt?: string;
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
  dateDisplay: string;
  time: string;
  surveyKitId?: string;
}

export interface SupportTicket {
    id: string;
    volunteerId: string;
    subject: string;
    description: string;
    status: 'open' | 'closed' | 'in-progress';
    createdAt: string;
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
    receiverId: string;
    content: string;
    timestamp: string;
    read: boolean;
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    date: string;
    category: string;
    status: 'pending' | 'approved';
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
    firstName: string;
    lastName: string;
    dob: string;
    phone: string;
    email?: string;
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
    serviceNeeded: string;
    notes?: string;
    status: 'Pending' | 'In Progress' | 'Completed' | 'Withdrawn';
    urgency: 'Standard' | 'Urgent' | 'Emergency';
    referredTo: string;
    createdAt: string;
    eventId?: string;
    slaComplianceStatus?: 'Compliant' | 'Non-Compliant' | 'On Track' | 'Excluded';
    outcome?: string;
}

export interface ReferralResource {
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
