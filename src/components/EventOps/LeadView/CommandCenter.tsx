import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import {
  Users,
  UserCheck,
  AlertTriangle,
  Clock,
  Activity,
  CheckSquare,
  HeartPulse,
  ClipboardList,
  RefreshCw,
  Search,
  Loader2,
  WifiOff,
  Shield,
  Zap,
  X,
  UserPlus,
  CheckCircle,
  XCircle,
  Filter,
  RotateCw,
  TrendingUp,
  Bell,
  ChevronRight,
  Edit3,
} from 'lucide-react';
import { useOps } from '../OpsContext';
import { apiService } from '../../../services/apiService';
import { toastService } from '../../../services/toastService';
import { CHECKLIST_TEMPLATES, EVENT_TYPE_TEMPLATE_MAP } from '../../../constants';
import type { Opportunity, Volunteer, IncidentReport } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LeadCommandCenterProps {
  onBack: () => void;
  onEditEvent?: (opp: Opportunity) => void;
  canEdit?: boolean;
  allVolunteers?: Volunteer[];
}

type TabId = 'roster' | 'services' | 'checklist' | 'incidents';
type RosterFilter = 'all' | 'checked-in' | 'not-yet' | 'walkins';

interface ServiceCounts {
  screenings: number | null;
  referrals: number | null;
  surveys: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase() ?? '')
    .join('');
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTimeUntilEnd(endTime: string): string {
  const end = new Date(endTime).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return 'Shift ended';
  const totalMins = Math.floor(diff / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `Ends in ${hours}h ${mins}m`;
  return `Ends in ${mins}m`;
}

function isShiftEndingSoon(endTime: string): boolean {
  const end = new Date(endTime).getTime();
  const now = Date.now();
  return end - now <= 30 * 60 * 1000 && end > now;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// Skeleton shimmer row
const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-50">
    <div className="w-9 h-9 rounded-full bg-zinc-100 animate-pulse flex-shrink-0" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3.5 bg-zinc-100 rounded-full animate-pulse w-1/2" />
      <div className="h-3 bg-zinc-100 rounded-full animate-pulse w-1/3" />
    </div>
    <div className="h-6 w-20 bg-zinc-100 rounded-full animate-pulse" />
  </div>
);

// Stat tile
interface StatTileProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: 'emerald' | 'amber' | 'rose' | 'brand' | 'zinc';
  progress?: number;
  icon?: React.ReactNode;
}

const StatTile: React.FC<StatTileProps> = ({ label, value, sub, color = 'brand', progress, icon }) => {
  const colorMap = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    brand: 'text-[#233DFF]',
    zinc: 'text-zinc-700',
  };
  const barMap = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    brand: 'bg-[#233DFF]',
    zinc: 'bg-zinc-400',
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs font-black uppercase tracking-wider text-zinc-400">{label}</p>
        {icon && <span className="text-zinc-300">{icon}</span>}
      </div>
      <p className={`text-3xl font-black tracking-tighter ${colorMap[color]} leading-none mb-1`}>
        {value}
      </p>
      {progress !== undefined && (
        <div className="h-1.5 bg-zinc-100 rounded-full mt-2 mb-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barMap[color]}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {sub && <p className="text-xs text-zinc-400 font-medium mt-0.5">{sub}</p>}
    </div>
  );
};

// Circular progress
const CircleProgress: React.FC<{ pct: number; size?: number }> = ({ pct, size = 80 }) => {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#f4f4f5" strokeWidth={8} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#233DFF"
        strokeWidth={8}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
};

