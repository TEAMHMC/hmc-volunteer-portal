
import React, { useState, useEffect } from 'react';
import { ClientRecord, ReferralRecord, ReferralResource, PartnerAgency, ServiceFeedback } from '../types';
import { apiService } from '../services/apiService';
import {
  Users, FileText, Building2, Star, Clock, CheckCircle, AlertTriangle,
  Search, Plus, X, Loader2, ChevronRight, Filter, BarChart3, TrendingUp,
  Phone, Mail, MapPin, Globe, Calendar, ArrowRight, RefreshCw, ShieldAlert, Activity
} from 'lucide-react';
import { toastService } from '../services/toastService';

interface ReferralManagementProps {
  isAdmin: boolean;
}

type TabId = 'dashboard' | 'clients' | 'referrals' | 'resources' | 'partners' | 'feedback' | 'flaggedClients';

interface FlaggedScreening {
  id: string;
  clientId: string | null;
  clientName: string;
  date: string | null;
  eventId: string | null;
  flags: { bloodPressure?: { label: string; level: string }; glucose?: { label: string; level: string } };
  followUpNeeded: boolean;
  abnormalFlag: boolean;
  clinicalAction: string | null;
  reviewedBy: string | null;
  vitals: { systolic: number | null; diastolic: number | null; glucose: number | null };
  hasReferral: boolean;
  referralStatus: string | null;
}

