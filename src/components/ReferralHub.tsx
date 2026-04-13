import React, { useState, useEffect } from 'react';
import { Volunteer } from '../types';
import { apiService } from '../services/apiService';
import { toastService } from '../services/toastService';
import {
  Copy, Check, Send, Linkedin, Share2, Users, Zap, Trophy,
  Loader2, Mail, ChevronDown, ExternalLink, Award, Calendar, Link2
} from 'lucide-react';

interface ReferralHubProps {
  user: Volunteer;
}

interface ReferralDashboardData {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  activeReferrals: number;
  sharesThisMonth: number;
  estimatedImpact: number;
}

interface LeaderboardEntry {
  rank: number;
  volunteerId: string;
  name: string;
  referrals: number;
  impact: number;
}

const ReferralHub: React.FC<ReferralHubProps> = ({ user }) => {
  const [dashboard, setDashboard] = useState<ReferralDashboardData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'share' | 'leaderboard' | 'events'>('overview');
  const [events, setEvents] = useState<any[]>([]);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  // Email invite state
  const [friendName, setFriendName] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('basic');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const TEMPLATE_OPTIONS = [
    { id: 'basic', label: 'General Invitation', description: 'A friendly invite to volunteer' },
    { id: 'impact_focused', label: 'Impact-Focused', description: 'Highlights your personal impact stats' },
    { id: 'short', label: 'Quick & Simple', description: 'Short and to the point' },
    { id: 'team_building', label: 'Team Building', description: 'Recruit friends to volunteer together' },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dashData, lbData] = await Promise.all([
          apiService.get('/api/referral/dashboard'),
          apiService.get('/api/leaderboard/referrals'),
        ]);
        setDashboard(dashData);
        setLeaderboard(lbData.leaderboard || []);

        // Fetch upcoming events for ambassador links
        apiService.get('/api/opportunities').then((data: any) => {
          const list: any[] = Array.isArray(data) ? data : (data.opportunities || []);
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const upcoming = list
            .filter((evt: any) => {
              const d = new Date(evt.date || evt.startDate || '');
              return !isNaN(d.getTime()) && d >= today;
            })
            .sort((a: any, b: any) => new Date(a.date || a.startDate).getTime() - new Date(b.date || b.startDate).getTime());
          setEvents(upcoming);
        }).catch(() => {});
      } catch (err) {
        console.error('[ReferralHub] Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleCopyLink = async () => {
    if (!dashboard?.referralLink) return;
    try {
      await navigator.clipboard.writeText(dashboard.referralLink);
      setCopied(true);
      toastService.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = dashboard.referralLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSocialShare = async (platform: 'linkedin' | 'instagram' | 'youtube') => {
    if (!dashboard) return;
    try {
      const { content } = await apiService.get(`/api/share/content/${platform}`).catch(() => ({ content: '' }));
      const encodedText = encodeURIComponent(content || '');
      const encodedUrl = encodeURIComponent(dashboard.referralLink);

      const shareUrls: Record<string, string> = {
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        // Instagram and YouTube don't have web share intents — copy text to clipboard instead
        instagram: `https://www.instagram.com/healthmattersclinic`,
        youtube: `https://www.youtube.com/@healthmattersclinic`,
      };

      if (platform === 'instagram' || platform === 'youtube') {
        // Copy share text to clipboard then open profile
        if (content) { try { await navigator.clipboard.writeText(`${content} ${dashboard.referralLink}`); } catch {} }
      }
      window.open(shareUrls[platform], '_blank', 'width=600,height=500');

      // Log share for XP
      await apiService.post('/api/share/log', { platform });
      toastService.success(`+25 XP earned for sharing on ${platform}!`);
    } catch (err) {
      console.error('[ReferralHub] Share failed:', err);
    }
  };

  const handleSendEmail = async () => {
    if (!friendEmail) {
      toastService.error('Please enter your friend\'s email address.');
      return;
    }
    setSendingEmail(true);
    try {
      await apiService.post('/api/referral/send-email', {
        recipientEmail: friendEmail,
        recipientName: friendName,
        templateType: selectedTemplate,
      });
      toastService.success(`Invitation sent to ${friendName || friendEmail}! +25 XP earned.`);
      setFriendName('');
      setFriendEmail('');
    } catch (err) {
      toastService.error('Failed to send invitation. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const getEventAmbassadorLink = (eventId: string) => {
    const code = dashboard?.referralCode || '';
    return `https://www.healthmatters.clinic/resources/eventfinder?event=${eventId}&ref=${code}&rsvp=true`;
  };

  const handleCopyEventLink = async (eventId: string) => {
    const link = getEventAmbassadorLink(eventId);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopiedEventId(eventId);
    toastService.success('Event ambassador link copied!');
    setTimeout(() => setCopiedEventId(null), 2000);
  };

  const userRank = leaderboard.findIndex(e => e.volunteerId === user.id) + 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Referral Hub</h2>
          <p className="text-zinc-400 font-bold mt-2 text-sm md:text-base">Share your unique link to invite volunteers and earn XP rewards.</p>
        </div>
        <div className="flex gap-2">
          {(['overview', 'share', 'events', 'leaderboard'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
                activeTab === tab
                  ? 'bg-zinc-900 text-white shadow-elevation-1'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'share' ? 'Share & Invite' : tab === 'events' ? 'Event Links' : 'Leaderboard'}
            </button>
          ))}
        </div>
      </div>

      {/* Your Referral Link — always visible */}
      {dashboard && (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 md:p-8 rounded-2xl md:rounded-[40px] text-white border border-zinc-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Your Unique Referral Link</p>
              <p className="text-sm md:text-base font-mono text-zinc-200 break-all">{dashboard.referralLink}</p>
            </div>
            <button
              onClick={handleCopyLink}
              className={`shrink-0 px-6 py-3 rounded-full font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-all ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white text-zinc-900 hover:scale-105 active:scale-95'
              }`}
            >
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-700 flex items-center gap-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Referral Code:</p>
            <span className="text-sm font-mono text-brand font-bold">{dashboard.referralCode}</span>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: 'Total Referrals', value: dashboard.totalReferrals, icon: Users, color: 'text-brand' },
              { label: 'Shares This Month', value: dashboard.sharesThisMonth, icon: Share2, color: 'text-indigo-500' },
              { label: 'XP from Referrals', value: dashboard.totalReferrals * 200, icon: Zap, color: 'text-amber-500' },
              { label: 'People Impacted', value: dashboard.estimatedImpact, icon: Trophy, color: 'text-emerald-500' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-zinc-100 shadow-sm">
                <stat.icon size={20} className={`${stat.color} mb-3`} />
                <p className="text-2xl md:text-3xl font-black tracking-tight">{stat.value}</p>
                <p className="text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-wider mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm">
            <h3 className="text-lg md:text-xl font-bold text-zinc-900 uppercase mb-6">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { step: '1', title: 'Share Your Link', desc: 'Copy your unique referral link and share it on social media, email, or text.' },
                { step: '2', title: 'Friend Signs Up', desc: 'When someone uses your link to apply, they\'re automatically linked to you.' },
                { step: '3', title: 'Earn Rewards', desc: 'Get 200 XP for each person who signs up + 25 XP each time you share.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand/10 text-brand font-black flex items-center justify-center text-lg shrink-0">{item.step}</div>
                  <div>
                    <p className="font-bold text-zinc-900">{item.title}</p>
                    <p className="text-sm text-zinc-500 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Share Row */}
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm">
            <h3 className="text-lg md:text-xl font-bold text-zinc-900 uppercase mb-4">Quick Share</h3>
            <p className="text-sm text-zinc-500 mb-6">Share with pre-written posts and earn 25 XP per share.</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleSocialShare('linkedin')}
                className="flex items-center gap-2 px-5 py-3 bg-[#0077B5] text-white rounded-full font-bold text-xs uppercase tracking-wide hover:scale-105 active:scale-95 transition-all"
              >
                <Linkedin size={16} /> LinkedIn
              </button>
              <button
                onClick={() => handleSocialShare('instagram')}
                className="flex items-center gap-2 px-5 py-3 text-white rounded-full font-bold text-xs uppercase tracking-wide hover:scale-105 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}
              >
                <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                Instagram
              </button>
              <button
                onClick={() => handleSocialShare('youtube')}
                className="flex items-center gap-2 px-5 py-3 bg-[#FF0000] text-white rounded-full font-bold text-xs uppercase tracking-wide hover:scale-105 active:scale-95 transition-all"
              >
                <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                YouTube
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share & Invite Tab */}
      {activeTab === 'share' && (
        <div className="space-y-6">
          {/* Social Share Section */}
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm">
            <h3 className="text-lg md:text-xl font-bold text-zinc-900 uppercase mb-2">Share on Social Media</h3>
            <p className="text-sm text-zinc-500 mb-6">We'll pre-populate a post with your impact stats and referral link. Earn 25 XP per share.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { platform: 'linkedin' as const, name: 'LinkedIn', style: { background: '#0077B5' }, icon: <Linkedin size={24} className="text-white" />, note: 'Opens share dialog' },
                { platform: 'instagram' as const, name: 'Instagram', style: { background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }, icon: <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>, note: 'Copies caption + opens profile' },
                { platform: 'youtube' as const, name: 'YouTube', style: { background: '#FF0000' }, icon: <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>, note: 'Opens channel page' },
              ].map(({ platform, name, style, icon, note }) => (
                <button
                  key={platform}
                  onClick={() => handleSocialShare(platform)}
                  className="p-6 rounded-3xl text-white flex flex-col items-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  style={style}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                    {icon}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm">{name}</p>
                    <p className="text-xs text-white/60 mt-1">+25 XP per share</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-white/80">
                    <ExternalLink size={12} /> {note}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Email Invite Section */}
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm">
            <h3 className="text-lg md:text-xl font-bold text-zinc-900 uppercase mb-2">Send Email Invitation</h3>
            <p className="text-sm text-zinc-500 mb-6">Invite friends directly via email with a personalized message. Earn 25 XP per invite sent.</p>

            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 px-1">Friend's Name</label>
                <input
                  type="text"
                  value={friendName}
                  onChange={e => setFriendName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl outline-none font-bold text-sm focus:bg-white focus:border-brand/30 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 px-1 flex items-center gap-1.5"><Mail size={10} /> Email Address</label>
                <input
                  type="email"
                  value={friendEmail}
                  onChange={e => setFriendEmail(e.target.value)}
                  placeholder="friend@example.com"
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl outline-none font-bold text-sm focus:bg-white focus:border-brand/30 transition-all"
                />
              </div>
              <div className="relative">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 px-1">Email Template</label>
                <button
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl font-bold text-sm text-left flex items-center justify-between hover:bg-white transition-all"
                >
                  <span>{TEMPLATE_OPTIONS.find(t => t.id === selectedTemplate)?.label}</span>
                  <ChevronDown size={16} className={`text-zinc-400 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showTemplateDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-10 overflow-hidden">
                    {TEMPLATE_OPTIONS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTemplate(t.id); setShowTemplateDropdown(false); }}
                        className={`w-full px-4 py-3 text-left hover:bg-zinc-50 transition-colors ${selectedTemplate === t.id ? 'bg-brand/5' : ''}`}
                      >
                        <p className="font-bold text-sm text-zinc-900">{t.label}</p>
                        <p className="text-xs text-zinc-500">{t.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !friendEmail}
                className="w-full py-4 bg-brand border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-elevation-2"
              >
                {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : <><Send size={14} /> Send Invitation</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Links Tab */}
      {activeTab === 'events' && dashboard && (
        <div className="space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Calendar size={22} className="text-brand" />
              <h3 className="text-lg md:text-xl font-black text-zinc-900 uppercase">Ambassador Event Links</h3>
            </div>
            <p className="text-sm text-zinc-500 mb-6">Generate unique ambassador links for upcoming events. When someone RSVPs through your link, you earn referral credit.</p>

            {events.length === 0 ? (
              <div className="text-center py-12">
                <Calendar size={40} className="mx-auto text-zinc-300 mb-4" />
                <p className="text-zinc-400 font-bold">No upcoming events right now</p>
                <p className="text-zinc-300 text-sm mt-1">Check back soon for new volunteer opportunities.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((evt: any) => {
                  const eventId = evt.id || evt._id;
                  const eventDate = new Date(evt.date || evt.startDate);
                  const isCopied = copiedEventId === eventId;
                  const ambassadorLink = getEventAmbassadorLink(eventId);

                  return (
                    <div
                      key={eventId}
                      className="p-4 md:p-5 rounded-2xl md:rounded-3xl border border-zinc-100 hover:border-zinc-200 transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-zinc-900 text-sm md:text-base truncate">{evt.title || evt.name}</p>
                            {evt.referralCount != null && evt.referralCount > 0 && (
                              <span className="shrink-0 px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-bold uppercase">
                                {evt.referralCount} referral{evt.referralCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zinc-400 font-bold">
                            <span>{eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            {evt.location && <span>· {evt.location}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleCopyEventLink(eventId)}
                            className={`min-h-[44px] px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-all ${
                              isCopied
                                ? 'bg-emerald-500 text-white'
                                : 'bg-zinc-900 text-white hover:scale-105 active:scale-95'
                            }`}
                          >
                            {isCopied ? <><Check size={14} /> Copied!</> : <><Link2 size={14} /> Get My Link</>}
                          </button>
                        </div>
                      </div>
                      {isCopied && (
                        <div className="mt-3 pt-3 border-t border-zinc-100">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Your Ambassador Link</p>
                          <p className="text-xs font-mono text-zinc-500 break-all">{ambassadorLink}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg md:text-xl font-bold text-zinc-900 uppercase">Top Referrers</h3>
            {userRank > 0 && (
              <div className="px-4 py-2 bg-brand/5 rounded-full text-sm font-bold text-brand">
                Your Rank: #{userRank}
              </div>
            )}
          </div>

          {(() => {
            const activeBoard = leaderboard.filter(e => e.referrals > 0);
            const medals = ['🥇', '🥈', '🥉'];
            const userEntry = leaderboard.find(e => e.volunteerId === user.id);
            const userActive = userEntry && userEntry.referrals > 0;

            if (activeBoard.length === 0) {
              return (
                <div className="text-center py-12">
                  <Trophy size={40} className="mx-auto text-zinc-200 mb-4" />
                  <p className="text-zinc-800 font-black text-lg">The board is wide open.</p>
                  <p className="text-zinc-400 font-medium text-sm mt-1 max-w-xs mx-auto">
                    No one has made their first referral yet — share your link and be the one who gets this community moving.
                  </p>
                </div>
              );
            }

            const top3 = activeBoard.slice(0, 3);
            const showUserRow = userActive && userRank > 3;

            return (
              <div className="space-y-2">
                {top3.map((entry, i) => {
                  const isUser = entry.volunteerId === user.id;
                  return (
                    <div
                      key={entry.volunteerId}
                      className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                        isUser ? 'bg-brand/5 border border-brand/20' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-lg shrink-0">
                        {medals[i]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${isUser ? 'text-brand' : 'text-zinc-900'}`}>
                          {entry.name} {isUser && '(You)'}
                        </p>
                        <p className="text-xs text-zinc-400">{entry.impact} people impacted</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-zinc-900">{entry.referrals}</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Referrals</p>
                      </div>
                    </div>
                  );
                })}
                {showUserRow && userEntry && (
                  <>
                    <div className="text-center text-zinc-300 text-xs py-1">· · ·</div>
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-brand/5 border border-brand/20">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-black text-zinc-400 shrink-0">
                        #{userRank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate text-brand">{userEntry.name} (You)</p>
                        <p className="text-xs text-zinc-400">{userEntry.impact} people impacted</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-zinc-900">{userEntry.referrals}</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Referrals</p>
                      </div>
                    </div>
                  </>
                )}
                {!userActive && (
                  <p className="text-center text-xs text-zinc-400 font-medium pt-3">
                    Share your link and log your first referral to appear on the board.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ReferralHub;
