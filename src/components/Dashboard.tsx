

import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowRight, Activity, Calendar, Clock, MapPin,
  ShieldCheck, Zap, Award, MessageSquare, HeartPulse,
  LogOut, TrendingUp, CheckCircle, ChevronRight, X, Info, BookOpen,
  GraduationCap, User, Users, DollarSign, BarChart3, FileText, Eye, Send, Database, ShieldAlert, Briefcase,
  Bell, Menu, CalendarDays
} from 'lucide-react';
import { Volunteer, ComplianceStep, Shift, Opportunity, SupportTicket, Announcement, Message } from '../types';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import { hasCompletedModule, hasCompletedAllModules, TIER_2_IDS, TIER_2_CORE_IDS } from '../constants';
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
import ReferralManagement from './ReferralManagement';
import ResourceDashboard from './ResourceDashboard';
import CoordinatorView from './CoordinatorView';
import SystemTour from './SystemTour';
import DocumentationHub from './DocumentationHub';
import EventExplorer from './EventExplorer';
import HealthScreeningsView from './HealthScreeningsView';
import IntakeReferralsView from './IntakeReferralsView';
import BoardGovernance from './BoardGovernance';
import LiveChatDashboard from './LiveChatDashboard';
import OrgCalendar from './OrgCalendar';

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
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [commHubTab, setCommHubTab] = useState<'broadcasts' | 'briefing' | 'support' | undefined>(undefined);

  const handleDismissBetaBanner = () => {
    setShowBetaBanner(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hmcBetaBannerDismissed', 'true');
    }
  };

  const getDefaultTab = (_role: string) => {
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'missions' | 'impact' | 'academy' | 'briefing' | 'docs' | 'calendar' | 'profile' | 'directory' | 'referrals' | 'resources' | 'analytics' | 'workflows' | 'forms' | 'my-team' | 'screenings' | 'intake' | 'governance' | 'livechat' | 'meetings'>(getDefaultTab(initialUser.role));
  const [viewingAsRole, setViewingAsRole] = useState<string | null>(null);

  useEffect(() => { setUser(initialUser); }, [initialUser]);

  const displayUser = useMemo(() => {
    if (user.isAdmin && viewingAsRole) {
      return { ...user, role: viewingAsRole, isAdmin: false };
    }
    return user;
  }, [user, viewingAsRole]);

  // Only reset tab when admin switches role preview
  useEffect(() => {
    if (viewingAsRole) setActiveTab('overview');
  }, [viewingAsRole]);

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

    // Update presence immediately and then every 30 seconds
    updatePresence();
    const intervalId = setInterval(updatePresence, 30 * 1000);

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

  // Core Volunteer Training — governance roles only need Tier 1, operational roles need Tier 1 + Tier 2
  const GOVERNANCE_ROLES = ['Board Member', 'Community Advisory Board'];
  const isGovernanceRole = GOVERNANCE_ROLES.includes(displayUser.role);

  // Portal access: Tier 1 only (2 orientation videos)
  const PORTAL_REQUIRED_MODULES = ['hmc_orientation', 'hmc_champion'];
  const completedTrainingIds = displayUser.completedTrainingIds || [];
  const hasCompletedOrientation = PORTAL_REQUIRED_MODULES.every(id =>
    hasCompletedModule(completedTrainingIds, id));
  const hasCompletedCoreTraining = hasCompletedOrientation;

  // Portal unlocks after Tier 1 orientation (or admin)
  const isOperationalEligible = displayUser.isAdmin || hasCompletedOrientation;
  // Legacy alias
  const canAccessOperationalTools = isOperationalEligible;

  // My Missions: requires coreVolunteerStatus (set after Tier 1 + Tier 2 Core) or admin
  const canAccessMissions = displayUser.isAdmin || (displayUser.coreVolunteerStatus === true);

  // Notification counts
  const [dismissedNotifTs, setDismissedNotifTs] = useState<string>(
    () => (typeof window !== 'undefined' && localStorage.getItem('hmcNotifDismissedAt')) || ''
  );

  const unreadDMs = useMemo(() => {
    return messages.filter(m => m.senderId !== displayUser.id && !m.read && m.recipientId !== 'general').length;
  }, [messages, displayUser.id]);

  const isCoordinatorOrLead = displayUser.role.includes('Coordinator') || displayUser.role.includes('Lead');
  const myTickets = useMemo(() => {
    return supportTickets.filter(t => {
      if (t.status === 'closed') return false;
      // Only show tickets assigned to you, submitted by you, or (admin sees all)
      if (displayUser.isAdmin) return t.assignedTo === displayUser.id || t.submittedBy === displayUser.id || t.status === 'open';
      return t.submittedBy === displayUser.id || t.assignedTo === displayUser.id;
    });
  }, [supportTickets, displayUser.id, displayUser.isAdmin]);
  const openTicketsCount = myTickets.length;

  const newApplicantsCount = useMemo(() => {
    if (!displayUser.isAdmin) return 0;
    return allVolunteers.filter(v => v.applicationStatus === 'pendingReview').length;
  }, [allVolunteers, displayUser.isAdmin]);

  const totalNotifications = unreadDMs + openTicketsCount + newApplicantsCount;

  const handleDismissNotifications = () => {
    const now = new Date().toISOString();
    setDismissedNotifTs(now);
    localStorage.setItem('hmcNotifDismissedAt', now);
  };

  const navItems = useMemo(() => {
    let items: { id: string; label: string; icon: any; badge?: number }[] = [
      { id: 'overview', label: 'Overview', icon: Activity },
      { id: 'academy', label: 'Training Academy', icon: GraduationCap },
    ];

    // My Missions: requires coreVolunteerStatus (Tier 1 + Tier 2 Core complete) or admin
    if (canAccessMissions) {
      // Governance roles see My Missions only if they opted in by completing Tier 2
      const governanceCompletedTier2 = isGovernanceRole && hasCompletedAllModules(completedTrainingIds, TIER_2_IDS);
      if (!isGovernanceRole || governanceCompletedTier2) {
        items.splice(1, 0, { id: 'missions', label: 'My Missions', icon: Calendar });
      }
    }

    // Always show these tabs
    items.push({ id: 'impact', label: 'Impact Hub', icon: DollarSign });
    items.push({ id: 'briefing', label: 'Communication Hub', icon: MessageSquare, badge: unreadDMs + openTicketsCount });
    items.push({ id: 'docs', label: 'Doc Hub', icon: BookOpen });
    items.push({ id: 'calendar', label: 'Calendar', icon: CalendarDays });

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

    // Live Chat Support - for client-facing roles to help website visitors
    if (canAccessOperationalTools && clientFacingRoles.includes(displayUser.role)) {
      items.push({ id: 'livechat', label: 'Live Chat', icon: MessageSquare });
    }

    // Event management for Events Leads/Coordinators and Outreach Leads
    if (canAccessOperationalTools && ['Events Lead', 'Events Coordinator', 'Outreach & Engagement Lead'].includes(displayUser.role)) {
      items.push({ id: 'event-management', label: 'Event Management', icon: Calendar });
    }

    // Add governance tab for Board Members and CAB
    if (['Board Member', 'Community Advisory Board'].includes(displayUser.role)) {
        items.push({ id: 'governance', label: 'Governance', icon: Briefcase });
    }

    // Add meetings tab for coordinators and leads
    const meetingRoles = ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Development Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead'];
    if (canAccessOperationalTools && meetingRoles.includes(displayUser.role)) {
        items.push({ id: 'meetings', label: 'Meetings', icon: Calendar });
    }

    // Coordinators and leads get access to Forms for internal surveys
    const formRoles = ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Development Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead'];
    if (!displayUser.isAdmin && canAccessOperationalTools && formRoles.includes(displayUser.role)) {
        items.push({ id: 'forms', label: 'Forms', icon: FileText });
    }

    if(displayUser.isAdmin) {
        items.push({ id: 'directory', label: 'Directory', icon: Users, badge: newApplicantsCount });
        items.push({ id: 'referrals', label: 'Referrals', icon: Send });
        items.push({ id: 'resources', label: 'Resources', icon: Database });
        items.push({ id: 'analytics', label: 'Analytics', icon: BarChart3 });
        items.push({ id: 'workflows', label: 'Workflows', icon: Zap });
        items.push({ id: 'forms', label: 'Forms', icon: FileText });
    } else if (['Board Member', 'Community Advisory Board', 'Tech Team', 'Data Analyst'].includes(displayUser.role)) {
        items.push({ id: 'analytics', label: 'Analytics', icon: BarChart3 });
    }
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayUser.role, displayUser.isAdmin, canAccessOperationalTools, canAccessMissions, unreadDMs, openTicketsCount, newApplicantsCount, isGovernanceRole, completedTrainingIds]);

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

      {/* Mobile top header */}
      <div className={`fixed top-10 left-0 right-0 h-14 bg-white border-b border-zinc-200 flex md:hidden items-center justify-between px-4 z-[98] ${showBetaBanner ? (viewingAsRole ? 'mt-24' : 'mt-12') : (viewingAsRole ? 'mt-12' : '')}`}>
        <button onClick={() => setShowMobileMenu(true)} className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
          <Menu size={20} className="text-zinc-700" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#233DFF] to-indigo-600 flex items-center justify-center">
            <img src={APP_CONFIG.BRAND.logoUrl} className="w-5 h-5" alt="HMC" />
          </div>
          <span className="text-sm font-black text-zinc-900">HMC Portal</span>
        </div>
        <button onClick={() => setShowNotifications(!showNotifications)} className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center relative">
          <Bell size={18} className="text-zinc-600" />
          {totalNotifications > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
              {totalNotifications > 99 ? '99+' : totalNotifications}
            </span>
          )}
        </button>
      </div>

      {/* Mobile slide-out menu overlay */}
      {showMobileMenu && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[299] md:hidden" onClick={() => setShowMobileMenu(false)} />
          <div className="fixed inset-y-0 left-0 w-[300px] bg-white z-[300] md:hidden flex flex-col p-6 gap-6 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#233DFF] to-indigo-600 flex items-center justify-center">
                  <img src={APP_CONFIG.BRAND.logoUrl} className="w-6 h-6" alt="HMC" />
                </div>
                <span className="text-sm font-black text-zinc-900">HMC Portal</span>
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-zinc-100 rounded-xl">
                <X size={20} className="text-zinc-500" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id as any); setShowMobileMenu(false); }} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold text-[13px] transition-all ${activeTab === item.id ? 'bg-[#233DFF] text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
                  <item.icon size={18} /> {item.label}
                  {item.badge && item.badge > 0 ? (
                    <span className={`ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${activeTab === item.id ? 'bg-white text-[#233DFF]' : 'bg-rose-500 text-white'}`}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
            <div className="mt-auto pt-4 border-t border-zinc-100 space-y-3">
              <button onClick={() => { setActiveTab('profile'); setShowMobileMenu(false); }} className="flex w-full items-center gap-3 p-3 hover:bg-zinc-50 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                  {displayUser.avatarUrl || displayUser.profilePhoto ? (
                    <img src={displayUser.avatarUrl || displayUser.profilePhoto} className="w-full h-full object-cover" alt="" />
                  ) : (
                    displayUser.name?.charAt(0)?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold text-zinc-900 truncate">{displayUser.name}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{displayUser.role}</p>
                </div>
              </button>
              <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3 text-zinc-400 font-medium text-sm hover:text-rose-500 rounded-xl transition-all">
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Mobile bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 flex md:hidden items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-[98]">
        {[
          { id: 'overview', label: 'Home', icon: Activity },
          { id: 'academy', label: 'Training', icon: GraduationCap },
          { id: 'calendar', label: 'Calendar', icon: CalendarDays },
          { id: 'briefing', label: 'Comms', icon: MessageSquare },
          { id: 'docs', label: 'Docs', icon: BookOpen },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-0 ${activeTab === tab.id ? 'text-[#233DFF]' : 'text-zinc-400'}`}>
            <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 1.5} />
            <span className="text-[10px] font-bold truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Desktop sidebar - hidden on mobile */}
      <aside className={`hidden md:flex w-[320px] bg-gradient-to-b from-white to-zinc-50/50 border-r border-zinc-100 p-8 flex-col gap-10 sticky top-0 h-screen overflow-y-auto no-scrollbar ${showBetaBanner ? (viewingAsRole ? 'pt-36' : 'pt-32') : (viewingAsRole ? 'pt-24' : 'pt-20')}`}>
         <div className="flex items-center gap-4 px-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#233DFF] to-indigo-600 flex items-center justify-center shadow-lg shadow-[#233DFF]/20">
              <img src={APP_CONFIG.BRAND.logoUrl} className="w-8 h-8" alt="HMC" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-black text-zinc-900 tracking-tight block">HMC Portal</span>
              <span className="text-[10px] font-medium text-zinc-400">Volunteer Hub</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors relative"
              >
                <Bell size={18} className="text-zinc-600" />
                {totalNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {totalNotifications > 99 ? '99+' : totalNotifications}
                  </span>
                )}
              </button>
            </div>
         </div>

         <nav className="flex flex-col gap-1.5">
            {navItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-semibold text-[13px] transition-all relative ${activeTab === item.id ? 'bg-[#233DFF] text-white shadow-lg shadow-[#233DFF]/25' : 'text-zinc-500 hover:text-zinc-900 hover:bg-white hover:shadow-sm'}`}>
                    <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} /> {item.label}
                    {item.badge && item.badge > 0 ? (
                      <span className={`ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${
                        activeTab === item.id ? 'bg-white text-[#233DFF]' : 'bg-rose-500 text-white'
                      }`}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
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

      {/* Notification dropdown - rendered outside sidebar to avoid overflow clipping */}
      {showNotifications && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setShowNotifications(false)} />
          <div className="fixed right-4 top-[100px] md:left-[240px] md:right-auto md:top-[80px] w-80 bg-white border border-zinc-200 rounded-2xl shadow-2xl z-[200] overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
              <h4 className="text-sm font-black text-zinc-900">Notifications</h4>
              <div className="flex items-center gap-2">
                {totalNotifications > 0 && (
                  <button onClick={() => { handleDismissNotifications(); setShowNotifications(false); }} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600">
                    Dismiss all
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-zinc-100 rounded-lg">
                  <X size={14} className="text-zinc-400" />
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {totalNotifications === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={24} className="mx-auto text-zinc-200 mb-2" />
                  <p className="text-xs text-zinc-400 font-medium">All caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {unreadDMs > 0 && (
                    <button
                      onClick={() => { setCommHubTab('briefing'); setActiveTab('briefing'); setShowNotifications(false); }}
                      className="w-full p-4 hover:bg-zinc-50 flex items-center gap-3 text-left transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#233DFF]/10 flex items-center justify-center shrink-0">
                        <MessageSquare size={16} className="text-[#233DFF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900">{unreadDMs} unread message{unreadDMs > 1 ? 's' : ''}</p>
                        <p className="text-[11px] text-zinc-400">New direct messages waiting</p>
                      </div>
                      <span className="min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{unreadDMs}</span>
                    </button>
                  )}
                  {openTicketsCount > 0 && (
                    <div>
                      <button
                        onClick={() => { setCommHubTab('support'); setActiveTab('briefing'); setShowNotifications(false); }}
                        className="w-full p-4 hover:bg-zinc-50 flex items-center gap-3 text-left transition-colors"
                      >
                        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                          <ShieldAlert size={16} className="text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-900">{openTicketsCount} ticket{openTicketsCount > 1 ? 's' : ''}</p>
                          <p className="text-[11px] text-zinc-400">Assigned to you or submitted by you</p>
                        </div>
                        <span className="min-w-[20px] h-5 px-1.5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{openTicketsCount}</span>
                      </button>
                      {myTickets.slice(0, 3).map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setCommHubTab('support'); setActiveTab('briefing'); setShowNotifications(false); }}
                          className="w-full px-4 py-2 pl-16 hover:bg-zinc-50 text-left transition-colors"
                        >
                          <p className="text-xs font-medium text-zinc-700 truncate">{t.subject}</p>
                          <p className="text-[10px] text-zinc-400">{t.status === 'open' ? 'Open' : 'In Progress'} · {t.priority}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {newApplicantsCount > 0 && (
                    <button
                      onClick={() => { setActiveTab('directory'); setShowNotifications(false); }}
                      className="w-full p-4 hover:bg-zinc-50 flex items-center gap-3 text-left transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <Users size={16} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900">{newApplicantsCount} new applicant{newApplicantsCount > 1 ? 's' : ''}</p>
                        <p className="text-[11px] text-zinc-400">Pending review in Directory</p>
                      </div>
                      <span className="min-w-[20px] h-5 px-1.5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{newApplicantsCount}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <main className={`flex-1 p-6 md:p-16 space-y-12 md:space-y-16 overflow-y-auto h-screen no-scrollbar pb-24 md:pb-16 ${showBetaBanner ? (viewingAsRole ? 'pt-40' : 'pt-36') : (viewingAsRole ? 'pt-28 md:pt-28' : 'pt-28 md:pt-24')}`}>
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
                        ? "Complete your orientation to unlock missions. You can explore the rest of the portal right away."
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
            {displayUser.role === 'Volunteer Lead' ? <CoordinatorView user={displayUser} allVolunteers={allVolunteers} /> : isOnboarding ? <OnboardingView user={displayUser} onNavigate={setActiveTab} /> : <ActiveVolunteerView user={displayUser} shifts={shifts} opportunities={opportunities} onNavigate={setActiveTab} hasCompletedCoreTraining={hasCompletedCoreTraining} isOperationalEligible={isOperationalEligible} isGovernanceRole={isGovernanceRole} />}
            <div className="pt-8 border-t border-zinc-100">
               <EventExplorer user={displayUser} opportunities={opportunities} setOpportunities={setOpportunities} onUpdate={handleUpdateUser} canSignUp={canAccessOperationalTools} shifts={shifts} setShifts={setShifts} />
            </div>
           </>
         )}

         {activeTab === 'academy' && <TrainingAcademy user={displayUser} onUpdate={handleUpdateUser} />}
         {activeTab === 'missions' && canAccessMissions && <ShiftsComponent userMode={displayUser.isAdmin ? 'admin' : 'volunteer'} user={displayUser} shifts={shifts} setShifts={setShifts} onUpdate={handleUpdateUser} opportunities={opportunities} setOpportunities={setOpportunities} allVolunteers={allVolunteers} setAllVolunteers={setAllVolunteers} />}
         {activeTab === 'event-management' && canAccessOperationalTools && ['Events Lead', 'Events Coordinator', 'Outreach & Engagement Lead'].includes(displayUser.role) && <ShiftsComponent userMode="coordinator" user={displayUser} shifts={shifts} setShifts={setShifts} onUpdate={handleUpdateUser} opportunities={opportunities} setOpportunities={setOpportunities} allVolunteers={allVolunteers} setAllVolunteers={setAllVolunteers} />}
         {activeTab === 'my-team' && displayUser.role === 'Volunteer Lead' && canAccessOperationalTools && <AdminVolunteerDirectory volunteers={allVolunteers.filter(v => v.managedBy === displayUser.id)} setVolunteers={setAllVolunteers} currentUser={displayUser} />}
         {activeTab === 'impact' && <ImpactHub user={displayUser} allVolunteers={allVolunteers} onUpdate={handleUpdateUser} />}
         {activeTab === 'briefing' && <CommunicationHub user={displayUser} userMode={displayUser.isAdmin ? 'admin' : 'volunteer'} allVolunteers={allVolunteers} announcements={announcements} setAnnouncements={setAnnouncements} messages={messages} setMessages={setMessages} supportTickets={supportTickets} setSupportTickets={setSupportTickets} initialTab={commHubTab} />}
         {activeTab === 'profile' && <MyProfile currentUser={displayUser} onUpdate={handleUpdateUser} />}
         {activeTab === 'docs' && <DocumentationHub currentUser={displayUser} />}
         {activeTab === 'calendar' && <OrgCalendar user={displayUser} opportunities={opportunities} />}
         {activeTab === 'directory' && user.isAdmin && <AdminVolunteerDirectory volunteers={allVolunteers} setVolunteers={setAllVolunteers} currentUser={user} />}
         {activeTab === 'referrals' && user.isAdmin && <ReferralManagement isAdmin={true} />}
         {activeTab === 'resources' && user.isAdmin && <ResourceDashboard />}
         {(activeTab === 'analytics' && (user.isAdmin || ['Board Member', 'Community Advisory Board', 'Tech Team', 'Data Analyst'].includes(user.role))) && <AnalyticsDashboard volunteers={allVolunteers} />}
         {activeTab === 'workflows' && user.isAdmin && <AutomatedWorkflows />}
         {activeTab === 'forms' && (user.isAdmin || ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Development Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead'].includes(displayUser.role)) && <FormBuilder />}
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
         {activeTab === 'meetings' && (
           <BoardGovernance user={displayUser} meetingsOnly />
         )}
         {activeTab === 'livechat' && canAccessOperationalTools && ['Core Volunteer', 'Licensed Medical Professional', 'Medical Admin', 'Volunteer Lead'].includes(displayUser.role) && (
           <LiveChatDashboard currentUser={displayUser} />
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
          <div className="bg-gradient-to-br from-[#233DFF] via-[#4F5FFF] to-indigo-600 rounded-[40px] p-10 md:p-12 text-white shadow-2xl shadow-[#233DFF]/20 relative overflow-hidden group">
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
                      Complete 2 short orientation videos to unlock community missions. You can already explore Training Academy, Comms, Doc Hub, and Impact Hub.
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#233DFF] to-indigo-600 flex items-center justify-center shadow-lg shadow-[#233DFF]/20">
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

const ActiveVolunteerView: React.FC<{ user: Volunteer, shifts: Shift[], opportunities: Opportunity[], onNavigate: (tab: 'missions' | 'profile' | 'academy') => void, hasCompletedCoreTraining: boolean, isOperationalEligible: boolean, isGovernanceRole?: boolean }> = ({ user, shifts, opportunities, onNavigate, hasCompletedCoreTraining, isOperationalEligible, isGovernanceRole = false }) => {
  const getOpp = (oppId: string) => opportunities.find(o => o.id === oppId);

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
  const nextShiftOpp = nextShift ? getOpp(nextShift.opportunityId) : undefined;
  const nextRsvpedEvent = rsvpedOpportunities[0];

  // Determine what to show - prioritize shifts, fallback to rsvped events
  const hasUpcomingMission = nextShift || nextRsvpedEvent;
  const pendingTasks = user.tasks?.filter(t => t.status === 'pending') || [];

  // If orientation not complete, show training required message (Tier 1 only)
  if (!isOperationalEligible) {
    const coreModules = [
      { id: 'hmc_orientation', label: 'HMC Orientation' },
      { id: 'hmc_champion', label: 'Because You\'re a Champion' },
    ];
    const completedCount = coreModules.filter(m => hasCompletedModule(user.completedTrainingIds || [], m.id)).length;
    const progress = (completedCount / coreModules.length) * 100;
    const trainingDone = hasCompletedCoreTraining;
    const roleApproved = user.coreVolunteerStatus === true;

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
                  <h3 className="text-2xl font-bold text-amber-900 tracking-tight mb-2">
                    {trainingDone && !roleApproved ? 'Awaiting Role Approval' : 'Complete Your Training'}
                  </h3>
                  <p className="text-amber-700 font-medium">
                    {trainingDone && !roleApproved
                      ? 'Your training is complete! Your role application is being reviewed.'
                      : `${completedCount} of ${coreModules.length} modules completed`}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="h-2 bg-amber-200/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <p className="text-amber-800 font-medium leading-relaxed mb-4">
                {trainingDone && !roleApproved
                  ? 'Your orientation is complete! Your role application is being reviewed. You can continue exploring the portal while you wait.'
                  : 'Complete these 2 orientation videos to unlock community missions and event signups.'}
              </p>
              {!trainingDone && (
                <p className="text-amber-700/70 text-sm font-medium mb-6">
                  You can already explore Training Academy, Communication Hub, Doc Hub, and Impact Hub using the menu.
                </p>
              )}
              {trainingDone && !roleApproved && <div className="mb-6" />}

              {/* Training Checklist */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-amber-200/50 mb-6 space-y-3">
                {coreModules.map(item => {
                  const isComplete = hasCompletedModule(user.completedTrainingIds || [], item.id);
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
                <h4 className="text-4xl font-black text-zinc-900 tracking-tighter mt-4">{nextShiftOpp?.title || nextShift.roleType}</h4>
                <div className="flex items-center gap-8 mt-6 text-zinc-500 font-medium flex-wrap">
                  <span className="flex items-center gap-2"><Calendar size={16}/> {new Date(nextShift.startTime).toLocaleDateString()}</span>
                  <span className="flex items-center gap-2"><Clock size={16}/> {new Date(nextShift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  {nextShiftOpp?.serviceLocation && <span className="flex items-center gap-2"><MapPin size={16}/> {nextShiftOpp.serviceLocation}</span>}
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
          <h4 className="text-lg font-black text-zinc-900 mb-4 px-2">Action Items</h4>
          <div className="space-y-3">
             {!hasCompletedCoreTraining && (
                <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-400 text-white flex items-center justify-center"><GraduationCap size={16} /></div>
                    <p className="font-bold text-amber-800 text-sm">Complete orientation training</p>
                  </div>
                  <button onClick={() => onNavigate('academy')} className="text-xs font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1">Go <ChevronRight size={14} /></button>
                </div>
             )}
             {!user.completedHIPAATraining && hasCompletedCoreTraining && (
                <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-400 text-white flex items-center justify-center"><ShieldCheck size={16} /></div>
                    <p className="font-bold text-rose-800 text-sm">Complete HIPAA training</p>
                  </div>
                  <button onClick={() => onNavigate('academy')} className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1">Go <ChevronRight size={14} /></button>
                </div>
             )}
             {hasCompletedCoreTraining && !hasUpcomingMission && (
                <div className="p-5 bg-[#233DFF]/5 border border-[#233DFF]/20 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#233DFF] text-white flex items-center justify-center"><Calendar size={16} /></div>
                    <p className="font-bold text-[#233DFF] text-sm">Sign up for a mission</p>
                  </div>
                  <button onClick={() => onNavigate('missions')} className="text-xs font-bold text-[#233DFF] hover:text-[#1a2fbf] flex items-center gap-1">Browse <ChevronRight size={14} /></button>
                </div>
             )}
             {hasCompletedCoreTraining && hasUpcomingMission && user.completedHIPAATraining && (
                <p className="text-sm text-emerald-600 font-bold italic px-2 flex items-center gap-2"><CheckCircle size={16} /> You're all caught up!</p>
             )}
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
