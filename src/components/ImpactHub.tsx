import React, { useState, useEffect, useCallback } from 'react';
import { Volunteer } from '../types';
import { APP_CONFIG } from '../config';
import { apiService } from '../services/apiService';
import { geminiService } from '../services/geminiService';
import {
  DollarSign, BarChart3, Gift, Sparkles, Loader2, Copy, Check,
  Trophy, Award as AwardIcon, User as UserIcon, Instagram, Linkedin, Youtube, ShoppingBag, X,
  CheckCircle, AlertCircle, RotateCcw, Clock
} from 'lucide-react';

interface ImpactHubProps {
  user: Volunteer;
  allVolunteers: Volunteer[];
  onUpdate: (u: Volunteer) => void;
}

const ImpactHub: React.FC<ImpactHubProps> = ({ user, allVolunteers, onUpdate }) => {
  const isComms = ['Newsletter & Content Writer', 'Content Writer', 'Social Media Team'].includes(user.role);
  const [activeTab, setActiveTab] = useState<'content' | 'leaderboard' | 'rewards'>(isComms ? 'content' : 'leaderboard');

  const leaderboardData = [...allVolunteers]
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
  
  const userRank = [...allVolunteers].sort((a,b) => b.points - a.points).findIndex(v => v.id === user.id) + 1;

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic">Impact Hub</h2>
          <p className="text-zinc-500 mt-4 font-medium text-sm md:text-lg leading-relaxed">Amplify your contribution, earn rewards, and see how you rank among your peers.</p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap bg-white border border-zinc-100 p-2 rounded-full shadow-elevation-1 shrink-0 overflow-x-auto w-full sm:w-auto">
          <button onClick={() => setActiveTab('content')} className={`flex items-center gap-3 px-4 md:px-8 py-4 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${activeTab === 'content' ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-400 hover:text-zinc-600'}`}><DollarSign size={16} /> {isComms ? 'Content Studio' : 'Fundraising'}</button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center gap-3 px-4 md:px-8 py-4 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${activeTab === 'leaderboard' ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-400 hover:text-zinc-600'}`}><BarChart3 size={16} /> Leaderboard</button>
          <button onClick={() => setActiveTab('rewards')} className={`flex items-center gap-3 px-4 md:px-8 py-4 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${activeTab === 'rewards' ? 'bg-brand text-white shadow-elevation-2' : 'text-zinc-400 hover:text-zinc-600'}`}><Gift size={16} /> Rewards</button>
        </div>
      </div>
      
      {activeTab === 'content' && <ContentStudioPanel user={user} />}
      {activeTab === 'leaderboard' && <LeaderboardPanel user={user} userRank={userRank} leaderboardData={leaderboardData} />}
      {activeTab === 'rewards' && <RewardsPanel user={user} onUpdate={onUpdate} />}

    </div>
  );
};

