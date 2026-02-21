import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { FormField, SurveyKit, VolunteerSurveyResponse } from '../types';

// Collection names
const COLLECTIONS = {
  FORMS: 'forms',
  SURVEY_RESPONSES: 'surveyResponses',
  SURVEY_KITS: 'surveyKits',
  CLIENT_SURVEYS: 'clientSurveys'
};

// Helper to check if Firestore is available
const isFirestoreAvailable = (): boolean => {
  if (!db) {
    console.warn('Firestore not available - survey features disabled');
    return false;
  }
  return true;
};

// Helper to sort by submittedAt descending in memory
const sortBySubmittedAtDesc = (a: any, b: any) => {
  const aTime = a.submittedAt?.toDate?.()?.getTime() || a.submittedAt || 0;
  const bTime = b.submittedAt?.toDate?.()?.getTime() || b.submittedAt || 0;
  return bTime - aTime;
};

// ============ FORM DEFINITIONS ============

export interface FormDefinition {
  id?: string;
  title: string;
  description: string;
  fields: FormField[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  isActive: boolean;
  category: 'intake' | 'feedback' | 'screening' | 'referral' | 'custom' | 'internal';
}

/**
 * Create a new form definition
 */
export const createForm = async (form: Omit<FormDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  if (!isFirestoreAvailable()) return '';
  const docRef = await addDoc(collection(db!, COLLECTIONS.FORMS), {
    ...form,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

/**
 * Update an existing form definition
 */
export const updateForm = async (formId: string, updates: Partial<FormDefinition>): Promise<void> => {
  if (!isFirestoreAvailable()) return;
  const formRef = doc(db!, COLLECTIONS.FORMS, formId);
  await updateDoc(formRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

/**
 * Delete a form definition
 */
export const deleteForm = async (formId: string): Promise<void> => {
  if (!isFirestoreAvailable()) return;
  await deleteDoc(doc(db!, COLLECTIONS.FORMS, formId));
};

/**
 * Get all form definitions
 */
export const getForms = async (category?: FormDefinition['category']): Promise<FormDefinition[]> => {
  if (!isFirestoreAvailable()) return [];
  let q;

  if (category) {
    q = query(collection(db!, COLLECTIONS.FORMS), where('category', '==', category));
  } else {
    q = query(collection(db!, COLLECTIONS.FORMS));
  }

  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as FormDefinition));
  results.sort((a: any, b: any) => {
    const aTime = a.createdAt?.toDate?.()?.getTime() || a.createdAt || 0;
    const bTime = b.createdAt?.toDate?.()?.getTime() || b.createdAt || 0;
    return bTime - aTime;
  });
  return results;
};

/**
 * Get a single form by ID
 */
export const getFormById = async (formId: string): Promise<FormDefinition | null> => {
  if (!isFirestoreAvailable()) return null;
  const docRef = doc(db!, COLLECTIONS.FORMS, formId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as FormDefinition;
  }
  return null;
};

// ============ SURVEY RESPONSES ============

export interface SurveyResponse {
  id?: string;
  formId: string;
  formTitle: string;
  eventId?: string;
  eventTitle?: string;
  respondentId?: string; // Client or volunteer ID if known
  respondentType: 'client' | 'volunteer' | 'anonymous';
  responses: { [fieldId: string]: string | string[] | number };
  submittedAt?: string;
  submittedBy?: string; // Volunteer who collected the survey
  location?: { lat: number; lng: number };
  metadata?: { [key: string]: any };
}

/**
 * Submit a survey response
 */
export const submitSurveyResponse = async (response: Omit<SurveyResponse, 'id' | 'submittedAt'>): Promise<string> => {
  if (!isFirestoreAvailable()) return '';
  const docRef = await addDoc(collection(db!, COLLECTIONS.SURVEY_RESPONSES), {
    ...response,
    submittedAt: serverTimestamp()
  });
  return docRef.id;
};

/**
 * Get survey responses for a specific form
 */
export const getSurveyResponsesByForm = async (formId: string, limitCount = 100): Promise<SurveyResponse[]> => {
  if (!isFirestoreAvailable()) return [];
  const q = query(
    collection(db!, COLLECTIONS.SURVEY_RESPONSES),
    where('formId', '==', formId)
  );

  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SurveyResponse));
  results.sort(sortBySubmittedAtDesc);
  return results.slice(0, limitCount);
};

/**
 * Get survey responses for a specific event
 */
export const getSurveyResponsesByEvent = async (eventId: string): Promise<SurveyResponse[]> => {
  if (!isFirestoreAvailable()) return [];
  const q = query(
    collection(db!, COLLECTIONS.SURVEY_RESPONSES),
    where('eventId', '==', eventId)
  );

  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SurveyResponse));
  results.sort(sortBySubmittedAtDesc);
  return results;
};

