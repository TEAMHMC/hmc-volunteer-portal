

import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowRight, Activity, Calendar, Clock, MapPin,
  ShieldCheck, Zap, Award, MessageSquare, HeartPulse,
  LogOut, TrendingUp, CheckCircle, ChevronRight, X, Info, BookOpen,
  GraduationCap, User, Users, DollarSign, BarChart3, FileText, Eye, Send, Database, ShieldAlert, Briefcase
} from 'lucide-react';
import { Volunteer, ComplianceStep, Shift, Opportunity, SupportTicket, Announcement, Message } from '../types';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import TrainingAcademy from './TrainingAcademy';
import ShiftsComponent from './Shifts';
import CommunicationHub from './CommunicationHub';
import MyProfile from './MyProfile';
import AdminVolunteerDirectory from './AdminVolunteerDirectory';
import ImpactHub from './ImpactHub';
import AnalyticsDashboard from './AnalyticsDashboard';
import AutomatedWorkflows from './AutomatedWorkflows';
import FormBuilder from './FormBuilder';
import ReferralsDashboard from './ReferralsDashboard';
import ResourceDashboard from './ResourceDashboard';
import CoordinatorView from './CoordinatorView';
import SystemTour from './SystemTour';
import DocumentationHub from './DocumentationHub';
import EventExplorer from './EventExplorer';
import HealthScreeningsView from './HealthScreeningsView';
import IntakeReferralsView from './IntakeReferralsView';
import BoardGovernance from './BoardGovernance';

interface DashboardProps {
  user: Volunteer;
  allVolunteers: Volunteer[];
  setAllVolunteers: React.Dispatch<React.SetStateAction<Volunteer[]>>;
  onLogout: () => void;
  onUpdateUser: (updatedUser: Volunteer) => void;
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  shifts: Shift[];
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  supportTickets: SupportTicket[];
  setSupportTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

// Helper to get personalized greeting based on time of day
const getGreeting = (name: string) => {
  const hour = new Date().getHours();
  const firstName = name?.split(' ')[0] || 'there';
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
};

// Helper to get current date formatted nicely
const getFormattedDate = () => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const Dashboard: React.FC<DashboardProps> = (props) => {
  const {
    user: initialUser, allVolunteers, setAllVolunteers, onLogout, onUpdateUser,
    opportunities, setOpportunities, shifts, setShifts, supportTickets, setSupportTickets,
    announcements, setAnnouncements, messages, setMessages
  } = props;

  const [user, setUser] = useState(initialUser);
  const [showTour, setShowTour] = useState(!initialUser.hasCompletedSystemTour && initialUser.status === 'active');

  const [showBetaBanner, setShowBetaBanner] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('hmcBetaBannerDismissed') !== 'true'
  );

  const handleDismissBetaBanner = () => {
    setShowBetaBanner(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hmcBetaBannerDismissed', 'true');
    }
  };

