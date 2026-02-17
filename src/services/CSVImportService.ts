/**
 * CSV Bulk Import Service for HMC Volunteer Portal v4.0
 * Handles importing up to 800+ volunteers with availability and role assignment
 * 
 * CRITICAL v4.0 FEATURES:
 * - Validates Core Volunteer status requirements
 * - Enforces HIPAA training as mandatory
 * - Captures availability data for all volunteers
 * - Validates event deployment eligibility gates
 */

import { Volunteer, CSVImportRow } from '../types';
import { APP_CONFIG } from '../config';
import Papa from 'papaparse';

export interface CSVImportResult {
  success: boolean;
  totalRows: number;
  successfulImports: number;
  failedRows: Array<{
    rowNumber: number;
    email: string;
    error: string;
  }>;
  volunteers: Volunteer[];
  warnings: string[];
}

export class CSVImportService {
  /**
   * Parse CSV file and validate data
   */
  static async parseCSV(file: File): Promise<CSVImportRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        transform: (value) => value?.trim(),
        complete: (results) => {
          resolve(results.data as CSVImportRow[]);
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        },
      });
    });
  }

  /**
   * Validate single CSV row
   */
  static validateRow(row: CSVImportRow, rowNumber: number): { valid: boolean; error?: string } {
    // Required fields
    if (!row.legalFirstName?.trim()) return { valid: false, error: 'First name required' };
    if (!row.legalLastName?.trim()) return { valid: false, error: 'Last name required' };
    if (!row.email?.trim() || !row.email.includes('@')) return { valid: false, error: 'Valid email required' };
    if (!row.phone?.trim()) return { valid: false, error: 'Phone number required' };
    
    // Availability fields (CRITICAL v4.0)
    if (!row.availability_days) return { valid: false, error: 'Availability days required (e.g., "Mon,Tue,Wed")' };
    if (!row.availability_preferredTime) return { valid: false, error: 'Preferred time required (Morning/Afternoon/Evening)' };
    if (!row.availability_startDate) return { valid: false, error: 'Start date required (YYYY-MM-DD)' };
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(row.availability_startDate)) {
      return { valid: false, error: 'Start date must be YYYY-MM-DD format' };
    }
    
    // Validate role
    const validRoles = APP_CONFIG.HMC_ROLES.map(r => r.label);
    if (!row.volunteerRole || !validRoles.includes(row.volunteerRole)) {
      return { valid: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` };
    }
    
    // Validate availability days
    const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const days = row.availability_days.split(',').map(d => d.trim());
    const invalidDays = days.filter(d => !validDays.includes(d));
    if (invalidDays.length > 0) {
      return { valid: false, error: `Invalid days: ${invalidDays.join(', ')}` };
    }
    
    return { valid: true };
  }

  /**
   * Convert CSV row to Volunteer object
   */
  static rowToVolunteer(row: CSVImportRow, index: number): Volunteer {
    const roleConfig = APP_CONFIG.HMC_ROLES.find(r => r.label === row.volunteerRole);
    const preferredTime = row.availability_preferredTime || 'Morning';
    
    // Determine if this is a Core Volunteer role
    const isCoreVolunteer = row.volunteerRole === 'Core Volunteer';
    
    // Initialize event eligibility gates
    const eventEligibility = {
      canDeployCore: false, // Requires Core Volunteer status + HIPAA
      streetMedicineGate: false,
      clinicGate: false,
      healthFairGate: false,
      naloxoneDistribution: false,
      oraQuickDistribution: false,
      qualifiedEventTypes: [] as string[],
    };

    const volunteer: Volunteer = {
      id: `volunteer-${Date.now()}-${index}`,
      tenantId: 'hmc-health',
      
      // Personal Information
      legalFirstName: row.legalFirstName.trim(),
      legalLastName: row.legalLastName.trim(),
      name: `${row.legalFirstName.trim()} ${row.legalLastName.trim()}`,
      email: row.email.trim().toLowerCase(),
      phone: row.phone.trim(),
      
      // Address
      address: row.address || '',
      city: row.city || '',
      state: row.state || 'CA',
      zipCode: row.zipCode || '',
      mailingAddressSame: true,
      
      // Demographics
      dob: row.dob || '',
      gender: row.gender || 'Prefer not to say',
      tshirtSize: row.tshirtSize || 'M',
      
      // Affiliation
      hmcAffiliation: [],
      isEmployed: false,
      isStudent: false,
      gainFromExperience: 'Community service',
      howDidYouHear: row.howDidYouHear || 'CSV Import',
      
      // ============================================================
      // HMC v4.0 IDENTITY SYSTEM
      // ============================================================
      identityLabel: 'HMC Champion',
      volunteerRole: (row.volunteerRole as any) || 'Core Volunteer',
      role: row.volunteerRole || 'Core Volunteer', // Legacy field
      
      // Core Volunteer Status
      coreVolunteerStatus: isCoreVolunteer ? true : false,
      coreVolunteerApprovedDate: isCoreVolunteer ? new Date().toISOString() : undefined,
      
      // HIPAA Training - CRITICAL v4.0
      // Mandatory for all volunteers after approval
      completedHIPAATraining: false,
      
      // Status
      status: 'onboarding',
      joinedDate: new Date().toISOString(),
      onboardingProgress: 0,
      isAdmin: false,
      points: 0,
      hoursContributed: 0,
      isNewUser: true,
      
      // Compliance - CSV imported volunteers must complete full onboarding
      compliance: {
        application: { id: 'app-1', label: 'Application', status: 'pending' },
        backgroundCheck: { id: 'bg-1', label: 'Background Check', status: 'pending' },
        hipaaTraining: { id: 'hipaa-1', label: 'HIPAA Training', status: 'pending' },
        training: { id: 'train-1', label: 'Training', status: 'pending' },
        orientation: { id: 'orient-1', label: 'Orientation', status: 'pending' },
      },
      
      // ============================================================
      // AVAILABILITY SYSTEM - REQUIRED for CSV import
      // ============================================================
      availability: {
        days: row.availability_days.split(',').map(d => d.trim()),
        preferredTime: preferredTime,
        startDate: row.availability_startDate,
        timezone: 'America/Los_Angeles',
        hoursPerWeek: row.availability_hoursPerWeek || '4-8',
        unavailableDates: [],
      },
      
      // ============================================================
      // EVENT DEPLOYMENT ELIGIBILITY GATES
      // ============================================================
      eventEligibility: eventEligibility,
      
      // Emergency Contact (placeholder for CSV import)
      emergencyContact: {
        name: 'Not provided',
        relationship: 'Not provided',
        email: '',
        cellPhone: '',
      },
      
      // Skills & Tasks
      skills: [],
      tasks: [],
      achievements: [],
      completedTrainingIds: [],
      assignedShiftIds: [],
      rsvpedEventIds: [],
      
      // Notifications
      notificationPrefs: {
        emailAlerts: true,
        smsAlerts: false,
        opportunityUpdates: true,
        trainingReminders: true,
        eventInvitations: true,
      },
      
      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      applicationStatus: 'pending',
    };

    return volunteer;
  }

  /**
   * Import CSV file and create volunteers
   * Validates all rows and returns detailed results
   */
  static async importCSV(file: File): Promise<CSVImportResult> {
    try {
      // Parse CSV
      const rows = await this.parseCSV(file);
      
      if (rows.length === 0) {
        return {
          success: false,
          totalRows: 0,
          successfulImports: 0,
          failedRows: [],
          volunteers: [],
          warnings: ['CSV file contains no data rows'],
        };
      }

      // Check max size
      if (rows.length > APP_CONFIG.BUSINESS_RULES.CSV_IMPORT.MAX_VOLUNTEERS_PER_IMPORT) {
        return {
          success: false,
          totalRows: rows.length,
          successfulImports: 0,
          failedRows: rows.map((r, i) => ({
            rowNumber: i + 2,
            email: r.email || 'unknown',
            error: `Batch size exceeded (max: ${APP_CONFIG.BUSINESS_RULES.CSV_IMPORT.MAX_VOLUNTEERS_PER_IMPORT}). Please split into smaller batches.`,
          })),
          volunteers: [],
          warnings: [`CSV contains ${rows.length} volunteers, but max is ${APP_CONFIG.BUSINESS_RULES.CSV_IMPORT.MAX_VOLUNTEERS_PER_IMPORT}`],
        };
      }

      // Validate and convert rows
      const failedRows: CSVImportResult['failedRows'] = [];
      const volunteers: Volunteer[] = [];
      const warnings: string[] = [];

      rows.forEach((row, index) => {
        const validation = this.validateRow(row, index + 2);
        
        if (!validation.valid) {
          failedRows.push({
            rowNumber: index + 2,
            email: row.email || 'unknown',
            error: validation.error || 'Unknown error',
          });
        } else {
          const volunteer = this.rowToVolunteer(row, index);
          volunteers.push(volunteer);
        }
      });

      // Generate warnings
      const coreVolunteerCount = volunteers.filter(v => v.volunteerRole === 'Core Volunteer').length;
      if (coreVolunteerCount > 0) {
        warnings.push(`${coreVolunteerCount} Core Volunteers will require HIPAA training before event deployment`);
      }

      const medicalRoles = volunteers.filter(v => v.volunteerRole.includes('Medical') || v.volunteerRole === 'Licensed Medical Professional');
      if (medicalRoles.length > 0) {
        warnings.push(`${medicalRoles.length} medical staff will require LiveScan fingerprinting`);
      }

      return {
        success: failedRows.length === 0,
        totalRows: rows.length,
        successfulImports: volunteers.length,
        failedRows,
        volunteers,
        warnings,
      };

    } catch (error) {
      return {
        success: false,
        totalRows: 0,
        successfulImports: 0,
        failedRows: [],
        volunteers: [],
        warnings: [`Import failed: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Generate CSV template for bulk import
   */
  static generateTemplate(): string {
    const headers = [
      'legalFirstName',
      'legalLastName',
      'email',
      'phone',
      'volunteerRole',
      'availability_days',
      'availability_preferredTime',
      'availability_startDate',
      'availability_hoursPerWeek',
      'dob',
      'gender',
      'address',
      'city',
      'state',
      'zipCode',
      'tshirtSize',
      'howDidYouHear',
    ];

    const example = [
      'John',
      'Doe',
      'john@example.com',
      '(555) 123-4567',
      'Core Volunteer',
      'Mon,Wed,Fri',
      'Morning',
      '2026-02-01',
      '8',
      '1990-01-15',
      'Male',
      '123 Main St',
      'Los Angeles',
      'CA',
      '90001',
      'L',
      'Friend Referral',
    ];

    return [headers.join(','), example.join(',')].join('\n');
  }
}

// Export for use in React components
export default CSVImportService;