/**
 * Get all survey responses within a date range
 */
export const getSurveyResponsesByDateRange = async (startDate: Date, endDate: Date): Promise<SurveyResponse[]> => {
  // Fetch all responses, filter by date range in memory to avoid composite index
  const snapshot = await getDocs(collection(db!, COLLECTIONS.SURVEY_RESPONSES));
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const results = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as SurveyResponse))
    .filter(r => {
      const ts = (r as any).submittedAt?.toDate?.()?.getTime() || 0;
      return ts >= startMs && ts <= endMs;
    });
  results.sort(sortBySubmittedAtDesc);
  return results;
};

// ============ VOLUNTEER FEEDBACK SURVEYS ============

/**
 * Submit volunteer feedback survey (post-event)
 */
export const submitVolunteerFeedback = async (feedback: Omit<VolunteerSurveyResponse, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db!, COLLECTIONS.SURVEY_RESPONSES), {
    ...feedback,
    respondentType: 'volunteer',
    formId: 'volunteer-feedback',
    formTitle: 'Volunteer Post-Event Feedback',
    submittedAt: serverTimestamp()
  });
  return docRef.id;
};

/**
 * Get volunteer feedback responses
 */
export const getVolunteerFeedback = async (eventId?: string): Promise<VolunteerSurveyResponse[]> => {
  let q;

  if (eventId) {
    // Single where clause — filter formId in memory to avoid composite index
    q = query(
      collection(db!, COLLECTIONS.SURVEY_RESPONSES),
      where('eventId', '==', eventId)
    );
  } else {
    q = query(
      collection(db!, COLLECTIONS.SURVEY_RESPONSES),
      where('formId', '==', 'volunteer-feedback')
    );
  }

  const snapshot = await getDocs(q);
  const results = snapshot.docs
    .map(doc => doc.data())
    .filter(data => data.formId === 'volunteer-feedback')
    .sort(sortBySubmittedAtDesc)
    .slice(0, 100);

  return results.map(data => ({
    id: data.id,
    volunteerId: data.respondentId || data.volunteerId,
    volunteerRole: data.volunteerRole || 'Unknown',
    eventId: data.eventId,
    rating: data.responses?.rating || data.rating || 0,
    feedback: data.responses?.feedback || data.feedback || '',
    submittedAt: data.submittedAt?.toDate?.()?.toISOString() || data.submittedAt
  } as VolunteerSurveyResponse));
};

// ============ CLIENT SURVEYS (SDOH, Intake, etc.) ============

export interface ClientSurveySubmission {
  id?: string;
  surveyKitId: string;
  surveyKitName: string;
  clientId?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientPhone?: string;
  eventId: string;
  eventTitle: string;
  collectedBy: string; // Volunteer ID
  collectedByName: string;
  responses: { [fieldId: string]: string | string[] | number };
  consentGiven: boolean;
  submittedAt?: string;
  location?: { lat: number; lng: number };
}

/**
 * Submit a client survey (collected at events)
 */
export const submitClientSurvey = async (survey: Omit<ClientSurveySubmission, 'id' | 'submittedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db!, COLLECTIONS.CLIENT_SURVEYS), {
    ...survey,
    submittedAt: serverTimestamp()
  });
  return docRef.id;
};

/**
 * Get client surveys for an event
 */
