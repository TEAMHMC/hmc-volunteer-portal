
import React, { useState, useEffect } from 'react';
import { ClientRecord, ReferralRecord, ReferralResource, PartnerAgency, ServiceFeedback } from '../types';
import { apiService } from '../services/apiService';
import {
  Users, FileText, Building2, Star, Clock, CheckCircle, AlertTriangle,
  Search, Plus, X, Loader2, ChevronRight, Filter, BarChart3, TrendingUp,
  Phone, Mail, MapPin, Globe, Calendar, ArrowRight, RefreshCw
} from 'lucide-react';
import { toastService } from '../services/toastService';

interface ReferralManagementProps {
  isAdmin: boolean;
}

type TabId = 'dashboard' | 'clients' | 'referrals' | 'resources' | 'partners' | 'feedback';

const ReferralManagement: React.FC<ReferralManagementProps> = ({ isAdmin }) => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [resources, setResources] = useState<ReferralResource[]>([]);
  const [partners, setPartners] = useState<PartnerAgency[]>([]);
  const [feedback, setFeedback] = useState<ServiceFeedback[]>([]);
  const [slaReport, setSlaReport] = useState<any>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [clientsData, referralsData, resourcesData, partnersData, feedbackData, slaData] = await Promise.all([
        apiService.get('/api/clients').catch(() => []),
        apiService.get('/api/referrals').catch(() => []),
        apiService.get('/api/resources').catch(() => []),
        apiService.get('/api/partners').catch(() => []),
        apiService.get('/api/feedback').catch(() => []),
        apiService.get('/api/referrals/sla-report').catch(() => null),
      ]);
      setClients(clientsData);
      setReferrals(referralsData);
      setResources(resourcesData);
      setPartners(partnersData);
      setFeedback(feedbackData);
      setSlaReport(slaData);
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
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-brand" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Referral Management</h1>
          <p className="text-zinc-500 mt-4 font-bold text-lg leading-relaxed">Client intake, referrals, and service coordination</p>
        </div>
        <button
          onClick={fetchAllData}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 border border-black text-zinc-700 rounded-full text-sm font-bold uppercase tracking-wide hover:bg-zinc-200"
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
      <div className="bg-white rounded-card-lg border border-zinc-100 shadow-elevation-1 overflow-hidden">
        {activeTab === 'dashboard' && (
          <DashboardView
            clients={clients}
            referrals={referrals}
            resources={resources}
            slaReport={slaReport}
          />
        )}
        {activeTab === 'clients' && (
          <ClientsView clients={clients} onRefresh={fetchAllData} />
        )}
        {activeTab === 'referrals' && (
          <ReferralsView referrals={referrals} clients={clients} resources={resources} onRefresh={fetchAllData} />
        )}
        {activeTab === 'resources' && (
          <ResourcesView resources={resources} onRefresh={fetchAllData} />
        )}
        {activeTab === 'partners' && (
          <PartnersView partners={partners} onRefresh={fetchAllData} />
        )}
        {activeTab === 'feedback' && (
          <FeedbackView feedback={feedback} resources={resources} />
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
    <div className="p-8 space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className={`p-6 rounded-3xl border bg-${kpi.color}-50 border-${kpi.color}-100 shadow-elevation-1`}>
            <div className={`w-12 h-12 rounded-2xl bg-${kpi.color}-100 text-${kpi.color}-600 flex items-center justify-center mb-4`}>
              {kpi.icon}
            </div>
            <p className="text-3xl font-black text-zinc-900">{kpi.value}</p>
            <p className="text-sm font-bold text-zinc-400">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* SLA Report */}
      {slaReport && (
        <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 shadow-elevation-1">
          <h3 className="text-xl font-bold text-zinc-900 mb-4 flex items-center gap-2">
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
        <div className="p-6 bg-rose-50 rounded-3xl border border-rose-200 shadow-elevation-1">
          <h3 className="text-xl font-bold text-rose-800 mb-4 flex items-center gap-2">
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
        <h3 className="text-xl font-bold text-zinc-900 mb-4">Recent Referrals</h3>
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
const ClientsView: React.FC<{ clients: ClientRecord[]; onRefresh: () => void }> = ({ clients, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);

  const filteredClients = clients.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
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
          className="flex items-center gap-2 px-5 py-3 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide"
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
              <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase">Intake Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredClients.map(client => (
              <tr key={client.id} className="hover:bg-zinc-50 cursor-pointer">
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
                <td className="px-4 py-4 text-sm text-zinc-500">
                  {client.intakeDate ? new Date(client.intakeDate).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
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
    <div className="p-8">
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
    <div className={`p-6 rounded-card-lg border shadow-elevation-1 ${isOverdue ? 'bg-rose-50 border-rose-200' : 'bg-white border-zinc-100'}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xl font-bold text-zinc-900">{referral.clientName}</h3>
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
        <div className="flex gap-2">
          <button
            onClick={() => updateStatus('In Progress')}
            disabled={isUpdating}
            className="px-4 py-2 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide hover:bg-brand/90 disabled:opacity-50"
          >
            Mark In Progress
          </button>
          <button
            onClick={() => updateStatus('Completed')}
            disabled={isUpdating}
            className="px-4 py-2 bg-brand border border-black text-white rounded-full text-sm font-bold uppercase tracking-wide hover:bg-brand/90 disabled:opacity-50"
          >
            Mark Completed
          </button>
        </div>
      )}
    </div>
  );
};

// Resources View
const ResourcesView: React.FC<{ resources: ReferralResource[]; onRefresh: () => void }> = ({ resources, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredResources = resources.filter(r =>
    r['Resource Name'].toLowerCase().includes(searchQuery.toLowerCase()) ||
    r['Service Category']?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8">
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
          <div key={i} className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 shadow-elevation-1 hover:border-brand/20 transition-colors">
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
    </div>
  );
};

// Partners View
const PartnersView: React.FC<{ partners: PartnerAgency[]; onRefresh: () => void }> = ({ partners, onRefresh }) => {
  const [showNewPartner, setShowNewPartner] = useState(false);

  return (
    <div className="p-8">
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowNewPartner(true)}
          className="flex items-center gap-2 px-5 py-3 bg-brand border border-black text-white rounded-full font-bold text-sm uppercase tracking-wide"
        >
          <Plus size={18} /> Add Partner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {partners.map(partner => (
          <div key={partner.id} className="p-6 bg-white rounded-3xl border border-zinc-100 shadow-elevation-1">
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
    <div className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 shadow-elevation-1 text-center">
          <Star size={32} className="mx-auto text-amber-500 mb-2" />
          <p className="text-3xl font-black text-zinc-900">{avgRating}</p>
          <p className="text-sm font-bold text-zinc-400">Average Rating</p>
        </div>
        <div className="p-6 bg-brand/5 rounded-3xl border border-brand/10 shadow-elevation-1 text-center">
          <FileText size={32} className="mx-auto text-brand mb-2" />
          <p className="text-3xl font-black text-zinc-900">{feedback.length}</p>
          <p className="text-sm font-bold text-zinc-400">Total Feedback</p>
        </div>
        <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 shadow-elevation-1 text-center">
          <TrendingUp size={32} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-3xl font-black text-zinc-900">
            {feedback.filter(f => f.wouldRecommend).length}
          </p>
          <p className="text-sm font-bold text-zinc-400">Would Recommend</p>
        </div>
      </div>

      <div className="space-y-4">
        {feedback.map(f => (
          <div key={f.id} className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 shadow-elevation-1">
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
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-zinc-900">New Client Intake</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">First Name *</label>
              <input
                required
                type="text"
                value={formData.firstName || ''}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Last Name *</label>
              <input
                required
                type="text"
                value={formData.lastName || ''}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Phone *</label>
              <input
                required
                type="tel"
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Date of Birth</label>
              <input
                type="date"
                value={formData.dob || ''}
                onChange={e => setFormData({ ...formData, dob: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Primary Language</label>
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
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">SPA (Service Planning Area)</label>
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
          <div className="flex justify-end gap-4 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-6 py-3 bg-zinc-100 border border-black text-zinc-700 rounded-full font-bold uppercase tracking-wide">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="px-6 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide disabled:opacity-50">
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
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900">Add Partner Agency</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Agency Name *</label>
            <input
              required
              type="text"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Type</label>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Contact Name</label>
              <input
                type="text"
                value={formData.contactName || ''}
                onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Contact Email</label>
              <input
                type="email"
                value={formData.contactEmail || ''}
                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Contact Phone</label>
            <input
              type="tel"
              value={formData.contactPhone || ''}
              onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
              className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm"
            />
          </div>
          <div className="flex justify-end gap-4 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-6 py-3 bg-zinc-100 border border-black text-zinc-700 rounded-full font-bold uppercase tracking-wide">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="px-6 py-3 bg-brand border border-black text-white rounded-full font-bold uppercase tracking-wide disabled:opacity-50">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Add Partner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReferralManagement;
