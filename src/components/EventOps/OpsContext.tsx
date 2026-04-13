import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import { AuditLog, IncidentReport, MissionOpsRun, Opportunity, Shift, Volunteer } from '../../types';
import { apiService } from '../../services/apiService';
import { toastService } from '../../services/toastService';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const LEAD_ROLES: string[] = [
  'Events Lead',
  'Events Coordinator',
  'Volunteer Lead',
  'Program Coordinator',
  'General Operations Coordinator',
  'Operations Coordinator',
  'Outreach & Engagement Lead',
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CheckinStatus {
  checkedIn: boolean;
  checkedOut?: boolean;
  checkedInAt?: string;
  buddyName?: string;
  buddyRole?: string;
  pairLabel?: string;
}

interface RsvpEntry {
  id: string;
  name: string;
  email: string;
  checkedIn: boolean;
  walkin: boolean;
  checkedInAt?: string;
}

interface TrackerData {
  clientLogs: unknown[];
  distributions: unknown[];
  participantsServed: number;
}

interface ItineraryData {
  itinerary?: string;
  setupDiagram?: string;
  customNotes?: string;
}

interface RsvpStats {
  total: number;
  checkedIn: number;
  walkins: number;
}

interface QueuedWrite {
  id: string;
  endpoint: string;
  payload: unknown;
  method: 'POST' | 'PUT';
  timestamp: number;
}

export interface OpsSessionState {
  opsRun: MissionOpsRun | null;
  incidents: IncidentReport[];
  auditLogs: AuditLog[];
  checkinStatus: CheckinStatus | null;
  checkoutResult: { hoursServed: number; pointsEarned: number } | null;
  rsvpStats: RsvpStats | null;
  rsvps: RsvpEntry[];
  tracker: TrackerData | null;
  itinerary: ItineraryData | null;
  loading: boolean;
  error: string | null;
  pendingWrites: number;
  isOnline: boolean;
}

export interface OpsContextValue {
  state: OpsSessionState;
  shift: Shift;
  opportunity: Opportunity;
  user: Volunteer;
  allVolunteers: Volunteer[];
  isLead: boolean;
  isTestMode: boolean;

  checkIn: () => Promise<void>;
  checkOut: () => Promise<void>;
  checkItem: (itemId: string) => Promise<void>;
  reportIncident: (incident: Partial<IncidentReport>) => Promise<void>;
  signOff: (signatureData: string) => Promise<void>;
  logAudit: (log: Pick<AuditLog, 'actionType' | 'targetSystem' | 'targetId' | 'summary'>) => void;
  queueWrite: (endpoint: string, payload: unknown, method?: 'POST' | 'PUT') => Promise<void>;

  manualCheckin: (volunteerId: string) => Promise<void>;
  walkInCheckin: (name: string, email?: string, phone?: string, noPhone?: boolean, altContact?: string, existingClientId?: string) => Promise<void>;
  refreshRoster: () => Promise<void>;
  logClientEncounter: (data: { type: string; ageRange?: string; genderIdentity?: string; notes?: string; eventId: string; timestamp: string }) => Promise<void>;
}

export interface OpsProviderProps {
  shift: Shift;
  opportunity: Opportunity;
  user: Volunteer;
  allVolunteers?: Volunteer[];
  isTestMode?: boolean;
  onSignoff?: () => void;
  onUpdateUser?: (u: Volunteer) => void;
  children: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const OpsContext = createContext<OpsContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Mock data for test mode
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_RSVP_STATS: RsvpStats = { total: 12, checkedIn: 4, walkins: 1 };

const MOCK_RSVPS: RsvpEntry[] = [
  { id: 'mock-1', name: 'Alex Rivera', email: 'alex@example.com', checkedIn: true, walkin: false, checkedInAt: new Date().toISOString() },
  { id: 'mock-2', name: 'Jordan Lee', email: 'jordan@example.com', checkedIn: false, walkin: false },
  { id: 'mock-3', name: 'Sam Chen', email: 'sam@example.com', checkedIn: true, walkin: true, checkedInAt: new Date().toISOString() },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getQueueKey(shiftId: string): string {
  return `hmc-ops-write-queue-${shiftId}`;
}

function loadQueue(shiftId: string): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(getQueueKey(shiftId));
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(shiftId: string, queue: QueuedWrite[]): void {
  try {
    localStorage.setItem(getQueueKey(shiftId), JSON.stringify(queue));
  } catch {
    // Storage quota exceeded — fail silently
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const OpsProvider: React.FC<OpsProviderProps> = ({
  shift,
  opportunity,
  user,
  allVolunteers = [],
  isTestMode = false,
  onSignoff,
  onUpdateUser,
  children,
}) => {
  const isLead = user.isAdmin || LEAD_ROLES.includes(user.role);

  const [state, setState] = useState<OpsSessionState>({
    opsRun: null,
    incidents: [],
    auditLogs: [],
    checkinStatus: null,
    checkoutResult: null,
    rsvpStats: isTestMode ? MOCK_RSVP_STATS : null,
    rsvps: isTestMode ? MOCK_RSVPS : [],
    tracker: null,
    itinerary: null,
    loading: !isTestMode,
    error: null,
    pendingWrites: 0,
    isOnline: navigator.onLine,
  });

  // Keep a ref to the write queue so callbacks stay stable
  const writeQueueRef = useRef<QueuedWrite[]>(loadQueue(shift.id));
  const isMounted = useRef(true);

  // ── Utility: flush pending writes count into state ──
  const syncPendingCount = useCallback(() => {
    setState(prev => ({ ...prev, pendingWrites: writeQueueRef.current.length }));
  }, []);

  // ── Core write-queue drain ──
  const drainQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const queue = [...writeQueueRef.current];
    if (queue.length === 0) return;

    const remaining: QueuedWrite[] = [];
    for (const item of queue) {
      try {
        if (item.method === 'PUT') {
          await apiService.put(item.endpoint, item.payload);
        } else {
          await apiService.post(item.endpoint, item.payload);
        }
      } catch {
        remaining.push(item);
      }
    }
    writeQueueRef.current = remaining;
    saveQueue(shift.id, remaining);
    if (isMounted.current) syncPendingCount();
  }, [shift.id, syncPendingCount]);

  // ── queueWrite: persist-first, then attempt immediate send ──
  const queueWrite = useCallback(
    async (endpoint: string, payload: unknown, method: 'POST' | 'PUT' = 'POST'): Promise<void> => {
      if (isTestMode) {
        console.info('[PRACTICE MODE] Queued write intercepted:', method, endpoint, payload);
        return;
      }

      const entry: QueuedWrite = { id: generateId(), endpoint, payload, method, timestamp: Date.now() };
      writeQueueRef.current = [...writeQueueRef.current, entry];
      saveQueue(shift.id, writeQueueRef.current);
      if (isMounted.current) syncPendingCount();

      if (!navigator.onLine) return;

      try {
        if (method === 'PUT') {
          await apiService.put(endpoint, payload);
        } else {
          await apiService.post(endpoint, payload);
        }
        // Remove from queue on success
        writeQueueRef.current = writeQueueRef.current.filter(q => q.id !== entry.id);
        saveQueue(shift.id, writeQueueRef.current);
        if (isMounted.current) syncPendingCount();
      } catch {
        // Already persisted; will drain on reconnect
      }
    },
    [isTestMode, shift.id, syncPendingCount],
  );

  // ── Online / offline listeners ──
  useEffect(() => {
    const handleOnline = () => {
      if (isMounted.current) setState(prev => ({ ...prev, isOnline: true }));
      drainQueue();
    };
    const handleOffline = () => {
      if (isMounted.current) setState(prev => ({ ...prev, isOnline: false }));
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [drainQueue]);

  // ── Initial data load ──
  useEffect(() => {
    isMounted.current = true;

    if (isTestMode) {
      // Drain any leftover queue from previous real session
      drainQueue();
      return;
    }

    const load = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        const [runData, checkinData] = await Promise.all([
          apiService.get(`/api/ops/run/${shift.id}/${user.id}`),
          apiService.get(`/api/ops/volunteer-checkin/${opportunity.id}/status`).catch(() => ({ checkedIn: false })),
        ]);

        const itineraryData = await apiService
          .get(`/api/ops/itinerary/${opportunity.id}`)
          .catch(() => null);

        const trackerData = await apiService
          .get(`/api/ops/tracker/${opportunity.id}`)
          .catch(() => null);

        let rsvpStats: RsvpStats | null = null;
        let rsvps: RsvpEntry[] = [];
        if (isLead) {
          [rsvpStats, rsvps] = await Promise.all([
            apiService.get(`/api/events/${opportunity.id}/rsvp-stats`).catch(() => null),
            apiService.get(`/api/events/${opportunity.id}/public-rsvps`).catch(() => []),
          ]);
        }

        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            opsRun: runData.opsRun ?? null,
            incidents: runData.incidents ?? [],
            auditLogs: runData.auditLogs ?? [],
            checkinStatus: checkinData,
            itinerary: itineraryData,
            tracker: trackerData,
            rsvpStats,
            rsvps: rsvps ?? [],
            loading: false,
          }));
        }

        // Attempt to drain any previously queued writes
        drainQueue();
      } catch (err) {
        if (isMounted.current) {
          const msg = err instanceof Error ? err.message : 'Failed to load ops session';
          setState(prev => ({ ...prev, loading: false, error: msg }));
        }
      }
    };

    load();

    return () => {
      isMounted.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift.id, opportunity.id, user.id]);

  // ── Roster polling for leads ──
  useEffect(() => {
    if (!isLead || isTestMode) return;

    const poll = async () => {
      if (!isMounted.current) return;
      try {
        const [stats, rsvps] = await Promise.all([
          apiService.get(`/api/events/${opportunity.id}/rsvp-stats`),
          apiService.get(`/api/events/${opportunity.id}/public-rsvps`),
        ]);
        if (isMounted.current) {
          setState(prev => ({ ...prev, rsvpStats: stats, rsvps: rsvps ?? [] }));
        }
      } catch {
        // Silent fail on poll
      }
    };

    const intervalId = setInterval(poll, 30_000);
    return () => clearInterval(intervalId);
  }, [isLead, isTestMode, opportunity.id]);

  // ── unmount guard ──
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  const checkIn = useCallback(async (): Promise<void> => {
    if (isTestMode) {
      setState(prev => ({
        ...prev,
        checkinStatus: {
          checkedIn: true,
          checkedInAt: new Date().toISOString(),
          buddyName: 'Practice Partner',
          buddyRole: 'Core Volunteer',
          pairLabel: 'Pair A',
        },
      }));
      return;
    }

    try {
      const result = await apiService.post(`/api/ops/volunteer-checkin/${opportunity.id}`, { shiftId: shift.id });
      const newStatus: CheckinStatus = {
        checkedIn: true,
        checkedInAt: new Date().toISOString(),
        buddyName: result?.buddyAssignment?.buddyName,
        buddyRole: result?.buddyAssignment?.buddyRole,
        pairLabel: result?.buddyAssignment?.pairLabel,
      };
      setState(prev => ({ ...prev, checkinStatus: newStatus }));
      toastService.success('Checked in successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Check-in failed';
      toastService.error(msg);
      throw err;
    }
  }, [isTestMode, opportunity.id, shift.id]);

  const checkOut = useCallback(async (): Promise<void> => {
    if (isTestMode) {
      const result = { hoursServed: 2, pointsEarned: 50 };
      setState(prev => ({
        ...prev,
        checkoutResult: result,
        checkinStatus: prev.checkinStatus ? { ...prev.checkinStatus, checkedOut: true } : prev.checkinStatus,
      }));
      return;
    }

    try {
      const result = await apiService.post(`/api/ops/volunteer-checkout/${opportunity.id}`, {});
      setState(prev => ({
        ...prev,
        checkoutResult: result,
        checkinStatus: prev.checkinStatus ? { ...prev.checkinStatus, checkedOut: true } : prev.checkinStatus,
      }));
      toastService.success(`Checked out! ${result.hoursServed}h • ${result.pointsEarned} pts`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Check-out failed';
      toastService.error(msg);
      throw err;
    }
  }, [isTestMode, opportunity.id]);

  const checkItem = useCallback(
    async (itemId: string): Promise<void> => {
      setState(prev => {
        if (!prev.opsRun) return prev;
        const alreadyDone = prev.opsRun.completedItems.includes(itemId);
        const completedItems = alreadyDone
          ? prev.opsRun.completedItems.filter(i => i !== itemId)
          : [...prev.opsRun.completedItems, itemId];
        const nextOpsRun = { ...prev.opsRun, completedItems };
        // Queue the write as a side effect after state settles
        void queueWrite('/api/ops/checklist', {
          runId: nextOpsRun.id,
          completedItems,
        });
        return { ...prev, opsRun: nextOpsRun };
      });
    },
    [queueWrite],
  );

  const reportIncident = useCallback(
    async (incident: Partial<IncidentReport>): Promise<void> => {
      const full: IncidentReport = {
        id: generateId(),
        shiftId: shift.id,
        volunteerId: user.id,
        timestamp: new Date().toISOString(),
        type: incident.type ?? 'Other',
        description: incident.description ?? '',
        actionsTaken: incident.actionsTaken ?? '',
        whoNotified: incident.whoNotified ?? '',
        status: 'reported',
        ...incident,
      };

      if (isTestMode) {
        setState(prev => ({ ...prev, incidents: [...prev.incidents, full] }));
        toastService.success('[PRACTICE MODE] Incident logged locally');
        return;
      }

      try {
        const saved = await apiService.post('/api/incidents/create', full);
        setState(prev => ({ ...prev, incidents: [...prev.incidents, saved ?? full] }));
        toastService.success('Incident reported');
      } catch (err) {
        // Optimistic add even on failure, queue for sync
        setState(prev => ({ ...prev, incidents: [...prev.incidents, full] }));
        void queueWrite('/api/incidents/create', full);
        const msg = err instanceof Error ? err.message : 'Failed to submit incident';
        toastService.error(`${msg} — saved locally`);
      }
    },
    [isTestMode, shift.id, user.id, queueWrite],
  );

  const signOff = useCallback(
    async (signatureData: string): Promise<void> => {
      const completedItems = state.opsRun?.completedItems ?? [];

      if (isTestMode) {
        toastService.success('Simulation complete — great work!');
        // Mark simulation as completed on the volunteer's training record
        onUpdateUser?.({
          ...user,
          completedTrainingIds: [
            ...new Set([...(user.completedTrainingIds ?? []), 'event-ops-simulation']),
          ],
        });
        // Simulate checkout result so WrapUp shows the celebration screen
        setState(prev => ({
          ...prev,
          checkoutResult: { hoursServed: 2, pointsEarned: 100 },
        }));
        onSignoff?.();
        return;
      }

      try {
        await apiService.post('/api/ops/signoff', { shiftId: shift.id, signatureData, completedItems });
        toastService.success('Signed off successfully');
        onSignoff?.();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sign-off failed';
        toastService.error(msg);
        throw err;
      }
    },
    [isTestMode, shift.id, state.opsRun, onSignoff, onUpdateUser, user],
  );

  const logAudit = useCallback(
    (log: Pick<AuditLog, 'actionType' | 'targetSystem' | 'targetId' | 'summary'>): void => {
      const full: AuditLog = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        actionType: log.actionType,
        summary: log.summary,
        actorUserId: user.id,
        actorRole: user.role,
        shiftId: shift.id,
        eventId: opportunity.id,
        targetSystem: log.targetSystem,
        targetId: log.targetId,
      };

      // Optimistic local add
      setState(prev => ({ ...prev, auditLogs: [full, ...prev.auditLogs] }));

      // Queue API write
      void queueWrite('/api/audit-logs/create', full);
    },
    [user.id, user.role, shift.id, opportunity.id, queueWrite],
  );

  const refreshRoster = useCallback(async (): Promise<void> => {
    if (isTestMode) return;
    try {
      const [stats, rsvps] = await Promise.all([
        apiService.get(`/api/events/${opportunity.id}/rsvp-stats`),
        apiService.get(`/api/events/${opportunity.id}/public-rsvps`),
      ]);
      if (isMounted.current) {
        setState(prev => ({ ...prev, rsvpStats: stats, rsvps: rsvps ?? [] }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh roster';
      toastService.error(msg);
      throw err;
    }
  }, [isTestMode, opportunity.id]);

  const manualCheckin = useCallback(
    async (volunteerId: string): Promise<void> => {
      if (!isLead) return;
      if (isTestMode) {
        setState(prev => ({
          ...prev,
          rsvps: prev.rsvps.map(r =>
            r.id === volunteerId ? { ...r, checkedIn: true, checkedInAt: new Date().toISOString() } : r
          ),
          rsvpStats: prev.rsvpStats
            ? { ...prev.rsvpStats, checkedIn: (prev.rsvpStats.checkedIn ?? 0) + 1 }
            : prev.rsvpStats,
        }));
        toastService.success('[Practice] Volunteer checked in');
        return;
      }
      try {
        await apiService.post(`/api/events/${opportunity.id}/manual-checkin`, { volunteerId });
        toastService.success('Volunteer checked in');
        await refreshRoster();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Manual check-in failed';
        toastService.error(msg);
        throw err;
      }
    },
    [isLead, isTestMode, opportunity.id, refreshRoster],
  );

  const walkInCheckin = useCallback(
    async (name: string, email?: string, phone?: string, noPhone?: boolean, altContact?: string, existingClientId?: string): Promise<void> => {
      if (!isLead) return;
      if (isTestMode) {
        const mockId = `walkin-${Date.now()}`;
        setState(prev => ({
          ...prev,
          rsvps: [...prev.rsvps, {
            id: mockId, name, email: email ?? '', phone, noPhone, altContact,
            checkedIn: true, checkedInAt: new Date().toISOString(), walkin: true,
          } as any],
          rsvpStats: prev.rsvpStats
            ? {
                ...prev.rsvpStats,
                walkins: (prev.rsvpStats.walkins ?? 0) + 1,
                checkedIn: (prev.rsvpStats.checkedIn ?? 0) + 1,
                total: (prev.rsvpStats.total ?? 0) + 1,
              }
            : prev.rsvpStats,
        }));
        toastService.success(`[Practice] Walk-in registered: ${name}`);
        return;
      }
      try {
        await apiService.post(`/api/events/${opportunity.id}/walkin-checkin`, { name, email, phone, noPhone, altContact, existingClientId });
        toastService.success(`Walk-in checked in: ${name}`);
        await refreshRoster();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Walk-in check-in failed';
        toastService.error(msg);
        throw err;
      }
    },
    [isLead, isTestMode, opportunity.id, refreshRoster],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Context value
  // ─────────────────────────────────────────────────────────────────────────

  const value: OpsContextValue = {
    state,
    shift,
    opportunity,
    user,
    allVolunteers,
    isLead,
    isTestMode,
    checkIn,
    checkOut,
    checkItem,
    reportIncident,
    signOff,
    logAudit,
    queueWrite,
    manualCheckin,
    walkInCheckin,
    refreshRoster,
    logClientEncounter: async (data) => {
      if (isTestMode) { console.log('[TEST] logClientEncounter', data); return; }
      await queueWrite(`/api/client-encounters`, data);
    },
  };

  return (
    <OpsContext.Provider value={value}>
      {isTestMode && (
        <div
          role="alert"
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-sm font-black uppercase tracking-wider text-amber-900"
          style={{ minHeight: 44 }}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span>PRACTICE MODE — No data will be saved</span>
          <AlertTriangle size={14} className="shrink-0" />
        </div>
      )}
      {children}
    </OpsContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useOps(): OpsContextValue {
  const ctx = useContext(OpsContext);
  if (!ctx) {
    throw new Error('useOps must be used within an OpsProvider');
  }
  return ctx;
}
