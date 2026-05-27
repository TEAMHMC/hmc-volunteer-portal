import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import {
  Building2, FileText, BarChart3, LogOut, Loader2, ChevronDown,
  CheckCircle, AlertTriangle, Clock, X, ChevronRight, Award,
  Phone, Mail, Globe, MapPin, Save, Activity,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PortalTab = 'referrals' | 'organization' | 'performance';

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

  const tabs: { id: PortalTab; label: string; Icon: React.ElementType }[] = [
    { id: 'referrals', label: 'Referrals', Icon: FileText },
    { id: 'organization', label: 'Our Organization', Icon: Building2 },
    { id: 'performance', label: 'Performance', Icon: BarChart3 },
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

        {/* Tab nav */}
        <div className="max-w-4xl mx-auto px-4 flex border-t border-white/10">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-1.5 px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-[#233DFF]'
                  : 'text-white/40 hover:text-white/70 border-b-2 border-transparent'
              }`}
            >
              <tab.Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        {activeTab === 'referrals' && <ReferralsTab />}
        {activeTab === 'organization' && <OrganizationTab />}
        {activeTab === 'performance' && <PerformanceTab />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a1a2e] border-t border-white/10 sm:hidden">
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-black uppercase tracking-wider transition-colors ${
                activeTab === tab.id ? 'text-white' : 'text-white/40'
              }`}
            >
              <tab.Icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default PartnerPortalView;
