import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { IncidentReport, Opportunity, Shift, Volunteer } from '../../types';
import { OpsProvider, useOps } from './OpsContext';
import LeadCommandCenter from './LeadView/CommandCenter';
import VolunteerMyDay from './VolunteerView/MyDay';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface EventOpsProps {
  shift: Shift;
  opportunity: Opportunity;
  user: Volunteer;
  onBack: () => void;
  onUpdateUser: (u: Volunteer) => void;
  onNavigateToAcademy?: () => void;
  allVolunteers?: Volunteer[];
  eventShifts?: Shift[];
  setOpportunities?: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  onEditEvent?: (opp: Opportunity) => void;
  canEdit?: boolean;
  isTestMode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Incident modal form types
// ─────────────────────────────────────────────────────────────────────────────

type IncidentType = IncidentReport['type'];

interface IncidentFormState {
  type: IncidentType;
  description: string;
  actionsTaken: string;
  whoNotified: string;
}

const INCIDENT_TYPES: IncidentType[] = [
  'EMS activation',
  'Exposure incident',
  'Safety/security issue',
  'Other',
];

const INITIAL_FORM: IncidentFormState = {
  type: 'Other',
  description: '',
  actionsTaken: '',
  whoNotified: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// Incident Modal
// ─────────────────────────────────────────────────────────────────────────────

const IncidentModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { reportIncident } = useOps();
  const [form, setForm] = useState<IncidentFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSubmitting(true);
    try {
      await reportIncident(form);
      onClose();
    } catch {
      // toastService.error already called inside reportIncident
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" aria-hidden="true" />
            <h2
              id="incident-modal-title"
              className="font-black uppercase italic tracking-tighter text-zinc-900"
            >
              Report Incident
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close incident report"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Type */}
          <div className="space-y-1">
            <label
              htmlFor="incident-type"
              className="block text-xs font-black uppercase tracking-wider text-zinc-500"
            >
              Incident Type
            </label>
            <select
              id="incident-type"
              name="type"
              value={form.type}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 focus:border-[#233DFF] focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20"
              style={{ minHeight: 44 }}
            >
              {INCIDENT_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label
              htmlFor="incident-description"
              className="block text-xs font-black uppercase tracking-wider text-zinc-500"
            >
              Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="incident-description"
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={3}
              placeholder="Describe what happened..."
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-[#233DFF] focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20"
            />
          </div>

          {/* Actions Taken */}
          <div className="space-y-1">
            <label
              htmlFor="incident-actions"
              className="block text-xs font-black uppercase tracking-wider text-zinc-500"
            >
              Actions Taken
            </label>
            <textarea
              id="incident-actions"
              name="actionsTaken"
              value={form.actionsTaken}
              onChange={handleChange}
              rows={2}
              placeholder="What steps were taken?"
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-[#233DFF] focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20"
            />
          </div>

          {/* Who Notified */}
          <div className="space-y-1">
            <label
              htmlFor="incident-notified"
              className="block text-xs font-black uppercase tracking-wider text-zinc-500"
            >
              Who Was Notified
            </label>
            <input
              id="incident-notified"
              type="text"
              name="whoNotified"
              value={form.whoNotified}
              onChange={handleChange}
              placeholder="e.g. Event Lead, EMS, Medical Team"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-[#233DFF] focus:outline-none focus:ring-2 focus:ring-[#233DFF]/20"
              style={{ minHeight: 44 }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !form.description.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-rose-500 px-6 font-black uppercase tracking-wider text-white transition-all hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: 48 }}
          >
            {submitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {submitting ? 'Submitting...' : 'Submit Incident Report'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Incident FAB
// ─────────────────────────────────────────────────────────────────────────────

const IncidentFab: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition-all hover:bg-rose-600 hover:shadow-xl active:scale-95"
        style={{ width: 56, height: 56 }}
        aria-label="Report an incident"
        title="Report an incident"
      >
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </button>

      {open && <IncidentModal onClose={() => setOpen(false)} />}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Inner shell — reads context, chooses view
// ─────────────────────────────────────────────────────────────────────────────

interface InnerShellProps {
  onBack: () => void;
  onNavigateToAcademy?: () => void;
  allVolunteers?: Volunteer[];
  onEditEvent?: (opp: Opportunity) => void;
  canEdit?: boolean;
}

const InnerShell: React.FC<InnerShellProps> = ({
  onBack,
  onNavigateToAcademy,
  allVolunteers,
  onEditEvent,
  canEdit,
}) => {
  const { isLead, isTestMode } = useOps();

  // In simulation mode always show the volunteer experience —
  // the simulation trains volunteers regardless of the launcher's actual role
  const showVolunteerView = isTestMode || !isLead;

  return (
    <div className={isTestMode ? 'pt-11' : undefined}>
      {showVolunteerView ? (
        <VolunteerMyDay
          onBack={onBack}
          onNavigateToAcademy={onNavigateToAcademy}
        />
      ) : (
        <LeadCommandCenter
          onBack={onBack}
          allVolunteers={allVolunteers}
          onEditEvent={onEditEvent}
          canEdit={canEdit}
        />
      )}
      <IncidentFab />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EventOps — public entry point
// ─────────────────────────────────────────────────────────────────────────────

const EventOps: React.FC<EventOpsProps> = ({
  shift,
  opportunity,
  user,
  onBack,
  onUpdateUser,
  onNavigateToAcademy,
  allVolunteers,
  onEditEvent,
  canEdit,
  isTestMode = false,
}) => {
  return (
    <OpsProvider
      shift={shift}
      opportunity={opportunity}
      user={user}
      allVolunteers={allVolunteers}
      isTestMode={isTestMode}
      onUpdateUser={onUpdateUser}
    >
      <InnerShell
        onBack={onBack}
        onNavigateToAcademy={onNavigateToAcademy}
        allVolunteers={allVolunteers}
        onEditEvent={onEditEvent}
        canEdit={canEdit}
      />
    </OpsProvider>
  );
};

export default EventOps;