// Signature canvas
interface SignatureCanvasProps {
  onSignature: (dataUrl: string) => void;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ onSignature }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e, canvas);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  }, [hasSignature]);

  const endDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      onSignature(canvas.toDataURL());
    }
  }, [hasSignature, onSignature]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);
    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', endDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', endDraw);
    };
  }, [startDraw, draw, endDraw]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignature('');
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Lead Signature</p>
      <div className="relative border-2 border-dashed border-zinc-200 rounded-xl overflow-hidden bg-zinc-50">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full touch-none cursor-crosshair"
          style={{ height: 160 }}
        />
        {!hasSignature && (
          <p className="absolute inset-0 flex items-center justify-center text-zinc-300 text-sm font-medium pointer-events-none select-none">
            Sign here
          </p>
        )}
      </div>
      {hasSignature && (
        <button
          onClick={clear}
          className="text-xs text-zinc-400 hover:text-zinc-600 font-medium transition-colors"
        >
          Clear signature
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SignoffModal
// ─────────────────────────────────────────────────────────────────────────────

interface SignoffModalProps {
  onClose: () => void;
  onBack: () => void;
}

const SignoffModal: React.FC<SignoffModalProps> = ({ onClose, onBack }) => {
  const { state, shift, opportunity, signOff, isTestMode } = useOps();
  const [sigData, setSigData] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const checkedIn = state.rsvpStats?.checkedIn ?? 0;
  const served = state.tracker?.participantsServed ?? 0;

  const shiftStart = new Date(shift.startTime);
  const shiftEnd = new Date(shift.endTime);
  const hoursRaw = (shiftEnd.getTime() - shiftStart.getTime()) / 3600000;
  const hours = Math.round(hoursRaw * 10) / 10;

  const handleSubmit = async () => {
    if (!sigData && !isTestMode) {
      toastService.error('Please sign before submitting');
      return;
    }
    setSubmitting(true);
    try {
      await signOff(sigData || 'practice-mode');
      onBack();
    } catch {
      // error toast handled in context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 rounded-t-3xl sm:rounded-t-3xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black tracking-tight text-zinc-900">Event Sign-Off</h2>
            <p className="text-xs text-zinc-400 font-medium truncate max-w-[220px]">{opportunity.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors text-zinc-500"
          >
            <XCircle size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Volunteers', val: checkedIn },
              { label: 'Served', val: served },
              { label: 'Hours', val: hours },
            ].map(({ label, val }) => (
              <div key={label} className="bg-zinc-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-zinc-900 tracking-tighter">{val}</p>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Open incidents warning */}
          {state.incidents.filter(i => i.status !== 'resolved').length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium">
                {state.incidents.filter(i => i.status !== 'resolved').length} open incident(s) — please resolve or document before signing off.
              </p>
            </div>
          )}

          {/* Signature */}
          <SignatureCanvas onSignature={setSigData} />

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || (!sigData && !isTestMode)}
            className="w-full min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-200 hover:bg-[#1a2de0] active:scale-[0.98]"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Submitting…</>
            ) : (
              <><CheckCircle size={16} /> Submit Sign-Off</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Roster
// ─────────────────────────────────────────────────────────────────────────────

const RosterTab: React.FC = () => {
  const { state, manualCheckin, walkInCheckin, refreshRoster } = useOps();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInEmail, setWalkInEmail] = useState('');
  const [walkInLoading, setWalkInLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    return state.rsvps.filter(r => {
      const matchSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase());

      const matchFilter =
        filter === 'all' ||
        (filter === 'checked-in' && r.checkedIn && !r.walkin) ||
        (filter === 'not-yet' && !r.checkedIn) ||
        (filter === 'walkins' && r.walkin);

      return matchSearch && matchFilter;
    });
  }, [state.rsvps, search, filter]);

  const handleManualCheckin = async (id: string) => {
    setCheckingInId(id);
    setConfirmId(null);
    try {
      await manualCheckin(id);
    } catch {
      // error handled in context
    } finally {
      setCheckingInId(null);
    }
  };

  const handleWalkIn = async () => {
    if (!walkInName.trim()) return;
    setWalkInLoading(true);
    try {
      await walkInCheckin(walkInName.trim(), walkInEmail.trim() || undefined);
      setWalkInName('');
      setWalkInEmail('');
      setWalkInOpen(false);
    } catch {
      // handled
    } finally {
      setWalkInLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshRoster();
    } catch {
      // handled
    } finally {
      setRefreshing(false);
    }
  };

  const filters: { id: RosterFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'checked-in', label: 'Checked In' },
    { id: 'not-yet', label: 'Not Yet' },
    { id: 'walkins', label: 'Walk-ins' },
  ];

  if (state.loading && state.rsvps.length === 0) {
    return (
      <div className="py-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Search */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search volunteers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-full bg-zinc-100 text-sm font-medium text-zinc-800 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-[#233DFF]/20 transition-all min-h-[44px]"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all min-h-[32px] ${
              filter === f.id
                ? 'bg-[#233DFF] text-white'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Volunteer list */}
      <div className="bg-white rounded-2xl mx-4 border border-zinc-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <Users size={32} className="mx-auto text-zinc-200 mb-2" />
            <p className="text-sm font-medium text-zinc-400">No volunteers match</p>
          </div>
        ) : (
          filtered.map((rsvp) => {
            const isConfirming = confirmId === rsvp.id;
            const isCheckingThis = checkingInId === rsvp.id;
            return (
              <div
                key={rsvp.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-zinc-50 last:border-0 transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#233DFF]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#233DFF] font-black text-xs">{getInitials(rsvp.name)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{rsvp.name}</p>
                  <p className="text-xs text-zinc-400 truncate">{rsvp.email}</p>
                </div>

                {/* Status */}
                <div className="flex-shrink-0">
                  {rsvp.walkin ? (
                    <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-black uppercase tracking-wider">
                      Walk-In
                    </span>
                  ) : rsvp.checkedIn ? (
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-wider">
                        Checked In
                      </span>
                      {rsvp.checkedInAt && (
                        <p className="text-[10px] text-zinc-400 mt-0.5 text-right">
                          {formatTime(new Date(rsvp.checkedInAt))}
                        </p>
                      )}
                    </div>
                  ) : isCheckingThis ? (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Checking in…</span>
                    </div>
                  ) : isConfirming ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleManualCheckin(rsvp.id)}
                        className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-xs font-black uppercase tracking-wider min-h-[32px]"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500 text-xs font-black uppercase tracking-wider min-h-[32px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-full bg-zinc-100 text-zinc-400 text-xs font-medium hidden sm:block">
                        Not Yet
                      </span>
                      <button
                        onClick={() => setConfirmId(rsvp.id)}
                        className="px-2.5 py-1 rounded-full bg-[#233DFF]/10 text-[#233DFF] text-xs font-black uppercase tracking-wider hover:bg-[#233DFF]/20 transition-colors min-h-[32px]"
                      >
                        Check In
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Walk-in registration */}
      <div className="mx-4 mt-3">
        {!walkInOpen ? (
          <button
            onClick={() => setWalkInOpen(true)}
            className="w-full min-h-[44px] border-2 border-dashed border-zinc-200 rounded-2xl flex items-center justify-center gap-2 text-zinc-400 hover:border-[#233DFF]/40 hover:text-[#233DFF] transition-all font-black uppercase tracking-wider text-xs"
          >
            <UserPlus size={15} />
            Register Walk-In
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Walk-In Registration</p>
            <input
              type="text"
              placeholder="Full name *"
              value={walkInName}
              onChange={e => setWalkInName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-sm font-medium text-zinc-800 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-[#233DFF]/20 min-h-[44px]"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={walkInEmail}
              onChange={e => setWalkInEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 text-sm font-medium text-zinc-800 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-[#233DFF]/20 min-h-[44px]"
            />
            <div className="flex gap-2">
              <button
                onClick={handleWalkIn}
                disabled={!walkInName.trim() || walkInLoading}
                className="flex-1 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full disabled:opacity-40 flex items-center justify-center gap-2 text-sm transition-all hover:bg-[#1a2de0]"
              >
                {walkInLoading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Register
              </button>
              <button
                onClick={() => { setWalkInOpen(false); setWalkInName(''); setWalkInEmail(''); }}
                className="px-4 min-h-[44px] bg-zinc-100 text-zinc-500 font-black uppercase tracking-wider rounded-full text-sm hover:bg-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="mx-4 mt-3 flex items-center justify-between px-1">
        <p className="text-xs text-zinc-400 font-medium">
          {state.rsvpStats?.checkedIn ?? 0} of {state.rsvpStats?.total ?? 0} checked in
          {(state.rsvpStats?.walkins ?? 0) > 0 && ` · ${state.rsvpStats?.walkins} walk-in${state.rsvpStats?.walkins !== 1 ? 's' : ''}`}
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[#233DFF] font-black uppercase tracking-wider transition-colors min-h-[32px] px-2"
        >
          <RotateCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Services
// ─────────────────────────────────────────────────────────────────────────────

const ServicesTab: React.FC = () => {
  const { state, opportunity, logClientEncounter } = useOps();
  const [counts, setCounts] = useState<ServiceCounts>({ screenings: null, referrals: null, surveys: null });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logType, setLogType] = useState<'screening' | 'referral' | 'distribution' | 'survey' | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [ageRange, setAgeRange] = useState('');
  const [genderIdentity, setGenderIdentity] = useState('');
  const [notes, setNotes] = useState('');

  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [s, r, sv] = await Promise.all([
          apiService.get(`/api/health-screenings?eventId=${opportunity.id}&date=${todayStr}`).catch(() => []),
          apiService.get(`/api/referrals?eventId=${opportunity.id}&date=${todayStr}`).catch(() => []),
          apiService.get(`/api/client-surveys?eventId=${opportunity.id}&date=${todayStr}`).catch(() => []),
        ]);
        if (!cancelled) {
          setCounts({
            screenings: Array.isArray(s) ? s.length : (s?.total ?? 0),
            referrals: Array.isArray(r) ? r.length : (r?.total ?? 0),
            surveys: Array.isArray(sv) ? sv.length : (sv?.total ?? 0),
          });
        }
      } catch {
        // fail silently — zeros shown
      } finally {
        if (!cancelled) setLoadingCounts(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [opportunity.id, todayStr]);

  const distributions = state.tracker?.distributions.length ?? 0;

  const handleOpenLog = (type: typeof logType) => {
    setLogType(type);
    setAgeRange('');
    setGenderIdentity('');
    setNotes('');
    setShowLogForm(true);
  };

  const handleSubmitLog = async () => {
    if (!logType) return;
    setLogLoading(true);
    try {
      await logClientEncounter({
        type: logType,
        ageRange,
        genderIdentity,
        notes,
        eventId: opportunity.id,
        timestamp: new Date().toISOString(),
      });
      // Bump local count optimistically
      setCounts(prev => ({
        ...prev,
        screenings: logType === 'screening' ? (prev.screenings ?? 0) + 1 : prev.screenings,
        referrals: logType === 'referral' ? (prev.referrals ?? 0) + 1 : prev.referrals,
        surveys: logType === 'survey' ? (prev.surveys ?? 0) + 1 : prev.surveys,
      }));
      setShowLogForm(false);
    } finally {
      setLogLoading(false);
    }
  };

  const tiles = [
    {
      label: 'Screenings',
      type: 'screening' as const,
      value: loadingCounts ? '—' : (counts.screenings ?? 0),
      icon: <HeartPulse size={18} className="text-rose-400" />,
      color: 'rose' as const,
    },
    {
      label: 'Referrals',
      type: 'referral' as const,
      value: loadingCounts ? '—' : (counts.referrals ?? 0),
      icon: <ChevronRight size={18} className="text-[#233DFF]" />,
      color: 'brand' as const,
    },
    {
      label: 'Distributions',
      type: 'distribution' as const,
      value: distributions,
      icon: <Activity size={18} className="text-emerald-400" />,
      color: 'emerald' as const,
    },
    {
      label: 'Surveys',
      type: 'survey' as const,
      value: loadingCounts ? '—' : (counts.surveys ?? 0),
      icon: <ClipboardList size={18} className="text-amber-400" />,
      color: 'amber' as const,
    },
  ];

  const recentLogs = (state.tracker?.clientLogs ?? []).slice(0, 10) as Array<{
    id?: string;
    timestamp?: string;
    loggedByName?: string;
    genderIdentity?: string;
    ageRange?: string;
    resourcesOnly?: boolean;
    healthScreeningOnly?: boolean;
    fullConsult?: boolean;
    referralGiven?: boolean;
  }>;

  const describeLog = (log: typeof recentLogs[0]): string => {
    if (log.fullConsult) return 'Full consult';
    if (log.healthScreeningOnly) return 'Health screening only';
    if (log.resourcesOnly) return 'Resources distributed';
    if (log.referralGiven) return 'Referral given';
    return 'Service logged';
  };

  return (
    <div className="pb-6 px-4 pt-4 space-y-4">

      {/* Quick log form */}
      {showLogForm && logType && (
        <div className="bg-white rounded-2xl border-2 border-[#233DFF]/20 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-zinc-900 uppercase tracking-wider">
              Log {logType.charAt(0).toUpperCase() + logType.slice(1)}
            </p>
            <button onClick={() => setShowLogForm(false)} className="text-zinc-400 hover:text-zinc-700"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-wider block mb-1">Age Range</label>
              <select value={ageRange} onChange={e => setAgeRange(e.target.value)} className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:border-[#233DFF]/40">
                <option value="">Select...</option>
                {['Under 18','18–24','25–34','35–44','45–54','55–64','65+','Prefer not to say'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-wider block mb-1">Gender Identity</label>
              <select value={genderIdentity} onChange={e => setGenderIdentity(e.target.value)} className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:border-[#233DFF]/40">
                <option value="">Select...</option>
                {['Male','Female','Non-binary','Transgender','Prefer not to say','Other'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-wider block mb-1">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any relevant details..." className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium outline-none focus:border-[#233DFF]/40" />
          </div>
          <button onClick={handleSubmitLog} disabled={logLoading} className="w-full py-3 bg-[#233DFF] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {logLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {logLoading ? 'Saving...' : 'Save Log'}
          </button>
        </div>
      )}

      {/* Metric grid — tap to log */}
      <p className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">Today Only — Tap to Log</p>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(t => (
          <button key={t.label} onClick={() => handleOpenLog(t.type)}
            className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm hover:shadow-md hover:border-[#233DFF]/20 active:scale-95 transition-all text-left">
            <div className="flex items-center justify-between mb-2">
              {t.icon}
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">{t.label}</span>
            </div>
            <p className={`text-3xl font-black tracking-tighter leading-none ${
              t.color === 'rose' ? 'text-rose-600' :
              t.color === 'brand' ? 'text-[#233DFF]' :
              t.color === 'emerald' ? 'text-emerald-600' :
              'text-amber-600'
            }`}>
              {t.value}
            </p>
          </button>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-50 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Recent Activity</p>
          <Activity size={14} className="text-zinc-300" />
        </div>

        {recentLogs.length === 0 ? (
          <div className="py-8 text-center">
            <Activity size={28} className="mx-auto text-zinc-200 mb-2" />
            <p className="text-sm font-medium text-zinc-400">No activity logged yet</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {recentLogs.map((log, idx) => (
              <div key={log.id ?? idx} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#233DFF] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800">{describeLog(log)}</p>
                  {(log.genderIdentity || log.ageRange) && (
                    <p className="text-xs text-zinc-400">
                      {[log.ageRange, log.genderIdentity].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {log.timestamp && (
                    <p className="text-xs text-zinc-400">{formatRelativeTime(log.timestamp)}</p>
                  )}
                  {log.loggedByName && (
                    <p className="text-[10px] text-zinc-300">{log.loggedByName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Checklist
// ─────────────────────────────────────────────────────────────────────────────

const ChecklistTab: React.FC = () => {
  const { state, opportunity, checkItem } = useOps();

  const templateId = EVENT_TYPE_TEMPLATE_MAP[opportunity.category];
  const template = CHECKLIST_TEMPLATES.find(t => t.id === templateId) ?? CHECKLIST_TEMPLATES[0];

  const completedIds = state.opsRun?.completedItems ?? [];

  const stages = Object.entries(template.stages);
  const allItems = stages.flatMap(([, stage]) => stage.items);
  const totalItems = allItems.length;
  const completedCount = allItems.filter(item => completedIds.includes(item.id)).length;
  const pct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  return (
    <div className="pb-6">
      {/* Progress header */}
      <div className="flex items-center gap-4 px-4 pt-5 pb-4">
        <div className="relative flex-shrink-0">
          <CircleProgress pct={pct} size={72} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-black text-zinc-900">{pct}%</span>
          </div>
        </div>
        <div>
          <p className="text-xl font-black tracking-tight text-zinc-900">
            {completedCount} <span className="text-zinc-300">/</span> {totalItems}
          </p>
          <p className="text-xs text-zinc-400 font-medium">tasks complete</p>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">{template.name}</p>
        </div>
      </div>

      {/* Stages */}
      <div className="px-4 space-y-4">
        {stages.map(([stageKey, stage]) => {
          const stageCompleted = stage.items.filter(i => completedIds.includes(i.id)).length;
          const stagePct = stage.items.length > 0 ? (stageCompleted / stage.items.length) * 100 : 0;

          return (
            <div key={stageKey} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
              {/* Stage header */}
              <div className="px-4 pt-4 pb-3 border-b border-zinc-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-black text-zinc-800">{stage.title}</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                    stagePct === 100
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {stageCompleted}/{stage.items.length}
                  </span>
                </div>
                <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#233DFF] rounded-full transition-all duration-500"
                    style={{ width: `${stagePct}%` }}
                  />
                </div>
              </div>

              {/* Items */}
              {stage.items.map(item => {
                const done = completedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => checkItem(item.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-zinc-50 last:border-0 transition-colors hover:bg-zinc-50/60 min-h-[44px] ${
                      done ? 'opacity-70' : ''
                    }`}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                      done
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-zinc-300'
                    }`}>
                      {done && <CheckCircle size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm font-medium leading-snug ${
                      done ? 'line-through text-zinc-400' : 'text-zinc-700'
                    }`}>
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Incidents
// ─────────────────────────────────────────────────────────────────────────────

const IncidentsTab: React.FC = () => {
  const { state, opportunity } = useOps();
  const [localIncidents, setLocalIncidents] = useState<IncidentReport[]>(state.incidents);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    setLocalIncidents(state.incidents);
  }, [state.incidents]);

  const handleResolve = async (incident: IncidentReport) => {
    setResolvingId(incident.id);
    try {
      await apiService.put(`/api/incidents/${incident.id}`, { status: 'resolved' });
      setLocalIncidents(prev =>
        prev.map(i => i.id === incident.id ? { ...i, status: 'resolved' } : i)
      );
      toastService.success('Incident marked resolved');
    } catch {
      toastService.error('Failed to update incident');
    } finally {
      setResolvingId(null);
    }
  };

  const severityForType = (type: IncidentReport['type']): 'critical' | 'medium' | 'low' => {
    if (type === 'EMS activation') return 'critical';
    if (type === 'Exposure incident') return 'critical';
    if (type === 'Safety/security issue') return 'medium';
    return 'low';
  };

  if (localIncidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <Shield size={28} className="text-emerald-600" />
        </div>
        <p className="text-lg font-black text-zinc-900 tracking-tight">No Incidents Reported</p>
        <p className="text-sm text-zinc-400 font-medium mt-1">Event running smoothly</p>
      </div>
    );
  }

  return (
    <div className="pb-6 px-4 pt-4 space-y-3">
      {localIncidents.map(incident => {
        const sev = severityForType(incident.type);
        const isExpanded = expandedId === incident.id;
        const isResolving = resolvingId === incident.id;
        const isOpen = incident.status !== 'resolved';

        return (
          <div
            key={incident.id}
            className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm"
          >
            <button
              className="w-full text-left px-4 pt-4 pb-3"
              onClick={() => setExpandedId(isExpanded ? null : incident.id)}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    sev === 'critical'
                      ? 'bg-rose-100 text-rose-700'
                      : sev === 'medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}>
                    {sev === 'critical' ? 'Critical' : sev === 'medium' ? 'Medium' : 'Low'}
                  </span>
                  <span className="text-xs font-medium text-zinc-500">{incident.type}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isOpen
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isOpen ? 'Open' : 'Resolved'}
                  </span>
                  <ChevronRight
                    size={14}
                    className={`text-zinc-300 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>
              </div>

              <p className={`text-sm text-zinc-700 font-medium leading-snug ${!isExpanded ? 'line-clamp-2' : ''}`}>
                {incident.description}
              </p>

              <p className="text-xs text-zinc-400 mt-1">
                {formatRelativeTime(incident.timestamp)}
              </p>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-zinc-50 pt-3">
                {incident.actionsTaken && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">Actions Taken</p>
                    <p className="text-sm text-zinc-600 font-medium">{incident.actionsTaken}</p>
                  </div>
                )}
                {incident.whoNotified && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">Notified</p>
                    <p className="text-sm text-zinc-600 font-medium">{incident.whoNotified}</p>
                  </div>
                )}

                {isOpen && (
                  <button
                    onClick={() => handleResolve(incident)}
                    disabled={isResolving}
                    className="w-full min-h-[44px] bg-emerald-500 text-white font-black uppercase tracking-wider rounded-full flex items-center justify-center gap-2 text-sm hover:bg-emerald-600 disabled:opacity-50 transition-all"
                  >
                    {isResolving ? (
                      <><Loader2 size={14} className="animate-spin" /> Updating…</>
                    ) : (
                      <><CheckCircle size={14} /> Mark Resolved</>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const CommandCenter: React.FC<LeadCommandCenterProps> = ({
  onBack,
  onEditEvent,
  canEdit = false,
}) => {
  const { state, shift, opportunity, isTestMode } = useOps();

  const [activeTab, setActiveTab] = useState<TabId>('roster');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSignoff, setShowSignoff] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Clock
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // ── Derived stats ──
  const checkedIn = state.rsvpStats?.checkedIn ?? 0;
  const total = state.rsvpStats?.total ?? 0;
  const walkins = state.rsvpStats?.walkins ?? 0;
  const served = state.tracker?.participantsServed ?? 0;
  const openIncidents = state.incidents.filter(i => i.status !== 'resolved').length;

  const checkinPct = total > 0 ? (checkedIn / total) * 100 : 0;
  const checkinColor: 'emerald' | 'amber' | 'rose' =
    checkinPct >= 80 ? 'emerald' : checkinPct >= 50 ? 'amber' : 'rose';

  const timeUntilEnd = formatTimeUntilEnd(shift.endTime);
  const shiftEndingSoon = isShiftEndingSoon(shift.endTime);

  // ── Tab config ──
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'roster', label: 'Roster', icon: <Users size={14} /> },
    { id: 'services', label: 'Services', icon: <HeartPulse size={14} /> },
    { id: 'checklist', label: 'Checklist', icon: <CheckSquare size={14} /> },
    { id: 'incidents', label: 'Incidents', icon: <AlertTriangle size={14} /> },
  ];

  // ── Event display ──
  const eventDate = opportunity.dateDisplay ?? opportunity.date;
  const eventLocation = opportunity.serviceLocation ?? opportunity.address ?? '';

  return (
    <div
      className={`min-h-screen bg-zinc-50 flex flex-col transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Loading bar */}
      {state.loading && (
        <div className="fixed top-0 left-0 right-0 z-[200] h-0.5 bg-zinc-100">
          <div className="h-full bg-[#233DFF] animate-pulse" style={{ width: '60%' }} />
        </div>
      )}

      {/* Test mode banner */}
      {isTestMode && (
        <div className="bg-amber-400 px-4 py-2 flex items-center justify-center gap-2 text-amber-900 text-xs font-black uppercase tracking-wider min-h-[40px]">
          <Zap size={13} />
          PRACTICE MODE — Data shown is simulated
          <Zap size={13} />
        </div>
      )}

      {/* ── STICKY HEADER ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Back */}
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-700 font-medium text-sm transition-colors min-h-[44px] px-1 flex-shrink-0"
          >
            ← Back
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-black tracking-tight text-zinc-900 truncate">
              {opportunity.title}
            </h1>
            <p className="text-xs text-zinc-500 font-medium truncate">
              {eventDate}{eventLocation ? ` · ${eventLocation}` : ''}
            </p>
          </div>

          {/* Right indicators */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isTestMode && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider hidden sm:block">
                Practice
              </span>
            )}
            {!state.isOnline && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100">
                <WifiOff size={12} className="text-amber-600" />
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider hidden sm:block">Offline</span>
              </div>
            )}
            {state.pendingWrites > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100">
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">{state.pendingWrites} pending</span>
              </div>
            )}
            {canEdit && onEditEvent && (
              <button
                onClick={() => onEditEvent(opportunity)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors min-h-[44px] min-w-[44px]"
              >
                <Edit3 size={14} className="text-zinc-500" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── STATS BAR ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {/* Tile 1: Team Check-In */}
        <StatTile
          label="Checked In"
          value={
            <span>
              {total > 0 ? checkedIn : '—'}
              <span className="text-2xl text-zinc-300 font-black">/{total > 0 ? total : '—'}</span>
            </span>
          }
          sub={walkins > 0 ? `${walkins} walk-in${walkins !== 1 ? 's' : ''}` : 'No walk-ins yet'}
          color={total > 0 ? checkinColor : 'zinc'}
          progress={total > 0 ? checkinPct : undefined}
          icon={<UserCheck size={16} />}
        />

        {/* Tile 2: People Served */}
        <StatTile
          label="Served Today"
          value={served}
          sub="screenings + referrals + distributions"
          color="emerald"
          icon={<TrendingUp size={16} className="text-emerald-400" />}
        />

        {/* Tile 3: Open Incidents */}
        <StatTile
          label="Open Incidents"
          value={openIncidents}
          sub={openIncidents === 0 ? 'All clear' : `${openIncidents} need${openIncidents === 1 ? 's' : ''} attention`}
          color={openIncidents > 0 ? 'rose' : 'zinc'}
          icon={<AlertTriangle size={16} className={openIncidents > 0 ? 'text-rose-400' : 'text-zinc-300'} />}
        />

        {/* Tile 4: Time */}
        <StatTile
          label="Current Time"
          value={formatTime(currentTime)}
          sub={timeUntilEnd}
          color="brand"
          icon={<Clock size={16} />}
        />
      </div>

      {/* ── ALERT BANNER ── */}
      {openIncidents > 0 && (
        <div className="mx-4 mb-2">
          <button
            onClick={() => setActiveTab('incidents')}
            className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-left hover:bg-amber-100 transition-colors min-h-[44px]"
          >
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
            <p className="text-sm font-bold text-amber-800 flex-1">
              {openIncidents} open incident{openIncidents !== 1 ? 's' : ''} · Review in Incidents tab
            </p>
            <ChevronRight size={14} className="text-amber-400 flex-shrink-0" />
          </button>
        </div>
      )}

      {/* ── ERROR BANNER ── */}
      {state.error && (
        <div className="mx-4 mb-2 flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
          <XCircle size={16} className="text-rose-500 flex-shrink-0" />
          <p className="text-sm font-medium text-rose-700 flex-1">Failed to load data — {state.error}</p>
        </div>
      )}

      {/* ── TABS ── */}
      <div className="sticky top-[57px] z-30 bg-white border-b border-zinc-100">
        <div className="flex overflow-x-auto no-scrollbar px-4 gap-1 py-2">
          {tabs.map(tab => {
            const hasAlert = tab.id === 'incidents' && openIncidents > 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200 min-h-[36px] relative ${
                  activeTab === tab.id
                    ? 'bg-[#233DFF] text-white shadow-sm'
                    : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                {tab.icon}
                {tab.label}
                {hasAlert && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'roster' && <RosterTab />}
        {activeTab === 'services' && <ServicesTab />}
        {activeTab === 'checklist' && <ChecklistTab />}
        {activeTab === 'incidents' && <IncidentsTab />}
      </div>

      {/* ── SHIFT ENDING SOON FOOTER ── */}
      {shiftEndingSoon && (
        <div className="sticky bottom-0 z-30 bg-amber-50 border-t border-amber-200 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bell size={15} className="text-amber-600 flex-shrink-0" />
            <p className="text-sm font-bold text-amber-800 truncate">Shift ending soon — begin wrap-up</p>
          </div>
          <button
            onClick={() => setShowSignoff(true)}
            className="flex-shrink-0 px-4 py-2 bg-amber-500 text-white font-black uppercase tracking-wider rounded-full text-xs hover:bg-amber-600 transition-colors min-h-[44px]"
          >
            Start Wrap-Up
          </button>
        </div>
      )}

      {/* ── SIGN-OFF MODAL ── */}
      {showSignoff && (
        <SignoffModal
          onClose={() => setShowSignoff(false)}
          onBack={onBack}
        />
      )}
    </div>
  );
};

export default CommandCenter;