const ContentStudioPanel: React.FC<{user: Volunteer}> = ({ user }) => {
  const [isDraftingEmail, setIsDraftingEmail] = useState(false);
  const [draftedEmail, setDraftedEmail] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  const [isDraftingPost, setIsDraftingPost] = useState(false);
  const [draftedPost, setDraftedPost] = useState('');
  const [postTopic, setPostTopic] = useState('');
  const [platform, setPlatform] = useState<'Instagram' | 'LinkedIn'>('Instagram');
  
  const isComms = ['Newsletter & Content Writer', 'Content Writer', 'Social Media Team'].includes(user.role);

  const handleDraftEmail = async () => {
    setIsDraftingEmail(true); setDraftedEmail('');
    const { emailBody } = await geminiService.draftFundraisingEmail(user.name, user.role);
    setDraftedEmail(emailBody); setIsDraftingEmail(false);
  };
  
  const handleDraftPost = async () => {
    if (!postTopic) return;
    setIsDraftingPost(true); setDraftedPost('');
    const { postText } = await geminiService.draftSocialMediaPost(postTopic, platform);
    setDraftedPost(postText); setIsDraftingPost(false);
  };
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={`grid grid-cols-1 ${isComms ? 'lg:grid-cols-2' : ''} gap-10`}>
      <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
        <h3 className="text-base md:text-xl font-bold text-zinc-900 uppercase">AI-Powered Fundraising</h3>
        <p className="text-sm text-zinc-600 mt-2">Use our Matching Assistant to draft a personalized fundraising email to send to your network.</p>
        <div className="mt-10 pt-10 border-t border-zinc-100">
          {!draftedEmail && !isDraftingEmail && <button onClick={handleDraftEmail} className="bg-brand border border-black text-white px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wide shadow-elevation-2 hover:scale-105 transition-all flex items-center justify-center gap-4 group"><Sparkles size={24} /> Draft My Email</button>}
          {isDraftingEmail && <div className="flex items-center justify-center h-48"><Loader2 size={48} className="text-brand animate-spin" /></div>}
          {draftedEmail && (
            <div className="space-y-6 animate-in fade-in">
               <div className="bg-zinc-50 p-4 md:p-8 rounded-3xl border border-zinc-100 whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[300px] overflow-y-auto">{draftedEmail}</div>
               <div className="flex items-center gap-4"><button onClick={() => handleCopy(draftedEmail)} className="flex-1 py-4 bg-brand border border-black text-white rounded-full font-bold text-[11px] uppercase tracking-wide flex items-center justify-center gap-3">{isCopied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Email</>}</button><button onClick={() => setDraftedEmail('')} className="py-4 px-8 border border-black rounded-full font-black text-xs uppercase tracking-wide">Start Over</button></div>
            </div>
          )}
        </div>
      </div>
      
      {isComms && (
         <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
            <h3 className="text-base md:text-xl font-bold text-zinc-900 uppercase">Social Media Generator</h3>
            <p className="text-sm text-zinc-600 mt-2">Draft engaging social media posts for HMC's channels.</p>
            <div className="mt-10 pt-10 border-t border-zinc-100">
              {!draftedPost && !isDraftingPost && (
                  <div className="space-y-4">
                     <input type="text" value={postTopic} onChange={e => setPostTopic(e.target.value)} placeholder="Enter post topic..." className="w-full p-4 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none focus:border-brand/30 font-bold text-sm" />
                     <div className="flex gap-2 p-1 bg-zinc-100 rounded-full"><button onClick={() => setPlatform('Instagram')} className={`flex-1 py-2 text-xs font-bold rounded-full flex items-center justify-center gap-2 ${platform === 'Instagram' ? 'bg-white shadow' : ''}`}><Instagram size={14}/> Instagram</button><button onClick={() => setPlatform('LinkedIn')} className={`flex-1 py-2 text-xs font-bold rounded-full flex items-center justify-center gap-2 ${platform === 'LinkedIn' ? 'bg-white shadow' : ''}`}><Linkedin size={14}/> LinkedIn</button></div>
                     <button onClick={handleDraftPost} disabled={!postTopic} className="w-full bg-brand border border-black text-white px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wide shadow-elevation-2 flex items-center justify-center gap-4 group disabled:opacity-50"><Sparkles size={20} /> Draft Post</button>
                  </div>
              )}
              {isDraftingPost && <div className="flex items-center justify-center h-48"><Loader2 size={48} className="text-brand animate-spin" /></div>}
              {draftedPost && (
                <div className="space-y-6 animate-in fade-in">
                   <div className="bg-zinc-50 p-4 md:p-8 rounded-3xl border border-zinc-100 whitespace-pre-wrap font-sans text-sm leading-relaxed max-h-[300px] overflow-y-auto">{draftedPost}</div>
                   <div className="flex items-center gap-4"><button onClick={() => handleCopy(draftedPost)} className="flex-1 py-4 bg-brand border border-black text-white rounded-full font-bold text-[11px] uppercase tracking-wide flex items-center justify-center gap-3">{isCopied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Post</>}</button><button onClick={() => setDraftedPost('')} className="py-4 px-8 border border-black rounded-full font-black text-xs uppercase tracking-wide">Start Over</button></div>
                </div>
              )}
            </div>
         </div>
      )}
    </div>
  );
};

