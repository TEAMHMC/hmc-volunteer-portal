

import React, { useMemo, useState, useEffect } from 'react';
import { Volunteer, VolunteerSurveyResponse } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { Users, Clock, ShieldCheck, BarChart3, Star, Percent, MessageSquare, Sparkles, Loader2, FileText, CheckCircle, TrendingUp } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { apiService } from '../services/apiService';

interface AnalyticsDashboardProps {
  volunteers: Volunteer[];
}

const BRAND_COLOR = '#233DFF';

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ volunteers }) => {
  const [activeTab, setActiveTab] = useState<'operations' | 'experience'>('operations');
    
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


export default AnalyticsDashboard;