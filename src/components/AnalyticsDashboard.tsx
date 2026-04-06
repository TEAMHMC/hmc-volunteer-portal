

import React, { useMemo, useState, useEffect } from 'react';
import { Volunteer, VolunteerSurveyResponse } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { Users, Clock, ShieldCheck, BarChart3, Star, Percent, MessageSquare, Sparkles, Loader2, FileText, CheckCircle, TrendingUp, AlertTriangle, Activity, Server, Database, ExternalLink } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { apiService } from '../services/apiService';

interface AnalyticsDashboardProps {
  volunteers: Volunteer[];
  isAdmin?: boolean;
}

const BRAND_COLOR = '#233DFF';

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ volunteers, isAdmin = false }) => {
  const [activeTab, setActiveTab] = useState<'operations' | 'experience' | 'system'>('operations');
    
  const totalVolunteers = volunteers.length;
  const totalHours = useMemo(() => volunteers.reduce((acc, v) => acc + v.hoursContributed, 0), [volunteers]);
  const activeVolunteers = useMemo(() => volunteers.filter(v => v.status === 'active').length, [volunteers]);

  const hoursByRole = useMemo(() => {
    const roleMap: { [key: string]: number } = {};
    volunteers.forEach(v => {
      roleMap[v.role] = (roleMap[v.role] || 0) + v.hoursContributed;
    });
    return Object.entries(roleMap).map(([name, hours]) => ({ name, hours }));
  }, [volunteers]);
  
  const volunteersByRole = useMemo(() => {
    const roleMap: { [key: string]: number } = {};
    volunteers.forEach(v => {
      roleMap[v.role] = (roleMap[v.role] || 0) + 1;
    });
    return Object.entries(roleMap).map(([name, value]) => ({ name, value }));
  }, [volunteers]);

  const COLORS = [BRAND_COLOR, '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

  return (
    <div className="space-y-6 md:space-y-12 animate-in fade-in duration-700 pb-20">
      <header>
        <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Analytics Dashboard</h1>
        <p className="text-zinc-500 mt-4 font-medium text-sm md:text-lg leading-relaxed">Program-wide volunteer operations and experience overview.</p>
      </header>

      <div className="flex bg-white border border-zinc-100 p-2 rounded-2xl md:rounded-[40px] shadow-sm hover:shadow-2xl transition-shadow w-full md:w-fit flex-wrap">
          <button onClick={() => setActiveTab('operations')} className={`flex items-center gap-3 px-4 md:px-8 py-4 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'operations' ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-400 hover:text-zinc-600'}`}><BarChart3 size={16} /> Operations</button>
          <button onClick={() => setActiveTab('experience')} className={`flex items-center gap-3 px-4 md:px-8 py-4 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'experience' ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-400 hover:text-zinc-600'}`}><MessageSquare size={16} /> Volunteer Experience</button>
          {isAdmin && (
            <button onClick={() => setActiveTab('system')} className={`flex items-center gap-3 px-4 md:px-8 py-4 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'system' ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-400 hover:text-zinc-600'}`}><Server size={16} /> System Health</button>
          )}
      </div>
      
      {activeTab === 'operations' && (
        <div className="space-y-4 md:space-y-8 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            <StatCard title="Total Volunteers" value={totalVolunteers} icon={Users} />
            <StatCard title="Total Hours Contributed" value={Math.round(totalHours)} icon={Clock} />
            <StatCard title="Active Volunteers" value={activeVolunteers} icon={ShieldCheck} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-8">
            <div className="xl:col-span-3 bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
              <h3 className="text-base md:text-xl font-bold text-zinc-900 mb-6 uppercase tracking-wider flex items-center gap-3"><BarChart3 size={20} /> Volunteer Hours by Role</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={hoursByRole} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip cursor={{fill: 'rgba(35, 61, 255, 0.05)'}} contentStyle={{ backgroundColor: '#fff', border: '1px solid #f1f1f1', borderRadius: '16px' }} />
                    <Bar dataKey="hours" fill={BRAND_COLOR} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="xl:col-span-2 bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
              <h3 className="text-base md:text-xl font-bold text-zinc-900 mb-6 uppercase tracking-wider">Volunteer Distribution</h3>
               <div style={{ width: '100%', height: 300 }}>
                 <ResponsiveContainer>
                    <PieChart>
                      <Pie data={volunteersByRole} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" fill="#8884d8">
                        {volunteersByRole.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #f1f1f1', borderRadius: '16px' }} />
                      <Legend iconSize={10} wrapperStyle={{fontSize: "12px"}}/>
                    </PieChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'experience' && <VolunteerExperienceView />}
      {activeTab === 'system' && isAdmin && <SystemHealthView />}

    </div>
  );
};

const StatCard: React.FC<{title: string, value: number | string, icon: React.ElementType, unit?: string}> = ({ title, value, icon: Icon, unit }) => (
    <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
        <div className="flex items-center justify-center w-12 h-12 bg-zinc-50 rounded-3xl text-zinc-500 mb-4">
            <Icon size={24} />
        </div>
        <p className="text-sm font-bold text-zinc-400">{title}</p>
        <p className="text-xl md:text-3xl font-black text-zinc-900 mt-1">{value}{unit && <span className="text-xl md:text-3xl text-zinc-300 ml-1">{unit}</span>}</p>
    </div>
);

const VolunteerExperienceView = () => {
  const [surveyResponses, setSurveyResponses] = useState<VolunteerSurveyResponse[]>([]);
  const [surveyStats, setSurveyStats] = useState<{
    totalResponses: number;
    responsesByForm: { [formId: string]: number };
    averageRating: number;
    responsesOverTime: { date: string; count: number }[];
  } | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResponses = async () => {
      setIsLoading(true);
      try {
        // Fetch volunteer feedback via backend API
        const feedback = await apiService.get('/api/volunteer-feedback');
        setSurveyResponses(Array.isArray(feedback) ? feedback : []);

        // Fetch overall survey stats via backend API
        const stats = await apiService.get('/api/survey-stats');
        setSurveyStats(stats || { totalResponses: 0, responsesByForm: {}, averageRating: 0, responsesOverTime: [] });
      } catch (error) {
        console.error('Error fetching survey data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResponses();
  }, []);
  
  useEffect(() => {
    if(surveyResponses.length > 0) {
      const fetchSummary = async () => {
        setIsLoadingSummary(true);
        const feedbackTexts = surveyResponses.map(r => r.feedback);
        try {
          const summary = await geminiService.summarizeVolunteerFeedback(feedbackTexts);
          setAiSummary(summary);
        } catch (error) {
          setAiSummary('Failed to generate summary.');
        } finally {
          setIsLoadingSummary(false);
        }
      };
      fetchSummary();
    }
  }, [surveyResponses]);
  
  const overallSatisfaction = useMemo(() => {
    if (surveyResponses.length === 0) return 'N/A';
    const total = surveyResponses.reduce((acc, r) => acc + r.rating, 0);
    return (total / surveyResponses.length).toFixed(1);
  }, [surveyResponses]);

  const satisfactionByRole = useMemo(() => {
      const roleData: { [key: string]: { total: number, count: number } } = {};
      surveyResponses.forEach(r => {
          if (!roleData[r.volunteerRole]) roleData[r.volunteerRole] = { total: 0, count: 0 };
          roleData[r.volunteerRole].total += r.rating;
          roleData[r.volunteerRole].count++;
      });
      return Object.entries(roleData).map(([name, data]) => ({ name, rating: (data.total / data.count).toFixed(1) }));
  }, [surveyResponses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <StatCard title="Overall Satisfaction" value={overallSatisfaction} unit={overallSatisfaction === 'N/A' ? '' : "/ 5"} icon={Star} />
            <StatCard title="Total Responses" value={surveyStats?.totalResponses || surveyResponses.length} icon={MessageSquare} />
            <StatCard title="Avg Rating (All)" value={surveyStats?.averageRating?.toFixed(1) || 'N/A'} unit={surveyStats?.averageRating ? "/ 5" : ""} icon={TrendingUp} />
            <StatCard title="Form Types" value={Object.keys(surveyStats?.responsesByForm || {}).length} icon={FileText} />
        </div>

        {/* Responses Over Time Chart */}
        {surveyStats?.responsesOverTime && surveyStats.responsesOverTime.length > 0 && (
          <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
            <h3 className="text-base md:text-xl font-bold text-zinc-900 mb-6 uppercase tracking-wider">Survey Collection Trend</h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={surveyStats.responsesOverTime.slice(-30)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke={BRAND_COLOR} strokeWidth={3} dot={{ fill: BRAND_COLOR, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {surveyResponses.length > 0 ? (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-8">
                <div className="xl:col-span-3 bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
                    <h3 className="text-base md:text-xl font-bold text-zinc-900 mb-6 uppercase tracking-wider">Satisfaction by Role</h3>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={satisfactionByRole} layout="vertical" margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                               <XAxis type="number" domain={[0, 5]} hide />
                               <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#6b7280' }} />
                               <Tooltip />
                               <Bar dataKey="rating" fill={BRAND_COLOR} radius={[0, 8, 8, 0]} barSize={15} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                 <div className="xl:col-span-2 bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
                    <h3 className="text-base md:text-xl font-bold text-zinc-900 mb-4 uppercase tracking-wider flex items-center gap-3"><Sparkles size={20} className="text-brand"/> Feedback Summary</h3>
                    {isLoadingSummary ? (
                        <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-brand" /></div>
                    ) : aiSummary ? (
                        <div className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed font-bold">
                            {/* SECURITY: Render as text, not HTML, to prevent XSS */}
                            {aiSummary.replace(/\*/g, '•')}
                        </div>
                    ) : (
                        <p className="text-zinc-400 font-bold text-sm">AI summary will appear when feedback data is available.</p>
                    )}
                </div>
            </div>
          </>
        ) : (
            <div className="text-center py-20 bg-zinc-50 rounded-2xl md:rounded-[40px] border border-zinc-100 border-dashed shadow-sm hover:shadow-2xl transition-shadow">
                <MessageSquare size={48} className="mx-auto text-zinc-300 mb-4" />
                <h3 className="font-bold text-zinc-500">No feedback data available.</h3>
                <p className="text-zinc-400 font-bold text-sm">Collect surveys at events to start seeing insights here.</p>
            </div>
        )}
    </div>
  );
};


interface HealthData {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  services: {
    firestore: string;
    storage: string;
    twilio: string;
    gemini: string;
  };
  metrics: {
    activeUsersLast24h: number;
    failedLoginAttemptsLast24h: number;
  };
  logs: string;
}

const SystemHealthView = () => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.get('/api/health');
      setHealthData(data);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch system health data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  };

  const ServiceBadge = ({ name, status }: { name: string; status: string }) => {
    const isOk = status === 'ok' || status === 'configured';
    const isNotConfigured = status === 'not_configured';
    return (
      <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isOk ? 'bg-emerald-500' : isNotConfigured ? 'bg-zinc-300' : 'bg-rose-500'}`} />
          <span className="text-sm font-bold text-zinc-700">{name}</span>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${isOk ? 'bg-emerald-100 text-emerald-700' : isNotConfigured ? 'bg-zinc-100 text-zinc-400' : 'bg-rose-100 text-rose-700'}`}>
          {status.replace('_', ' ')}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl md:rounded-[40px] p-8 text-center space-y-3">
        <AlertTriangle size={32} className="mx-auto text-rose-400" />
        <p className="font-bold text-rose-700">Failed to load system health data</p>
        <p className="text-sm text-rose-500">{error}</p>
        <button onClick={fetchHealth} className="mt-2 px-6 py-2 bg-rose-600 text-white rounded-full text-sm font-bold hover:bg-rose-700 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (!healthData) return null;

  const isAllOk = healthData.status === 'ok';
  const activeUsers = healthData.metrics.activeUsersLast24h;
  const failedLogins = healthData.metrics.failedLoginAttemptsLast24h;

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in">
      {/* Overall status banner */}
      <div className={`flex items-center gap-4 p-5 md:p-8 rounded-2xl md:rounded-[40px] border ${isAllOk ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isAllOk ? 'bg-emerald-500' : 'bg-amber-500'}`}>
          {isAllOk ? <CheckCircle size={24} className="text-white" /> : <AlertTriangle size={24} className="text-white" />}
        </div>
        <div className="flex-1">
          <p className={`text-lg font-black ${isAllOk ? 'text-emerald-800' : 'text-amber-800'}`}>
            {isAllOk ? 'All Systems Operational' : 'Issues Detected'}
          </p>
          <p className={`text-sm font-bold ${isAllOk ? 'text-emerald-600' : 'text-amber-600'}`}>
            Last checked: {lastRefreshed?.toLocaleTimeString() ?? 'Unknown'} &bull; Server uptime: {formatUptime(healthData.uptime)}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="px-4 py-2 bg-white border border-zinc-200 rounded-full text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors shrink-0"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
        {/* Active users */}
        <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
          <div className="flex items-center justify-center w-12 h-12 bg-brand/10 rounded-3xl text-brand mb-4">
            <Activity size={24} />
          </div>
          <p className="text-sm font-bold text-zinc-400">Active Users (24h)</p>
          <p className="text-3xl font-black text-zinc-900 mt-1">
            {activeUsers < 0 ? 'N/A' : activeUsers.toLocaleString()}
          </p>
          {activeUsers < 0 && <p className="text-xs text-zinc-400 mt-1">Data unavailable</p>}
        </div>

        {/* Failed logins */}
        <div className={`bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border shadow-sm hover:shadow-2xl transition-shadow ${failedLogins > 10 ? 'border-rose-200' : 'border-zinc-100'}`}>
          <div className={`flex items-center justify-center w-12 h-12 rounded-3xl mb-4 ${failedLogins > 10 ? 'bg-rose-100 text-rose-600' : 'bg-zinc-50 text-zinc-500'}`}>
            <ShieldCheck size={24} />
          </div>
          <p className="text-sm font-bold text-zinc-400">Failed Login Attempts (24h)</p>
          <p className={`text-3xl font-black mt-1 ${failedLogins > 10 ? 'text-rose-600' : 'text-zinc-900'}`}>
            {failedLogins < 0 ? 'N/A' : failedLogins.toLocaleString()}
          </p>
          {failedLogins > 10 && <p className="text-xs text-rose-500 mt-1 font-bold">Elevated — review audit logs</p>}
        </div>

        {/* Server uptime */}
        <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
          <div className="flex items-center justify-center w-12 h-12 bg-zinc-50 rounded-3xl text-zinc-500 mb-4">
            <Server size={24} />
          </div>
          <p className="text-sm font-bold text-zinc-400">Server Uptime</p>
          <p className="text-3xl font-black text-zinc-900 mt-1">{formatUptime(healthData.uptime)}</p>
        </div>
      </div>

      {/* Services grid */}
      <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
        <h3 className="text-base md:text-xl font-bold text-zinc-900 mb-6 uppercase tracking-wider flex items-center gap-3">
          <Database size={20} /> Service Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ServiceBadge name="Firestore Database" status={healthData.services.firestore} />
          <ServiceBadge name="Cloud Storage" status={healthData.services.storage} />
          <ServiceBadge name="Twilio (SMS)" status={healthData.services.twilio} />
          <ServiceBadge name="Gemini AI" status={healthData.services.gemini} />
        </div>
      </div>

      {/* Logs note */}
      <div className="flex items-start gap-4 p-5 md:p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
        <ExternalLink size={18} className="text-zinc-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-zinc-700">Detailed Logs</p>
          <p className="text-sm text-zinc-500 mt-1">{healthData.logs}</p>
          <p className="text-xs text-zinc-400 mt-2">
            Application logs are also available in Google Cloud Run → Logs, and authentication audit events are stored in Firestore under <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-zinc-200 text-[11px]">audit_logs</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;