import React, { useState, useEffect } from 'react';
import { Volunteer } from '../types';
import { apiService } from '../services/apiService';
import { toastService } from '../services/toastService';
import {
  Copy, Check, Send, Linkedin, Share2, Users, Zap, Trophy,
  Loader2, Mail, ChevronDown, ExternalLink, Award
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
  const [activeTab, setActiveTab] = useState<'overview' | 'share' | 'leaderboard'>('overview');

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

  const handleSocialShare = async (platform: 'linkedin' | 'twitter' | 'facebook') => {
    if (!dashboard) return;
    try {
      const { content } = await apiService.get(`/api/share/content/${platform}`);
      const encodedText = encodeURIComponent(content || '');
      const encodedUrl = encodeURIComponent(dashboard.referralLink);

      const shareUrls: Record<string, string> = {
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      };

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
          {(['overview', 'share', 'leaderboard'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
                activeTab === tab
                  ? 'bg-zinc-900 text-white shadow-elevation-1'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'share' ? 'Share & Invite' : 'Leaderboard'}
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
                onClick={() => handleSocialShare('twitter')}
                className="flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-full font-bold text-xs uppercase tracking-wide hover:scale-105 active:scale-95 transition-all"
              >
                <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                X / Twitter
              </button>
              <button
                onClick={() => handleSocialShare('facebook')}
                className="flex items-center gap-2 px-5 py-3 bg-[#1877F2] text-white rounded-full font-bold text-xs uppercase tracking-wide hover:scale-105 active:scale-95 transition-all"
              >
                <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
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
                { platform: 'linkedin' as const, name: 'LinkedIn', color: 'bg-[#0077B5]', icon: <Linkedin size={24} className="text-white" /> },
                { platform: 'twitter' as const, name: 'X / Twitter', color: 'bg-zinc-900', icon: <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                { platform: 'facebook' as const, name: 'Facebook', color: 'bg-[#1877F2]', icon: <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
              ].map(({ platform, name, color, icon }) => (
                <button
                  key={platform}
                  onClick={() => handleSocialShare(platform)}
                  className={`${color} p-6 rounded-3xl text-white flex flex-col items-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                    {icon}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm">{name}</p>
                    <p className="text-xs text-white/60 mt-1">+25 XP per share</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-white/80">
                    <ExternalLink size={12} /> Share Now
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

          {leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <Trophy size={40} className="mx-auto text-zinc-300 mb-4" />
              <p className="text-zinc-400 font-bold">No referrals yet — be the first!</p>
              <p className="text-zinc-300 text-sm mt-1">Share your link to start climbing the leaderboard.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 20).map((entry, i) => {
                const isUser = entry.volunteerId === user.id;
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div
                    key={entry.volunteerId}
                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      isUser ? 'bg-brand/5 border border-brand/20' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-lg font-black shrink-0">
                      {i < 3 ? medals[i] : <span className="text-sm text-zinc-400">{entry.rank}</span>}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReferralHub;