const ReferralManagement: React.FC<ReferralManagementProps> = ({ isAdmin }) => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [resources, setResources] = useState<ReferralResource[]>([]);
  const [partners, setPartners] = useState<PartnerAgency[]>([]);
  const [feedback, setFeedback] = useState<ServiceFeedback[]>([]);
  const [slaReport, setSlaReport] = useState<any>(null);
  const [flaggedClients, setFlaggedClients] = useState<FlaggedScreening[]>([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [clientsData, referralsData, resourcesData, partnersData, feedbackData, slaData, flaggedData] = await Promise.all([
        apiService.get('/api/clients').catch(() => []),
        apiService.get('/api/referrals').catch(() => []),
        apiService.get('/api/resources').catch(() => []),
        apiService.get('/api/partners').catch(() => []),
        apiService.get('/api/feedback').catch(() => []),
        apiService.get('/api/referrals/sla-report').catch(() => null),
        apiService.get('/api/screenings/flagged').catch(() => ({ screenings: [] })),
      ]);
      setClients(clientsData);
      setReferrals(referralsData);
      setResources(resourcesData);
      setPartners(partnersData);
      setFeedback(feedbackData);
      setSlaReport(slaData);
      setFlaggedClients(flaggedData?.screenings || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={18} /> },
    { id: 'clients', label: 'Clients', icon: <Users size={18} />, count: clients.length },
    { id: 'referrals', label: 'Referrals', icon: <FileText size={18} />, count: referrals.length },
    { id: 'resources', label: 'Resources', icon: <Globe size={18} />, count: resources.length },
    { id: 'partners', label: 'Partners', icon: <Building2 size={18} />, count: partners.length },
    { id: 'feedback', label: 'Feedback', icon: <Star size={18} />, count: feedback.length },
    { id: 'flaggedClients', label: 'Flagged Clients', icon: <ShieldAlert size={18} />, count: flaggedClients.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-brand" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Referral Management</h1>
          <p className="text-sm md:text-lg font-medium text-zinc-500 mt-2">Client intake, referrals, and service coordination</p>
        </div>
        <button
          onClick={fetchAllData}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 border border-black text-zinc-700 rounded-full text-sm font-bold uppercase tracking-wide hover:bg-zinc-200 min-h-[44px] w-full sm:w-auto"
        >
          <RefreshCw size={16} /> Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-brand text-white shadow-elevation-2'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:border-brand'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-zinc-100'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow overflow-hidden">
        {activeTab === 'dashboard' && (
          <DashboardView
            clients={clients}
            referrals={referrals}
            resources={resources}
            slaReport={slaReport}
          />
        )}
        {activeTab === 'clients' && (
          <ClientsView clients={clients} referrals={referrals} resources={resources} onRefresh={fetchAllData} />
        )}
        {activeTab === 'referrals' && (
          <ReferralsView referrals={referrals} clients={clients} resources={resources} onRefresh={fetchAllData} />
        )}
        {activeTab === 'resources' && (
          <ResourcesView resources={resources} clients={clients} onRefresh={fetchAllData} onSwitchToClients={() => setActiveTab('clients')} />
        )}
        {activeTab === 'partners' && (
          <PartnersView partners={partners} onRefresh={fetchAllData} />
        )}
        {activeTab === 'feedback' && (
          <FeedbackView feedback={feedback} resources={resources} />
        )}
        {activeTab === 'flaggedClients' && (
          <FlaggedClientsView flaggedScreenings={flaggedClients} resources={resources} onRefresh={fetchAllData} />
        )}
      </div>
    </div>
  );
};

// Dashboard View with KPIs
const DashboardView: React.FC<{
  clients: ClientRecord[];
  referrals: ReferralRecord[];
  resources: ReferralResource[];
  slaReport: any;
}> = ({ clients, referrals, resources, slaReport }) => {
  const pendingReferrals = referrals.filter(r => r.status === 'Pending');
  const urgentReferrals = referrals.filter(r => r.urgency === 'Emergency' || r.urgency === 'Urgent');
  const completedThisMonth = referrals.filter(r => {
    if (r.status !== 'Completed') return false;
    const date = new Date(r.createdAt);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  const kpis = [
    { label: 'Active Clients', value: clients.filter(c => c.status === 'Active').length, icon: <Users />, color: 'blue' },
    { label: 'Pending Referrals', value: pendingReferrals.length, icon: <Clock />, color: 'amber' },
    { label: 'SLA Compliance', value: slaReport ? `${Math.round((slaReport.compliant / (slaReport.compliant + slaReport.nonCompliant || 1)) * 100)}%` : 'N/A', icon: <CheckCircle />, color: 'emerald' },
    { label: 'Active Resources', value: resources.filter(r => r['Active / Inactive'] === 'checked').length, icon: <Globe />, color: 'purple' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className={`p-4 md:p-6 rounded-3xl border bg-${kpi.color}-50 border-${kpi.color}-100 shadow-elevation-1`}>
            <div className={`w-12 h-12 rounded-2xl bg-${kpi.color}-100 text-${kpi.color}-600 flex items-center justify-center mb-4`}>
              {kpi.icon}
            </div>
            <p className="text-xl md:text-3xl font-black text-zinc-900">{kpi.value}</p>
            <p className="text-sm font-bold text-zinc-400">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* SLA Report */}
      {slaReport && (
        <div className="p-4 md:p-6 bg-zinc-50 rounded-3xl border border-zinc-100 shadow-elevation-1">
          <h3 className="text-base md:text-xl font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <Clock size={20} /> 72-Hour SLA Compliance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-600">{slaReport.compliant}</p>
              <p className="text-sm font-bold text-zinc-400">Compliant</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-rose-600">{slaReport.nonCompliant}</p>
              <p className="text-sm font-bold text-zinc-400">Non-Compliant</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-amber-600">{slaReport.onTrack}</p>
              <p className="text-sm font-bold text-zinc-400">On Track</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-brand">{slaReport.avgResponseTimeHours}h</p>
              <p className="text-sm font-bold text-zinc-400">Avg Response</p>
            </div>
          </div>
        </div>
      )}

      {/* Urgent Referrals */}
      {urgentReferrals.length > 0 && (
        <div className="p-4 md:p-6 bg-rose-50 rounded-3xl border border-rose-200 shadow-elevation-1">
          <h3 className="text-base md:text-xl font-bold text-rose-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} /> Urgent/Emergency Referrals ({urgentReferrals.length})
          </h3>
          <div className="space-y-3">
            {urgentReferrals.slice(0, 5).map(r => (
              <div key={r.id} className="p-4 bg-white rounded-3xl border border-zinc-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-zinc-900">{r.clientName}</p>
                  <p className="text-sm text-zinc-600">{r.serviceNeeded}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  r.urgency === 'Emergency' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {r.urgency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h3 className="text-base md:text-xl font-bold text-zinc-900 mb-4">Recent Referrals</h3>
        <div className="space-y-3">
          {referrals.slice(0, 10).map(r => (
            <div key={r.id} className="p-4 bg-zinc-50 rounded-3xl border border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                  r.status === 'Completed' ? 'bg-emerald-500' :
                  r.status === 'In Progress' ? 'bg-brand/50' :
                  r.status === 'Pending' ? 'bg-amber-500' : 'bg-zinc-400'
                }`}>
                  {r.clientName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-zinc-900">{r.clientName}</p>
                  <p className="text-sm text-zinc-500">{r.serviceNeeded} → {r.referredTo}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-xs font-bold ${
                  r.status === 'Completed' ? 'text-emerald-600' :
                  r.status === 'In Progress' ? 'text-brand' :
                  r.status === 'Pending' ? 'text-amber-600' : 'text-zinc-400'
                }`}>
                  {r.status}
                </p>
                <p className="text-xs text-zinc-400">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Clients View
const ClientsView: React.FC<{ clients: ClientRecord[]; referrals: ReferralRecord[]; resources: ReferralResource[]; onRefresh: () => void }> = ({ clients, referrals, resources, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [showNewReferral, setShowNewReferral] = useState(false);
  const [newReferralData, setNewReferralData] = useState({ serviceNeeded: '', referredTo: '', urgency: 'Standard', notes: '' });
  const [isSavingReferral, setIsSavingReferral] = useState(false);
  const [editingReferralId, setEditingReferralId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ReferralRecord>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const filteredClients = clients.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const clientReferrals = selectedClient ? referrals.filter(r => r.clientId === selectedClient.id || r.clientName === `${selectedClient.firstName} ${selectedClient.lastName}`) : [];

  const handleCreateReferral = async () => {
    if (!selectedClient || !newReferralData.serviceNeeded) return;
    setIsSavingReferral(true);
    try {
      await apiService.post('/api/referrals/create', {
        referral: {
          clientId: selectedClient.id,
          clientName: `${selectedClient.firstName} ${selectedClient.lastName}`,
          serviceNeeded: newReferralData.serviceNeeded,
          referredTo: newReferralData.referredTo,
          urgency: newReferralData.urgency,
          notes: newReferralData.notes,
          status: 'Pending',
          referralDate: new Date().toISOString(),
        }
      });
      toastService.success('Referral created!');
      setShowNewReferral(false);
      setNewReferralData({ serviceNeeded: '', referredTo: '', urgency: 'Standard', notes: '' });
      onRefresh();
    } catch (err) {
      toastService.error('Failed to create referral.');
    } finally {
      setIsSavingReferral(false);
    }
  };

  const handleUpdateReferral = async (referralId: string) => {
    setIsSavingEdit(true);
    try {
      await apiService.put(`/api/referrals/${referralId}`, { referral: editData });
      toastService.success('Referral updated!');
      setEditingReferralId(null);
      setEditData({});
      onRefresh();
    } catch (err) {
      toastService.error('Failed to update referral.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      {selectedClient ? (
        // Client Detail View
        <div className="space-y-6 animate-in fade-in">
          <button onClick={() => { setSelectedClient(null); setShowNewReferral(false); setEditingReferralId(null); }} className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-800 transition-colors">
            <ArrowRight size={14} className="rotate-180" /> Back to Clients
          </button>

          <div className="p-4 md:p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-zinc-900">{selectedClient.firstName} {selectedClient.lastName}</h2>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-zinc-500">
                  {selectedClient.phone && <span className="flex items-center gap-1"><Phone size={14} /> {selectedClient.phone}</span>}
                  {selectedClient.email && <span className="flex items-center gap-1"><Mail size={14} /> {selectedClient.email}</span>}
                  {selectedClient.primaryLanguage && <span className="flex items-center gap-1"><Globe size={14} /> {selectedClient.primaryLanguage}</span>}
                  {selectedClient.spa && <span className="flex items-center gap-1"><MapPin size={14} /> SPA {selectedClient.spa}</span>}
                </div>
              </div>
              <button
                onClick={() => setShowNewReferral(true)}
                className="flex items-center gap-2 px-5 py-3 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide min-h-[44px] w-full sm:w-auto justify-center"
              >
                <Plus size={16} /> New Referral
              </button>
            </div>
          </div>

          {/* New Referral Form */}
          {showNewReferral && (
            <div className="p-4 md:p-6 bg-brand/5 rounded-3xl border border-brand/10 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider">Create Referral</h3>
                <button onClick={() => setShowNewReferral(false)} className="p-1 hover:bg-zinc-100 rounded-full"><X size={16} /></button>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Service Needed *</label>
                <input
                  type="text"
                  value={newReferralData.serviceNeeded}
                  onChange={e => setNewReferralData({ ...newReferralData, serviceNeeded: e.target.value })}
                  placeholder="e.g., Housing assistance, Mental health counseling..."
                  className="w-full p-4 bg-white border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Refer To (Resource)</label>
                  <select
                    value={newReferralData.referredTo}
                    onChange={e => setNewReferralData({ ...newReferralData, referredTo: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-zinc-100 rounded-2xl font-bold text-sm"
                  >
                    <option value="">Select a resource...</option>
                    {resources.map((r, i) => <option key={i} value={r['Resource Name']}>{r['Resource Name']} — {r['Service Category']}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Urgency</label>
                  <select
                    value={newReferralData.urgency}
                    onChange={e => setNewReferralData({ ...newReferralData, urgency: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-zinc-100 rounded-2xl font-bold text-sm"
                  >
                    <option>Standard</option>
                    <option>Urgent</option>
                    <option>Emergency</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Notes</label>
                <textarea
                  value={newReferralData.notes}
                  onChange={e => setNewReferralData({ ...newReferralData, notes: e.target.value })}
                  placeholder="Additional context..."
                  className="w-full h-20 p-4 bg-white border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowNewReferral(false)} className="px-5 py-3 bg-zinc-100 border border-black text-zinc-700 rounded-full font-bold text-sm uppercase tracking-wide min-h-[44px]">Cancel</button>
                <button onClick={handleCreateReferral} disabled={!newReferralData.serviceNeeded || isSavingReferral} className="px-5 py-3 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide disabled:opacity-50 min-h-[44px]">
                  {isSavingReferral ? <Loader2 size={16} className="animate-spin" /> : 'Create Referral'}
                </button>
              </div>
            </div>
          )}

          {/* Referral History */}
          <div>
            <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider mb-4">Referral History ({clientReferrals.length})</h3>
            {clientReferrals.length === 0 ? (
              <div className="text-center py-8 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
                <FileText size={32} className="mx-auto mb-2 text-zinc-300" />
                <p className="text-sm font-bold text-zinc-400">No referrals yet for this client.</p>
                {!showNewReferral && <button onClick={() => setShowNewReferral(true)} className="mt-3 text-sm font-bold text-brand hover:underline">Create first referral</button>}
              </div>
            ) : (
              <div className="space-y-3">
                {clientReferrals.map(ref => (
                  <div key={ref.id} className="p-4 bg-white rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
                    {editingReferralId === ref.id ? (
                      // Edit mode
                      <div className="space-y-3 animate-in fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Service Needed</label>
                            <input value={editData.serviceNeeded || ''} onChange={e => setEditData({ ...editData, serviceNeeded: e.target.value })} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold outline-none focus:border-brand/30" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Status</label>
                            <select value={editData.status || ''} onChange={e => setEditData({ ...editData, status: e.target.value as any })} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold">
                              <option>Pending</option>
                              <option>In Progress</option>
                              <option>Completed</option>
                              <option>Cancelled</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Referred To</label>
                            <select value={editData.referredTo || ''} onChange={e => setEditData({ ...editData, referredTo: e.target.value })} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold">
                              <option value="">Select resource...</option>
                              {resources.map((r, i) => <option key={i} value={r['Resource Name']}>{r['Resource Name']}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Urgency</label>
                            <select value={editData.urgency || ''} onChange={e => setEditData({ ...editData, urgency: e.target.value as any })} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold">
                              <option>Standard</option>
                              <option>Urgent</option>
                              <option>Emergency</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Notes</label>
                          <textarea value={editData.notes || ''} onChange={e => setEditData({ ...editData, notes: e.target.value })} className="w-full h-16 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold outline-none focus:border-brand/30" />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setEditingReferralId(null); setEditData({}); }} className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-full text-xs font-bold uppercase tracking-wide min-h-[36px]">Cancel</button>
                          <button onClick={() => handleUpdateReferral(ref.id!)} disabled={isSavingEdit} className="px-4 py-2 bg-brand text-white rounded-full text-xs font-bold uppercase tracking-wide disabled:opacity-50 min-h-[36px]">
                            {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ref.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                              ref.status === 'In Progress' ? 'bg-brand/10 text-brand' :
                              ref.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'
                            }`}>{ref.status}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ref.urgency === 'Emergency' ? 'bg-rose-100 text-rose-700' :
                              ref.urgency === 'Urgent' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'
                            }`}>{ref.urgency}</span>
                          </div>
                          <p className="text-sm font-bold text-zinc-900">{ref.serviceNeeded}</p>
                          {ref.referredTo && <p className="text-xs text-zinc-500 mt-1">Referred to: <span className="font-bold text-zinc-700">{ref.referredTo}</span></p>}
                          {ref.notes && <p className="text-xs text-zinc-400 mt-1 italic">{ref.notes}</p>}
                          <p className="text-[10px] text-zinc-300 mt-2">{new Date(ref.createdAt).toLocaleDateString()} {ref.referredByName ? `by ${ref.referredByName}` : ''}</p>
                        </div>
                        <button
                          onClick={() => { setEditingReferralId(ref.id!); setEditData({ serviceNeeded: ref.serviceNeeded, status: ref.status, referredTo: ref.referredTo, urgency: ref.urgency, notes: ref.notes }); }}
                          className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-full text-xs font-bold uppercase tracking-wide hover:bg-zinc-200 min-h-[36px] shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Client List View
        <>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-6 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
            <button
              onClick={() => setShowNewClient(true)}
              className="flex items-center gap-2 px-5 py-3 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide min-h-[44px] w-full sm:w-auto justify-center"
            >
              <Plus size={18} /> New Client
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase">Language</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase">SPA</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase">Referrals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredClients.map(client => {
                  const clientRefCount = referrals.filter(r => r.clientId === client.id || r.clientName === `${client.firstName} ${client.lastName}`).length;
                  return (
                    <tr key={client.id} className="hover:bg-brand/5 cursor-pointer transition-colors" onClick={() => setSelectedClient(client)}>
                      <td className="px-4 py-4">
                        <p className="font-bold text-zinc-900">{client.firstName} {client.lastName}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-zinc-600">{client.phone}</p>
                        <p className="text-xs text-zinc-400">{client.email}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-600">{client.primaryLanguage || 'English'}</td>
                      <td className="px-4 py-4 text-sm text-zinc-600">{client.spa || '-'}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          client.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {client.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-brand/10 text-brand">{clientRefCount}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredClients.length === 0 && (
              <div className="text-center py-12 text-zinc-400">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-zinc-400 font-bold text-sm">No clients found</p>
              </div>
            )}
          </div>

          {showNewClient && (
            <NewClientModal onClose={() => setShowNewClient(false)} onComplete={() => { setShowNewClient(false); onRefresh(); }} />
          )}
        </>
      )}
    </div>
  );
};

// Referrals View
const ReferralsView: React.FC<{
  referrals: ReferralRecord[];
  clients: ClientRecord[];
  resources: ReferralResource[];
  onRefresh: () => void;
}> = ({ referrals, clients, resources, onRefresh }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'urgent'>('all');

  const filteredReferrals = referrals.filter(r => {
    if (filter === 'pending') return r.status === 'Pending';
    if (filter === 'urgent') return r.urgency === 'Emergency' || r.urgency === 'Urgent';
    return true;
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2">
          {['all', 'pending', 'urgent'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold capitalize ${
                filter === f ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredReferrals.map(referral => (
          <ReferralCard key={referral.id} referral={referral} onRefresh={onRefresh} />
        ))}
        {filteredReferrals.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-zinc-400 font-bold text-sm">No referrals found</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ReferralCard: React.FC<{ referral: ReferralRecord; onRefresh: () => void }> = ({ referral, onRefresh }) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      await apiService.put(`/api/referrals/${referral.id}`, {
        referral: {
          ...referral,
          status: newStatus,
          firstContactDate: newStatus === 'In Progress' && !referral.firstContactDate ? new Date().toISOString() : referral.firstContactDate
        }
      });
      onRefresh();
    } catch (error) {
      console.error('Failed to update referral:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Calculate SLA status
  const created = new Date(referral.createdAt);
  const deadline = new Date(created.getTime() + 72 * 60 * 60 * 1000);
  const now = new Date();
  const hoursRemaining = Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
  const isOverdue = referral.status === 'Pending' && now > deadline;

  return (
    <div className={`p-4 md:p-8 rounded-2xl md:rounded-[40px] border shadow-sm hover:shadow-2xl transition-shadow ${isOverdue ? 'bg-rose-50 border-rose-200' : 'bg-white border-zinc-100'}`}>
      <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-2">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-base md:text-xl font-bold text-zinc-900">{referral.clientName}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              referral.urgency === 'Emergency' ? 'bg-rose-100 text-rose-700' :
              referral.urgency === 'Urgent' ? 'bg-amber-100 text-amber-700' :
              'bg-zinc-100 text-zinc-600'
            }`}>
              {referral.urgency}
            </span>
          </div>
          <p className="text-sm text-zinc-600">{referral.serviceNeeded}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          referral.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
          referral.status === 'In Progress' ? 'bg-brand/10 text-brand' :
          referral.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
          'bg-zinc-100 text-zinc-600'
        }`}>
          {referral.status}
        </span>
      </div>

      <div className="flex items-center gap-6 text-sm text-zinc-500 mb-4">
        <span>Referred to: <strong className="text-zinc-700">{referral.referredTo}</strong></span>
        <span>Created: {new Date(referral.createdAt).toLocaleDateString()}</span>
        {referral.status === 'Pending' && (
          <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
            {isOverdue ? 'OVERDUE' : `${Math.round(hoursRemaining)}h remaining`}
          </span>
        )}
      </div>

      {referral.status === 'Pending' && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => updateStatus('In Progress')}
            disabled={isUpdating}
            className="px-4 py-2 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide hover:bg-brand/90 disabled:opacity-50 min-h-[44px] w-full sm:w-auto"
          >
            Mark In Progress
          </button>
          <button
            onClick={() => updateStatus('Completed')}
            disabled={isUpdating}
            className="px-4 py-2 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide hover:bg-brand/90 disabled:opacity-50 min-h-[44px] w-full sm:w-auto"
          >
            Mark Completed
          </button>
        </div>
      )}
    </div>
  );
};

// Resources View
const ResourcesView: React.FC<{ resources: ReferralResource[]; clients: ClientRecord[]; onRefresh: () => void; onSwitchToClients: (resourceName: string) => void }> = ({ resources, clients, onRefresh, onSwitchToClients }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<ReferralResource | null>(null);
  const [showMatchClient, setShowMatchClient] = useState(false);
  const [matchClientId, setMatchClientId] = useState('');
  const [matchServiceNeeded, setMatchServiceNeeded] = useState('');
  const [isSavingMatch, setIsSavingMatch] = useState(false);

  const filteredResources = resources.filter(r =>
    r['Resource Name'].toLowerCase().includes(searchQuery.toLowerCase()) ||
    r['Service Category']?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMatchToClient = async () => {
    if (!selectedResource || !matchClientId) return;
    const client = clients.find(c => c.id === matchClientId);
    if (!client) return;
    setIsSavingMatch(true);
    try {
      await apiService.post('/api/referrals/create', {
        referral: {
          clientId: client.id,
          clientName: `${client.firstName} ${client.lastName}`,
          serviceNeeded: matchServiceNeeded || selectedResource['Service Category'] || 'Service referral',
          referredTo: selectedResource['Resource Name'],
          urgency: 'Standard',
          status: 'Pending',
          referralDate: new Date().toISOString(),
        }
      });
      toastService.success(`Referral created for ${client.firstName} ${client.lastName} → ${selectedResource['Resource Name']}`);
      setShowMatchClient(false);
      setSelectedResource(null);
      setMatchClientId('');
      setMatchServiceNeeded('');
      onRefresh();
    } catch (err) {
      toastService.error('Failed to create referral.');
    } finally {
      setIsSavingMatch(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredResources.map((resource, i) => (
          <div key={i} className="p-4 md:p-6 bg-zinc-50 rounded-3xl border border-zinc-100 shadow-elevation-1 hover:border-brand/20 transition-colors cursor-pointer" onClick={() => { setSelectedResource(resource); setShowMatchClient(true); }}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-zinc-900">{resource['Resource Name']}</h3>
              {resource.averageRating && (
                <div className="flex items-center gap-1 text-amber-500">
                  <Star size={14} fill="currentColor" />
                  <span className="text-sm font-bold">{resource.averageRating}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-brand font-bold mb-2">{resource['Service Category']}</p>
            <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{resource['Key Offerings']}</p>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
              {resource['Contact Phone'] && (
                <span className="flex items-center gap-1"><Phone size={12} /> {resource['Contact Phone']}</span>
              )}
              {resource['SPA'] && (
                <span className="flex items-center gap-1"><MapPin size={12} /> SPA {resource['SPA']}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {filteredResources.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          <Globe size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-zinc-400 font-bold text-sm">No resources found</p>
        </div>
      )}

      {/* Match Resource to Client Modal */}
      {showMatchClient && selectedResource && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => { setShowMatchClient(false); setSelectedResource(null); }}>
          <div className="bg-white max-w-lg w-full rounded-modal shadow-elevation-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-base md:text-xl font-bold text-zinc-900">Refer Client to Resource</h2>
              <button onClick={() => { setShowMatchClient(false); setSelectedResource(null); }} className="p-2 hover:bg-zinc-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div className="p-4 bg-brand/5 rounded-2xl border border-brand/10">
                <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Resource</p>
                <p className="text-sm font-bold text-zinc-900">{selectedResource['Resource Name']}</p>
                <p className="text-xs text-brand font-bold">{selectedResource['Service Category']}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Select Client *</label>
                <select
                  value={matchClientId}
                  onChange={e => setMatchClientId(e.target.value)}
                  className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm"
                >
                  <option value="">Choose a client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.phone ? ` — ${c.phone}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Service Needed</label>
                <input
                  type="text"
                  value={matchServiceNeeded}
                  onChange={e => setMatchServiceNeeded(e.target.value)}
                  placeholder={selectedResource['Service Category'] || 'Describe the service need...'}
                  className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <button onClick={() => { setShowMatchClient(false); setSelectedResource(null); }} className="px-5 py-3 bg-zinc-100 border border-black text-zinc-700 rounded-full font-bold text-sm uppercase tracking-wide min-h-[44px] w-full sm:w-auto">Cancel</button>
                <button onClick={handleMatchToClient} disabled={!matchClientId || isSavingMatch} className="px-5 py-3 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide disabled:opacity-50 min-h-[44px] w-full sm:w-auto">
                  {isSavingMatch ? <Loader2 size={16} className="animate-spin" /> : 'Create Referral'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Partners View
const PartnersView: React.FC<{ partners: PartnerAgency[]; onRefresh: () => void }> = ({ partners, onRefresh }) => {
  const [showNewPartner, setShowNewPartner] = useState(false);

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowNewPartner(true)}
          className="flex items-center gap-2 px-5 py-3 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide min-h-[44px] w-full sm:w-auto justify-center"
        >
          <Plus size={18} /> Add Partner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {partners.map(partner => (
          <div key={partner.id} className="p-4 md:p-6 bg-white rounded-3xl border border-zinc-100 shadow-elevation-1">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-zinc-900">{partner.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                partner.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {partner.status}
              </span>
            </div>
            <p className="text-sm text-brand font-bold mb-3">{partner.type}</p>
            <div className="space-y-2 text-sm text-zinc-500">
              {partner.contactName && <p>{partner.contactName}</p>}
              {partner.contactEmail && (
                <p className="flex items-center gap-1"><Mail size={12} /> {partner.contactEmail}</p>
              )}
              {partner.contactPhone && (
                <p className="flex items-center gap-1"><Phone size={12} /> {partner.contactPhone}</p>
              )}
            </div>
            {partner.performanceScore && (
              <div className="mt-4 pt-4 border-t border-zinc-100">
                <p className="text-xs text-zinc-400">Performance Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${partner.performanceScore}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-zinc-700">{partner.performanceScore}%</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {partners.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          <Building2 size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-zinc-400 font-bold text-sm">No partner agencies yet</p>
        </div>
      )}

      {showNewPartner && (
        <NewPartnerModal onClose={() => setShowNewPartner(false)} onComplete={() => { setShowNewPartner(false); onRefresh(); }} />
      )}
    </div>
  );
};

// Feedback View
const FeedbackView: React.FC<{ feedback: ServiceFeedback[]; resources: ReferralResource[] }> = ({ feedback, resources }) => {
  const avgRating = feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
    : 'N/A';

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-8">
        <div className="p-4 md:p-6 bg-amber-50 rounded-3xl border border-amber-100 shadow-elevation-1 text-center">
          <Star size={32} className="mx-auto text-amber-500 mb-2" />
          <p className="text-xl md:text-3xl font-black text-zinc-900">{avgRating}</p>
          <p className="text-sm font-bold text-zinc-400">Average Rating</p>
        </div>
        <div className="p-4 md:p-6 bg-brand/5 rounded-3xl border border-brand/10 shadow-elevation-1 text-center">
          <FileText size={32} className="mx-auto text-brand mb-2" />
          <p className="text-xl md:text-3xl font-black text-zinc-900">{feedback.length}</p>
          <p className="text-sm font-bold text-zinc-400">Total Feedback</p>
        </div>
        <div className="p-4 md:p-6 bg-emerald-50 rounded-3xl border border-emerald-100 shadow-elevation-1 text-center">
          <TrendingUp size={32} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-xl md:text-3xl font-black text-zinc-900">
            {feedback.filter(f => f.wouldRecommend).length}
          </p>
          <p className="text-sm font-bold text-zinc-400">Would Recommend</p>
        </div>
      </div>

      <div className="space-y-4">
        {feedback.map(f => (
          <div key={f.id} className="p-4 md:p-6 bg-zinc-50 rounded-3xl border border-zinc-100 shadow-elevation-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-zinc-900">{f.resourceName || 'Service Feedback'}</p>
                <p className="text-sm text-zinc-500">{new Date(f.submittedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    size={18}
                    className={star <= f.rating ? 'text-amber-400' : 'text-zinc-200'}
                    fill={star <= f.rating ? 'currentColor' : 'none'}
                  />
                ))}
              </div>
            </div>
            {f.comments && <p className="text-sm text-zinc-600">{f.comments}</p>}
          </div>
        ))}
        {feedback.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <Star size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-zinc-400 font-bold text-sm">No feedback yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

// New Client Modal
const NewClientModal: React.FC<{ onClose: () => void; onComplete: () => void }> = ({ onClose, onComplete }) => {
  const [formData, setFormData] = useState<Partial<ClientRecord>>({ primaryLanguage: 'English' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiService.post('/api/clients/create', { client: formData });
      onComplete();
    } catch (error) {
      toastService.error('Failed to create client');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-2xl w-full rounded-modal shadow-elevation-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-base md:text-xl font-bold text-zinc-900">New Client Intake</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">First Name *</label>
              <input
                required
                type="text"
                value={formData.firstName || ''}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Last Name *</label>
              <input
                required
                type="text"
                value={formData.lastName || ''}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Phone *</label>
              <input
                required
                type="tel"
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Date of Birth</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM/DD/YYYY"
                maxLength={10}
                value={formData.dob || ''}
                onChange={e => { let v = e.target.value.replace(/[^\d/]/g, ''); const d = v.replace(/\//g, ''); if (d.length >= 4) v = d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4,8); else if (d.length >= 2) v = d.slice(0,2)+'/'+d.slice(2); else v = d; setFormData({ ...formData, dob: v }); }}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Primary Language</label>
              <select
                value={formData.primaryLanguage || 'English'}
                onChange={e => setFormData({ ...formData, primaryLanguage: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm"
              >
                <option>English</option>
                <option>Spanish</option>
                <option>Mandarin</option>
                <option>Cantonese</option>
                <option>Korean</option>
                <option>Vietnamese</option>
                <option>Tagalog</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">SPA (Service Planning Area)</label>
            <select
              value={formData.spa || ''}
              onChange={e => setFormData({ ...formData, spa: e.target.value })}
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm"
            >
              <option value="">Select SPA...</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(spa => (
                <option key={spa} value={spa.toString()}>SPA {spa}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-6 py-3 bg-zinc-100 border border-black text-zinc-700 rounded-full font-bold uppercase tracking-wide min-h-[44px] w-full sm:w-auto">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="px-6 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide disabled:opacity-50 min-h-[44px] w-full sm:w-auto">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// New Partner Modal
const NewPartnerModal: React.FC<{ onClose: () => void; onComplete: () => void }> = ({ onClose, onComplete }) => {
  const [formData, setFormData] = useState<Partial<PartnerAgency>>({ type: 'Other', status: 'Active' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiService.post('/api/partners', formData);
      onComplete();
    } catch (error) {
      toastService.error('Failed to create partner');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-2xl w-full rounded-modal shadow-elevation-3" onClick={e => e.stopPropagation()}>
        <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-base md:text-xl font-bold text-zinc-900">Add Partner Agency</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Agency Name *</label>
            <input
              required
              type="text"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Type</label>
            <select
              value={formData.type || 'Other'}
              onChange={e => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl font-bold text-sm"
            >
              <option>Healthcare</option>
              <option>Housing</option>
              <option>Food</option>
              <option>Legal</option>
              <option>Employment</option>
              <option>Mental Health</option>
              <option>Other</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Contact Name</label>
              <input
                type="text"
                value={formData.contactName || ''}
                onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Contact Email</label>
              <input
                type="email"
                value={formData.contactEmail || ''}
                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-2">Contact Phone</label>
            <input
              type="tel"
              value={formData.contactPhone || ''}
              onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
            />
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-6 py-3 bg-zinc-100 border border-black text-zinc-700 rounded-full font-bold uppercase tracking-wide min-h-[44px] w-full sm:w-auto">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="px-6 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide disabled:opacity-50 min-h-[44px] w-full sm:w-auto">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Add Partner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Flagged Clients View — clinical alerts from screenings
const FlaggedClientsView: React.FC<{
  flaggedScreenings: FlaggedScreening[];
  resources: ReferralResource[];
  onRefresh: () => void;
}> = ({ flaggedScreenings, resources, onRefresh }) => {
  const [typeFilter, setTypeFilter] = useState<'all' | 'bloodPressure' | 'glucose'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high'>('all');
  const [daysFilter, setDaysFilter] = useState<7 | 30 | 90>(90);
  const [referralModal, setReferralModal] = useState<FlaggedScreening | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<ReferralResource | null>(null);
  const [referralNotes, setReferralNotes] = useState('');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysFilter);
  const cutoffISO = cutoff.toISOString();

  const filtered = flaggedScreenings.filter(s => {
    if (s.date && s.date < cutoffISO) return false;
    if (typeFilter === 'bloodPressure' && !s.flags?.bloodPressure?.level) return false;
    if (typeFilter === 'glucose' && !s.flags?.glucose?.level) return false;
    if (severityFilter !== 'all') {
      const bpMatch = s.flags?.bloodPressure?.level === severityFilter;
      const gMatch = s.flags?.glucose?.level === severityFilter;
      if (!bpMatch && !gMatch) return false;
    }
    return true;
  });

  const getSeverityColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  };

  const getServiceNeeded = (s: FlaggedScreening) => {
    if (s.flags?.bloodPressure?.level === 'critical') return 'Blood Pressure Management — Hypertensive Crisis';
    if (s.flags?.bloodPressure?.level === 'high') return 'Blood Pressure Management — Elevated';
    if (s.flags?.glucose?.level === 'critical') return 'Glucose Management — Critical';
    if (s.flags?.glucose?.level === 'high') return 'Glucose Management — Elevated';
    return 'Medical Follow-Up Needed';
  };

  const getUrgency = (s: FlaggedScreening) => {
    const levels = [s.flags?.bloodPressure?.level, s.flags?.glucose?.level].filter(Boolean);
    if (levels.includes('critical')) return 'Emergency';
    if (levels.includes('high')) return 'Urgent';
    return 'Standard';
  };

  // Match resources by medical service category keywords
  const getMatchedResources = (screening: FlaggedScreening) => {
    const hasBP = screening.flags?.bloodPressure?.level && screening.flags.bloodPressure.level !== 'normal';
    const hasGlucose = screening.flags?.glucose?.level && screening.flags.glucose.level !== 'normal';
    const keywords = ['health', 'medical', 'clinic', 'care'];
    if (hasBP) keywords.push('blood pressure', 'hypertension', 'cardio', 'heart', 'cardiovascular');
    if (hasGlucose) keywords.push('diabetes', 'glucose', 'endocrin');

    return resources.filter(r => {
      if (r['Active / Inactive'] === 'unchecked') return false;
      const text = `${r['Service Category']} ${r['Key Offerings']} ${r['Resource Name']}`.toLowerCase();
      return keywords.some(kw => text.includes(kw));
    });
  };

  const openReferralModal = (screening: FlaggedScreening) => {
    setReferralModal(screening);
    setSelectedResource(null);
    setReferralNotes('');
    // Auto-select first matched resource
    const matched = getMatchedResources(screening);
    if (matched.length > 0) setSelectedResource(matched[0]);
  };

  const handleCreateReferral = async () => {
    if (!referralModal) return;
    if (!referralModal.clientId) {
      toastService.error('No client ID linked to this screening');
      return;
    }
    setCreatingId(referralModal.id);
    try {
      await apiService.post('/api/referrals/create', {
        referral: {
          clientId: referralModal.clientId,
          clientName: referralModal.clientName,
          serviceNeeded: getServiceNeeded(referralModal),
          urgency: getUrgency(referralModal),
          referredTo: selectedResource?.['Resource Name'] || 'Pending assignment',
          referredToDetails: selectedResource ? {
            resourceId: selectedResource.id,
            name: selectedResource['Resource Name'],
            category: selectedResource['Service Category'],
            phone: selectedResource['Contact Phone'],
            email: selectedResource['Contact Email'],
            address: selectedResource['Address'],
            intakeNotes: selectedResource['Intake / Referral Process Notes'] || '',
          } : undefined,
          matchReason: selectedResource
            ? `Matched by service category: ${selectedResource['Service Category']}. Offerings: ${selectedResource['Key Offerings']?.substring(0, 120)}`
            : 'No matching resource found — manual assignment needed',
          notes: (referralNotes || `Auto-created from flagged screening. ${referralModal.clinicalAction ? 'Clinical action: ' + referralModal.clinicalAction : ''}`).trim(),
          status: 'Pending',
          referralDate: new Date().toISOString(),
          screeningId: referralModal.id,
          medicalFlagType: referralModal.flags?.bloodPressure ? 'bloodPressure' : 'glucose',
        }
      });
      toastService.success(`Referral created${selectedResource ? ` → ${selectedResource['Resource Name']}` : ''}`);
      setReferralModal(null);
      onRefresh();
    } catch {
      toastService.error('Failed to create referral');
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight uppercase">Flagged Clients</h2>
          <p className="text-sm text-zinc-500 mt-1">Clients with abnormal screening results that may need medical referrals</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Activity size={16} className="text-red-500" />
          <span className="font-bold text-red-600">{filtered.length}</span>
          <span className="text-zinc-500">flagged client{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-zinc-50 rounded-full p-1 border border-zinc-100">
          {(['all', 'bloodPressure', 'glucose'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${typeFilter === t ? 'bg-brand text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
              {t === 'all' ? 'All Types' : t === 'bloodPressure' ? 'BP' : 'Glucose'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-zinc-50 rounded-full p-1 border border-zinc-100">
          {(['all', 'critical', 'high'] as const).map(l => (
            <button key={l} onClick={() => setSeverityFilter(l)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${severityFilter === l ? 'bg-brand text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
              {l === 'all' ? 'All Severity' : l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-zinc-50 rounded-full p-1 border border-zinc-100">
          {([7, 30, 90] as const).map(d => (
            <button key={d} onClick={() => setDaysFilter(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${daysFilter === d ? 'bg-brand text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <ShieldAlert size={48} className="mx-auto mb-4 opacity-40" />
          <p className="font-bold">No flagged screenings found</p>
          <p className="text-sm mt-1">Adjust filters or check back after screening events</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left py-3 px-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Client</th>
                <th className="text-left py-3 px-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Flag Type</th>
                <th className="text-left py-3 px-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Severity</th>
                <th className="text-left py-3 px-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Date</th>
                <th className="text-left py-3 px-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Vitals</th>
                <th className="text-left py-3 px-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Action</th>
                <th className="text-left py-3 px-4 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Referral</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const flagTypes: string[] = [];
                const severities: string[] = [];
                if (s.flags?.bloodPressure?.level && s.flags.bloodPressure.level !== 'normal') {
                  flagTypes.push('BP');
                  severities.push(s.flags.bloodPressure.level);
                }
                if (s.flags?.glucose?.level && s.flags.glucose.level !== 'normal') {
                  flagTypes.push('Glucose');
                  severities.push(s.flags.glucose.level);
                }
                const highestSeverity = severities.includes('critical') ? 'critical' : severities.includes('high') ? 'high' : severities[0] || 'medium';

                return (
                  <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-zinc-800">{s.clientName}</span>
                      {(s as any).screeningCount > 1 && (
                        <span className="ml-2 px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded text-[9px] font-bold">{(s as any).screeningCount} screenings</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {flagTypes.map(f => (
                          <span key={f} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">{f}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getSeverityColor(highestSeverity)}`}>
                        {highestSeverity.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-500 text-xs">
                      {s.date ? new Date(s.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-600">
                      {s.vitals.systolic && s.vitals.diastolic ? `${s.vitals.systolic}/${s.vitals.diastolic}` : ''}
                      {s.vitals.systolic && s.vitals.glucose ? ' · ' : ''}
                      {s.vitals.glucose ? `Gluc: ${s.vitals.glucose}` : ''}
                      {!s.vitals.systolic && !s.vitals.glucose ? '—' : ''}
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-500">
                      {s.clinicalAction || (s.reviewedBy ? 'Reviewed' : 'Pending review')}
                    </td>
                    <td className="py-3 px-4">
                      {s.hasReferral ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                          {s.referralStatus}
                        </span>
                      ) : (
                        <button
                          onClick={() => openReferralModal(s)}
                          disabled={creatingId === s.id || !s.clientId}
                          className="px-3 py-1.5 bg-brand text-white rounded-full text-[10px] font-bold uppercase tracking-wide hover:scale-105 transition-transform disabled:opacity-50"
                        >
                          {creatingId === s.id ? <Loader2 size={12} className="animate-spin" /> : 'Create Referral'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Referral Creation Modal */}
      {referralModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setReferralModal(null)}>
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-zinc-100 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black tracking-tight">Create Referral</h3>
                <button onClick={() => setReferralModal(null)} className="p-2 hover:bg-zinc-100 rounded-xl"><X size={18} /></button>
              </div>
              <p className="text-sm text-zinc-500 mt-1">for <span className="font-bold text-zinc-700">{referralModal.clientName}</span></p>
            </div>

            <div className="p-6 space-y-5">
              {/* Screening Summary */}
              <div className="bg-zinc-50 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Screening Summary</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="font-bold">{getServiceNeeded(referralModal)}</span>
                </div>
                <div className="flex gap-2 text-xs text-zinc-500">
                  {referralModal.vitals.systolic && referralModal.vitals.diastolic && (
                    <span>BP: {referralModal.vitals.systolic}/{referralModal.vitals.diastolic}</span>
                  )}
                  {referralModal.vitals.glucose && <span>Glucose: {referralModal.vitals.glucose}</span>}
                  <span>Urgency: <span className="font-bold text-zinc-700">{getUrgency(referralModal)}</span></span>
                </div>
              </div>

              {/* Matched Resources */}
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">Refer To</p>
                {(() => {
                  const matched = getMatchedResources(referralModal);
                  if (matched.length === 0) return (
                    <div className="text-sm text-zinc-400 bg-zinc-50 rounded-xl p-4 text-center">
                      No matching medical resources found. Referral will be created for manual assignment.
                    </div>
                  );
                  return (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {matched.map(r => (
                        <button
                          key={r.id || r['Resource Name']}
                          onClick={() => setSelectedResource(r)}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                            selectedResource?.['Resource Name'] === r['Resource Name']
                              ? 'border-brand bg-brand/5'
                              : 'border-zinc-100 hover:border-zinc-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-sm text-zinc-800">{r['Resource Name']}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">{r['Service Category']}</p>
                              {r['Key Offerings'] && (
                                <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{r['Key Offerings'].substring(0, 100)}</p>
                              )}
                            </div>
                            {selectedResource?.['Resource Name'] === r['Resource Name'] && (
                              <CheckCircle size={18} className="text-brand shrink-0 mt-0.5" />
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-zinc-400">
                            {r['Contact Phone'] && <span>{r['Contact Phone']}</span>}
                            {r['Address'] && <span>{r['Address'].substring(0, 40)}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Notes */}
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Notes (optional)</p>
                <textarea
                  value={referralNotes}
                  onChange={e => setReferralNotes(e.target.value)}
                  className="w-full p-3 bg-zinc-50 border-2 border-zinc-100 rounded-xl text-sm resize-none h-20 outline-none focus:border-brand/30"
                  placeholder="Additional context for this referral..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setReferralModal(null)} className="flex-1 py-3 border border-black rounded-full font-bold uppercase tracking-wide text-sm">Cancel</button>
                <button
                  onClick={handleCreateReferral}
                  disabled={creatingId === referralModal.id}
                  className="flex-1 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide text-sm disabled:opacity-50 shadow-elevation-2 flex items-center justify-center gap-2"
                >
                  {creatingId === referralModal.id ? <Loader2 size={14} className="animate-spin" /> : null}
                  {selectedResource ? `Refer to ${selectedResource['Resource Name'].substring(0, 20)}` : 'Create Referral'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralManagement;
