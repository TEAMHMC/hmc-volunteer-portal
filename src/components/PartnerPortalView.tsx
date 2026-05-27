import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import {
  Building2, FileText, BarChart3, LogOut, Loader2, ChevronDown,
  CheckCircle, AlertTriangle, Clock, X, ChevronRight, Award,
  Phone, Mail, Globe, MapPin, Save, Activity,
  ClipboardList, MessageSquare, Palette, Inbox, BarChart2,
  Plus, Trash2, Eye, Printer, Calendar, ExternalLink,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PortalTab = 'referrals' | 'organization' | 'performance' | 'apply' | 'community' | 'events' | 'agreements' | 'brand';

interface PartnerReferral {
  id: string;
  date: string;
  clientFirstName: string;
  clientLastInitial: string;
  serviceNeeded: string;
  urgency: 'Standard' | 'Urgent' | 'Emergency';
  status: 'Pending' | 'Accepted' | 'In Progress' | 'Completed' | 'Unable to Serve';
  notes?: string;
  referredBy?: string;
  aiMatchSummary?: string;
}

interface PartnerProfile {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: string;
  servicesProvided?: string[];
  languagesSupported?: string[];
  targetPopulations?: string[];
  isOfficialPartner?: boolean;
  performanceScore?: number;
  totalReferrals?: number;
  successfulOutcomes?: number;
  avgResponseTime?: number;
  logoUrl?: string;
  brandGuidelinesUrl?: string;
  primaryColor?: string;
  partnershipTypes?: string[];
}

interface PartnerApplication {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  partnershipTypes: string[];
  reviewNotes?: string;
}

interface BulletinPost {
  id: string;
  orgName: string;
  orgLogoUrl?: string;
  type: string;
  title: string;
  description: string;
  contactEmail: string;
  contactName?: string;
  tags?: string[];
  postedAt: string;
  expiresAt?: string;
  active?: boolean;
}

interface Agreement {
  id: string;
  title: string;
  type: string;
  status: 'pending_signature' | 'signed';
  sentAt: string;
  signedAt?: string;
  signatureName?: string;
  bodyText: string;
}

interface PartnerPortalProps {
  onBackToLanding: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const URGENCY_BADGE: Record<string, string> = {
  Standard: 'bg-zinc-100 text-zinc-600',
  Urgent: 'bg-amber-100 text-amber-700',
  Emergency: 'bg-red-100 text-red-700',
};

const STATUS_BADGE: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Accepted: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  'Unable to Serve': 'bg-red-100 text-red-700',
};

const BULLETIN_TYPE_LABELS: Record<string, string> = {
  vendor_seeking: 'Vendor Needed',
  opportunity: 'Opportunity',
  announcement: 'Announcement',
  subcontract_available: 'Available for Subcontract',
  event_collab: 'Event Collaboration',
};

const BULLETIN_TYPE_COLORS: Record<string, string> = {
  vendor_seeking: 'bg-purple-100 text-purple-700',
  opportunity: 'bg-blue-100 text-blue-700',
  announcement: 'bg-zinc-100 text-zinc-600',
  subcontract_available: 'bg-amber-100 text-amber-700',
  event_collab: 'bg-emerald-100 text-emerald-700',
};

const inputCls = 'w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-[#233DFF]/30 font-bold text-sm';
const labelCls = 'text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2';

// ─────────────────────────────────────────────────────────────────────────────
// Status Update Modal
// ─────────────────────────────────────────────────────────────────────────────

const StatusModal: React.FC<{
  referral: PartnerReferral;
  newStatus: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ referral, newStatus, onClose, onSaved }) => {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await apiService.put(`/api/partner/referrals/${referral.id}/respond`, { status: newStatus, notes });
      onSaved();
    } catch {
      setError('Failed to update status. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <h2 className="font-black text-zinc-900">Update Status</h2>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">
              {referral.clientFirstName} {referral.clientLastInitial}. — {referral.serviceNeeded}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-500">New status:</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${STATUS_BADGE[newStatus] || 'bg-zinc-100 text-zinc-600'}`}>
              {newStatus}
            </span>
          </div>
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add context about this status update..."
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-[#233DFF]/30 font-medium text-sm resize-none"
            />
          </div>
          {error && <p className="text-rose-500 text-xs font-medium">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 min-h-[44px] border border-zinc-200 text-zinc-700 font-black uppercase tracking-wider rounded-full text-sm hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={14} /> Confirm</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Referral Row
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_ACTIONS: Record<string, { label: string; next: string }[]> = {
  Pending: [
    { label: 'Accept', next: 'Accepted' },
    { label: 'Unable to Serve', next: 'Unable to Serve' },
  ],
  Accepted: [
    { label: 'Mark In Progress', next: 'In Progress' },
    { label: 'Unable to Serve', next: 'Unable to Serve' },
  ],
  'In Progress': [
    { label: 'Mark Completed', next: 'Completed' },
    { label: 'Unable to Serve', next: 'Unable to Serve' },
  ],
  Completed: [],
  'Unable to Serve': [],
};

const ReferralRow: React.FC<{ referral: PartnerReferral; onRefresh: () => void }> = ({ referral, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const actions = STATUS_ACTIONS[referral.status] || [];

  return (
    <>
      <div className="p-4 bg-white border border-zinc-100 rounded-2xl hover:border-zinc-200 transition-all">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1.5">
              <span className="font-bold text-zinc-900 text-sm">
                {referral.clientFirstName} {referral.clientLastInitial}.
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${URGENCY_BADGE[referral.urgency] || 'bg-zinc-100 text-zinc-600'}`}>
                {referral.urgency}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${STATUS_BADGE[referral.status] || 'bg-zinc-100 text-zinc-600'}`}>
                {referral.status}
              </span>
            </div>
            <p className="text-sm text-zinc-600 font-medium">{referral.serviceNeeded}</p>
            <p className="text-[11px] text-zinc-400 font-medium mt-1">{formatDate(referral.date)}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors"
              aria-label={expanded ? 'Collapse' : 'View details'}
            >
              <ChevronRight size={16} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            {actions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(v => !v)}
                  className="flex items-center gap-1 px-3 py-2 min-h-[36px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-[10px] hover:bg-[#1a2de0] transition-colors"
                >
                  Actions <ChevronDown size={12} />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-10 min-w-[160px] overflow-hidden">
                    {actions.map(action => (
                      <button
                        key={action.next}
                        onClick={() => { setDropdownOpen(false); setPendingStatus(action.next); }}
                        className="w-full px-4 py-2.5 text-left text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-zinc-100 space-y-2">
            {referral.notes && (
              <div>
                <p className={labelCls}>Notes</p>
                <p className="text-sm text-zinc-600 font-medium">{referral.notes}</p>
              </div>
            )}
            {referral.referredBy && (
              <div>
                <p className={labelCls}>Referred By</p>
                <p className="text-sm text-zinc-600 font-medium">{referral.referredBy}</p>
              </div>
            )}
            {referral.aiMatchSummary && (
              <div>
                <p className={labelCls}>AI Match Summary</p>
                <p className="text-sm text-zinc-600 font-medium">{referral.aiMatchSummary}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {pendingStatus && (
        <StatusModal
          referral={referral}
          newStatus={pendingStatus}
          onClose={() => setPendingStatus(null)}
          onSaved={() => { setPendingStatus(null); onRefresh(); }}
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Referrals
// ─────────────────────────────────────────────────────────────────────────────

const ReferralsTab: React.FC = () => {
  const [referrals, setReferrals] = useState<PartnerReferral[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiService.get('/api/partner/referrals')
      .then((data: any) => setReferrals(Array.isArray(data) ? data : []))
      .catch(() => setReferrals([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-zinc-300" />
      </div>
    );
  }

  if (referrals.length === 0) {
    return (
      <div className="text-center py-20 px-6">
        <FileText size={40} className="mx-auto text-zinc-200 mb-4" />
        <p className="font-black text-zinc-400 text-base">No referrals yet.</p>
        <p className="text-sm text-zinc-400 font-medium mt-2">HMC will notify you when a referral is sent your way.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-zinc-500">{referrals.length} referral{referrals.length !== 1 ? 's' : ''}</p>
      </div>
      {referrals.map(r => (
        <ReferralRow key={r.id} referral={r} onRefresh={load} />
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Organization
// ─────────────────────────────────────────────────────────────────────────────

const OrganizationTab: React.FC = () => {
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [form, setForm] = useState<Partial<PartnerProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiService.get('/api/partner/profile')
      .then((data: any) => {
        setProfile(data);
        setForm(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await apiService.put('/api/partner/profile', form);
      setProfile(updated);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof PartnerProfile, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-zinc-300" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 px-6">
        <Building2 size={40} className="mx-auto text-zinc-200 mb-4" />
        <p className="font-black text-zinc-400">Unable to load profile.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {profile.isOfficialPartner && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <Award size={18} className="text-amber-600 flex-shrink-0" />
          <span className="text-sm font-black text-amber-700 uppercase tracking-wider">Official Referral Partner</span>
        </div>
      )}

      {/* Inline performance metrics */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Referrals', value: profile.totalReferrals ?? 0 },
          { label: 'Completed', value: profile.successfulOutcomes ?? 0 },
          { label: 'Performance Score', value: profile.performanceScore != null ? `${profile.performanceScore}%` : 'N/A' },
        ].map(stat => (
          <div key={stat.label} className="p-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-center">
            <p className="text-lg font-black text-zinc-900">{stat.value}</p>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className={labelCls}>Organization Name</label>
          <input
            type="text"
            value={profile.name}
            readOnly
            className="w-full p-4 bg-zinc-100 border-2 border-zinc-100 rounded-2xl font-bold text-sm text-zinc-500 cursor-not-allowed"
          />
          <p className="text-[10px] text-zinc-400 font-medium mt-1">Contact HMC to change your organization name.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Contact Name</label>
            <input
              type="text"
              value={form.contactName || ''}
              onChange={e => setField('contactName', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Contact Email</label>
            <input
              type="email"
              value={form.contactEmail || ''}
              onChange={e => setField('contactEmail', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Contact Phone</label>
            <input
              type="tel"
              value={form.contactPhone || ''}
              onChange={e => setField('contactPhone', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input
              type="url"
              value={form.website || ''}
              onChange={e => setField('website', e.target.value)}
              className={inputCls}
              placeholder="https://"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Address</label>
          <input
            type="text"
            value={form.address || ''}
            onChange={e => setField('address', e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Services Provided (comma-separated)</label>
          <input
            type="text"
            value={(form.servicesProvided || []).join(', ')}
            onChange={e => setField('servicesProvided', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            className={inputCls}
            placeholder="Housing, Mental Health, Food Assistance"
          />
        </div>

        <div>
          <label className={labelCls}>Languages Supported</label>
          <input
            type="text"
            value={(form.languagesSupported || []).join(', ')}
            onChange={e => setField('languagesSupported', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            className={inputCls}
            placeholder="English, Spanish, Mandarin"
          />
        </div>

        <div>
          <label className={labelCls}>Target Populations</label>
          <input
            type="text"
            value={(form.targetPopulations || []).join(', ')}
            onChange={e => setField('targetPopulations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            className={inputCls}
            placeholder="Adults, Seniors, Youth"
          />
        </div>

        {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={14} /> Save Changes</>}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-bold">
              <CheckCircle size={15} /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Performance
// ─────────────────────────────────────────────────────────────────────────────

const PerformanceTab: React.FC = () => {
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiService.get('/api/partner/profile')
      .then((data: any) => setProfile(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-zinc-300" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 px-6">
        <BarChart3 size={40} className="mx-auto text-zinc-200 mb-4" />
        <p className="font-black text-zinc-400">No performance data available.</p>
      </div>
    );
  }

  const score = profile.performanceScore ?? 0;
  const scoreColor = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  const stats = [
    {
      label: 'Total Referrals Received',
      value: profile.totalReferrals ?? 0,
      Icon: FileText,
      color: 'bg-[#233DFF]/5 border-[#233DFF]/10',
      iconColor: 'text-[#233DFF]',
    },
    {
      label: 'Completed Successfully',
      value: profile.successfulOutcomes ?? 0,
      Icon: CheckCircle,
      color: 'bg-emerald-50 border-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Avg Response Time',
      value: profile.avgResponseTime != null ? `${profile.avgResponseTime}h` : 'N/A',
      Icon: Clock,
      color: 'bg-amber-50 border-amber-100',
      iconColor: 'text-amber-600',
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Performance score card */}
      <div className="p-5 rounded-3xl bg-zinc-50 border border-zinc-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className={labelCls}>Performance Score</p>
            <p className="text-4xl font-black text-zinc-900">{score}<span className="text-xl text-zinc-400">/100</span></p>
          </div>
          <Activity size={32} className="text-zinc-300" />
        </div>
        <div className="h-3 bg-zinc-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scoreColor}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-zinc-400 font-medium mt-2">
          {score >= 80 ? 'Excellent — keep it up.' : score >= 50 ? 'Good standing. Focus on response time to improve.' : 'Needs attention — contact HMC for support.'}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className={`p-5 rounded-2xl border ${stat.color}`}>
            <stat.Icon size={24} className={`${stat.iconColor} mb-3`} />
            <p className="text-2xl font-black text-zinc-900">{stat.value}</p>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] mt-1 leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Completion rate */}
      {(profile.totalReferrals ?? 0) > 0 && (
        <div className="p-5 rounded-2xl border border-zinc-100">
          <p className={labelCls}>Completion Rate</p>
          <p className="text-3xl font-black text-zinc-900 mb-2">
            {Math.round(((profile.successfulOutcomes ?? 0) / (profile.totalReferrals ?? 1)) * 100)}%
          </p>
          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#233DFF] rounded-full"
              style={{ width: `${Math.round(((profile.successfulOutcomes ?? 0) / (profile.totalReferrals ?? 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Apply for Partnership
// ─────────────────────────────────────────────────────────────────────────────

const PARTNERSHIP_TYPES = [
  {
    id: 'official_referral',
    label: 'Official Referral Partner',
    desc: 'HMC refers clients to your organization. You receive referrals in your dashboard and update their status.',
  },
  {
    id: 'event_vendor',
    label: 'Event Vendor / Co-host',
    desc: 'You provide services, space, or resources at HMC events. Or HMC co-hosts events with you.',
  },
  {
    id: 'subcontractor',
    label: 'Subcontractor',
    desc: 'You contract HMC for services, or HMC subcontracts you. For funded programs and scopes of work.',
  },
  {
    id: 'community',
    label: 'General Community Partner',
    desc: 'Share resources, cross-promote, build community together.',
  },
];

const ApplyTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [existingApp, setExistingApp] = useState<PartnerApplication | null>(null);
  const [noApp, setNoApp] = useState(false);

  // Wizard state
  const [step, setStep] = useState(1);
  const [partnershipTypes, setPartnershipTypes] = useState<string[]>([]);
  const [servicesOffered, setServicesOffered] = useState('');
  const [eventCapabilities, setEventCapabilities] = useState('');
  const [subcontractCapabilities, setSubcontractCapabilities] = useState('');
  const [hasLiabilityInsurance, setHasLiabilityInsurance] = useState<string>('');
  const [insuranceCertUrl, setInsuranceCertUrl] = useState('');
  const [clientCapacity, setClientCapacity] = useState('');
  const [serviceAreaNotes, setServiceAreaNotes] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [anythingElse, setAnythingElse] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandGuidelinesUrl, setBrandGuidelinesUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#233DFF');
  const [logoPreviewOk, setLogoPreviewOk] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');

  useEffect(() => {
    Promise.all([
      apiService.get('/api/partner/application').catch(() => null),
      apiService.get('/api/partner/profile').catch(() => null),
    ]).then(([appData, profileData]: [any, any]) => {
      if (appData && appData.id) {
        setExistingApp(appData);
      } else {
        setNoApp(true);
      }
      if (profileData?.contactEmail) setPartnerEmail(profileData.contactEmail);
    }).finally(() => setLoading(false));
  }, []);

  const toggleType = (id: string) => {
    setPartnershipTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const isEventVendor = partnershipTypes.includes('event_vendor');
  const isSubcontractor = partnershipTypes.includes('subcontractor');

  const canProceedStep1 = partnershipTypes.length > 0;
  const canProceedStep2 = servicesOffered.trim().length > 0;
  const canProceedStep3 = lookingFor.trim().length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      await apiService.post('/api/partner/apply', {
        partnershipTypes,
        servicesOffered,
        eventCapabilities: isEventVendor ? eventCapabilities : undefined,
        subcontractCapabilities: isSubcontractor ? subcontractCapabilities : undefined,
        insuranceInfo: isSubcontractor && hasLiabilityInsurance === 'yes' ? (insuranceCertUrl || 'Yes — COI available on request') : undefined,
        clientCapacityPerMonth: clientCapacity ? Number(clientCapacity) : undefined,
        serviceAreaNotes,
        needsFromHMC: lookingFor + (anythingElse ? `\n\nAdditional notes: ${anythingElse}` : ''),
        logoUrl: logoUrl || undefined,
        brandGuidelinesUrl: brandGuidelinesUrl || undefined,
        primaryColor,
      });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err?.message || err?.error || 'Submission failed. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-zinc-300" />
      </div>
    );
  }

  // Show existing application status
  if (existingApp) {
    const statusConfig = {
      pending: {
        badge: 'bg-amber-100 text-amber-700',
        label: 'Under Review',
        icon: <Clock size={16} className="text-amber-600" />,
        desc: `Submitted ${formatDate(existingApp.submittedAt)}. HMC will email you with next steps.`,
      },
      approved: {
        badge: 'bg-emerald-100 text-emerald-700',
        label: 'Approved',
        icon: <CheckCircle size={16} className="text-emerald-600" />,
        desc: 'Your application has been approved.',
      },
      rejected: {
        badge: 'bg-red-100 text-red-700',
        label: 'Not Approved',
        icon: <AlertTriangle size={16} className="text-red-600" />,
        desc: existingApp.reviewNotes || 'Contact HMC for more information.',
      },
    };
    const cfg = statusConfig[existingApp.status];

    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="p-6 bg-white border border-zinc-100 rounded-2xl space-y-4">
          <div className="flex items-center gap-3">
            {cfg.icon}
            <span className={`px-3 py-1 rounded-full text-xs font-black ${cfg.badge}`}>{cfg.label}</span>
          </div>
          <p className="text-sm text-zinc-600 font-medium">{cfg.desc}</p>
          {existingApp.partnershipTypes?.length > 0 && existingApp.status === 'approved' && (
            <div>
              <p className={labelCls}>Approved Partnership Types</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {existingApp.partnershipTypes.map(t => {
                  const pt = PARTNERSHIP_TYPES.find(p => p.id === t);
                  return (
                    <span key={t} className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-emerald-700">
                      {pt?.label || t}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Submitted success state
  if (submitted) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
          <CheckCircle size={40} className="mx-auto text-emerald-500" />
          <h3 className="font-black text-zinc-900 text-lg">Application Submitted</h3>
          <p className="text-sm text-zinc-600 font-medium leading-relaxed">
            Your application has been submitted. HMC will review it within 5 business days.
            {partnerEmail && <> We'll email you at <strong>{partnerEmail}</strong> with next steps.</>}
          </p>
        </div>
      </div>
    );
  }

  // Wizard
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map(s => (
          <React.Fragment key={s}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
              s === step ? 'bg-[#233DFF] text-white' : s < step ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-400'
            }`}>
              {s < step ? <CheckCircle size={14} /> : s}
            </div>
            {s < 4 && <div className={`flex-1 h-0.5 rounded-full transition-colors ${s < step ? 'bg-emerald-400' : 'bg-zinc-100'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Partnership Types */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-black text-zinc-900 mb-1">Partnership Types</h2>
            <p className="text-sm text-zinc-500 font-medium">Select all that apply to your organization.</p>
          </div>
          <div className="space-y-3">
            {PARTNERSHIP_TYPES.map(pt => (
              <button
                key={pt.id}
                type="button"
                onClick={() => toggleType(pt.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                  partnershipTypes.includes(pt.id)
                    ? 'border-[#233DFF] bg-[#233DFF]/5'
                    : 'border-zinc-100 bg-white hover:border-zinc-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                    partnershipTypes.includes(pt.id) ? 'bg-[#233DFF] border-[#233DFF]' : 'border-zinc-300'
                  }`}>
                    {partnershipTypes.includes(pt.id) && <CheckCircle size={12} className="text-white" />}
                  </div>
                  <div>
                    <p className="font-black text-zinc-900 text-sm">{pt.label}</p>
                    <p className="text-xs text-zinc-500 font-medium mt-0.5 leading-relaxed">{pt.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="px-6 py-3 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: What You Offer */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-black text-zinc-900 mb-1">What You Offer</h2>
            <p className="text-sm text-zinc-500 font-medium">Tell HMC about your capabilities.</p>
          </div>
          <div>
            <label className={labelCls}>Services you offer to HMC or our clients *</label>
            <textarea
              rows={4}
              value={servicesOffered}
              onChange={e => setServicesOffered(e.target.value)}
              placeholder="Describe the services your organization provides..."
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-[#233DFF]/30 font-medium text-sm resize-none"
            />
          </div>
          {isEventVendor && (
            <div>
              <label className={labelCls}>Event capabilities — what can you provide at events?</label>
              <textarea
                rows={3}
                value={eventCapabilities}
                onChange={e => setEventCapabilities(e.target.value)}
                placeholder="e.g. space rental, catering, A/V equipment, staffing..."
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-[#233DFF]/30 font-medium text-sm resize-none"
              />
            </div>
          )}
          {isSubcontractor && (
            <>
              <div>
                <label className={labelCls}>Subcontract capabilities — scope of services you can deliver</label>
                <textarea
                  rows={3}
                  value={subcontractCapabilities}
                  onChange={e => setSubcontractCapabilities(e.target.value)}
                  placeholder="e.g. community health education, outreach coordination..."
                  className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-[#233DFF]/30 font-medium text-sm resize-none"
                />
              </div>
              <div>
                <label className={labelCls}>Do you carry liability insurance?</label>
                <div className="flex gap-3">
                  {['yes', 'no'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setHasLiabilityInsurance(val)}
                      className={`flex-1 py-3 rounded-2xl border-2 font-black text-sm uppercase tracking-wider transition-colors ${
                        hasLiabilityInsurance === val
                          ? 'border-[#233DFF] bg-[#233DFF]/5 text-[#233DFF]'
                          : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                      }`}
                    >
                      {val === 'yes' ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
                {hasLiabilityInsurance === 'yes' && (
                  <div className="mt-3">
                    <label className={labelCls}>Certificate of Insurance (COI) link <span className="font-normal normal-case text-zinc-400">— required before agreement is finalized</span></label>
                    <input
                      type="url"
                      value={insuranceCertUrl}
                      onChange={e => setInsuranceCertUrl(e.target.value)}
                      className={inputCls}
                      placeholder="Link to your COI document (Google Drive, Dropbox, etc.)"
                    />
                    <p className="text-xs text-zinc-400 mt-1">Upload your COI to Google Drive or Dropbox and paste the public share link. HMC will request a current copy before finalizing any subcontractor agreement.</p>
                  </div>
                )}
              </div>
            </>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Client capacity per month (optional)</label>
              <input
                type="number"
                min={0}
                value={clientCapacity}
                onChange={e => setClientCapacity(e.target.value)}
                className={inputCls}
                placeholder="e.g. 20"
              />
            </div>
            <div>
              <label className={labelCls}>Service area notes (optional)</label>
              <input
                type="text"
                value={serviceAreaNotes}
                onChange={e => setServiceAreaNotes(e.target.value)}
                className={inputCls}
                placeholder="e.g. SPA 6 — South (Inglewood, Compton), SPA 4 — Metro"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 min-h-[44px] border border-zinc-200 text-zinc-700 font-black uppercase tracking-wider rounded-full text-sm hover:bg-zinc-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              className="flex-1 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: What You Need */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-black text-zinc-900 mb-1">What You Need</h2>
            <p className="text-sm text-zinc-500 font-medium">Help HMC understand how to support your organization.</p>
          </div>
          <div>
            <label className={labelCls}>What are you looking for from HMC? *</label>
            <textarea
              rows={4}
              value={lookingFor}
              onChange={e => setLookingFor(e.target.value)}
              placeholder="e.g. client referrals, co-marketing, subcontract opportunities..."
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-[#233DFF]/30 font-medium text-sm resize-none"
            />
          </div>
          <div>
            <label className={labelCls}>Anything else we should know? (optional)</label>
            <textarea
              rows={3}
              value={anythingElse}
              onChange={e => setAnythingElse(e.target.value)}
              placeholder="Additional context, questions, or information..."
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-[#233DFF]/30 font-medium text-sm resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 min-h-[44px] border border-zinc-200 text-zinc-700 font-black uppercase tracking-wider rounded-full text-sm hover:bg-zinc-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!canProceedStep3}
              className="flex-1 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Brand Assets */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-black text-zinc-900 mb-1">Brand Assets</h2>
            <p className="text-sm text-zinc-500 font-medium">Optional — helps HMC represent your org accurately in co-marketing.</p>
            <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700 leading-relaxed">
              <strong>All fields use links — no file upload.</strong> To share your logo or brand guide: upload to <strong>Canva</strong> (Share → Copy link), <strong>Google Drive</strong> (Share → Anyone with the link → Copy), or <strong>Dropbox</strong> (share link, change <code>dl=0</code> to <code>raw=1</code>). Paste the public link below.
            </div>
          </div>
          <div>
            <label className={labelCls}>Logo URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={e => { setLogoUrl(e.target.value); setLogoPreviewOk(false); }}
              className={inputCls}
              placeholder="https://example.com/logo.png — or paste a Canva/Drive/Dropbox link"
            />
            {logoUrl && (
              <div className="mt-2 p-3 bg-zinc-50 border border-zinc-100 rounded-2xl inline-block">
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-10 max-w-[160px] object-contain"
                  onLoad={() => setLogoPreviewOk(true)}
                  onError={() => setLogoPreviewOk(false)}
                />
                {!logoPreviewOk && <p className="text-[11px] text-zinc-400 font-medium mt-1">Preview not available</p>}
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Brand Guidelines URL (optional)</label>
            <input
              type="url"
              value={brandGuidelinesUrl}
              onChange={e => setBrandGuidelinesUrl(e.target.value)}
              className={inputCls}
              placeholder="https://example.com/brand-guide.pdf"
            />
          </div>
          <div>
            <label className={labelCls}>Primary Brand Color (optional)</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="w-12 h-12 rounded-xl border-2 border-zinc-100 cursor-pointer bg-zinc-50 p-1"
              />
              <span className="text-sm font-bold text-zinc-600">{primaryColor}</span>
            </div>
          </div>
          {submitError && <p className="text-rose-500 text-sm font-medium">{submitError}</p>}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(3)}
              className="flex-1 min-h-[44px] border border-zinc-200 text-zinc-700 font-black uppercase tracking-wider rounded-full text-sm hover:bg-zinc-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={14} /> Submit Application</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Community Board
// ─────────────────────────────────────────────────────────────────────────────

const BULLETIN_FILTERS = [
  { key: '', label: 'All' },
  { key: 'vendor_seeking', label: 'Vendor Needed' },
  { key: 'opportunity', label: 'Opportunities' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'subcontract_available', label: 'Subcontract' },
  { key: 'event_collab', label: 'Event Collab' },
];

const NewPostModal: React.FC<{
  defaultEmail: string;
  onClose: () => void;
  onPosted: () => void;
}> = ({ defaultEmail, onClose, onPosted }) => {
  const [type, setType] = useState('announcement');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [contactName, setContactName] = useState('');
  const [expires, setExpires] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !contactEmail.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await apiService.post('/api/partner/bulletin', {
        type,
        title,
        description,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        contactEmail,
        contactName: contactName || undefined,
        expiresAt: expires || undefined,
      });
      onPosted();
    } catch {
      setError('Failed to post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 sticky top-0 bg-white">
          <h2 className="font-black text-zinc-900">New Post</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Type *</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className={inputCls}
            >
              {Object.entries(BULLETIN_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className={inputCls}
              placeholder="Brief, descriptive title"
            />
          </div>
          <div>
            <label className={labelCls}>Description *</label>
            <textarea
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-[#233DFF]/30 font-medium text-sm resize-none"
              placeholder="Describe the opportunity, need, or announcement..."
            />
          </div>
          <div>
            <label className={labelCls}>Tags (comma-separated, optional)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className={inputCls}
              placeholder="mental health, housing, youth"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Contact Email *</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Contact Name (optional)</label>
              <input
                type="text"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Expires (optional)</label>
            <input
              type="date"
              value={expires}
              onChange={e => setExpires(e.target.value)}
              className={inputCls}
            />
          </div>
          {error && <p className="text-rose-500 text-xs font-medium">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] border border-zinc-200 text-zinc-700 font-black uppercase tracking-wider rounded-full text-sm hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim() || !contactEmail.trim()}
              className="flex-1 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const BulletinCard: React.FC<{ post: BulletinPost; owned?: boolean; onDelete?: () => void }> = ({ post, owned, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const MAX_LEN = 150;
  const isLong = post.description.length > MAX_LEN;
  const displayText = expanded || !isLong ? post.description : post.description.slice(0, MAX_LEN) + '...';
  const typeLabel = BULLETIN_TYPE_LABELS[post.type] || post.type;
  const typeCls = BULLETIN_TYPE_COLORS[post.type] || 'bg-zinc-100 text-zinc-600';

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await apiService.delete(`/api/partner/bulletin/${post.id}`);
      onDelete();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className={`p-4 bg-white border rounded-2xl transition-all ${owned ? 'border-zinc-200' : 'border-zinc-100'}`}>
      <div className="flex items-start gap-3 mb-3">
        {post.orgLogoUrl ? (
          <img src={post.orgLogoUrl} alt={post.orgName} className="w-8 h-8 rounded-lg object-contain bg-zinc-50 border border-zinc-100 flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-zinc-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-bold text-zinc-900 text-sm truncate">{post.orgName}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex-shrink-0 ${typeCls}`}>{typeLabel}</span>
            {owned && !post.active && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-zinc-100 text-zinc-500 flex-shrink-0">Inactive</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 font-medium">{formatDate(post.postedAt)}</p>
        </div>
        {owned && onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-zinc-300 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors flex-shrink-0"
            aria-label="Delete post"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
      <h3 className="font-black text-zinc-900 text-sm mb-1.5">{post.title}</h3>
      <p className="text-sm text-zinc-600 font-medium leading-relaxed">
        {displayText}
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="ml-1 text-[#233DFF] font-bold text-xs hover:underline"
          >
            {expanded ? 'show less' : 'read more'}
          </button>
        )}
      </p>
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {post.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-zinc-50 border border-zinc-100 rounded-full text-[10px] font-bold text-zinc-500">{tag}</span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <a
          href={`mailto:${post.contactEmail}`}
          className="flex items-center gap-1.5 text-xs font-black text-[#233DFF] hover:underline uppercase tracking-wider"
        >
          <Mail size={12} /> {post.contactName ? `Contact ${post.contactName}` : 'Contact'}
        </a>
      </div>
    </div>
  );
};

const CommunityBoardTab: React.FC = () => {
  const [publicPosts, setPublicPosts] = useState<BulletinPost[]>([]);
  const [myPosts, setMyPosts] = useState<BulletinPost[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);
  const [filter, setFilter] = useState('');
  const [showNewPost, setShowNewPost] = useState(false);
  const [partnerEmail, setPartnerEmail] = useState('');

  const loadPublic = () => {
    setLoadingPublic(true);
    apiService.get('/api/bulletin')
      .then((data: any) => setPublicPosts(Array.isArray(data) ? data : []))
      .catch(() => setPublicPosts([]))
      .finally(() => setLoadingPublic(false));
  };

  const loadMine = () => {
    setLoadingMine(true);
    apiService.get('/api/partner/bulletin')
      .then((data: any) => setMyPosts(Array.isArray(data) ? data : []))
      .catch(() => setMyPosts([]))
      .finally(() => setLoadingMine(false));
  };

  useEffect(() => {
    loadPublic();
    loadMine();
    apiService.get('/api/partner/profile').then((d: any) => {
      if (d?.contactEmail) setPartnerEmail(d.contactEmail);
    }).catch(() => {});
  }, []);

  const filtered = filter ? publicPosts.filter(p => p.type === filter) : publicPosts;

  return (
    <div className="p-4 md:p-6 space-y-8">
      {/* Browse Posts */}
      <div>
        <h2 className="text-base font-black text-zinc-900 mb-4">Browse Posts</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {BULLETIN_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-colors ${
                filter === f.key
                  ? 'bg-[#233DFF] text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {loadingPublic ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-zinc-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-6 bg-zinc-50 rounded-2xl border border-zinc-100">
            <MessageSquare size={32} className="mx-auto text-zinc-200 mb-3" />
            <p className="font-black text-zinc-400 text-sm">No posts yet. Be the first to post.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(post => (
              <BulletinCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      {/* My Posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-zinc-900">My Posts</h2>
          <button
            onClick={() => setShowNewPost(true)}
            className="flex items-center gap-1.5 px-4 py-2 min-h-[36px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-xs hover:bg-[#1a2de0] transition-colors"
          >
            <Plus size={13} /> New Post
          </button>
        </div>
        {loadingMine ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-zinc-300" />
          </div>
        ) : myPosts.length === 0 ? (
          <div className="text-center py-10 px-6 bg-zinc-50 rounded-2xl border border-zinc-100">
            <p className="font-black text-zinc-400 text-sm">No posts yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myPosts.map(post => (
              <BulletinCard
                key={post.id}
                post={post}
                owned
                onDelete={loadMine}
              />
            ))}
          </div>
        )}
      </div>

      {showNewPost && (
        <NewPostModal
          defaultEmail={partnerEmail}
          onClose={() => setShowNewPost(false)}
          onPosted={() => { setShowNewPost(false); loadMine(); loadPublic(); }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Events
// ─────────────────────────────────────────────────────────────────────────────

// GAS URL for partner event submissions — same endpoint as the public Event Finder partner form
const PARTNER_EVENT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbz98ofEpj4SyQPXPer7qY8F04IFweCIv3s_MtGuHtU5OhmSUURgfEuBlQ5I-D8tily1TA/exec';

const EventsTab: React.FC = () => {
  // Profile state (for pre-filling org name and email)
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [flyerLink, setFlyerLink] = useState('');
  const [attachBanner, setAttachBanner] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerLinkUrl, setBannerLinkUrl] = useState('');
  const [rsvpNotify, setRsvpNotify] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    apiService.get('/api/partner/profile')
      .then((data: any) => {
        setProfile(data);
        if (data?.contactEmail) setNotifyEmail(data.contactEmail);
      })
      .catch(() => {})
      .finally(() => setProfileLoaded(true));
  }, []);

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    proposedDate.length > 0 &&
    eventTime.trim().length > 0 &&
    location.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // Submit directly to GAS using the same action + no-cors pattern as the public partner form.
      // GAS always throws a CORS error even on success — use no-cors to bypass.
      // The browser sends the request without reading the response; GAS receives and processes it normally.
      const params = new URLSearchParams({
        action: 'partner_request',
        name: profile?.contactName || profile?.name || '',
        email: profile?.contactEmail || '',
        organization: profile?.name || '',
        eventTitle: title.trim(),
        eventDescription: description.trim(),
        proposedDate,
        eventTime: eventTime.trim(),
        location: location.trim(),
        flyerUrl: flyerLink.trim() || '',
        lang: 'en',
        timestamp: new Date().toISOString(),
      });
      if (rsvpNotify && notifyEmail.trim()) {
        params.set('notificationEmail', notifyEmail.trim());
      }
      if (attachBanner && bannerImageUrl.trim()) {
        params.set('bannerImageUrl', bannerImageUrl.trim());
      }
      if (attachBanner && bannerLinkUrl.trim()) {
        params.set('bannerLinkUrl', bannerLinkUrl.trim());
      }
      await fetch(`${PARTNER_EVENT_GAS_URL}?${params.toString()}`, {
        method: 'GET',
        mode: 'no-cors',
      });
      // Can't read response body with no-cors — optimistically show success (same as PartnerModal.tsx)
      setSubmitted(true);
    } catch {
      setSubmitError('Submission failed. Please try again or contact partner@healthmatters.clinic.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setProposedDate('');
    setEventTime('');
    setLocation('');
    setFlyerLink('');
    setAttachBanner(false);
    setBannerImageUrl('');
    setBannerLinkUrl('');
    setRsvpNotify(false);
    setNotifyEmail(profile?.contactEmail || '');
    setSubmitted(false);
    setSubmitError('');
  };

  if (!profileLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-10">
      {/* Section 1: Submit Your Event */}
      <div>
        <div className="mb-6">
          <h2 className="text-base font-black text-zinc-900">Submit Your Event</h2>
          <p className="text-sm text-zinc-500 font-medium mt-1">
            Submit a community event for listing on the HMC Event Finder. HMC will review and approve within 48 hours.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-4">
            <CheckCircle size={40} className="mx-auto text-emerald-500" />
            <h3 className="font-black text-zinc-900 text-lg">Event Submitted</h3>
            <p className="text-sm text-zinc-600 font-medium leading-relaxed">
              Your event has been submitted for review. HMC will notify you within 48 hours.
            </p>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[40px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-xs hover:bg-[#1a2de0] transition-colors"
            >
              <Plus size={13} /> Submit Another Event
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Organization (read-only, pre-filled) */}
            <div>
              <label className={labelCls}>Submitting Organization</label>
              <input
                type="text"
                value={profile?.name || ''}
                readOnly
                className="w-full p-4 bg-zinc-100 border-2 border-zinc-100 rounded-2xl font-bold text-sm text-zinc-500 cursor-not-allowed"
              />
            </div>

            {/* Event Title */}
            <div>
              <label className={labelCls}>Event Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className={inputCls}
                placeholder="Name of your event"
              />
            </div>

            {/* Event Description */}
            <div>
              <label className={labelCls}>Event Description *</label>
              <textarea
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-[#233DFF]/30 font-medium text-sm resize-none"
                placeholder="Describe the event, who it's for, and what attendees can expect..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Proposed Date */}
              <div>
                <label className={labelCls}>Proposed Date *</label>
                <input
                  type="date"
                  value={proposedDate}
                  onChange={e => setProposedDate(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>

              {/* Event Time */}
              <div>
                <label className={labelCls}>Event Time *</label>
                <input
                  type="text"
                  value={eventTime}
                  onChange={e => setEventTime(e.target.value)}
                  required
                  className={inputCls}
                  placeholder="e.g. 10:00 AM - 2:00 PM"
                />
              </div>
            </div>

            {/* Event Location */}
            <div>
              <label className={labelCls}>Event Location *</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                required
                className={inputCls}
                placeholder="Street address, City, State, ZIP"
              />
            </div>

            {/* Flyer Link */}
            <div>
              <label className={labelCls}>Flyer Link <span className="font-normal normal-case text-zinc-400">— optional</span></label>
              <input
                type="url"
                value={flyerLink}
                onChange={e => setFlyerLink(e.target.value)}
                className={inputCls}
                placeholder="https://"
              />
              <p className="text-[10px] text-zinc-400 font-medium mt-1.5">
                Upload to Canva or Google Drive and paste the public link.
              </p>
            </div>

            {/* Sponsor Banner (optional) */}
            <div className="p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={attachBanner}
                    onChange={e => setAttachBanner(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-10 h-6 rounded-full transition-colors ${attachBanner ? 'bg-[#233DFF]' : 'bg-zinc-300'}`} />
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${attachBanner ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="font-black text-zinc-900 text-sm">Attach a sponsor banner to this event listing</span>
              </label>

              {attachBanner && (
                <div className="space-y-3 pt-1">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700 leading-relaxed">
                    Banners are reviewed by HMC before going live alongside your event.
                  </div>
                  <div>
                    <label className={labelCls}>Banner Image URL <span className="font-normal normal-case text-zinc-400">— 728x90px recommended</span></label>
                    <input
                      type="url"
                      value={bannerImageUrl}
                      onChange={e => setBannerImageUrl(e.target.value)}
                      className={inputCls}
                      placeholder="Canva/Drive/Dropbox public link to your banner image"
                    />
                    <p className="text-[10px] text-zinc-400 font-medium mt-1.5">
                      Upload to Canva (Share link) or Google Drive (Anyone with link) and paste the public URL. Recommended size: 728x90px.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Banner Link URL <span className="font-normal normal-case text-zinc-400">— optional</span></label>
                    <input
                      type="url"
                      value={bannerLinkUrl}
                      onChange={e => setBannerLinkUrl(e.target.value)}
                      className={inputCls}
                      placeholder="Where clicking the banner goes, e.g. your website"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* RSVP Notification Toggle */}
            <div className="p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={rsvpNotify}
                    onChange={e => setRsvpNotify(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-10 h-6 rounded-full transition-colors ${rsvpNotify ? 'bg-[#233DFF]' : 'bg-zinc-300'}`} />
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${rsvpNotify ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="font-black text-zinc-900 text-sm">Notify me when someone RSVPs</span>
              </label>

              {rsvpNotify && (
                <div>
                  <label className={labelCls}>Notification Email</label>
                  <input
                    type="email"
                    value={notifyEmail}
                    onChange={e => setNotifyEmail(e.target.value)}
                    className={inputCls}
                    placeholder="your@email.com"
                  />
                  <p className="text-[10px] text-zinc-400 font-medium mt-1.5 leading-relaxed">
                    RSVPs will be tracked through HMC's system. You'll receive an email for each registration.
                  </p>
                </div>
              )}
            </div>

            {submitError && (
              <p className="text-rose-500 text-sm font-medium">{submitError}</p>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="flex items-center gap-2 px-6 py-3 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                  : <><Calendar size={14} /> Submit Event for Review</>
                }
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Section 2: Your Submitted Events */}
      <div>
        <h2 className="text-base font-black text-zinc-900 mb-3">Your Submitted Events</h2>
        <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-2xl space-y-2">
          <p className="text-sm text-zinc-600 font-medium leading-relaxed">
            Your submitted events appear in the Event Finder after HMC review. Track your events at{' '}
            <a
              href="https://eventfinder.healthmatters.clinic"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#233DFF] font-bold hover:underline inline-flex items-center gap-1"
            >
              eventfinder.healthmatters.clinic <ExternalLink size={11} />
            </a>
          </p>
          <p className="text-xs text-zinc-400 font-medium">
            Contact <a href="mailto:partner@healthmatters.clinic" className="text-[#233DFF] hover:underline">partner@healthmatters.clinic</a> if you need to update or remove a listed event.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Agreements
// ─────────────────────────────────────────────────────────────────────────────

const SignModal: React.FC<{
  agreement: Agreement;
  onClose: () => void;
  onSigned: () => void;
}> = ({ agreement, onClose, onSigned }) => {
  const [sigName, setSigName] = useState('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [signedDate, setSignedDate] = useState('');

  const handleSign = async () => {
    if (!sigName.trim()) return;
    setSigning(true);
    setError('');
    try {
      await apiService.post(`/api/partner/agreements/${agreement.id}/sign`, { signatureName: sigName });
      setSignedDate(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      setTimeout(() => { onSigned(); }, 1500);
    } catch {
      setError('Failed to sign. Please try again.');
      setSigning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <h2 className="font-black text-zinc-900">{agreement.title}</h2>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">Sent {formatDate(agreement.sentAt)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div
            className="max-h-[400px] overflow-y-auto p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm text-zinc-700 font-medium leading-relaxed whitespace-pre-wrap"
          >
            {agreement.bodyText}
          </div>
          {signedDate ? (
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <CheckCircle size={16} /> Signed on {signedDate}
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-500 font-medium">
                By typing your name and clicking Sign, you agree to the terms above.
              </p>
              <div>
                <label className={labelCls}>Your full name *</label>
                <input
                  type="text"
                  value={sigName}
                  onChange={e => setSigName(e.target.value)}
                  placeholder="Type your legal name"
                  className={inputCls}
                />
              </div>
              {error && <p className="text-rose-500 text-xs font-medium">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 min-h-[44px] border border-zinc-200 text-zinc-700 font-black uppercase tracking-wider rounded-full text-sm hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSign}
                  disabled={signing || !sigName.trim()}
                  className="flex-1 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {signing ? <Loader2 size={16} className="animate-spin" /> : <><FileText size={14} /> Sign Agreement</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const AgreementsTab: React.FC = () => {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingAgreement, setSigningAgreement] = useState<Agreement | null>(null);
  const [printAgreement, setPrintAgreement] = useState<Agreement | null>(null);

  const load = () => {
    setLoading(true);
    apiService.get('/api/partner/agreements')
      .then((data: any) => setAgreements(Array.isArray(data) ? data : []))
      .catch(() => setAgreements([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const pending = agreements.filter(a => a.status === 'pending_signature');
  const signed = agreements.filter(a => a.status === 'signed');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-zinc-300" />
      </div>
    );
  }

  if (agreements.length === 0) {
    return (
      <div className="text-center py-20 px-6">
        <FileText size={40} className="mx-auto text-zinc-200 mb-4" />
        <p className="font-black text-zinc-400 text-base">No agreements yet.</p>
        <p className="text-sm text-zinc-400 font-medium mt-2">HMC will send agreements here once your partnership application is reviewed.</p>
      </div>
    );
  }

  const handlePrint = (a: Agreement) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>${a.title}</title><style>
        body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 0 24px; line-height: 1.7; color: #111; }
        h1 { font-size: 22px; margin-bottom: 8px; }
        .meta { font-size: 13px; color: #666; margin-bottom: 24px; }
        .body { white-space: pre-wrap; font-size: 14px; }
        .sig { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ccc; font-size: 14px; }
      </style></head><body>
        <h1>${a.title}</h1>
        <div class="meta">Sent: ${formatDate(a.sentAt)}${a.signedAt ? ` | Signed: ${formatDate(a.signedAt)}` : ''}</div>
        <div class="body">${a.bodyText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        ${a.signatureName ? `<div class="sig"><strong>Signed by:</strong> ${a.signatureName}<br><strong>Date:</strong> ${a.signedAt ? formatDate(a.signedAt) : ''}</div>` : ''}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-8">
      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-base font-black text-zinc-900 mb-4">Pending Signature</h2>
          <div className="space-y-3">
            {pending.map(a => (
              <div key={a.id} className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-zinc-900 text-sm mb-0.5">{a.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black">{a.type}</span>
                    <span className="text-[11px] text-zinc-400 font-medium">Sent {formatDate(a.sentAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSigningAgreement(a)}
                  className="flex-shrink-0 px-4 py-2 min-h-[36px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-xs hover:bg-[#1a2de0] transition-colors"
                >
                  View and Sign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signed */}
      {signed.length > 0 && (
        <div>
          <h2 className="text-base font-black text-zinc-900 mb-4">Signed Agreements</h2>
          <div className="space-y-3">
            {signed.map(a => (
              <div key={a.id} className="p-4 bg-white border border-zinc-100 rounded-2xl flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-zinc-900 text-sm mb-0.5">{a.title}</p>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    Signed {a.signedAt ? formatDate(a.signedAt) : ''}
                    {a.signatureName && <> by <span className="font-bold">{a.signatureName}</span></>}
                  </p>
                </div>
                <button
                  onClick={() => handlePrint(a)}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-black text-zinc-500 hover:text-zinc-900 uppercase tracking-wider transition-colors"
                >
                  <Printer size={13} /> Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {signingAgreement && (
        <SignModal
          agreement={signingAgreement}
          onClose={() => setSigningAgreement(null)}
          onSigned={() => { setSigningAgreement(null); load(); }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Brand Assets
// ─────────────────────────────────────────────────────────────────────────────

const BrandAssetsTab: React.FC = () => {
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [brandGuidelinesUrl, setBrandGuidelinesUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#233DFF');
  const [logoOk, setLogoOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiService.get('/api/partner/profile')
      .then((data: any) => {
        setProfile(data);
        setLogoUrl(data?.logoUrl || '');
        setBrandGuidelinesUrl(data?.brandGuidelinesUrl || '');
        setPrimaryColor(data?.primaryColor || '#233DFF');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await apiService.put('/api/partner/profile', { logoUrl, brandGuidelinesUrl, primaryColor });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-zinc-300" />
      </div>
    );
  }

  const orgName = profile?.name || 'Your Organization';
  const partnershipTypes = profile?.partnershipTypes || [];
  const primaryTypeLabel = partnershipTypes.length > 0
    ? (PARTNERSHIP_TYPES.find(p => p.id === partnershipTypes[0])?.label || partnershipTypes[0])
    : 'Community Partner';

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-8">
      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <h2 className="text-base font-black text-zinc-900">Brand Information</h2>
        <div>
          <label className={labelCls}>Logo URL</label>
          <input
            type="url"
            value={logoUrl}
            onChange={e => { setLogoUrl(e.target.value); setLogoOk(false); }}
            className={inputCls}
            placeholder="https://example.com/logo.png"
          />
          {logoUrl && (
            <div className="mt-2 p-3 w-fit bg-zinc-50 border border-zinc-100 rounded-2xl">
              <img
                src={logoUrl}
                alt="Logo preview"
                className="h-[60px] max-w-[120px] object-contain"
                onLoad={() => setLogoOk(true)}
                onError={() => setLogoOk(false)}
              />
              {!logoOk && <p className="text-[11px] text-zinc-400 font-medium mt-1">Preview not available</p>}
            </div>
          )}
        </div>
        <div>
          <label className={labelCls}>Brand Guidelines URL</label>
          <input
            type="url"
            value={brandGuidelinesUrl}
            onChange={e => setBrandGuidelinesUrl(e.target.value)}
            className={inputCls}
            placeholder="https://example.com/brand-guide.pdf"
          />
        </div>
        <div>
          <label className={labelCls}>Primary Brand Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={e => setPrimaryColor(e.target.value)}
              className="w-12 h-12 rounded-xl border-2 border-zinc-100 cursor-pointer bg-zinc-50 p-1"
            />
            <span className="text-sm font-bold text-zinc-600">{primaryColor}</span>
          </div>
        </div>
        {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 min-h-[44px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#1a2de0] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={14} /> Save</>}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-bold">
              <CheckCircle size={15} /> Saved
            </span>
          )}
        </div>
      </form>

      {/* Co-Marketing Preview */}
      <div>
        <h2 className="text-base font-black text-zinc-900 mb-4">Co-Marketing Preview</h2>
        <p className="text-sm text-zinc-400 font-medium mb-4">How your organization appears as an HMC partner.</p>
        <div className="inline-flex items-center gap-3 p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm">
          {logoUrl && logoOk ? (
            <img src={logoUrl} alt={orgName} className="w-10 h-10 rounded-lg object-contain bg-zinc-50 border border-zinc-100" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center border-2" style={{ borderColor: primaryColor, background: `${primaryColor}18` }}>
              <Building2 size={18} style={{ color: primaryColor }} />
            </div>
          )}
          <div>
            <p className="font-black text-zinc-900 text-sm">{orgName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-zinc-100 text-zinc-600">{primaryTypeLabel}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">HMC Partner</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main PartnerPortalView
// ─────────────────────────────────────────────────────────────────────────────

const PartnerPortalView: React.FC<PartnerPortalProps> = ({ onBackToLanding }) => {
  const [activeTab, setActiveTab] = useState<PortalTab>('referrals');
  const [orgName, setOrgName] = useState<string>('');

  useEffect(() => {
    apiService.get('/api/partner/profile')
      .then((data: any) => setOrgName(data?.name || 'Partner Organization'))
      .catch(() => setOrgName('Partner Organization'));
  }, []);

  const tabs: { id: PortalTab; label: string; Icon: React.ElementType; mobileLabel: string }[] = [
    { id: 'referrals',     label: 'Referrals',       mobileLabel: 'Referrals',  Icon: Inbox },
    { id: 'organization',  label: 'Our Organization', mobileLabel: 'Org',        Icon: Building2 },
    { id: 'performance',   label: 'Performance',      mobileLabel: 'Stats',      Icon: BarChart2 },
    { id: 'apply',         label: 'Apply',            mobileLabel: 'Apply',      Icon: ClipboardList },
    { id: 'community',     label: 'Community Board',  mobileLabel: 'Board',      Icon: MessageSquare },
    { id: 'events',        label: 'Events',           mobileLabel: 'Events',     Icon: Calendar },
    { id: 'agreements',    label: 'Agreements',       mobileLabel: 'Agreements', Icon: FileText },
    { id: 'brand',         label: 'Brand Assets',     mobileLabel: 'Brand',      Icon: Palette },
  ];

  const handleLogout = async () => {
    try {
      await apiService.post('/auth/logout', {});
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('authToken');
      onBackToLanding();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-['Inter'] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1a1a2e] border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={APP_CONFIG.BRAND.logoUrl} alt="Health Matters Clinic" className="w-7 h-7 rounded-lg" />
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">Partner Portal</p>
              <p className="text-sm font-black text-white leading-tight">{orgName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] border border-white/20 text-white/70 hover:text-white hover:border-white/40 font-bold rounded-full text-xs uppercase tracking-wider transition-colors"
          >
            <LogOut size={13} /> Log Out
          </button>
        </div>

        {/* Tab nav — desktop only (sm and up) */}
        <div className="max-w-4xl mx-auto px-4 hidden sm:flex border-t border-white/10 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-[#233DFF]'
                  : 'text-white/40 hover:text-white/70 border-b-2 border-transparent'
              }`}
            >
              <tab.Icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        {activeTab === 'referrals'    && <ReferralsTab />}
        {activeTab === 'organization' && <OrganizationTab />}
        {activeTab === 'performance'  && <PerformanceTab />}
        {activeTab === 'apply'        && <ApplyTab />}
        {activeTab === 'community'    && <CommunityBoardTab />}
        {activeTab === 'events'       && <EventsTab />}
        {activeTab === 'agreements'   && <AgreementsTab />}
        {activeTab === 'brand'        && <BrandAssetsTab />}
      </main>

      {/* Mobile bottom nav — icon + short label, scrollable */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a1a2e] border-t border-white/10 sm:hidden">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-3 text-[9px] font-black uppercase tracking-wider transition-colors ${
                activeTab === tab.id ? 'text-white' : 'text-white/40'
              }`}
            >
              <tab.Icon size={18} />
              {tab.mobileLabel}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default PartnerPortalView;
