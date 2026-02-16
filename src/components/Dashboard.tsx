

import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowRight, Activity, Calendar, Clock, MapPin,
  ShieldCheck, Zap, Award, MessageSquare, HeartPulse,
  LogOut, TrendingUp, CheckCircle, ChevronRight, X, Info, BookOpen,
  GraduationCap, User, Users, DollarSign, BarChart3, FileText, Eye, Send, Database, ShieldAlert, Briefcase,
  Bell, Menu, CalendarDays, Megaphone
} from 'lucide-react';
import { Volunteer, ComplianceStep, Shift, Opportunity, SupportTicket, Announcement, Message } from '../types';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import { hasCompletedModule, hasCompletedAllModules, TIER_2_IDS, TIER_2_CORE_IDS, COORDINATOR_AND_LEAD_ROLES, GOVERNANCE_ROLES, EVENT_MANAGEMENT_ROLES } from '../constants';
import { computeLevel } from '../utils/xpLevels';
import { generateQuests, completeQuest, getAllQuestsComplete, DAILY_QUEST_BONUS_XP, DailyQuest } from '../utils/dailyQuests';
import { toastService } from '../services/toastService';
import TrainingAcademy from './TrainingAcademy';
import ShiftsComponent from './Shifts';
import CommunicationHub from './CommunicationHub';
import MyProfile from './MyProfile';
import AdminVolunteerDirectory from './AdminVolunteerDirectory';
import ImpactHub from './ImpactHub';
import AnalyticsDashboard from './AnalyticsDashboard';
import AutomatedWorkflows from './AutomatedWorkflows';
import FormBuilder from './FormBuilder';
import ReferralManagement from './ReferralManagement';
import ResourceDashboard from './ResourceDashboard';
import CoordinatorView from './CoordinatorView';
import SystemTour from './SystemTour';
import DocumentationHub from './DocumentationHub';
// EventExplorer is accessed via My Missions tab (Shifts component)
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
  gamification?: {
    currentXP: number;
    level: number;
    xpToNext: number;
    levelProgress: number;
    streakDays: number;
    achievementIds: string[];
    volunteerType: string;
    referralCode: string;
    referralCount: number;
  } | null;
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
    announcements, setAnnouncements, messages, setMessages, gamification
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

  const [activeTab, setActiveTab] = useState<'overview' | 'missions' | 'impact' | 'academy' | 'briefing' | 'docs' | 'calendar' | 'profile' | 'directory' | 'referrals' | 'resources' | 'analytics' | 'workflows' | 'forms' | 'my-team' | 'screenings' | 'intake' | 'governance' | 'livechat' | 'meetings' | 'event-management'>(getDefaultTab(initialUser.role));
  const [viewingAsRole, setViewingAsRole] = useState<string | null>(null);

  useEffect(() => { setUser(initialUser); }, [initialUser]);

  const displayUser = useMemo(() => {
    if (user.isAdmin && viewingAsRole) {
      return { ...user, role: viewingAsRole, isAdmin: false };
    }
    // Fallback: ensure role is never undefined/empty (prevents blank dashboard)
    if (!user.role) {
      return { ...user, role: 'HMC Champion' };
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

  const isCoordinatorOrLead = COORDINATOR_AND_LEAD_ROLES.includes(displayUser.role);

  // Event-participant roles: collaborate on events but aren't coordinators/leads and may not have coreVolunteerStatus
  const EVENT_PARTICIPANT_ROLES = ['Outreach Volunteer', 'Content Writer', 'Newsletter & Content Writer', 'Social Media Team', 'Student Intern', 'Fundraising Volunteer', 'Grant Writer'];
  const isEventParticipant = EVENT_PARTICIPANT_ROLES.includes(displayUser.role);

  // My Missions: requires coreVolunteerStatus AND HIPAA training (or admin, or coordinator/lead roles, or event participant with HIPAA)
  const canAccessMissions = displayUser.isAdmin || (displayUser.coreVolunteerStatus === true && displayUser.completedHIPAATraining === true) || isCoordinatorOrLead || (isEventParticipant && displayUser.completedHIPAATraining === true);

  // Notification counts
  const [dismissedNotifTs, setDismissedNotifTs] = useState<string>(
    () => (typeof window !== 'undefined' && localStorage.getItem('hmcNotifDismissedAt')) || ''
  );

  const unreadDMs = useMemo(() => {
    return messages.filter(m => {
      if (m.senderId === displayUser.id || m.read || m.recipientId === 'general') return false;
      if (dismissedNotifTs && m.timestamp && m.timestamp <= dismissedNotifTs) return false;
      return true;
    }).length;
  }, [messages, displayUser.id, dismissedNotifTs]);

  const myTickets = useMemo(() => {
    return supportTickets.filter(t => {
      if (t.status === 'closed') return false;
      // Only show tickets assigned to you, submitted by you, or (admin sees all)
      const isMyTicket = t.submittedBy === displayUser.id || t.assignedTo === displayUser.id;
      if (!displayUser.isAdmin && !isMyTicket) return false;
      if (displayUser.isAdmin && !isMyTicket && t.status !== 'open') return false;
      // Respect dismissal — only re-show if there's new activity since dismiss
      if (dismissedNotifTs) {
        const lastActivity = t.updatedAt || t.createdAt;
        if (lastActivity && lastActivity <= dismissedNotifTs) return false;
      }
      return true;
    });
  }, [supportTickets, displayUser.id, displayUser.isAdmin, dismissedNotifTs]);
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

  // Complete daily quests when user navigates to corresponding tabs
  useEffect(() => {
    const questMap: Record<string, string> = {
      missions: 'check_mission',
      academy: 'review_training',
      briefing: 'send_message',
      calendar: 'check_calendar',
      directory: 'review_applicants',
      governance: 'check_governance',
    };
    const questId = questMap[activeTab];
    if (questId) {
      completeQuest(questId);
    }
  }, [activeTab]);

  type NavItem = { id: string; label: string; icon: any; badge?: number };
  type SidebarGroup = { label: string; items: NavItem[] };

  const sidebarGroups = useMemo(() => {
    const medicalRoles = ['Licensed Medical Professional', 'Medical Admin'];
    const clientFacingRoles = ['Core Volunteer', 'Licensed Medical Professional', 'Medical Admin', 'Volunteer Lead'];

    const groups: SidebarGroup[] = [];

    // MAIN
    const mainItems: NavItem[] = [{ id: 'overview', label: 'Overview', icon: Activity }];
    if (canAccessMissions) {
      const governanceCompletedTier2 = isGovernanceRole && hasCompletedAllModules(completedTrainingIds, TIER_2_IDS);
      if (!isGovernanceRole || governanceCompletedTier2) {
        mainItems.push({ id: 'missions', label: 'My Missions', icon: Calendar });
      }
    }
    mainItems.push({ id: 'calendar', label: 'Calendar', icon: CalendarDays });
    groups.push({ label: 'MAIN', items: mainItems });

    // TOOLS
    const toolItems: NavItem[] = [
      { id: 'academy', label: 'Training Academy', icon: GraduationCap },
      { id: 'docs', label: 'Doc Hub', icon: BookOpen },
    ];
    if (!displayUser.isAdmin && canAccessOperationalTools && COORDINATOR_AND_LEAD_ROLES.includes(displayUser.role)) {
      toolItems.push({ id: 'forms', label: 'Forms', icon: FileText });
    }
    groups.push({ label: 'TOOLS', items: toolItems });

    // COMMUNICATE
    const commItems: NavItem[] = [
      { id: 'briefing', label: 'Communication Hub', icon: MessageSquare, badge: unreadDMs + openTicketsCount },
    ];
    if (canAccessOperationalTools && clientFacingRoles.includes(displayUser.role)) {
      commItems.push({ id: 'livechat', label: 'Live Chat', icon: MessageSquare });
    }
    groups.push({ label: 'COMMUNICATE', items: commItems });

    // COMMUNITY
    groups.push({ label: 'COMMUNITY', items: [{ id: 'impact', label: 'Impact Hub', icon: DollarSign }] });

    // ROLE-SPECIFIC
    const roleItems: NavItem[] = [];
    if (displayUser.role === 'Volunteer Lead' && canAccessOperationalTools) {
      roleItems.push({ id: 'my-team', label: 'My Team', icon: Users });
    }
    if (canAccessOperationalTools && medicalRoles.includes(displayUser.role)) {
      roleItems.push({ id: 'screenings', label: 'Health Screenings', icon: HeartPulse });
    }
    if (canAccessOperationalTools && clientFacingRoles.includes(displayUser.role)) {
      roleItems.push({ id: 'intake', label: 'Client Portal', icon: Send });
    }
    if (canAccessOperationalTools && ['Events Lead', 'Events Coordinator', 'Outreach & Engagement Lead'].includes(displayUser.role)) {
      roleItems.push({ id: 'event-management', label: 'Event Management', icon: Calendar });
    }
    if (GOVERNANCE_ROLES.includes(displayUser.role)) {
      roleItems.push({ id: 'governance', label: 'Governance', icon: Briefcase });
    }
    if (canAccessOperationalTools && COORDINATOR_AND_LEAD_ROLES.includes(displayUser.role)) {
      roleItems.push({ id: 'meetings', label: 'Meetings', icon: Calendar });
    }
    if (!displayUser.isAdmin && ['Board Member', 'Community Advisory Board', 'Tech Team', 'Data Analyst'].includes(displayUser.role)) {
      roleItems.push({ id: 'analytics', label: 'Analytics', icon: BarChart3 });
    }
    if (roleItems.length > 0) {
      groups.push({ label: 'ROLE-SPECIFIC', items: roleItems });
    }

    // ADMIN
    if (displayUser.isAdmin) {
      groups.push({
        label: 'ADMIN',
        items: [
          { id: 'directory', label: 'Directory', icon: Users, badge: newApplicantsCount },
          { id: 'referrals', label: 'Referrals', icon: Send },
          { id: 'resources', label: 'Resources', icon: Database },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'workflows', label: 'Workflows', icon: Zap },
          { id: 'forms', label: 'Forms', icon: FileText },
        ],
      });
    }

    return groups;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayUser.role, displayUser.isAdmin, canAccessOperationalTools, canAccessMissions, unreadDMs, openTicketsCount, newApplicantsCount, isGovernanceRole, completedTrainingIds]);

  // Flat navItems for tab validation and mobile bottom bar
  const navItems = useMemo(() => {
    return sidebarGroups.flatMap(g => g.items);
  }, [sidebarGroups]);

  const isOnboarding = displayUser.status === 'onboarding' || displayUser.status === 'applicant';

  // Redirect to overview if current tab is no longer accessible (e.g., role changed)
  // 'profile' is always valid (accessed via avatar button, not sidebar nav)
  useEffect(() => {
    const validTabIds = navItems.map(n => n.id);
    if (activeTab !== 'overview' && activeTab !== 'profile' && !validTabIds.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [navItems, activeTab]);

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
          <div className={`fixed ${showBetaBanner ? 'top-[88px]' : 'top-10'} left-0 right-0 h-12 bg-amber-400 text-zinc-900 flex items-center justify-center text-[11px] font-black uppercase tracking-[0.2em] z-[101] md:pl-[320px] shadow-elevation-2`}>
             <Eye size={16} className="mr-3"/> Viewing as {viewingAsRole}
             <button onClick={() => setViewingAsRole(null)} className="ml-6 bg-brand text-white px-4 py-1 rounded-full text-[9px] hover:opacity-80">Return to Admin View</button>
          </div>
      )}
      
      <div className={`absolute top-0 left-0 right-0 h-10 bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] z-[100] md:pl-[320px]`}>
         HMC Volunteer Platform v{APP_CONFIG.VERSION} • <span className="text-amber-400 ml-2">Release Environment</span>
      </div>

      {/* Mobile top header */}
      <div className={`fixed top-10 left-0 right-0 h-14 bg-white border-b border-zinc-200 flex md:hidden items-center justify-between px-4 z-[98] ${showBetaBanner ? (viewingAsRole ? 'mt-24' : 'mt-12') : (viewingAsRole ? 'mt-12' : '')}`}>
        <button onClick={() => setShowMobileMenu(true)} className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
          <Menu size={20} className="text-zinc-700" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand to-indigo-600 flex items-center justify-center">
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-indigo-600 flex items-center justify-center">
                  <img src={APP_CONFIG.BRAND.logoUrl} className="w-6 h-6" alt="HMC" />
                </div>
                <span className="text-sm font-black text-zinc-900">HMC Portal</span>
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-zinc-100 rounded-xl">
                <X size={20} className="text-zinc-500" />
              </button>
            </div>
            <nav className="flex flex-col gap-4">
              {sidebarGroups.map(group => (
                <div key={group.label}>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] px-4 mb-1.5">{group.label}</p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map(item => (
                      <button key={item.id + '-' + group.label} onClick={() => { setActiveTab(item.id as any); setShowMobileMenu(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-full font-bold text-[13px] transition-all ${activeTab === item.id ? 'bg-brand text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
                        <item.icon size={18} /> {item.label}
                        {item.badge && item.badge > 0 ? (
                          <span className={`ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${activeTab === item.id ? 'bg-white text-brand' : 'bg-rose-500 text-white'}`}>
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
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
              <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3 text-zinc-400 font-bold text-sm hover:text-rose-500 rounded-xl transition-all">
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
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-full transition-all min-w-0 ${activeTab === tab.id ? 'text-brand' : 'text-zinc-400'}`}>
            <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 1.5} />
            <span className="text-[10px] font-bold truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Desktop sidebar - hidden on mobile */}
      <aside className={`hidden md:flex w-[320px] bg-gradient-to-b from-white to-zinc-50/50 border-r border-zinc-100 p-8 flex-col gap-10 sticky top-0 h-screen overflow-y-auto no-scrollbar ${showBetaBanner ? (viewingAsRole ? 'pt-36' : 'pt-32') : (viewingAsRole ? 'pt-24' : 'pt-20')}`}>
         <div className="flex items-center gap-4 px-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand to-indigo-600 flex items-center justify-center shadow-elevation-2">
              <img src={APP_CONFIG.BRAND.logoUrl} className="w-8 h-8" alt="HMC" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-black text-zinc-900 tracking-tight block">HMC Portal</span>
              <span className="text-[10px] font-bold text-zinc-400">Volunteer Hub</span>
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

         <nav className="flex flex-col gap-5">
            {sidebarGroups.map(group => (
              <div key={group.label}>
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] px-5 mb-2">{group.label}</p>
                <div className="flex flex-col gap-1">
                  {group.items.map(item => (
                    <button key={item.id + '-' + group.label} onClick={() => setActiveTab(item.id as any)} className={`flex items-center gap-4 px-5 py-3.5 rounded-full font-bold text-[13px] transition-all relative ${activeTab === item.id ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-500 hover:text-zinc-900 hover:bg-white hover:shadow-elevation-1'}`}>
                        <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} /> {item.label}
                        {item.badge && item.badge > 0 ? (
                          <span className={`ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${
                            activeTab === item.id ? 'bg-white text-brand' : 'bg-rose-500 text-white'
                          }`}>
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
         </nav>

         <div className="mt-auto space-y-4 pt-8 border-t border-zinc-100">
            <button onClick={() => setActiveTab('profile')} className="flex w-full items-center gap-4 p-3 hover:bg-white rounded-2xl transition-all hover:shadow-elevation-1 group">
               <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 text-white flex items-center justify-center font-bold text-lg shadow-elevation-2 shrink-0 overflow-hidden">
                 {displayUser.avatarUrl || displayUser.profilePhoto ? (
                   <img src={displayUser.avatarUrl || displayUser.profilePhoto} className="w-full h-full object-cover" alt="" />
                 ) : (
                   displayUser.name?.charAt(0)?.toUpperCase()
                 )}
               </div>
               <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold text-zinc-900 truncate group-hover:text-brand transition-colors">{displayUser.name}</p>
                  <p className="text-[10px] font-bold text-zinc-400 truncate">{displayUser.role}</p>
               </div>
               <ChevronRight size={16} className="text-zinc-300 group-hover:text-brand transition-colors" />
            </button>
            {user.isAdmin && !viewingAsRole && (
              <div className="relative">
                <select
                  onChange={(e) => setViewingAsRole(e.target.value)}
                  className="w-full bg-brand text-white border-0 rounded-full font-bold text-[10px] uppercase tracking-wide pl-10 pr-6 py-3 appearance-none cursor-pointer hover:bg-zinc-800 transition-colors shadow-elevation-2"
                >
                  <option value="">View as Role...</option>
                  {APP_CONFIG.HMC_ROLES.map(role => <option key={role.id} value={role.label}>{role.label}</option>)}
                </select>
                <Eye size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              </div>
            )}
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3 text-zinc-400 font-bold text-sm hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
               <LogOut size={16} /> Sign Out
            </button>
         </div>
      </aside>

      {/* Notification slide-out panel */}
      {showNotifications && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[199] transition-opacity" onClick={() => setShowNotifications(false)} />
          <div className="fixed inset-y-0 right-0 w-full md:w-[380px] bg-white shadow-elevation-3 z-[200] flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <h4 className="text-base font-black text-zinc-900">Notifications</h4>
              <div className="flex items-center gap-3">
                {totalNotifications > 0 && (
                  <button onClick={() => { handleDismissNotifications(); }} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-600">
                    Dismiss all
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)} className="p-1.5 hover:bg-zinc-100 rounded-lg">
                  <X size={16} className="text-zinc-400" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {totalNotifications === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={28} className="mx-auto text-zinc-200 mb-3" />
                  <p className="text-sm text-zinc-400 font-bold">All caught up!</p>
                  <p className="text-xs text-zinc-300 mt-1">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {unreadDMs > 0 && (
                    <button
                      onClick={() => { setCommHubTab('briefing'); setActiveTab('briefing'); setShowNotifications(false); }}
                      className="w-full p-5 hover:bg-zinc-50 flex items-center gap-4 text-left transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                        <MessageSquare size={18} className="text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900">{unreadDMs} unread message{unreadDMs > 1 ? 's' : ''}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">New direct messages waiting</p>
                      </div>
                      <span className="min-w-[22px] h-[22px] px-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{unreadDMs}</span>
                    </button>
                  )}
                  {openTicketsCount > 0 && (
                    <div>
                      <button
                        onClick={() => { setCommHubTab('support'); setActiveTab('briefing'); setShowNotifications(false); }}
                        className="w-full p-5 hover:bg-zinc-50 flex items-center gap-4 text-left transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                          <ShieldAlert size={18} className="text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-900">{openTicketsCount} ticket{openTicketsCount > 1 ? 's' : ''}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">Assigned to you or submitted by you</p>
                        </div>
                        <span className="min-w-[22px] h-[22px] px-1.5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{openTicketsCount}</span>
                      </button>
                      {myTickets.slice(0, 3).map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setCommHubTab('support'); setActiveTab('briefing'); setShowNotifications(false); }}
                          className="w-full px-5 py-3 pl-[72px] hover:bg-zinc-50 text-left transition-colors"
                        >
                          <p className="text-xs font-bold text-zinc-700 truncate">{t.subject}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{t.status === 'open' ? 'Open' : 'In Progress'} · {t.priority}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {newApplicantsCount > 0 && (
                    <button
                      onClick={() => { setActiveTab('directory'); setShowNotifications(false); }}
                      className="w-full p-5 hover:bg-zinc-50 flex items-center gap-4 text-left transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <Users size={18} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900">{newApplicantsCount} new applicant{newApplicantsCount > 1 ? 's' : ''}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">Pending review in Directory</p>
                      </div>
                      <span className="min-w-[22px] h-[22px] px-1.5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{newApplicantsCount}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {totalNotifications > 0 && (
              <div className="p-4 border-t border-zinc-100 shrink-0">
                <button
                  onClick={() => { handleDismissNotifications(); setShowNotifications(false); }}
                  className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-sm font-bold rounded-xl transition-colors"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <main className={`flex-1 p-6 md:p-8 space-y-8 overflow-y-auto h-screen no-scrollbar pb-20 ${showBetaBanner ? (viewingAsRole ? 'pt-40' : 'pt-36') : (viewingAsRole ? 'pt-28 md:pt-28' : 'pt-28 md:pt-24')}`}>
         {/* Announcement Banner */}
         {(() => {
           const DISMISSED_KEY = 'hmcDismissedAnnouncements';
           const getDismissed = (): string[] => {
             try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); } catch { return []; }
           };
           const [dismissedIds, setDismissedIds] = React.useState<string[]>(getDismissed);
           const now = new Date();
           const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
           const visibleAnnouncements = announcements
             .filter(a =>
               a.status === 'approved'
               && new Date(a.date) >= sevenDaysAgo
               && (!a.targetRoles || a.targetRoles.length === 0 || a.targetRoles.includes(displayUser.role))
               && !dismissedIds.includes(a.id)
             )
             .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
             .slice(0, 2);

           if (visibleAnnouncements.length === 0) return null;

           const handleDismiss = (id: string) => {
             const updated = [...dismissedIds, id];
             setDismissedIds(updated);
             localStorage.setItem(DISMISSED_KEY, JSON.stringify(updated));
           };

           return (
             <div className="space-y-2 mb-6">
               {visibleAnnouncements.map(a => (
                 <div key={a.id} className="flex items-center gap-3 px-4 py-3 bg-brand/5 border border-brand/15 rounded-2xl">
                   <Megaphone size={16} className="text-brand shrink-0" />
                   <div className="flex-1 min-w-0">
                     <span className="text-sm font-bold text-zinc-900">{a.title}</span>
                     {a.content && <span className="text-sm text-zinc-500 ml-2 truncate">{a.content.length > 80 ? a.content.slice(0, 80) + '...' : a.content}</span>}
                   </div>
                   <button onClick={() => handleDismiss(a.id)} className="p-1.5 hover:bg-brand/10 rounded-lg transition-colors shrink-0">
                     <X size={14} className="text-zinc-400" />
                   </button>
                 </div>
               ))}
             </div>
           );
         })()}

         {activeTab === 'overview' && (
           <>
            <header className="space-y-5">
                {/* Greeting + Stat Chips */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-zinc-400">{getFormattedDate()}</p>
                    <h1 className="text-2xl font-black text-zinc-900 tracking-tight">
                      {getGreeting(displayUser.name)}.
                    </h1>
                    <p className="text-zinc-500 mt-2 font-bold text-lg max-w-lg">
                      {isOnboarding
                        ? "Complete your orientation to unlock missions."
                        : "Ready to continue making a difference?"}
                    </p>
                  </div>

                  {/* Compact Stat Chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50/80 backdrop-blur-sm border border-zinc-200/50 rounded-full shadow-elevation-1">
                      <i className="fa-solid fa-clock text-zinc-400 text-xs" />
                      <span className="text-sm font-bold text-zinc-900">{displayUser.hoursContributed}</span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">hrs</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-brand/5 backdrop-blur-sm border border-brand/15 rounded-full shadow-elevation-1">
                      <i className="fa-solid fa-bolt text-brand text-xs" />
                      <span className="text-sm font-bold text-brand">{(computeLevel(displayUser.points).currentXP).toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">xp</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/50 rounded-full shadow-elevation-1">
                      <i className="fa-solid fa-shield text-emerald-500 text-xs" />
                      <span className="text-sm font-bold text-emerald-600">Lv {computeLevel(displayUser.points).level}</span>
                    </div>
                    {gamification && gamification.streakDays > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 rounded-full shadow-elevation-1">
                        <i className="fa-solid fa-fire text-amber-500 text-xs" />
                        <span className="text-sm font-bold text-amber-500">{gamification.streakDays}d</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Level Progress Bar */}
                {(() => {
                  const lvl = computeLevel(displayUser.points);
                  if (lvl.isMaxLevel) {
                    return (
                      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/50 rounded-2xl p-4 text-center">
                        <p className="text-sm font-bold text-amber-700">
                          <i className="fa-solid fa-crown text-amber-500 mr-2" />
                          Max Level Reached — {lvl.title}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-gradient-to-r from-white to-zinc-50/50 border border-zinc-200 rounded-2xl p-4 shadow-elevation-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-zinc-600">
                          <i className="fa-solid fa-star text-brand mr-1.5" />
                          Level {lvl.level} · {lvl.title}
                        </span>
                        <span className="text-xs font-bold text-brand">{lvl.xpToNext.toLocaleString()} XP to Level {lvl.level + 1}</span>
                      </div>
                      <div className="w-full h-3.5 bg-zinc-100 rounded-full overflow-hidden relative group">
                        <div className="h-full bg-gradient-to-r from-brand to-[#6366f1] rounded-full transition-all duration-700 relative" style={{ width: `${lvl.progress}%` }}>
                          {lvl.progress > 0 && lvl.progress < 100 && (
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm animate-pulse" />
                          )}
                        </div>
                      </div>
                      {lvl.progress >= 75 && (
                        <p className="text-[10px] font-bold text-emerald-600 mt-2">Almost there! Keep going!</p>
                      )}
                    </div>
                  );
                })()}
            </header>
            {displayUser.role === 'Volunteer Lead' ? <CoordinatorView user={displayUser} allVolunteers={allVolunteers} onNavigate={setActiveTab} /> : isOnboarding ? <OnboardingView user={displayUser} onNavigate={setActiveTab} /> : <ActiveVolunteerView user={displayUser} shifts={shifts} opportunities={opportunities} onNavigate={setActiveTab} hasCompletedCoreTraining={hasCompletedCoreTraining} isOperationalEligible={isOperationalEligible} isGovernanceRole={isGovernanceRole} newApplicantsCount={newApplicantsCount} />}
            <ComingUp user={displayUser} shifts={shifts} opportunities={opportunities} onNavigate={setActiveTab} />
           </>
         )}

         {activeTab === 'academy' && <TrainingAcademy user={displayUser} onUpdate={handleUpdateUser} />}
         {activeTab === 'missions' && canAccessMissions && <ShiftsComponent userMode={displayUser.isAdmin ? 'admin' : isCoordinatorOrLead ? 'coordinator' : 'volunteer'} user={displayUser} shifts={shifts} setShifts={setShifts} onUpdate={handleUpdateUser} opportunities={opportunities} setOpportunities={setOpportunities} allVolunteers={allVolunteers} setAllVolunteers={setAllVolunteers} />}
         {activeTab === 'event-management' && canAccessOperationalTools && (displayUser.isAdmin || COORDINATOR_AND_LEAD_ROLES.includes(displayUser.role)) && <ShiftsComponent userMode="coordinator" user={displayUser} shifts={shifts} setShifts={setShifts} onUpdate={handleUpdateUser} opportunities={opportunities} setOpportunities={setOpportunities} allVolunteers={allVolunteers} setAllVolunteers={setAllVolunteers} />}
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
         {activeTab === 'forms' && (user.isAdmin || COORDINATOR_AND_LEAD_ROLES.includes(displayUser.role)) && <FormBuilder />}
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
         {activeTab === 'governance' && GOVERNANCE_ROLES.includes(displayUser.role) && (
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
          <div className="bg-gradient-to-br from-brand via-[#4F5FFF] to-indigo-600 rounded-2xl p-6 md:p-8 text-white shadow-elevation-3 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
              <div className="relative z-10 flex flex-col justify-between min-h-[200px]">
                <div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-[11px] font-bold uppercase tracking-widest mb-8">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      Getting Started
                    </div>
                    <h3 className="text-2xl md:text-2xl font-bold tracking-normal leading-[1.1] mb-6">
                      Welcome to the team, {user.name?.split(' ')[0]}.
                    </h3>
                    <p className="text-lg font-bold text-white/80 max-w-lg leading-relaxed">
                      Complete 2 short orientation videos to unlock community missions. You can already explore Training Academy, Comms, Doc Hub, and Impact Hub.
                    </p>
                </div>
                <button onClick={() => onNavigate('academy')} className="w-fit mt-8 px-8 py-5 bg-white text-zinc-900 border border-zinc-950 rounded-full font-bold text-base uppercase tracking-wide shadow-elevation-2 hover:shadow-elevation-2 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group/btn">
                    <span className="w-2 h-2 rounded-full bg-zinc-950" />
                    Start Training
                    <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
              <TrendingUp size={400} className="absolute -bottom-20 -right-20 text-white/5 pointer-events-none group-hover:scale-110 transition-transform duration-[3s]" />
          </div>
        </div>

        <div className="space-y-6">
          {/* Profile Status Card - Glass effect */}
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl border border-zinc-200/50 shadow-elevation-2 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-zinc-900 tracking-tight">Profile Status</h4>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-indigo-600 flex items-center justify-center shadow-elevation-2">
                  <ShieldCheck size={18} className="text-white" />
                </div>
              </div>
              <div className="space-y-4">
                {Object.values(user.compliance || {}).map((step, key) => (
                      <div key={key} className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-50 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${step.status === 'completed' || step.status === 'verified' ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-300'}`}>
                            <CheckCircle size={16} strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className={`text-sm font-bold transition-colors ${step.status === 'completed' || step.status === 'verified' ? 'text-zinc-900' : 'text-zinc-400'}`}>{step.label}</p>
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


const ActiveVolunteerView: React.FC<{ user: Volunteer, shifts: Shift[], opportunities: Opportunity[], onNavigate: (tab: string) => void, hasCompletedCoreTraining: boolean, isOperationalEligible: boolean, isGovernanceRole?: boolean, newApplicantsCount?: number }> = ({ user, shifts, opportunities, onNavigate, hasCompletedCoreTraining, isOperationalEligible, isGovernanceRole = false, newApplicantsCount = 0 }) => {
  const getOpp = (oppId: string) => opportunities.find(o => o.id === oppId);

  // SMO self-report state
  const [smoCycles, setSmoCycles] = React.useState<{ id: string; saturdayDate: string; thursdayDate: string; status: string; selfReported: boolean; leadConfirmed: boolean }[]>([]);

  React.useEffect(() => {
    apiService.get('/api/smo/cycles/my').then((data: any) => {
      if (Array.isArray(data)) setSmoCycles(data);
    }).catch(err => console.error('[Dashboard] SMO cycles fetch failed:', err));
  }, []);

  const handleSmoSelfReport = async (cycleId: string) => {
    try {
      await apiService.post(`/api/smo/cycles/${cycleId}/self-report`, {});
      setSmoCycles(prev => prev.map(c => c.id === cycleId ? { ...c, selfReported: true } : c));
    } catch (e: any) {
      toastService.error(e.message || 'Failed to report attendance');
    }
  };

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
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 md:p-8 border border-amber-200/50 shadow-elevation-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-200/20 to-orange-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-start gap-5 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-elevation-2 shrink-0">
                  <GraduationCap size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-amber-900 tracking-tight mb-2">
                    {trainingDone && !roleApproved ? 'Awaiting Role Approval' : 'Complete Your Training'}
                  </h3>
                  <p className="text-amber-700 font-bold">
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

              <p className="text-amber-800 font-bold leading-relaxed mb-4">
                {trainingDone && !roleApproved
                  ? 'Your orientation is complete! Your role application is being reviewed. You can continue exploring the portal while you wait.'
                  : 'Complete these 2 orientation videos to unlock community missions and event signups.'}
              </p>
              {!trainingDone && (
                <p className="text-amber-700/70 text-sm font-bold mb-6">
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
                      <span className={`text-sm font-bold ${isComplete ? 'text-emerald-700' : 'text-amber-700'}`}>{item.label}</span>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => onNavigate('academy')} className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white border border-black rounded-full font-bold text-base uppercase tracking-wide shadow-elevation-2 hover:shadow-elevation-2 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-white" />
                Continue Training
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-10">
          <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 shadow-inner space-y-6">
            <h4 className="text-xl font-bold text-zinc-900 tracking-normal leading-none">Quick Actions</h4>
            <div className="space-y-4">
              <button onClick={() => onNavigate('academy')} className="w-full text-left p-6 bg-white rounded-full border border-zinc-950 shadow-elevation-1 flex items-center justify-between group hover:border-brand/30 hover:shadow-elevation-2 transition-all uppercase tracking-wide">
                <span className="font-bold text-base text-zinc-800 flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-zinc-950" />Continue Training</span><ArrowRight size={16} className="text-zinc-400 group-hover:text-brand transition-colors"/>
              </button>
              <button onClick={() => onNavigate('profile')} className="w-full text-left p-6 bg-white rounded-full border border-zinc-950 shadow-elevation-1 flex items-center justify-between group hover:border-brand/30 hover:shadow-elevation-2 transition-all uppercase tracking-wide">
                <span className="font-bold text-base text-zinc-800 flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-zinc-950" />Update Profile</span><ArrowRight size={16} className="text-zinc-400 group-hover:text-brand transition-colors"/>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [activeCardTab, setActiveCardTab] = React.useState<'actions' | 'quests'>('actions');
  const [quests, setQuests] = React.useState<DailyQuest[]>(() =>
    generateQuests(user.role, user.isAdmin, isGovernanceRole)
  );

  const handleCompleteQuest = (questId: string) => {
    completeQuest(questId);
    setQuests(generateQuests(user.role, user.isAdmin, isGovernanceRole));
  };

  const completedQuestsCount = quests.filter(q => q.completed).length;
  const allComplete = getAllQuestsComplete(quests);

  // Action items
  const actionItems: { icon: string; title: string; description: string; color: string; onClick: () => void }[] = [];
  if (!hasCompletedCoreTraining) {
    actionItems.push({ icon: 'fa-solid fa-graduation-cap', title: 'Complete orientation', description: 'Finish orientation videos to unlock missions', color: 'amber', onClick: () => onNavigate('academy') });
  }
  if (!user.completedHIPAATraining && hasCompletedCoreTraining) {
    actionItems.push({ icon: 'fa-solid fa-shield-halved', title: 'Complete HIPAA training', description: 'Required before signing up for missions', color: 'rose', onClick: () => onNavigate('academy') });
  }
  if (!user.availability?.days?.length) {
    actionItems.push({ icon: 'fa-solid fa-calendar-check', title: 'Set your availability', description: 'Help us match you to the right shifts', color: 'blue', onClick: () => onNavigate('profile') });
  }
  if (hasCompletedCoreTraining && !hasUpcomingMission) {
    actionItems.push({ icon: 'fa-solid fa-compass', title: 'Sign up for a mission', description: 'Browse available community events', color: 'blue', onClick: () => onNavigate('missions') });
  }
  if (user.isAdmin && newApplicantsCount > 0) {
    actionItems.push({ icon: 'fa-solid fa-user-check', title: 'Review applicants', description: `${newApplicantsCount} new volunteer${newApplicantsCount > 1 ? 's' : ''} waiting for review`, color: 'emerald', onClick: () => onNavigate('directory') });
  }

  // SMO Thursday training self-report action items
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  smoCycles
    .filter(c => !c.selfReported && !c.leadConfirmed && c.thursdayDate <= todayStr && c.status === 'registration_open')
    .forEach(c => {
      actionItems.push({
        icon: 'fa-solid fa-clipboard-check',
        title: 'Report SMO training attendance',
        description: `Confirm you attended Thursday training (${new Date(c.thursdayDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}) to keep your Saturday spot`,
        color: 'emerald',
        onClick: () => handleSmoSelfReport(c.id),
      });
    });

  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', iconBg: 'bg-gradient-to-br from-amber-400 to-amber-500' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', iconBg: 'bg-gradient-to-br from-rose-400 to-rose-500' },
    blue: { bg: 'bg-brand/5', border: 'border-brand/20', text: 'text-brand', iconBg: 'bg-gradient-to-br from-brand to-indigo-500' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', iconBg: 'bg-gradient-to-br from-emerald-400 to-emerald-500' },
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-elevation-1 overflow-hidden">
      {/* Tab Header */}
      <div className="flex border-b border-zinc-100">
        <button
          onClick={() => setActiveCardTab('actions')}
          className={`flex-1 px-6 py-4 text-sm font-bold transition-colors relative ${activeCardTab === 'actions' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
        >
          <i className="fa-solid fa-list-check mr-2" />Actions
          {actionItems.length > 0 && activeCardTab !== 'actions' && (
            <span className="ml-2 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full inline-flex items-center justify-center">{actionItems.length}</span>
          )}
          {activeCardTab === 'actions' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
        </button>
        <button
          onClick={() => setActiveCardTab('quests')}
          className={`flex-1 px-6 py-4 text-sm font-bold transition-colors relative ${activeCardTab === 'quests' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
        >
          <i className="fa-solid fa-scroll mr-2" />Daily Quests
          {!allComplete && activeCardTab !== 'quests' && (
            <span className="ml-2 text-[10px] font-bold text-zinc-400">{completedQuestsCount}/{quests.length}</span>
          )}
          {allComplete && activeCardTab !== 'quests' && (
            <span className="ml-2 text-[10px] font-bold text-emerald-500"><i className="fa-solid fa-check" /></span>
          )}
          {activeCardTab === 'quests' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeCardTab === 'actions' && (
          <div className="space-y-3">
            {actionItems.length === 0 ? (
              <p className="text-sm text-emerald-600 font-bold italic flex items-center gap-2">
                <CheckCircle size={16} /> You're all caught up!
              </p>
            ) : (
              actionItems.map((item, i) => {
                const c = colorMap[item.color] || colorMap.blue;
                return (
                  <button key={i} onClick={item.onClick} className={`w-full p-4 ${c.bg} border ${c.border} rounded-2xl flex items-center gap-4 text-left hover:opacity-90 transition-opacity group`}>
                    <div className={`w-9 h-9 rounded-xl ${c.iconBg} text-white flex items-center justify-center shrink-0`}>
                      <i className={`${item.icon} text-sm`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${c.text}`}>{item.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{item.description}</p>
                    </div>
                    <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-500 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        )}

        {activeCardTab === 'quests' && (
          <div className="space-y-4">
            {/* Quest progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-zinc-500">{completedQuestsCount}/{quests.length} Quests Complete</span>
                {allComplete && <span className="text-xs font-bold text-emerald-500">+{DAILY_QUEST_BONUS_XP} XP Bonus!</span>}
              </div>
              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(completedQuestsCount / quests.length) * 100}%` }} />
              </div>
            </div>

            {allComplete ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3"><i className="fa-solid fa-trophy text-amber-400" /></div>
                <p className="text-lg font-bold text-zinc-900">All quests complete!</p>
                <p className="text-sm text-zinc-500 mt-1">You earned {quests.reduce((sum, q) => sum + q.xpReward, 0) + DAILY_QUEST_BONUS_XP} XP today. Come back tomorrow!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {quests.map(quest => (
                  <div key={quest.id} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${quest.completed ? 'bg-emerald-50/50' : 'hover:bg-zinc-50'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${quest.completed ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                      {quest.completed ? <i className="fa-solid fa-check text-xs" /> : <i className={`${quest.icon} text-xs`} />}
                    </div>
                    <span className={`text-sm font-bold flex-1 ${quest.completed ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>{quest.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${quest.completed ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-500'}`}>+{quest.xpReward} XP</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


interface TimelineItem {
  id: string;
  title: string;
  date: Date;
  time?: string;
  location?: string;
  category?: string;
  type: 'shift' | 'event';
}

const ComingUp: React.FC<{ user: Volunteer; shifts: Shift[]; opportunities: Opportunity[]; onNavigate: (tab: 'missions' | 'calendar') => void }> = ({ user, shifts, opportunities, onNavigate }) => {
  const timelineItems = useMemo(() => {
    const now = new Date();
    const items: TimelineItem[] = [];
    const seenIds = new Set<string>();
    const seenOppIds = new Set<string>();

    // Shifts assigned to user
    shifts
      .filter(s => user.assignedShiftIds?.includes(s.id) && new Date(s.startTime) > now)
      .forEach(s => {
        const opp = opportunities.find(o => o.id === s.opportunityId);
        const key = `shift-${s.id}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          if (s.opportunityId) seenOppIds.add(s.opportunityId);
          items.push({
            id: key,
            title: opp?.title || s.roleType,
            date: new Date(s.startTime),
            time: new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            location: opp?.serviceLocation,
            category: opp?.category,
            type: 'shift',
          });
        }
      });

    // RSVPed events — skip if already shown via shift for same opportunity
    opportunities
      .filter(o => user.rsvpedEventIds?.includes(o.id) && new Date(o.date) > now)
      .forEach(o => {
        if (seenOppIds.has(o.id)) return;
        const key = `event-${o.id}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          items.push({
            id: key,
            title: o.title,
            date: o.date ? new Date(o.date + 'T00:00:00') : new Date(),
            time: o.time,
            location: o.serviceLocation,
            category: o.category,
            type: 'event',
          });
        }
      });

    items.sort((a, b) => a.date.getTime() - b.date.getTime());
    return items;
  }, [user.assignedShiftIds, user.rsvpedEventIds, shifts, opportunities]);

  const heroItem = timelineItems[0];
  const restItems = timelineItems.slice(1, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
          <i className="fa-solid fa-radar text-brand text-sm" />
          Coming Up
        </h3>
        <button onClick={() => onNavigate('calendar')} className="flex items-center gap-2 px-4 py-2 bg-brand text-white border border-zinc-950 rounded-full font-bold text-sm uppercase tracking-wide hover:opacity-95 transition-all">
          <span className="w-2 h-2 rounded-full bg-white" />View All
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Hero Card */}
      {heroItem ? (
        <div className="bg-gradient-to-br from-brand via-[#4F5FFF] to-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-white/15 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {heroItem.type === 'shift' ? 'Next Mission' : 'Next Event'}
              </span>
              {heroItem.category && (
                <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold">{heroItem.category}</span>
              )}
            </div>
            <h4 className="text-2xl font-bold tracking-normal mb-4">{heroItem.title}</h4>
            <div className="flex items-center gap-6 text-sm text-white/80 font-bold flex-wrap">
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-calendar text-xs" />
                {heroItem.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              {heroItem.time && (
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-clock text-xs" />
                  {heroItem.time}
                </span>
              )}
              {heroItem.location && (
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-location-dot text-xs" />
                  {heroItem.location}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-50 rounded-2xl p-8 border border-zinc-100 text-center">
          <i className="fa-solid fa-compass text-zinc-300 text-2xl mb-3" />
          <p className="text-zinc-400 font-bold text-sm mb-3">No upcoming missions.</p>
          <button onClick={() => onNavigate('missions')} className="px-5 py-2.5 bg-brand text-white border border-zinc-950 rounded-full font-bold text-sm uppercase tracking-wide flex items-center gap-2 mx-auto">
            <span className="w-2 h-2 rounded-full bg-white" />Find a Mission
          </button>
        </div>
      )}

      {/* Vertical Timeline */}
      {restItems.length > 0 && (
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-zinc-200" />

          <div className="space-y-4">
            {restItems.map((item, i) => (
              <div key={item.id} className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div className="absolute left-[-21px] top-3 w-[7px] h-[7px] rounded-full bg-brand ring-4 ring-white" />

                {/* Date pill */}
                <div className="shrink-0 w-16 pt-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">
                    {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>

                {/* Event card */}
                <div className="flex-1 bg-white border border-zinc-100 rounded-xl p-4 hover:shadow-elevation-1 transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h5 className="text-sm font-bold text-zinc-900 truncate">{item.title}</h5>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-zinc-500">
                        {item.time && (
                          <span className="flex items-center gap-1">
                            <i className="fa-solid fa-clock text-[10px] text-zinc-400" />
                            {item.time}
                          </span>
                        )}
                        {item.location && (
                          <span className="flex items-center gap-1 truncate">
                            <i className="fa-solid fa-location-dot text-[10px] text-zinc-400" />
                            {item.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.category && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-brand shrink-0">{item.category}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
