/**
 * HMC Volunteer Portal v4.1 - Shift Registration Validation
 *
 * 4-Layer Access Model:
 * Status → Role → Training → Permissions
 *
 * ENFORCEMENT:
 * - isOperationalEligible gate (approvedOperationalRole + Tier 2 complete)
 * - Program-specific training clearance (Tier 3 per-program)
 * - Background check verification
 * - Availability validation
 */

import { Volunteer, Shift, Opportunity } from '../types';
import {
  TIER_1_IDS, TIER_2_IDS,
  PROGRAM_TRAINING_REQUIREMENTS,
  hasCompletedAllModules
} from '../constants';

export interface RegistrationValidationResult {
  canRegister: boolean;
  blockingIssues: string[];
  warnings: string[];
  gatesStatus: {
    isOperationalEligible: boolean;
    tier1Complete: boolean;
    tier2Complete: boolean;
    programClearance: boolean;
    backgroundCheckComplete: boolean;
  };
}

/**
 * Map opportunity categories to program training requirements
 */
const getCategoryProgram = (category: string): string | null => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('street medicine') || cat.includes('smo')) return 'street_medicine';
  if (cat.includes('clinic') || cat.includes('clinical')) return 'clinical';
  if (cat.includes('wellness') || cat.includes('unstoppable') || cat.includes('workshop')) return 'community_wellness';
  if (cat.includes('outreach') || cat.includes('health fair') || cat.includes('pop-up') || cat.includes('tabling')) return 'community_health_outreach';
  return null; // General events — Tier 2 is sufficient
};

/**
 * CRITICAL VALIDATION: Check if volunteer meets all requirements for shift registration
 *
 * Requirements (v4.1):
 * 1. Must be operationally eligible (approved role + Tier 2 training)
 * 2. Must have program-specific Tier 3 clearance for specialized events
 * 3. Background check should be verified (warning if pending)
 */
export const validateShiftRegistration = (
  volunteer: Volunteer,
  shift: Shift,
  opportunity: Opportunity
): RegistrationValidationResult => {

  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const completedIds = volunteer.completedTrainingIds || [];

  const tier1Complete = hasCompletedAllModules(completedIds, TIER_1_IDS);
  const tier2Complete = hasCompletedAllModules(completedIds, TIER_2_IDS);
  const hasApprovedRole = volunteer.coreVolunteerStatus === true;
  const isOperationalEligible = hasApprovedRole && tier2Complete;

  const gatesStatus = {
    isOperationalEligible,
    tier1Complete,
    tier2Complete,
    programClearance: false,
    backgroundCheckComplete: false,
  };

  // ============================================================
  // GATE 1: OPERATIONAL ELIGIBILITY (Tier 1 + Tier 2 + approved role)
  // ============================================================
  if (!tier1Complete) {
    blockingIssues.push(
      'Orientation Required: Complete the two orientation videos in Training Academy before registering for shifts.'
    );
  }

  if (!tier2Complete) {
    blockingIssues.push(
      'Baseline Training Required: Complete all Tier 2 training modules (HIPAA, CMHW, Survey, Portal How-To) before registering for shifts.'
    );
  }

  if (!hasApprovedRole) {
    blockingIssues.push(
      'Role Approval Required: Your operational role must be approved by an admin before you can register for shifts. ' +
      'Complete your training and your application will be reviewed.'
    );
  }

  // ============================================================
  // GATE 2: PROGRAM-SPECIFIC TRAINING CLEARANCE (Tier 3)
  // ============================================================
  const program = getCategoryProgram(opportunity.category);

  if (program) {
    const requiredModuleIds = PROGRAM_TRAINING_REQUIREMENTS[program] || [];
    const hasProgramClearance = hasCompletedAllModules(completedIds, requiredModuleIds);

    if (!hasProgramClearance) {
      const programLabels: Record<string, string> = {
        street_medicine: 'Street Medicine',
        clinical: 'Clinical Services',
        community_wellness: 'Community Wellness',
        community_health_outreach: 'Community Health Outreach',
      };
      const missingModules = requiredModuleIds.filter(id => !completedIds.includes(id));
      blockingIssues.push(
        `${programLabels[program]} Training Required: This event requires program-specific training. ` +
        `Complete ${missingModules.length} remaining module(s) in Training Academy.`
      );
    } else {
      gatesStatus.programClearance = true;
    }
  } else {
    // General events — no program-specific clearance needed
    gatesStatus.programClearance = true;
  }

  // ============================================================
  // GATE 3: BACKGROUND CHECK VERIFICATION
  // ============================================================
  const bgCheckStatus = volunteer.compliance?.backgroundCheck?.status;
  if (bgCheckStatus !== 'verified' && bgCheckStatus !== 'completed') {
    warnings.push(
      'Background Check Pending: Your background check is still being processed. ' +
      'You may continue preparing, but cannot be assigned to shifts until verified.'
    );
  } else {
    gatesStatus.backgroundCheckComplete = true;
  }

  // ============================================================
  // AVAILABILITY CHECK
  // ============================================================
  const shiftDate = new Date(opportunity.date);
  const shiftDayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][shiftDate.getDay()];

  const volunteerAvailableDays = volunteer.availability?.days || [];
  if (volunteerAvailableDays.length > 0 && !volunteerAvailableDays.includes(shiftDayOfWeek)) {
    warnings.push(
      `Availability Conflict: This shift is on ${shiftDayOfWeek}, but your availability is set for: ${volunteerAvailableDays.join(', ')}. ` +
      `Update your availability in My Profile if your schedule has changed.`
    );
  }

  const unavailableDates = volunteer.availability?.unavailableDates || [];
  if (unavailableDates.includes(opportunity.date)) {
    blockingIssues.push(
      `Time Off Conflict: You've marked ${opportunity.date} as unavailable. ` +
      `Remove this date from your "Time Off" list in My Profile if you want to register.`
    );
  }

  // ============================================================
  // FINAL RESULT
  // ============================================================
  const canRegister = blockingIssues.length === 0 && isOperationalEligible;

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
    return 'You are eligible to register for this shift!';
  }

  const messages = [
    result.blockingIssues.length > 0
      ? `${result.blockingIssues.length} requirement(s) blocking registration:\n${result.blockingIssues.join('\n\n')}`
      : 'Unable to register for this shift.',

    result.warnings.length > 0
      ? `\n\nWarnings:\n${result.warnings.join('\n')}`
      : ''
  ];

  return messages.filter(Boolean).join('');
};

/**
 * Helper: Check if volunteer is operationally eligible
 */
export const isVolunteerOperational = (volunteer: Volunteer): boolean => {
  const completedIds = volunteer.completedTrainingIds || [];
  const tier2Complete = hasCompletedAllModules(completedIds, TIER_2_IDS);
  return volunteer.coreVolunteerStatus === true && tier2Complete;
};

/**
 * Helper: Check if volunteer has clearance for a specific program
 */
export const hasProgramClearance = (volunteer: Volunteer, program: string): boolean => {
  const completedIds = volunteer.completedTrainingIds || [];
  const requiredModuleIds = PROGRAM_TRAINING_REQUIREMENTS[program] || [];
  if (requiredModuleIds.length === 0) return true;
  return hasCompletedAllModules(completedIds, requiredModuleIds);
};

export default {
  validateShiftRegistration,
  getRegistrationBlockMessage,
  isVolunteerOperational,
  hasProgramClearance,
};
