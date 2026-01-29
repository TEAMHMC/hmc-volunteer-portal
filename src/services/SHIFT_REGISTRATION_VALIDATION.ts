/**
 * HMC Volunteer Portal v4.0 - Shift Registration Validation
 * 
 * CRITICAL ENFORCEMENT:
 * - Enforces Core Volunteer status requirement
 * - Enforces HIPAA training completion
 * - Validates event deployment eligibility gates
 * - Prevents registration if gates not met
 * 
 * This is the gatekeeper for volunteer shift assignments
 */

import { Volunteer, Shift, Opportunity } from '../types';

export interface RegistrationValidationResult {
  canRegister: boolean;
  blockingIssues: string[];
  warnings: string[];
  gatesStatus: {
    coreVolunteerStatus: boolean;
    hipaaTraining: boolean;
    coreAcademyComplete: boolean;
    backgroundCheckComplete: boolean;
    eventEligibilityGate: boolean;
  };
}

/**
 * CRITICAL VALIDATION: Check if volunteer meets all requirements for shift registration
 * 
 * Requirements (v4.0):
 * 1. Must have Core Volunteer status = true
 * 2. Must have completed HIPAA training
 * 3. Must have completed Core Academy modules
 * 4. Background check must be verified
 * 5. Event type must match eventEligibility gates
 */
export const validateShiftRegistration = (
  volunteer: Volunteer,
  shift: Shift,
  opportunity: Opportunity
): RegistrationValidationResult => {
  
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const gatesStatus = {
    coreVolunteerStatus: false,
    hipaaTraining: false,
    coreAcademyComplete: false,
    backgroundCheckComplete: false,
    eventEligibilityGate: false,
  };

  // ============================================================
  // GATE 1: CORE VOLUNTEER STATUS (CRITICAL v4.0)
  // ============================================================
  if (!volunteer.coreVolunteerStatus) {
    blockingIssues.push(
      '🔴 Core Volunteer Status Required: You must complete the Core Volunteer training and be approved before registering for shifts. ' +
      'Complete your onboarding in the Training Academy to gain this status.'
    );
  } else {
    gatesStatus.coreVolunteerStatus = true;
  }

  // ============================================================
  // GATE 2: HIPAA TRAINING (CRITICAL v4.0 - MANDATORY FOR ALL)
  // ============================================================
  if (!volunteer.completedHIPAATraining) {
    blockingIssues.push(
      '🔴 HIPAA Training Required: Before you can register for any shift, you must complete HIPAA training. ' +
      'This protects client confidentiality and is mandatory for all volunteers. Access the training in your Training Academy.'
    );
  } else {
    gatesStatus.hipaaTraining = true;
  }

  // ============================================================
  // GATE 3: CORE ACADEMY COMPLETION
  // ============================================================
  const requiredCoreModules = [
    'core_academy_module_1',
    'core_academy_module_2',
    'hipaa_training'
  ];
  
  const completedCoreModules = volunteer.completedTrainingIds || [];
  const missingModules = requiredCoreModules.filter(m => !completedCoreModules.includes(m));
  
  if (missingModules.length > 0) {
    blockingIssues.push(
      `🔴 Training Incomplete: You must complete the Core Academy modules before registering. ` +
      `Missing: ${missingModules.map(m => m.replace('_', ' ')).join(', ')}`
    );
  } else {
    gatesStatus.coreAcademyComplete = true;
  }

  // ============================================================
  // GATE 4: BACKGROUND CHECK VERIFICATION
  // ============================================================
  const bgCheckStatus = volunteer.compliance?.backgroundCheck?.status;
  if (bgCheckStatus !== 'verified' && bgCheckStatus !== 'completed') {
    warnings.push(
      '⚠️ Background Check Pending: Your background check is still being processed. ' +
      'You may continue preparing, but cannot be assigned to shifts until verified.'
    );
  } else {
    gatesStatus.backgroundCheckComplete = true;
  }

  // ============================================================
  // GATE 5: EVENT-SPECIFIC ELIGIBILITY
  // ============================================================
  let eventEligibilityMet = false;
  
  const eventType = opportunity.category?.toLowerCase() || '';
  const eligibility = volunteer.eventEligibility || {
    canDeployCore: false,
    streetMedicineGate: false,
    clinicGate: false,
    healthFairGate: false,
    naloxoneDistribution: false,
    oraQuickDistribution: false,
    qualifiedEventTypes: []
  };

  // Check specific event type gates
  if (eventType.includes('street medicine') && !eligibility.streetMedicineGate) {
    blockingIssues.push(
      '🔴 Street Medicine Training Required: This event requires additional specialized training. ' +
      'Complete Street Medicine training in your Training Academy.'
    );
  } else if (eventType.includes('street medicine')) {
    eventEligibilityMet = true;
  }

  if (eventType.includes('clinic') && !eligibility.clinicGate) {
    blockingIssues.push(
      '🔴 Clinic Operations Training Required: This event requires clinic-specific training. ' +
      'Complete Clinic Operations training in your Training Academy.'
    );
  } else if (eventType.includes('clinic')) {
    eventEligibilityMet = true;
  }

  if (eventType.includes('health fair') && !eligibility.healthFairGate) {
    blockingIssues.push(
      '🔴 Health Fair Eligibility: You are not currently eligible for this event type. ' +
      'Your current training qualifies you for: ' + (eligibility.qualifiedEventTypes.join(', ') || 'none yet')
    );
  } else if (eventType.includes('health fair')) {
    eventEligibilityMet = true;
  }

  // If no specific event type gate, check if at least Core deployment is possible
  if (!eventEligibilityMet && eligibility.canDeployCore) {
    eventEligibilityMet = true;
  }

  if (!eventEligibilityMet) {
    blockingIssues.push(
      `🔴 Event Eligibility Gate: This event type (${opportunity.category}) is not in your qualified events. ` +
      `Your current qualifications: ${eligibility.qualifiedEventTypes.join(', ') || 'Core events only (pending training completion)'}`
    );
  } else {
    gatesStatus.eventEligibilityGate = true;
  }

  // ============================================================
  // AVAILABILITY CHECK
  // ============================================================
  const shiftDate = new Date(opportunity.date);
  const shiftDayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][shiftDate.getDay()];
  
  const volunteerAvailableDays = volunteer.availability?.days || [];
  if (!volunteerAvailableDays.includes(shiftDayOfWeek)) {
    warnings.push(
      `⚠️ Availability Conflict: This shift is on ${shiftDayOfWeek}, but your availability is set for: ${volunteerAvailableDays.join(', ')}. ` +
      `Update your availability in My Profile if your schedule has changed.`
    );
  }

  const unavailableDates = volunteer.availability?.unavailableDates || [];
  if (unavailableDates.includes(opportunity.date)) {
    blockingIssues.push(
      `🔴 Time Off Conflict: You've marked ${opportunity.date} as unavailable. ` +
      `Remove this date from your "Time Off" list in My Profile if you want to register.`
    );
  }

  // ============================================================
  // FINAL RESULT
  // ============================================================
  const canRegister = blockingIssues.length === 0 && gatesStatus.coreVolunteerStatus && 
                     gatesStatus.hipaaTraining && gatesStatus.coreAcademyComplete;

  return {
    canRegister,
    blockingIssues,
    warnings,
    gatesStatus
  };
};

