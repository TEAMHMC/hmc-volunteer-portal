import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  ClipboardList,
  CheckCircle,
  X,
  Clock,
  AlertTriangle,
  Mail,
  Building2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Send,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { apiService } from '../services/apiService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AdminApplication {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  partnershipTypes: string[];
  reviewNotes?: string;
  orgName?: string;
  contactEmail?: string;
  servicesOffered?: string;
  referralCategories?: string[];
}

interface AdminPartner {
  id: string;
  name: string;
  contactEmail?: string;
  partnershipTypes?: string[];
  portalUserEmail?: string;
  referralCategories?: string[];
  servicesProvided?: string[];
}

type PanelTab = 'applications' | 'partners';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const labelCls = 'text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2';

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const PARTNERSHIP_TYPE_LABELS: Record<string, string> = {
  official_referral: 'Official Referral Partner',
  event_vendor: 'Event Vendor / Co-host',
  subcontractor: 'Subcontractor',
  community: 'General Community Partner',
};

const REFERRAL_CATEGORY_LABELS: Record<string, string> = {
  healthcare: 'Healthcare / Medical',
  mentalHealth: 'Mental Health & Behavioral Health',
  substanceUse: 'Substance Use Treatment',
  housing: 'Housing & Shelter',
  food: 'Food & Nutrition',
  employment: 'Employment & Job Training',
  legal: 'Legal Aid & Immigration',
  childcare: 'Childcare & Child Services',
  transportation: 'Transportation',
  hivSexualHealth: 'HIV / Sexual Health',
};

// ─────────────────────────────────────────────────────────────────────────────
// ApplicationsTab
// ─────────────────────────────────────────────────────────────────────────────

