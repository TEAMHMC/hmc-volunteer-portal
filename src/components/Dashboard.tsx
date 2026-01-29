

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowRight, Activity, Calendar, Clock, MapPin, 
  ShieldCheck, Zap, Award, MessageSquare, HeartPulse,
  LogOut, TrendingUp, CheckCircle, ChevronRight, X, Info, BookOpen,
  GraduationCap, User, Users, DollarSign, BarChart3, FileText, Eye, Send, Database, ShieldAlert
} from 'lucide-react';
import { Volunteer, ComplianceStep, Shift, Opportunity, SupportTicket, Announcement, Message } from '../types';
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

  const [activeTab, setActiveTab] = useState<'overview' | 'missions' | 'impact' | 'academy' | 'briefing' | 'docs' | 'profile' | 'directory' | 'referrals' | 'resources' | 'analytics' | 'workflows' | 'forms' | 'my-team'>(getDefaultTab(initialUser.role));
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

  const handleUpdateUser = (updatedUser: Volunteer) => {
    const mergedUser = { ...user, ...updatedUser, id: user.id };
    setUser(mergedUser);
    onUpdateUser(mergedUser);
  };
  
  const handleTourComplete = () => {
    setShowTour(false);
    handleUpdateUser({ ...user, hasCompletedSystemTour: true });
  };

  const navItems = useMemo(() => {
    let items = [
      { id: 'overview', label: 'Overview', icon: Activity },
      { id: 'missions', label: 'My Missions', icon: Calendar },
      { id: 'impact', label: 'Impact Hub', icon: DollarSign },
      { id: 'academy', label: 'Training Academy', icon: GraduationCap },
      { id: 'briefing', label: 'Briefing Hub', icon: MessageSquare },
      { id: 'docs', label: 'Doc Hub', icon: BookOpen },
    ];
    
    if (['Board Member', 'Community Advisory Board'].includes(displayUser.role)) {
      items = items.filter(item => item.id !== 'missions');
    }

    if (displayUser.role === 'Volunteer Lead') {
      items.splice(1, 0, { id: 'my-team', label: 'My Team', icon: Users });
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
  }, [displayUser.role, displayUser.isAdmin]);

  const isOnboarding = displayUser.status === 'onboarding' || displayUser.status === 'applicant';

  return (
    <div className="min-h-screen bg-[#FDFEFE] flex flex-col md:flex-row font-['Inter'] relative">
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

      <aside className={`w-full md:w-[320px] bg-white border-r border-zinc-100 p-10 flex flex-col gap-12 sticky top-0 h-screen overflow-y-auto no-scrollbar ${showBetaBanner ? (viewingAsRole ? 'pt-36' : 'pt-32') : (viewingAsRole ? 'pt-24' : 'pt-20')}`}>
         <div className="flex items-center gap-4 px-2">
            <img src={APP_CONFIG.BRAND.logoUrl} className="w-10 h-10" alt="HMC" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900">Volunteer Hub</span>
         </div>

         <nav className="flex flex-col gap-2">
            {navItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex items-center gap-4 px-6 py-4 rounded-full font-black text-[13px] uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-[#233DFF] text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50'}`}>
                    <item.icon size={18} /> {item.label}
                </button>
            ))}
         </nav>

         <div className="mt-auto space-y-6 pt-10 border-t border-zinc-50">
            <button onClick={() => setActiveTab('profile')} className="flex w-full items-center gap-4 px-2 hover:bg-zinc-50 rounded-2xl py-2 transition-colors">
               <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-black text-xl shadow-xl shrink-0">{displayUser.avatarUrl ? <img src={displayUser.avatarUrl} className="w-full h-full object-cover"/> : displayUser.name.charAt(0)}</div>
               <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-black text-zinc-900 truncate">{displayUser.name}</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate">{displayUser.role}</p>
               </div>
            </button>
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 py-4 text-zinc-300 font-black text-[11px] uppercase tracking-widest hover:text-rose-500 transition-colors">
               <LogOut size={16} /> End Session
            </button>
         </div>
      </aside>

      <main className={`flex-1 p-10 md:p-16 space-y-16 overflow-y-auto h-screen no-scrollbar ${showBetaBanner ? (viewingAsRole ? 'pt-40' : 'pt-36') : (viewingAsRole ? 'pt-28' : 'pt-24')}`}>
         {activeTab === 'overview' && (
           <>
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                <div className="space-y-4">
                  <div className={`px-5 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] w-fit flex items-center gap-2 ${isOnboarding ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                      <div className={`w-2 h-2 rounded-full animate-pulse ${isOnboarding ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {isOnboarding ? 'PROFILE: ONBOARDING' : 'PROFILE: ACTIVE'}
                  </div>
                  <h1 className="text-7xl font-black text-zinc-900 tracking-tighter leading-none italic uppercase">Small acts. <br/><span className="text-[#233DFF]">Big impact.</span></h1>
                </div>
                {user.isAdmin && !viewingAsRole && (
                  <div className="relative">
                    <select
                      onChange={(e) => setViewingAsRole(e.target.value)}
                      className="bg-white border border-zinc-200 rounded-full font-black text-[11px] uppercase tracking-widest pl-12 pr-6 py-4 appearance-none cursor-pointer hover:border-zinc-400"
                    >
                      <option value="">View as Role...</option>
                      {APP_CONFIG.HMC_ROLES.map(role => <option key={role.id} value={role.label}>{role.label}</option>)}
                    </select>
                    <Eye size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  </div>
                )}
                <div className="flex bg-white border border-zinc-100 p-2 rounded-3xl shadow-sm">
                  <div className="px-8 py-5 border-r border-zinc-50 text-center">
                      <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">Hours</p>
                      <p className="text-2xl font-black text-zinc-900">{displayUser.hoursContributed}</p>
                  </div>
                  <div className="px-8 py-5 text-center">
                      <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">Impact XP</p>
                      <p className="text-2xl font-black text-zinc-900">{displayUser.points}</p>
                  </div>
                </div>
            </header>
            {displayUser.role === 'Volunteer Lead' ? <CoordinatorView user={displayUser} allVolunteers={allVolunteers} /> : isOnboarding ? <OnboardingView user={displayUser} onNavigate={setActiveTab} /> : <ActiveVolunteerView user={displayUser} shifts={shifts} onNavigate={setActiveTab} />}
            <div className="pt-8 border-t border-zinc-100">
               <EventExplorer user={displayUser} opportunities={opportunities} onUpdate={handleUpdateUser} />
            </div>
           </>
         )}

         {activeTab === 'academy' && <TrainingAcademy user={displayUser} onUpdate={handleUpdateUser} />}
         {activeTab === 'missions' && <ShiftsComponent userMode={displayUser.isAdmin ? 'admin' : 'volunteer'} user={displayUser} shifts={shifts} setShifts={setShifts} onUpdate={handleUpdateUser} opportunities={opportunities} setOpportunities={setOpportunities} allVolunteers={allVolunteers} />}
         {activeTab === 'my-team' && displayUser.role === 'Volunteer Lead' && <AdminVolunteerDirectory volunteers={allVolunteers.filter(v => v.managedBy === displayUser.id)} setVolunteers={setAllVolunteers} currentUser={displayUser} />}
         {activeTab === 'impact' && <ImpactHub user={displayUser} allVolunteers={allVolunteers} onUpdate={handleUpdateUser} />}
         {activeTab === 'briefing' && <CommunicationHub user={displayUser} userMode={displayUser.isAdmin ? 'admin' : 'volunteer'} allVolunteers={allVolunteers} announcements={announcements} setAnnouncements={setAnnouncements} messages={messages} setMessages={setMessages} supportTickets={supportTickets} setSupportTickets={setSupportTickets} />}
         {activeTab === 'profile' && <MyProfile currentUser={displayUser} onUpdate={handleUpdateUser} />}
         {activeTab === 'docs' && <DocumentationHub />}
         {activeTab === 'directory' && user.isAdmin && <AdminVolunteerDirectory volunteers={allVolunteers} setVolunteers={setAllVolunteers} currentUser={user} />}
         {activeTab === 'referrals' && user.isAdmin && <ReferralsDashboard user={user} allVolunteers={allVolunteers} />}
         {activeTab === 'resources' && user.isAdmin && <ResourceDashboard />}
         {(activeTab === 'analytics' && (user.isAdmin || ['Board Member', 'Community Advisory Board', 'Tech Team', 'Data Analyst'].includes(user.role))) && <AnalyticsDashboard volunteers={allVolunteers} />}
         {activeTab === 'workflows' && user.isAdmin && <AutomatedWorkflows />}
         {activeTab === 'forms' && user.isAdmin && <FormBuilder />}

      </main>
    </div>
  );
};

const OnboardingView = ({ user, onNavigate }: { user: Volunteer, onNavigate: (tab: 'academy' | 'missions') => void }) => {
    const completedModuleIds = user.completedTrainingIds || [];
    return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2 space-y-10">
          <div className="bg-[#233DFF] rounded-[56px] p-12 text-white shadow-2xl relative overflow-hidden group h-full">
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                    <p className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em] mb-12">Your First Steps</p>
                    <h3 className="text-6xl font-black tracking-tighter leading-none mb-8 italic uppercase">Orientation Plan</h3>
                    <p className="text-xl font-medium text-white/80 max-w-xl leading-relaxed">
                      Welcome to the HMC team. We've prepared {user.trainingPlan?.orientationModules.length || 0} orientation modules for your role as <span className="font-black text-white">{user.role}</span>.
                    </p>
                </div>
                <button onClick={() => onNavigate('academy')} className="w-fit mt-12 px-12 py-7 bg-white text-[#233DFF] rounded-full font-black text-lg shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-4">
                    Launch Training Portal <ArrowRight size={24} />
                </button>
              </div>
              <TrendingUp size={600} className="absolute -bottom-40 -right-40 text-white/5 pointer-events-none group-hover:scale-110 transition-transform duration-[4s]" />
          </div>
        </div>

        <div className="space-y-10">
          <div className="bg-white p-12 rounded-[56px] border border-zinc-100 shadow-sm space-y-10">
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-black text-zinc-900 tracking-tight uppercase italic leading-none">Profile Status</h4>
                <ShieldCheck size={24} className="text-[#233DFF]" />
              </div>
              <div className="space-y-8">
                {Object.values(user.compliance).map((step, key) => (
                      <div key={key} className="flex items-center gap-5 group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${step.status === 'completed' || step.status === 'verified' ? 'bg-[#233DFF] text-white border-[#233DFF]' : 'bg-zinc-50 text-zinc-200 border-zinc-50 shadow-inner'}`}>
                            <CheckCircle size={18} strokeWidth={3} />
                        </div>
                        <div className="min-w-0">
                            <p className={`text-sm font-black transition-colors ${step.status === 'completed' || step.status === 'verified' ? 'text-zinc-900' : 'text-zinc-300'}`}>{step.label}</p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{step.status}</p>
                        </div>
                      </div>
                    ))}
              </div>
          </div>
        </div>
    </div>
)};

const ActiveVolunteerView: React.FC<{ user: Volunteer, shifts: Shift[], onNavigate: (tab: 'missions' | 'profile' | 'academy') => void }> = ({ user, shifts, onNavigate }) => {
  const upcomingShifts = shifts
    .filter(s => user.assignedShiftIds?.includes(s.id) && new Date(s.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  
  const nextShift = upcomingShifts[0];
  const pendingTasks = user.tasks?.filter(t => t.status === 'pending') || [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
      <div className="xl:col-span-2 bg-white p-12 rounded-[56px] border border-zinc-100 shadow-sm space-y-10">
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Mission Command</h3>
        {nextShift ? (
          <div className="bg-zinc-50 p-10 rounded-[40px] border border-zinc-100">
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Next Mission</p>
            <h4 className="text-4xl font-black text-zinc-900 tracking-tighter mt-4">{nextShift.roleType}</h4>
            <div className="flex items-center gap-8 mt-6 text-zinc-500 font-medium">
              <span className="flex items-center gap-2"><Calendar size={16}/> {new Date(nextShift.startTime).toLocaleDateString()}</span>
              <span className="flex items-center gap-2"><Clock size={16}/> {new Date(nextShift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
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