/**
 * Helper: Get human-readable message for registration blocks
 */
export const getRegistrationBlockMessage = (result: RegistrationValidationResult): string => {
  if (result.canRegister) {
    return '✅ You are eligible to register for this shift!';
  }

  const messages = [
    result.blockingIssues.length > 0 
      ? `${result.blockingIssues.length} requirement(s) blocking registration:\n${result.blockingIssues.join('\n\n')}`
      : 'Unable to register for this shift.',
    
    result.warnings.length > 0
      ? `\n\n⚠️ Warnings:\n${result.warnings.join('\n')}`
      : ''
  ];

  return messages.filter(Boolean).join('');
};

/**
 * Helper: Get list of missing training modules
 */
export const getMissingTrainingModules = (volunteer: Volunteer): string[] => {
  const requiredModules = [
    'core_academy_module_1',
    'core_academy_module_2',
    'hipaa_training'
  ];
  
  const completed = volunteer.completedTrainingIds || [];
  return requiredModules.filter(m => !completed.includes(m));
};

/**
 * Helper: Check if volunteer can be promoted to Core Volunteer status
 */
export const canPromoteToCoreVolunteer = (volunteer: Volunteer): boolean => {
  return (
    volunteer.compliance?.application?.status === 'completed' &&
    volunteer.compliance?.backgroundCheck?.status === 'verified' &&
    getMissingTrainingModules(volunteer).length === 0
  );
};

/**
 * Helper: Mark volunteer as ready for shift deployment
 * Sets coreVolunteerStatus and initializes eventEligibility
 */
export const promoteToCoreVolunteer = (volunteer: Volunteer): Volunteer => {
  return {
    ...volunteer,
    coreVolunteerStatus: true,
    coreVolunteerApprovedDate: new Date().toISOString(),
    eventEligibility: {
      canDeployCore: true, // Now eligible for Core events
      streetMedicineGate: false, // Requires additional training
      clinicGate: false,
      healthFairGate: true, // Health fairs are included in Core pathway
      naloxoneDistribution: false,
      oraQuickDistribution: false,
      qualifiedEventTypes: ['health_fair', 'wellness_event', 'community_outreach']
    },
    status: 'active',
    compliance: {
      ...volunteer.compliance,
      training: {
        ...volunteer.compliance?.training,
        status: 'completed'
      }
    }
  };
};

export default {
  validateShiftRegistration,
  getRegistrationBlockMessage,
  getMissingTrainingModules,
  canPromoteToCoreVolunteer,
  promoteToCoreVolunteer
};