const ApplicationsTab: React.FC = () => {
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.get('/api/admin/partner-applications');
      setApplications(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load partner applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const handleApprove = async (app: AdminApplication) => {
    setProcessingId(app.id);
    try {
      await apiService.put(`/api/admin/partner-applications/${app.id}/review`, {
        status: 'approved',
        approvedTypes: app.partnershipTypes,
      });
      await fetchApplications();
    } catch (err: any) {
      alert(err?.message || 'Approval failed. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (app: AdminApplication) => {
    const note = window.prompt('Enter a review note for the applicant (optional):');
    if (note === null) return; // cancelled
    setProcessingId(app.id);
    try {
      await apiService.put(`/api/admin/partner-applications/${app.id}/review`, {
        status: 'rejected',
        reviewNotes: note || undefined,
      });
      await fetchApplications();
    } catch (err: any) {
      alert(err?.message || 'Rejection failed. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-zinc-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3">
        <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
        <p className="text-sm font-medium text-red-700">{error}</p>
      </div>
    );
  }

  const pending = applications.filter(a => a.status === 'pending');
  const others = applications.filter(a => a.status !== 'pending');

  const statusConfig = {
    pending: { badge: 'bg-amber-100 text-amber-700', label: 'Pending', icon: <Clock size={12} className="text-amber-600" /> },
    approved: { badge: 'bg-emerald-100 text-emerald-700', label: 'Approved', icon: <CheckCircle size={12} className="text-emerald-600" /> },
    rejected: { badge: 'bg-red-100 text-red-700', label: 'Rejected', icon: <X size={12} className="text-red-500" /> },
  };

  const ApplicationRow = ({ app }: { app: AdminApplication }) => {
    const cfg = statusConfig[app.status];
    const isPending = app.status === 'pending';
    const isProcessing = processingId === app.id;
    return (
      <div className={`p-5 rounded-2xl border ${isPending ? 'border-amber-200 bg-amber-50/30' : 'border-zinc-100 bg-white'}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 size={14} className="text-zinc-400 shrink-0" />
              <span className="font-black text-zinc-900 text-sm">{app.orgName || 'Unknown Organization'}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${cfg.badge}`}>
                {cfg.icon}
                {cfg.label}
              </span>
            </div>
            {app.contactEmail && (
              <p className="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
                <Mail size={11} className="text-zinc-400" />
                {app.contactEmail}
              </p>
            )}
            <p className="text-[10px] text-zinc-400 font-medium">Submitted {formatDate(app.submittedAt)}</p>
            {app.partnershipTypes?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {app.partnershipTypes.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-[#233dff]/10 text-[#233dff] rounded-full text-[10px] font-bold">
                    {PARTNERSHIP_TYPE_LABELS[t] || t}
                  </span>
                ))}
              </div>
            )}
            {app.referralCategories && app.referralCategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {app.referralCategories.map(k => (
                  <span key={k} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full text-[10px] font-bold">
                    {REFERRAL_CATEGORY_LABELS[k] || k}
                  </span>
                ))}
              </div>
            )}
            {app.reviewNotes && (
              <p className="text-xs text-zinc-500 font-medium italic mt-1">{app.reviewNotes}</p>
            )}
          </div>
          {isPending && (
            <div className="flex gap-2 shrink-0 sm:ml-4">
              <button
                onClick={() => handleApprove(app)}
                disabled={!!isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#233dff] text-white text-xs font-black uppercase tracking-wider rounded-full hover:bg-[#1a2de0] disabled:opacity-40 transition-colors"
              >
                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Approve
              </button>
              <button
                onClick={() => handleReject(app)}
                disabled={!!isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-xs font-black uppercase tracking-wider rounded-full hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className={labelCls + ' mb-0'}>Pending Review</p>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black">{pending.length}</span>
          </div>
          {pending.map(app => <ApplicationRow key={app.id} app={app} />)}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-3">
          <p className={labelCls}>Reviewed</p>
          {others.map(app => <ApplicationRow key={app.id} app={app} />)}
        </div>
      )}
      {applications.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-black text-sm uppercase tracking-widest">No Applications</p>
          <p className="text-xs font-medium mt-1">Partner applications will appear here when submitted.</p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PartnersTab
// ─────────────────────────────────────────────────────────────────────────────

const PartnersTab: React.FC = () => {
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.get('/api/partners');
      setPartners(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load partners.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const handleSendInvite = async (partner: AdminPartner) => {
    setInvitingId(partner.id);
    try {
      await apiService.post(`/api/partners/${partner.id}/invite`, {});
      alert(`Invite sent to ${partner.name}.`);
      await fetchPartners();
    } catch (err: any) {
      alert(err?.message || 'Failed to send invite. Please try again.');
    } finally {
      setInvitingId(null);
    }
  };

  const handleRemove = async (partner: AdminPartner) => {
    if (!window.confirm(`Remove ${partner.name} from the partner network? This cannot be undone.`)) return;
    setRemovingId(partner.id);
    try {
      await apiService.delete(`/api/partners/${partner.id}`);
      await fetchPartners();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove partner.');
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-zinc-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3">
        <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
        <p className="text-sm font-medium text-red-700">{error}</p>
      </div>
    );
  }

  if (partners.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400">
        <Users size={36} className="mx-auto mb-3 opacity-40" />
        <p className="font-black text-sm uppercase tracking-widest">No Active Partners</p>
        <p className="text-xs font-medium mt-1">Approved partner organizations will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {partners.map(partner => {
        const isExpanded = expandedId === partner.id;
        const hasPortal = !!partner.portalUserEmail;
        const isInviting = invitingId === partner.id;
        return (
          <div key={partner.id} className="rounded-2xl border border-zinc-100 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : partner.id)}
              className="w-full text-left p-5 flex items-center gap-3 hover:bg-zinc-50/50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                <Building2 size={16} className="text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-zinc-900 text-sm truncate">{partner.name}</p>
                {partner.contactEmail && (
                  <p className="text-xs text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                    <Mail size={10} />
                    {partner.contactEmail}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasPortal ? (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black">Portal Active</span>
                ) : (
                  <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full text-[10px] font-black">No Portal Account</span>
                )}
                {isExpanded
                  ? <ChevronDown size={14} className="text-zinc-400" />
                  : <ChevronRight size={14} className="text-zinc-400" />
                }
              </div>
            </button>
            {isExpanded && (
              <div className="px-5 pb-5 space-y-4 border-t border-zinc-100 pt-4">
                {partner.partnershipTypes && partner.partnershipTypes.length > 0 && (
                  <div>
                    <p className={labelCls}>Partnership Types</p>
                    <div className="flex flex-wrap gap-1.5">
                      {partner.partnershipTypes.map(t => (
                        <span key={t} className="px-2 py-0.5 bg-[#233dff]/10 text-[#233dff] rounded-full text-[10px] font-bold">
                          {PARTNERSHIP_TYPE_LABELS[t] || t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {partner.referralCategories && partner.referralCategories.length > 0 && (
                  <div>
                    <p className={labelCls}>Referral Categories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {partner.referralCategories.map(k => (
                        <span key={k} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full text-[10px] font-bold">
                          {REFERRAL_CATEGORY_LABELS[k] || k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {partner.servicesProvided && partner.servicesProvided.length > 0 && (
                  <div>
                    <p className={labelCls}>Services</p>
                    <p className="text-xs text-zinc-600 font-medium leading-relaxed">{partner.servicesProvided.join(', ')}</p>
                  </div>
                )}
                {hasPortal && partner.portalUserEmail && (
                  <div>
                    <p className={labelCls}>Portal Account</p>
                    <p className="text-xs text-zinc-600 font-medium">{partner.portalUserEmail}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100">
                  {partner.contactEmail && (
                    <a
                      href={`mailto:${partner.contactEmail}`}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 text-zinc-700 text-xs font-black uppercase tracking-wider rounded-full hover:bg-zinc-50 transition-colors"
                    >
                      <Mail size={12} />
                      Email Partner
                    </a>
                  )}
                  {partner.website && (
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 text-zinc-700 text-xs font-black uppercase tracking-wider rounded-full hover:bg-zinc-50 transition-colors"
                    >
                      <ExternalLink size={12} />
                      Website
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSendInvite(partner)}
                    disabled={isInviting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#233dff] text-white text-xs font-black uppercase tracking-wider rounded-full hover:bg-[#1a2de0] disabled:opacity-40 transition-colors"
                  >
                    {isInviting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    {hasPortal ? 'Resend Invite' : 'Send Portal Invite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(partner)}
                    disabled={removingId === partner.id}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-xs font-black uppercase tracking-wider rounded-full hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    {removingId === partner.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PartnerAdminPanel (main export)
// ─────────────────────────────────────────────────────────────────────────────

const PartnerAdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PanelTab>('applications');

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
    { id: 'applications', label: 'Applications', icon: <ClipboardList size={15} /> },
    { id: 'partners', label: 'Partners', icon: <Users size={15} /> },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Partner Admin</h2>
        <p className="text-zinc-500 mt-3 font-medium text-sm md:text-base leading-relaxed">
          Review incoming partner applications and manage active partner organizations.
        </p>
      </div>

      <div className="flex gap-2 border-b border-zinc-100 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-[#233dff] text-[#233dff]'
                : 'border-transparent text-zinc-400 hover:text-zinc-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'applications' && <ApplicationsTab />}
        {activeTab === 'partners' && <PartnersTab />}
      </div>
    </div>
  );
};

export default PartnerAdminPanel;