  const getDefaultTab = (role: string) => {
    if (['Board Member', 'Community Advisory Board', 'Tech Team', 'Data Analyst'].includes(role)) return 'analytics';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'missions' | 'impact' | 'academy' | 'briefing' | 'docs' | 'profile' | 'directory' | 'referrals' | 'resources' | 'analytics' | 'workflows' | 'forms' | 'my-team' | 'screenings' | 'intake' | 'governance'>(getDefaultTab(initialUser.role));
  const [viewingAsRole, setViewingAsRole] = useState<string | null>(null);

  useEffect(() => { setUser(initialUser); }, [initialUser]);

  const displayUser = useMemo(() => {
    if (user.isAdmin && viewingAsRole) {
      return { ...user, role: viewingAsRole, isAdmin: false };
    }
    return user;
  }, [user, viewingAsRole]);

  useEffect(() => {
    setActiveTab(getDefaultTab(displayUser.role));
  }, [displayUser.role]);

  // Presence tracking - ping server every 2 minutes to show online status
  useEffect(() => {
    const updatePresence = async () => {
      try {
        await apiService.post('/api/volunteer/presence', {});
      } catch (error) {
        // Silently fail - presence is non-critical
        console.warn('Failed to update presence:', error);
      }
    };

    // Update presence immediately and then every 2 minutes
    updatePresence();
    const intervalId = setInterval(updatePresence, 2 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [user.id]);

  const handleUpdateUser = (updatedUser: Volunteer) => {
    const mergedUser = { ...user, ...updatedUser, id: user.id };
    setUser(mergedUser);
    onUpdateUser(mergedUser);
  };
  
  const handleTourComplete = () => {
    setShowTour(false);
    handleUpdateUser({ ...user, hasCompletedSystemTour: true });
  };

  // Core Volunteer Training - ALL 5 modules required for operational access
  const CORE_TRAINING_MODULES = [
    'hmc_get_to_know_us',
    'hipaa_staff_2025',
    'cmhw_part1',
    'cmhw_part2',
    'hmc_survey_training'
  ];

  const completedTrainingIds = displayUser.completedTrainingIds || [];
  const hasCompletedCoreTraining = CORE_TRAINING_MODULES.every(id => completedTrainingIds.includes(id));

  // Access to operational tools requires: Core Training complete (admins bypass this)
  const canAccessOperationalTools = displayUser.isAdmin || hasCompletedCoreTraining;

  const navItems = useMemo(() => {
    let items = [
      { id: 'overview', label: 'Overview', icon: Activity },
      { id: 'academy', label: 'Training Academy', icon: GraduationCap },
    ];

    // Only show operational tabs (missions) if core training is complete OR user is admin
    if (canAccessOperationalTools) {
      // Insert missions after overview for users with access
      if (!['Board Member', 'Community Advisory Board'].includes(displayUser.role)) {
        items.splice(1, 0, { id: 'missions', label: 'My Missions', icon: Calendar });
      }
    }

    // Always show these tabs
    items.push({ id: 'impact', label: 'Impact Hub', icon: DollarSign });
    items.push({ id: 'briefing', label: 'Communication Hub', icon: MessageSquare });
    items.push({ id: 'docs', label: 'Doc Hub', icon: BookOpen });

    if (displayUser.role === 'Volunteer Lead' && canAccessOperationalTools) {
      items.splice(2, 0, { id: 'my-team', label: 'My Team', icon: Users });
    }

    // Role-specific clinical/operational views
    const medicalRoles = ['Licensed Medical Professional', 'Medical Admin'];
    const clientFacingRoles = ['Core Volunteer', 'Licensed Medical Professional', 'Medical Admin', 'Volunteer Lead'];

    // Health Screenings - for medical professionals
    if (canAccessOperationalTools && medicalRoles.includes(displayUser.role)) {
      items.push({ id: 'screenings', label: 'Health Screenings', icon: HeartPulse });
    }

    // Client Intake & Referrals - for client-facing roles
    if (canAccessOperationalTools && clientFacingRoles.includes(displayUser.role)) {
      items.push({ id: 'intake', label: 'Client Portal', icon: Send });
    }

    // Add governance tab for Board Members and CAB
    if (['Board Member', 'Community Advisory Board'].includes(displayUser.role)) {
        items.push({ id: 'governance', label: 'Governance', icon: Briefcase });
    }

    if(displayUser.isAdmin) {
        items.push({ id: 'directory', label: 'Directory', icon: Users });
        items.push({ id: 'referrals', label: 'Referrals', icon: Send });
        items.push({ id: 'resources', label: 'Resources', icon: Database });
        items.push({ id: 'analytics', label: 'Analytics', icon: BarChart3 });
        items.push({ id: 'workflows', label: 'Workflows', icon: Zap });
        items.push({ id: 'forms', label: 'Forms', icon: FileText });
    } else if (['Board Member', 'Community Advisory Board', 'Tech Team', 'Data Analyst'].includes(displayUser.role)) {
        items.push({ id: 'analytics', label: 'Analytics', icon: BarChart3 });
    }
    return items;
  }, [displayUser.role, displayUser.isAdmin, canAccessOperationalTools]);

  const isOnboarding = displayUser.status === 'onboarding' || displayUser.status === 'applicant';

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100/50 flex flex-col md:flex-row font-['Inter'] relative">
      {showTour && <SystemTour onComplete={handleTourComplete} onClose={handleTourComplete} />}
      
      {showBetaBanner && (
        <div className="fixed top-10 left-0 right-0 h-12 bg-amber-100 border-b border-amber-200 text-amber-900 flex items-center justify-center text-xs font-bold z-[101] md:pl-[320px] gap-4 px-12 md:px-4">
            <ShieldAlert size={16} className="text-amber-600 shrink-0" />
            <span className="text-center">This is a beta release. Please report any issues to <a href="mailto:dev@healthmatters.clinic" className="underline font-black">dev@healthmatters.clinic</a>.</span>
            <button onClick={handleDismissBetaBanner} className="p-2 rounded-full hover:bg-amber-200/50 absolute right-4 md:static">
                <X size={16} />
            </button>
        </div>
      )}

      {viewingAsRole && (
          <div className={`fixed ${showBetaBanner ? 'top-[88px]' : 'top-10'} left-0 right-0 h-12 bg-amber-400 text-zinc-900 flex items-center justify-center text-[11px] font-black uppercase tracking-[0.2em] z-[101] md:pl-[320px] shadow-lg`}>
             <Eye size={16} className="mr-3"/> Viewing as {viewingAsRole}
             <button onClick={() => setViewingAsRole(null)} className="ml-6 bg-zinc-900 text-white px-4 py-1 rounded-full text-[9px] hover:opacity-80">Return to Admin View</button>
          </div>
      )}
      
      <div className={`absolute top-0 left-0 right-0 h-10 bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] z-[100] md:pl-[320px]`}>
         HMC Volunteer Platform v4.1.0-PROD • <span className="text-amber-400 ml-2">Release Environment</span>
      </div>

      <aside className={`w-full md:w-[320px] bg-gradient-to-b from-white to-zinc-50/50 border-r border-zinc-100 p-8 flex flex-col gap-10 sticky top-0 h-screen overflow-y-auto no-scrollbar ${showBetaBanner ? (viewingAsRole ? 'pt-36' : 'pt-32') : (viewingAsRole ? 'pt-24' : 'pt-20')}`}>
         <div className="flex items-center gap-4 px-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#233DFF] to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <img src={APP_CONFIG.BRAND.logoUrl} className="w-8 h-8" alt="HMC" />
            </div>
            <div>
              <span className="text-sm font-black text-zinc-900 tracking-tight block">HMC Portal</span>
              <span className="text-[10px] font-medium text-zinc-400">Volunteer Hub</span>
            </div>
         </div>

         <nav className="flex flex-col gap-1.5">
            {navItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-semibold text-[13px] transition-all ${activeTab === item.id ? 'bg-[#233DFF] text-white shadow-lg shadow-blue-500/25' : 'text-zinc-500 hover:text-zinc-900 hover:bg-white hover:shadow-sm'}`}>
                    <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} /> {item.label}
                </button>
            ))}
         </nav>

         <div className="mt-auto space-y-4 pt-8 border-t border-zinc-100">
            <button onClick={() => setActiveTab('profile')} className="flex w-full items-center gap-4 p-3 hover:bg-white rounded-2xl transition-all hover:shadow-sm group">
               <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 text-white flex items-center justify-center font-bold text-lg shadow-lg shrink-0 overflow-hidden">
                 {displayUser.avatarUrl || displayUser.profilePhoto ? (
                   <img src={displayUser.avatarUrl || displayUser.profilePhoto} className="w-full h-full object-cover" alt="" />
                 ) : (
                   displayUser.name?.charAt(0)?.toUpperCase()
                 )}
               </div>
               <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold text-zinc-900 truncate group-hover:text-[#233DFF] transition-colors">{displayUser.name}</p>
                  <p className="text-[10px] font-medium text-zinc-400 truncate">{displayUser.role}</p>
               </div>
               <ChevronRight size={16} className="text-zinc-300 group-hover:text-[#233DFF] transition-colors" />
            </button>
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3 text-zinc-400 font-medium text-sm hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
               <LogOut size={16} /> Sign Out
            </button>
         </div>
      </aside>

      <main className={`flex-1 p-10 md:p-16 space-y-16 overflow-y-auto h-screen no-scrollbar ${showBetaBanner ? (viewingAsRole ? 'pt-40' : 'pt-36') : (viewingAsRole ? 'pt-28' : 'pt-24')}`}>
         {activeTab === 'overview' && (
           <>
            <header className="space-y-8">
                {/* Personalized Greeting Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-zinc-400">{getFormattedDate()}</p>
                    <h1 className="text-5xl md:text-6xl font-black text-zinc-900 tracking-tight leading-[1.1]">
                      {getGreeting(displayUser.name)}.
                    </h1>
                    <p className="text-lg text-zinc-500 font-medium max-w-lg">
                      {isOnboarding
                        ? "Let's get you set up and ready to make an impact in our community."
                        : "Ready to continue making a difference? Here's your dashboard."}
                    </p>
                  </div>

                  {/* Stats Card - Apple-style glass effect */}
                  <div className="flex bg-white/80 backdrop-blur-xl border border-zinc-200/50 p-1.5 rounded-[28px] shadow-lg shadow-zinc-200/50">
                    <div className="px-8 py-6 text-center">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Hours</p>
                        <p className="text-4xl font-black text-zinc-900 tracking-tight">{displayUser.hoursContributed}</p>
                    </div>
                    <div className="w-px bg-zinc-100 my-4" />
                    <div className="px-8 py-6 text-center">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Impact XP</p>
                        <p className="text-4xl font-black text-[#233DFF] tracking-tight">{displayUser.points}</p>
                    </div>
                  </div>
                </div>

                {/* Status & Admin Controls Row */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className={`px-5 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2.5 ${isOnboarding ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                      <div className={`w-2 h-2 rounded-full animate-pulse ${isOnboarding ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {isOnboarding ? 'Onboarding' : 'Active Volunteer'}
                  </div>

                  <div className="px-5 py-2.5 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">
                    {displayUser.role}
                  </div>

                  {user.isAdmin && !viewingAsRole && (
                    <div className="relative ml-auto">
                      <select
                        onChange={(e) => setViewingAsRole(e.target.value)}
                        className="bg-zinc-900 text-white border-0 rounded-full font-black text-[10px] uppercase tracking-widest pl-10 pr-6 py-3 appearance-none cursor-pointer hover:bg-zinc-800 transition-colors shadow-lg"
                      >
                        <option value="">View as Role...</option>
                        {APP_CONFIG.HMC_ROLES.map(role => <option key={role.id} value={role.label}>{role.label}</option>)}
                      </select>
                      <Eye size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    </div>
                  )}
                </div>
            </header>
            {displayUser.role === 'Volunteer Lead' ? <CoordinatorView user={displayUser} allVolunteers={allVolunteers} /> : isOnboarding ? <OnboardingView user={displayUser} onNavigate={setActiveTab} /> : <ActiveVolunteerView user={displayUser} shifts={shifts} opportunities={opportunities} onNavigate={setActiveTab} hasCompletedCoreTraining={hasCompletedCoreTraining} />}
            <div className="pt-8 border-t border-zinc-100">
               <EventExplorer user={displayUser} opportunities={opportunities} setOpportunities={setOpportunities} onUpdate={handleUpdateUser} canSignUp={canAccessOperationalTools} shifts={shifts} setShifts={setShifts} />
            </div>
           </>
         )}

         {activeTab === 'academy' && <TrainingAcademy user={displayUser} onUpdate={handleUpdateUser} />}
         {activeTab === 'missions' && canAccessOperationalTools && <ShiftsComponent userMode={displayUser.isAdmin ? 'admin' : 'volunteer'} user={displayUser} shifts={shifts} setShifts={setShifts} onUpdate={handleUpdateUser} opportunities={opportunities} setOpportunities={setOpportunities} allVolunteers={allVolunteers} />}
         {activeTab === 'my-team' && displayUser.role === 'Volunteer Lead' && canAccessOperationalTools && <AdminVolunteerDirectory volunteers={allVolunteers.filter(v => v.managedBy === displayUser.id)} setVolunteers={setAllVolunteers} currentUser={displayUser} />}
         {activeTab === 'impact' && <ImpactHub user={displayUser} allVolunteers={allVolunteers} onUpdate={handleUpdateUser} />}
         {activeTab === 'briefing' && <CommunicationHub user={displayUser} userMode={displayUser.isAdmin ? 'admin' : 'volunteer'} allVolunteers={allVolunteers} announcements={announcements} setAnnouncements={setAnnouncements} messages={messages} setMessages={setMessages} supportTickets={supportTickets} setSupportTickets={setSupportTickets} />}
         {activeTab === 'profile' && <MyProfile currentUser={displayUser} onUpdate={handleUpdateUser} />}
         {activeTab === 'docs' && <DocumentationHub currentUser={displayUser} />}
         {activeTab === 'directory' && user.isAdmin && <AdminVolunteerDirectory volunteers={allVolunteers} setVolunteers={setAllVolunteers} currentUser={user} />}
         {activeTab === 'referrals' && user.isAdmin && <ReferralsDashboard user={user} allVolunteers={allVolunteers} />}
         {activeTab === 'resources' && user.isAdmin && <ResourceDashboard />}
         {(activeTab === 'analytics' && (user.isAdmin || ['Board Member', 'Community Advisory Board', 'Tech Team', 'Data Analyst'].includes(user.role))) && <AnalyticsDashboard volunteers={allVolunteers} />}
         {activeTab === 'workflows' && user.isAdmin && <AutomatedWorkflows />}
         {activeTab === 'forms' && user.isAdmin && <FormBuilder />}
         {activeTab === 'screenings' && canAccessOperationalTools && ['Licensed Medical Professional', 'Medical Admin'].includes(displayUser.role) && (
           <HealthScreeningsView
             user={displayUser}
             shift={{ id: 'dashboard-session', opportunityId: '', startTime: new Date().toISOString(), endTime: '', roleType: 'Clinical', slotsTotal: 1, slotsFilled: 0, assignedVolunteerIds: [] }}
             onLog={() => {}}
           />
         )}
         {activeTab === 'intake' && canAccessOperationalTools && ['Core Volunteer', 'Licensed Medical Professional', 'Medical Admin', 'Volunteer Lead'].includes(displayUser.role) && (
           <IntakeReferralsView
             user={displayUser}
             shift={{ id: 'dashboard-session', opportunityId: '', startTime: new Date().toISOString(), endTime: '', roleType: 'Clinical', slotsTotal: 1, slotsFilled: 0, assignedVolunteerIds: [] }}
             onLog={() => {}}
           />
         )}
         {activeTab === 'governance' && ['Board Member', 'Community Advisory Board'].includes(displayUser.role) && (
           <BoardGovernance user={displayUser} />
         )}

      </main>
    </div>
  );
};

const OnboardingView = ({ user, onNavigate }: { user: Volunteer, onNavigate: (tab: 'academy' | 'missions') => void }) => {
    const completedModuleIds = user.completedTrainingIds || [];
    return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          {/* Hero Card - Glass morphism style */}
          <div className="bg-gradient-to-br from-[#233DFF] via-[#4F5FFF] to-indigo-600 rounded-[40px] p-10 md:p-12 text-white shadow-2xl shadow-blue-500/20 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
              <div className="relative z-10 flex flex-col justify-between min-h-[280px]">
                <div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-[11px] font-bold uppercase tracking-widest mb-8">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      Getting Started
                    </div>
                    <h3 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.1] mb-6">
                      Welcome to the team, {user.name?.split(' ')[0]}.
                    </h3>
                    <p className="text-lg font-medium text-white/80 max-w-lg leading-relaxed">
                      Complete your orientation training to unlock community missions and start making an impact.
                    </p>
                </div>
                <button onClick={() => onNavigate('academy')} className="w-fit mt-8 px-8 py-5 bg-white text-[#233DFF] rounded-2xl font-bold text-sm shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group/btn">
                    <div className="w-2 h-2 rounded-full bg-[#233DFF]" />
                    Start Training
                    <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
              <TrendingUp size={400} className="absolute -bottom-20 -right-20 text-white/5 pointer-events-none group-hover:scale-110 transition-transform duration-[3s]" />
          </div>
        </div>

        <div className="space-y-6">
          {/* Profile Status Card - Glass effect */}
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[32px] border border-zinc-200/50 shadow-lg shadow-zinc-200/30 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-zinc-900 tracking-tight">Profile Status</h4>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#233DFF] to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <ShieldCheck size={18} className="text-white" />
                </div>
              </div>
              <div className="space-y-4">
                {Object.values(user.compliance).map((step, key) => (
                      <div key={key} className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-50 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${step.status === 'completed' || step.status === 'verified' ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-300'}`}>
                            <CheckCircle size={16} strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold transition-colors ${step.status === 'completed' || step.status === 'verified' ? 'text-zinc-900' : 'text-zinc-400'}`}>{step.label}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${step.status === 'completed' || step.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                          {step.status}
                        </span>
                      </div>
                    ))}
              </div>
          </div>
        </div>
    </div>
)};

const ActiveVolunteerView: React.FC<{ user: Volunteer, shifts: Shift[], opportunities: Opportunity[], onNavigate: (tab: 'missions' | 'profile' | 'academy') => void, hasCompletedCoreTraining: boolean }> = ({ user, shifts, opportunities, onNavigate, hasCompletedCoreTraining }) => {
  // Get upcoming shifts the user is assigned to
  const upcomingShifts = shifts
    .filter(s => user.assignedShiftIds?.includes(s.id) && new Date(s.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Also get events from rsvpedEventIds that may not have corresponding shifts
  const rsvpedOpportunities = opportunities
    .filter(o => user.rsvpedEventIds?.includes(o.id) && new Date(o.date) > new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Combine: prefer shifts if available, otherwise use opportunity data
  const nextShift = upcomingShifts[0];
  const nextRsvpedEvent = rsvpedOpportunities[0];

  // Determine what to show - prioritize shifts, fallback to rsvped events
  const hasUpcomingMission = nextShift || nextRsvpedEvent;
  const pendingTasks = user.tasks?.filter(t => t.status === 'pending') || [];

  // If core training not complete, show training required message
  if (!hasCompletedCoreTraining) {
    const completedCount = [
      user.completedTrainingIds?.includes('hmc_get_to_know_us'),
      user.completedTrainingIds?.includes('hipaa_staff_2025'),
      user.completedTrainingIds?.includes('cmhw_part1'),
      user.completedTrainingIds?.includes('cmhw_part2'),
      user.completedTrainingIds?.includes('hmc_survey_training')
    ].filter(Boolean).length;
    const progress = (completedCount / 5) * 100;

    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          {/* Training Required Card - Modern gradient */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-[32px] p-8 md:p-10 border border-amber-200/50 shadow-lg shadow-amber-100/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-200/20 to-orange-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-start gap-5 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                  <GraduationCap size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-amber-900 tracking-tight mb-2">Complete Your Training</h3>
                  <p className="text-amber-700 font-medium">
                    {completedCount} of 5 modules completed
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="h-2 bg-amber-200/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <p className="text-amber-800 font-medium leading-relaxed mb-6">
                Complete all required modules to unlock community missions and start making an impact.
              </p>

              {/* Training Checklist */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-amber-200/50 mb-6 space-y-3">
                {[
                  { id: 'hmc_get_to_know_us', label: 'HMC Orientation' },
                  { id: 'hipaa_staff_2025', label: 'HIPAA Training' },
                  { id: 'cmhw_part1', label: 'Community Health Worker (Part 1)' },
                  { id: 'cmhw_part2', label: 'Community Health Worker (Part 2)' },
                  { id: 'hmc_survey_training', label: 'Survey Administration' }
                ].map(item => {
                  const isComplete = user.completedTrainingIds?.includes(item.id);
                  return (
                    <div key={item.id} className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${isComplete ? 'bg-emerald-50' : ''}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isComplete ? 'bg-emerald-500 text-white' : 'bg-amber-200 text-amber-400'}`}>
                        <CheckCircle size={14} strokeWidth={3} />
                      </div>
                      <span className={`text-sm font-medium ${isComplete ? 'text-emerald-700' : 'text-amber-700'}`}>{item.label}</span>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => onNavigate('academy')} className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-amber-500/30 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-white" />
                Continue Training
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-10">
          <div className="bg-zinc-50 p-12 rounded-[56px] border border-zinc-100 shadow-inner space-y-10">
            <h4 className="text-xl font-black text-zinc-900 tracking-tight uppercase italic leading-none">Quick Actions</h4>
            <div className="space-y-4">
              <button onClick={() => onNavigate('academy')} className="w-full text-left p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between group hover:border-[#233DFF]">
                <span className="font-black text-zinc-800">Continue Training</span><ChevronRight className="text-zinc-300 group-hover:text-[#233DFF]"/>
              </button>
              <button onClick={() => onNavigate('profile')} className="w-full text-left p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between group hover:border-[#233DFF]">
                <span className="font-black text-zinc-800">Update Profile</span><ChevronRight className="text-zinc-300 group-hover:text-[#233DFF]"/>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
      <div className="xl:col-span-2 bg-white p-12 rounded-[56px] border border-zinc-100 shadow-sm space-y-10">
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Mission Command</h3>
        {hasUpcomingMission ? (
          <div className="bg-zinc-50 p-10 rounded-[40px] border border-zinc-100">
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Next Mission</p>
            {nextShift ? (
              <>
                <h4 className="text-4xl font-black text-zinc-900 tracking-tighter mt-4">{nextShift.roleType}</h4>
                <div className="flex items-center gap-8 mt-6 text-zinc-500 font-medium">
                  <span className="flex items-center gap-2"><Calendar size={16}/> {new Date(nextShift.startTime).toLocaleDateString()}</span>
                  <span className="flex items-center gap-2"><Clock size={16}/> {new Date(nextShift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </>
            ) : nextRsvpedEvent && (
              <>
                <h4 className="text-4xl font-black text-zinc-900 tracking-tighter mt-4">{nextRsvpedEvent.title}</h4>
                <div className="flex items-center gap-8 mt-6 text-zinc-500 font-medium flex-wrap">
                  <span className="flex items-center gap-2"><Calendar size={16}/> {new Date(nextRsvpedEvent.date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-2"><MapPin size={16}/> {nextRsvpedEvent.serviceLocation}</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-10 bg-zinc-50 rounded-[40px] border border-zinc-100 text-center">
            <p className="text-lg font-bold text-zinc-400">No upcoming missions.</p>
            <button onClick={() => onNavigate('missions')} className="mt-4 px-6 py-3 bg-zinc-900 text-white rounded-full font-black text-xs uppercase tracking-widest">Find a Mission</button>
          </div>
        )}

        <div>
          <h4 className="text-lg font-black text-zinc-900 mb-4 px-2">Pending Assignments</h4>
          <div className="space-y-3">
             {pendingTasks.length > 0 ? pendingTasks.map(task => (
                <div key={task.id} className="p-5 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-between">
                  <p className="font-bold text-zinc-700">{task.title}</p>
                  <button onClick={() => onNavigate('profile')} className="text-xs font-bold text-zinc-400 hover:text-zinc-800">View</button>
                </div>
             )) : <p className="text-sm text-zinc-400 italic px-2">No pending assignments.</p>}
          </div>
        </div>
      </div>
      <div className="space-y-10">
        <div className="bg-zinc-50 p-12 rounded-[56px] border border-zinc-100 shadow-inner space-y-10">
            <h4 className="text-xl font-black text-zinc-900 tracking-tight uppercase italic leading-none">Quick Actions</h4>
            <div className="space-y-4">
              <button onClick={() => onNavigate('missions')} className="w-full text-left p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between group hover:border-[#233DFF]">
                <span className="font-black text-zinc-800">Find Missions</span><ChevronRight className="text-zinc-300 group-hover:text-[#233DFF]"/>
              </button>
               <button onClick={() => onNavigate('academy')} className="w-full text-left p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between group hover:border-[#233DFF]">
                <span className="font-black text-zinc-800">Continue Training</span><ChevronRight className="text-zinc-300 group-hover:text-[#233DFF]"/>
              </button>
               <button onClick={() => onNavigate('profile')} className="w-full text-left p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between group hover:border-[#233DFF]">
                <span className="font-black text-zinc-800">Update Profile</span><ChevronRight className="text-zinc-300 group-hover:text-[#233DFF]"/>
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};


export default Dashboard;