export const getClientSurveysByEvent = async (eventId: string): Promise<ClientSurveySubmission[]> => {
  if (!isFirestoreAvailable()) return [];
  const q = query(
    collection(db!, COLLECTIONS.CLIENT_SURVEYS),
    where('eventId', '==', eventId)
  );

  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as ClientSurveySubmission));
  results.sort(sortBySubmittedAtDesc);
  return results;
};

/**
 * Get client surveys by survey kit type
 */
export const getClientSurveysBySurveyKit = async (surveyKitId: string, limitCount = 100): Promise<ClientSurveySubmission[]> => {
  const q = query(
    collection(db!, COLLECTIONS.CLIENT_SURVEYS),
    where('surveyKitId', '==', surveyKitId)
  );

  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as ClientSurveySubmission));
  results.sort(sortBySubmittedAtDesc);
  return results.slice(0, limitCount);
};

// ============ ANALYTICS HELPERS ============

/**
 * Get survey response count by form
 */
export const getSurveyResponseCounts = async (): Promise<{ [formId: string]: number }> => {
  const snapshot = await getDocs(collection(db!, COLLECTIONS.SURVEY_RESPONSES));
  const counts: { [formId: string]: number } = {};

  snapshot.docs.forEach(doc => {
    const formId = doc.data().formId;
    counts[formId] = (counts[formId] || 0) + 1;
  });

  return counts;
};

/**
 * Get average rating from volunteer feedback
 */
export const getAverageVolunteerRating = async (eventId?: string): Promise<number> => {
  const feedback = await getVolunteerFeedback(eventId);
  if (feedback.length === 0) return 0;

  const total = feedback.reduce((sum, f) => sum + f.rating, 0);
  return total / feedback.length;
};

/**
 * Get survey statistics for analytics dashboard
 */
export const getSurveyStats = async (startDate?: Date, endDate?: Date): Promise<{
  totalResponses: number;
  responsesByForm: { [formId: string]: number };
  averageRating: number;
  responsesOverTime: { date: string; count: number }[];
}> => {
  let snapshot;

  if (startDate && endDate) {
    // Fetch all, filter in memory to avoid composite index
    const allSnapshot = await getDocs(collection(db!, COLLECTIONS.SURVEY_RESPONSES));
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const filtered = allSnapshot.docs.filter(doc => {
      const ts = doc.data().submittedAt?.toDate?.()?.getTime() || 0;
      return ts >= startMs && ts <= endMs;
    });
    snapshot = { docs: filtered };
  } else {
    snapshot = await getDocs(collection(db!, COLLECTIONS.SURVEY_RESPONSES));
  }

  const responses = snapshot.docs.map(doc => doc.data());

  // Calculate stats
  const responsesByForm: { [formId: string]: number } = {};
  const responsesOverTime: { [date: string]: number } = {};
  let ratingSum = 0;
  let ratingCount = 0;

  responses.forEach(r => {
    // By form
    responsesByForm[r.formId] = (responsesByForm[r.formId] || 0) + 1;

    // Over time
    const date = r.submittedAt?.toDate?.()?.toISOString()?.split('T')[0] || 'unknown';
    responsesOverTime[date] = (responsesOverTime[date] || 0) + 1;

    // Rating
    const rating = r.responses?.rating || r.rating;
    if (typeof rating === 'number') {
      ratingSum += rating;
      ratingCount++;
    }
  });

  return {
    totalResponses: responses.length,
    responsesByForm,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
    responsesOverTime: Object.entries(responsesOverTime).map(([date, count]) => ({ date, count }))
  };
};

export default {
  // Forms
  createForm,
  updateForm,
  deleteForm,
  getForms,
  getFormById,

  // Survey Responses
  submitSurveyResponse,
  getSurveyResponsesByForm,
  getSurveyResponsesByEvent,
  getSurveyResponsesByDateRange,

  // Volunteer Feedback
  submitVolunteerFeedback,
  getVolunteerFeedback,

  // Client Surveys
  submitClientSurvey,
  getClientSurveysByEvent,
  getClientSurveysBySurveyKit,

  // Analytics
  getSurveyResponseCounts,
  getAverageVolunteerRating,
  getSurveyStats
};