const LeaderboardPanel: React.FC<{user: Volunteer, userRank: number, leaderboardData: Volunteer[]}> = ({user, userRank, leaderboardData}) => (
  <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
    <h3 className="text-base md:text-xl font-bold text-zinc-900 uppercase mb-8">Community Leaderboard</h3>
    <div className="space-y-4">
      {leaderboardData.map((v, index) => (
        <div key={v.id} className={`p-6 rounded-3xl border flex items-center justify-between transition-all ${user.id === v.id ? 'bg-brand text-white border-brand/20 shadow-sm hover:shadow-2xl transition-shadow' : 'bg-zinc-50 border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow'}`}>
          <div className="flex items-center gap-6">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black ${user.id === v.id ? 'bg-white/20' : 'bg-zinc-200 text-zinc-500'}`}>
              {index + 1}
            </div>
            <div className={`font-black ${user.id === v.id ? 'text-white' : 'text-zinc-900'}`}>{v.name}</div>
          </div>
          <div className={`text-base md:text-xl font-black ${user.id === v.id ? 'text-white' : 'text-zinc-900'}`}>{v.points} <span className="text-xs font-bold opacity-50">XP</span></div>
        </div>
      ))}
      {userRank > 10 && (
         <div className="p-6 rounded-3xl border-2 border-dashed border-zinc-200 flex items-center justify-between">
           <div className="flex items-center gap-6">
             <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black bg-zinc-200 text-zinc-500">{userRank}</div>
             <div className="font-black text-zinc-900">{user.name} (You)</div>
           </div>
           <div className="text-base md:text-xl font-black text-zinc-900">{user.points} <span className="text-xs font-bold opacity-50">XP</span></div>
         </div>
      )}
    </div>
  </div>
);

const RewardsPanel: React.FC<{user: Volunteer, onUpdate: (u: Volunteer) => void}> = ({user, onUpdate}) => {
  const [claimedSocial, setClaimedSocial] = useState<string[]>(user.claimedSocialPoints || []);

  const socialLinks = [
    { id: 'instagram', name: 'Instagram', url: APP_CONFIG.GAMIFICATION.socialLinks.instagram, points: 50, icon: Instagram, color: 'bg-gradient-to-br from-purple-500 to-pink-500' },
    { id: 'linkedin', name: 'LinkedIn', url: APP_CONFIG.GAMIFICATION.socialLinks.linkedin, points: 50, icon: Linkedin, color: 'bg-[#0077B5]' },
    { id: 'youtube', name: 'YouTube', url: APP_CONFIG.GAMIFICATION.socialLinks.youtube, points: 50, icon: Youtube, color: 'bg-red-600' },
  ];

  const handleFollowClaim = (socialId: string, socialUrl: string, pointsValue: number) => {
    if (claimedSocial.includes(socialId)) return;

    // Open social link in new tab
    window.open(socialUrl, '_blank');

    // Update claimed list and add points
    const newClaimedSocial = [...claimedSocial, socialId];
    setClaimedSocial(newClaimedSocial);

    const updatedUser = {
      ...user,
      points: user.points + pointsValue,
      claimedSocialPoints: newClaimedSocial
    };
    onUpdate(updatedUser);
  };

  return (
   <div className="space-y-10">
      {/* Social Media Points Section */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 p-4 md:p-8 rounded-2xl md:rounded-[40px] text-white border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
        <h3 className="text-base md:text-xl font-bold uppercase mb-2">Follow Us & Earn XP</h3>
        <p className="text-zinc-400 mb-8">Support HMC on social media and earn bonus points for each platform you follow!</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {socialLinks.map(social => {
            const isClaimed = claimedSocial.includes(social.id);
            return (
              <button
                key={social.id}
                onClick={() => handleFollowClaim(social.id, social.url, social.points)}
                disabled={isClaimed}
                className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-4 transition-all ${
                  isClaimed
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                }`}
              >
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${social.color}`}>
                  <social.icon size={32} className="text-white" />
                </div>
                <div className="text-center">
                  <p className="font-black text-sm md:text-lg">{social.name}</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {isClaimed ? (
                      <span className="text-emerald-400 flex items-center justify-center gap-1">
                        <Check size={14} /> Claimed!
                      </span>
                    ) : (
                      <>+{social.points} XP</>
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Admin: pending redemption fulfillment */}
      {user.isAdmin && <AdminRedemptionsPanel user={user} />}

      {/* Rewards Store */}
      <RewardsStore user={user} onUpdate={onUpdate} />
   </div>
  );
};


// Rewards Store with redemption flow
const SHOP_URLS: Record<string, string> = {
  'rew1': 'https://www.healthmatters.clinic/product/unstoppable-tee',
  'rew2': 'https://www.healthmatters.clinic/shop',
  'rew3': 'https://www.healthmatters.clinic/shop',
  'rew4': '', // Letter of rec — no shop link
};

const RewardsStore: React.FC<{ user: Volunteer; onUpdate: (u: Volunteer) => void }> = ({ user, onUpdate }) => {
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<{ rewardTitle: string } | null>(null);
  const [error, setError] = useState('');

  const handleRedeem = async (reward: { id: string; title: string; points: number }) => {
    if (!confirm(`Request "${reward.title}" for ${reward.points} XP?\n\nYour XP will be held and deducted once an admin sends you your valid coupon code (usually within 24 hours).`)) return;
    setRedeeming(reward.id);
    setError('');
    try {
      await apiService.post('/api/rewards/redeem', {
        rewardId: reward.id,
        rewardTitle: reward.title,
        rewardPoints: reward.points,
      });
      setPendingResult({ rewardTitle: reward.title });
    } catch (e: any) {
      setError(e?.message || 'Failed to redeem. Please try again.');
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <>
      <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow">
        <h3 className="text-base md:text-xl font-bold text-zinc-900 uppercase mb-2">Rewards Store</h3>
        <p className="text-sm text-zinc-600 mb-2">Redeem your Impact XP for exclusive HMC merchandise.</p>
        <p className="text-xs text-zinc-400 mb-8">Your balance: <span className="font-black text-zinc-900">{user.points} XP</span>{(user as any).heldPoints > 0 && <span className="ml-2 text-amber-500">({(user as any).heldPoints} XP pending fulfillment)</span>}</p>
        {error && <p className="text-sm text-rose-500 font-bold mb-4">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
          {APP_CONFIG.GAMIFICATION.rewards.map(reward => {
            const canAfford = (user.points || 0) >= reward.points;
            const isRedeeming = redeeming === reward.id;
            return (
              <div key={reward.id} className={`p-4 md:p-8 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-2xl transition-shadow text-center flex flex-col items-center transition-all ${canAfford ? 'bg-white' : 'bg-zinc-50 opacity-60'}`}>
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 border-2 ${canAfford ? 'bg-brand/5 border-brand/10 text-brand' : 'bg-zinc-100 border-zinc-200 text-zinc-300'}`}>
                   <AwardIcon size={48} />
                </div>
                <p className="text-base font-black text-zinc-900 flex-1">{reward.title}</p>
                <p className="text-2xl font-black text-zinc-900 my-4">{reward.points} <span className="text-xs font-bold text-zinc-300">XP</span></p>
                <button
                  disabled={!canAfford || isRedeeming}
                  onClick={() => handleRedeem(reward)}
                  className="w-full py-3 min-h-[44px] bg-brand border border-black text-white rounded-full font-black text-[11px] uppercase tracking-[0.2em] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                >
                  {isRedeeming ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
                  {isRedeeming ? 'Redeeming...' : 'Redeem'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Confirmation Modal */}
      {pendingResult && (
        <div role="dialog" aria-modal="true" aria-label="Reward requested" className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setPendingResult(null)}>
          <div className="bg-white rounded-[40px] max-w-md w-full p-8 text-center shadow-elevation-3 border border-zinc-100" onClick={e => e.stopPropagation()}>
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Gift size={36} className="text-emerald-600" />
            </div>
            <h3 className="text-2xl font-black text-zinc-900 mb-2">Request Submitted!</h3>
            <p className="text-sm text-zinc-500 mb-6">{pendingResult.rewardTitle}</p>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-6 text-left">
              <p className="text-sm font-bold text-amber-800 mb-1">What happens next:</p>
              <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                <li>An admin will create your discount code in the shop</li>
                <li>You'll receive an email with your valid coupon code</li>
                <li>Your XP will be deducted once the code is sent</li>
              </ol>
            </div>
            <p className="text-xs text-zinc-400 mb-6">Usually within 24 hours. Check your email at {user.email}.</p>
            <button onClick={() => setPendingResult(null)} className="px-8 py-3 bg-brand text-white border border-black rounded-full font-black text-sm uppercase tracking-wide hover:opacity-90 active:scale-95 transition-all">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

interface PendingRedemption {
  id: string;
  volunteerId: string;
  volunteerName: string;
  volunteerEmail: string;
  rewardId: string;
  rewardTitle: string;
  pointsSpent: number;
  status: 'pending' | 'fulfilled' | 'refunded';
  createdAt: string;
}

const AdminRedemptionsPanel: React.FC<{ user: Volunteer }> = ({ user }) => {
  const [redemptions, setRedemptions] = useState<PendingRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponInputs, setCouponInputs] = useState<Record<string, string>>({});
  const [fulfilling, setFulfilling] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [rowSuccess, setRowSuccess] = useState<Record<string, string>>({});

  const fetchRedemptions = useCallback(async () => {
    try {
      const data = await apiService.get('/api/admin/rewards/redemptions');
      setRedemptions(data.redemptions || []);
    } catch {
      setRedemptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRedemptions(); }, [fetchRedemptions]);

  const handleFulfill = async (r: PendingRedemption) => {
    const code = (couponInputs[r.id] || '').trim();
    if (!code) {
      setRowErrors(prev => ({ ...prev, [r.id]: 'Enter a coupon code first.' }));
      return;
    }
    setRowErrors(prev => ({ ...prev, [r.id]: '' }));
    setFulfilling(r.id);
    try {
      await apiService.post(`/api/admin/rewards/fulfill/${r.id}`, { couponCode: code });
      setRowSuccess(prev => ({ ...prev, [r.id]: `Fulfilled. Coupon sent to ${r.volunteerEmail}.` }));
      setRedemptions(prev => prev.filter(x => x.id !== r.id));
    } catch (e: any) {
      setRowErrors(prev => ({ ...prev, [r.id]: e?.message || 'Fulfill failed.' }));
    } finally {
      setFulfilling(null);
    }
  };

  const handleRefund = async (r: PendingRedemption) => {
    if (!window.confirm(`Refund ${r.pointsSpent} XP to ${r.volunteerName}? This cannot be undone.`)) return;
    setRefunding(r.id);
    try {
      await apiService.post(`/api/admin/rewards/refund/${r.id}`, {});
      setRowSuccess(prev => ({ ...prev, [r.id]: `${r.pointsSpent} XP refunded to ${r.volunteerName}.` }));
      setRedemptions(prev => prev.filter(x => x.id !== r.id));
    } catch (e: any) {
      setRowErrors(prev => ({ ...prev, [r.id]: e?.message || 'Refund failed.' }));
    } finally {
      setRefunding(null);
    }
  };

  if (!user.isAdmin) return null;

  const pending = redemptions.filter(r => r.status === 'pending');

  return (
    <div className="bg-white rounded-2xl md:rounded-[40px] border border-zinc-100 shadow-sm p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base md:text-xl font-bold text-zinc-900 uppercase">Pending Reward Requests</h3>
          <p className="text-xs text-zinc-400 font-bold mt-0.5">Create a Webflow discount code, paste it here, then click Fulfill to send it to the volunteer.</p>
        </div>
        {pending.length > 0 && (
          <span className="px-3 py-1 rounded-full bg-rose-500 text-white text-[11px] font-black">{pending.length}</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 text-sm font-bold">
          <Loader2 size={14} className="animate-spin" />
          Loading...
        </div>
      ) : pending.length === 0 ? (
        <div className="flex items-center gap-3 text-zinc-400 py-4">
          <CheckCircle size={18} className="text-emerald-400" />
          <span className="text-sm font-bold">No pending requests. All caught up.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(r => (
            <div key={r.id} className="border border-zinc-100 rounded-2xl p-4 md:p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-black text-sm">{r.volunteerName}</p>
                  <p className="text-xs text-zinc-400 font-bold">{r.volunteerEmail}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-black text-zinc-700">{r.rewardTitle}</span>
                    <span className="text-[10px] font-black text-zinc-300">{r.pointsSpent} XP</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-zinc-300 flex-shrink-0">
                  <Clock size={11} />
                  <span className="text-[10px] font-bold">
                    {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={couponInputs[r.id] || ''}
                  onChange={e => setCouponInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Paste Webflow coupon code..."
                  className="flex-1 px-4 py-2.5 rounded-full border border-zinc-200 text-xs font-bold focus:outline-none focus:border-brand"
                />
                <button
                  onClick={() => handleFulfill(r)}
                  disabled={fulfilling === r.id || !couponInputs[r.id]?.trim()}
                  className="px-5 py-2.5 rounded-full bg-brand text-white font-black text-[11px] uppercase tracking-[0.15em] disabled:opacity-40 hover:bg-zinc-900 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  {fulfilling === r.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  Fulfill
                </button>
                <button
                  onClick={() => handleRefund(r)}
                  disabled={refunding === r.id}
                  className="px-5 py-2.5 rounded-full bg-zinc-100 text-zinc-600 font-black text-[11px] uppercase tracking-[0.15em] disabled:opacity-40 hover:bg-zinc-200 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  {refunding === r.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  Refund XP
                </button>
              </div>

              {rowErrors[r.id] && (
                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 rounded-xl px-3 py-2">
                  <AlertCircle size={12} />
                  <span className="text-[11px] font-black">{rowErrors[r.id]}</span>
                </div>
              )}
              {rowSuccess[r.id] && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                  <CheckCircle size={12} />
                  <span className="text-[11px] font-black">{rowSuccess[r.id]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { ContentStudioPanel };
export default ImpactHub;