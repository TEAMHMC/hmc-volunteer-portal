import React, { useState } from 'react';
import { Volunteer } from '../types';
import { APP_CONFIG } from '../config';
import { geminiService } from '../services/geminiService';
import { 
  DollarSign, BarChart3, Gift, Sparkles, Loader2, Copy, Check,
  Trophy, Award as AwardIcon, User as UserIcon, Instagram, Linkedin
} from 'lucide-react';

interface ImpactHubProps {
  user: Volunteer;
  allVolunteers: Volunteer[];
  onUpdate: (u: Volunteer) => void;
}

const ImpactHub: React.FC<ImpactHubProps> = ({ user, allVolunteers, onUpdate }) => {
  const isComms = ['Content Writer', 'Social Media Team'].includes(user.role);
  const [activeTab, setActiveTab] = useState<'content' | 'leaderboard' | 'rewards'>(isComms ? 'content' : 'leaderboard');

  const leaderboardData = [...allVolunteers]
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
  
  const userRank = [...allVolunteers].sort((a,b) => b.points - a.points).findIndex(v => v.id === user.id) + 1;

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="max-w-xl">
          <h2 className="text-5xl font-black text-zinc-900 tracking-tighter uppercase leading-none">Impact Hub</h2>
          <p className="text-zinc-500 mt-4 font-medium text-lg leading-relaxed">Amplify your contribution, earn rewards, and see how you rank among your peers.</p>
        </div>
        <div className="flex bg-white border border-zinc-100 p-2 rounded-full shadow-sm shrink-0">
          <button onClick={() => setActiveTab('content')} className={`flex items-center gap-3 px-8 py-4 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'content' ? 'bg-[#233DFF] text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`}><DollarSign size={16} /> {isComms ? 'Content Studio' : 'Fundraising'}</button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center gap-3 px-8 py-4 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'leaderboard' ? 'bg-[#233DFF] text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`}><BarChart3 size={16} /> Leaderboard</button>
          <button onClick={() => setActiveTab('rewards')} className={`flex items-center gap-3 px-8 py-4 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'rewards' ? 'bg-[#233DFF] text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`}><Gift size={16} /> Rewards</button>
        </div>
      </div>
      
      {activeTab === 'content' && <ContentStudioPanel user={user} />}
      {activeTab === 'leaderboard' && <LeaderboardPanel user={user} userRank={userRank} leaderboardData={leaderboardData} />}
      {activeTab === 'rewards' && <RewardsPanel user={user} />}

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
  
  const isComms = ['Content Writer', 'Social Media Team'].includes(user.role);

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
      <div className="bg-white p-12 rounded-[56px] border border-zinc-100 shadow-sm">
        <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">AI-Powered Fundraising</h3>
        <p className="text-zinc-500 mt-2">Use our Matching Assistant to draft a personalized fundraising email to send to your network.</p>
        <div className="mt-10 pt-10 border-t border-zinc-100">
          {!draftedEmail && !isDraftingEmail && <button onClick={handleDraftEmail} className="bg-zinc-900 text-white px-12 py-7 rounded-full font-black text-lg shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-4 group"><Sparkles size={24} /> Draft My Email</button>}
          {isDraftingEmail && <div className="flex items-center justify-center h-48"><Loader2 size={48} className="text-[#233DFF] animate-spin" /></div>}
          {draftedEmail && (
            <div className="space-y-6 animate-in fade-in">
               <div className="bg-zinc-50 p-8 rounded-3xl border border-zinc-100 whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[300px] overflow-y-auto">{draftedEmail}</div>
               <div className="flex items-center gap-4"><button onClick={() => handleCopy(draftedEmail)} className="flex-1 py-4 bg-[#233DFF] text-white rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3">{isCopied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Email</>}</button><button onClick={() => setDraftedEmail('')} className="py-4 px-8 border border-zinc-200 rounded-full font-black text-xs uppercase">Start Over</button></div>
            </div>
          )}
        </div>
      </div>
      
      {isComms && (
         <div className="bg-white p-12 rounded-[56px] border border-zinc-100 shadow-sm">
            <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase">Social Media Generator</h3>
            <p className="text-zinc-500 mt-2">Draft engaging social media posts for HMC's channels.</p>
            <div className="mt-10 pt-10 border-t border-zinc-100">
              {!draftedPost && !isDraftingPost && (
                  <div className="space-y-4">
                     <input type="text" value={postTopic} onChange={e => setPostTopic(e.target.value)} placeholder="Enter post topic..." className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl" />
                     <div className="flex gap-2 p-1 bg-zinc-100 rounded-full"><button onClick={() => setPlatform('Instagram')} className={`flex-1 py-2 text-xs font-bold rounded-full flex items-center justify-center gap-2 ${platform === 'Instagram' ? 'bg-white shadow' : ''}`}><Instagram size={14}/> Instagram</button><button onClick={() => setPlatform('LinkedIn')} className={`flex-1 py-2 text-xs font-bold rounded-full flex items-center justify-center gap-2 ${platform === 'LinkedIn' ? 'bg-white shadow' : ''}`}><Linkedin size={14}/> LinkedIn</button></div>
                     <button onClick={handleDraftPost} disabled={!postTopic} className="w-full bg-zinc-900 text-white px-12 py-5 rounded-full font-black text-sm shadow-2xl flex items-center justify-center gap-4 group disabled:opacity-50"><Sparkles size={20} /> Draft Post</button>
                  </div>
              )}
              {isDraftingPost && <div className="flex items-center justify-center h-48"><Loader2 size={48} className="text-[#233DFF] animate-spin" /></div>}
              {draftedPost && (
                <div className="space-y-6 animate-in fade-in">
                   <div className="bg-zinc-50 p-8 rounded-3xl border border-zinc-100 whitespace-pre-wrap font-sans text-sm leading-relaxed max-h-[300px] overflow-y-auto">{draftedPost}</div>
                   <div className="flex items-center gap-4"><button onClick={() => handleCopy(draftedPost)} className="flex-1 py-4 bg-[#233DFF] text-white rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3">{isCopied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Post</>}</button><button onClick={() => setDraftedPost('')} className="py-4 px-8 border border-zinc-200 rounded-full font-black text-xs uppercase">Start Over</button></div>
                </div>
              )}
            </div>
         </div>
      )}
    </div>
  );
};

const LeaderboardPanel: React.FC<{user: Volunteer, userRank: number, leaderboardData: Volunteer[]}> = ({user, userRank, leaderboardData}) => (
  <div className="bg-white p-12 rounded-[56px] border border-zinc-100 shadow-sm">
    <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase mb-8">Community Leaderboard</h3>
    <div className="space-y-4">
      {leaderboardData.map((v, index) => (
        <div key={v.id} className={`p-6 rounded-3xl border flex items-center justify-between transition-all ${user.id === v.id ? 'bg-[#233DFF] text-white border-[#233DFF]/20 shadow-xl' : 'bg-zinc-50 border-zinc-100'}`}>
          <div className="flex items-center gap-6">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black ${user.id === v.id ? 'bg-white/20' : 'bg-zinc-200 text-zinc-500'}`}>
              {index + 1}
            </div>
            <div className={`font-black ${user.id === v.id ? 'text-white' : 'text-zinc-900'}`}>{v.name}</div>
          </div>
          <div className={`text-xl font-black ${user.id === v.id ? 'text-white' : 'text-zinc-900'}`}>{v.points} <span className="text-xs font-bold opacity-50">XP</span></div>
        </div>
      ))}
      {userRank > 10 && (
         <div className="p-6 rounded-3xl border-2 border-dashed border-zinc-200 flex items-center justify-between">
           <div className="flex items-center gap-6">
             <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black bg-zinc-200 text-zinc-500">{userRank}</div>
             <div className="font-black text-zinc-900">{user.name} (You)</div>
           </div>
           <div className="text-xl font-black text-zinc-900">{user.points} <span className="text-xs font-bold opacity-50">XP</span></div>
         </div>
      )}
    </div>
  </div>
);

const RewardsPanel: React.FC<{user: Volunteer}> = ({user}) => (
   <div className="bg-white p-12 rounded-[56px] border border-zinc-100 shadow-sm">
      <h3 className="text-2xl font-black text-zinc-900 tracking-tight uppercase mb-2">Rewards Store</h3>
      <p className="text-zinc-500 mb-8">Redeem your Impact XP for exclusive HMC merchandise.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {APP_CONFIG.GAMIFICATION.rewards.map(reward => {
          const canAfford = user.points >= reward.points;
          return (
            <div key={reward.id} className={`p-8 rounded-3xl border text-center flex flex-col items-center transition-all ${canAfford ? 'bg-white' : 'bg-zinc-50 opacity-60'}`}>
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 border-4 ${canAfford ? 'bg-[#233DFF]/5 border-[#233DFF]/10 text-[#233DFF]' : 'bg-zinc-100 border-zinc-200 text-zinc-300'}`}>
                 <AwardIcon size={48} />
              </div>
              <p className="text-base font-black text-zinc-900 flex-1">{reward.title}</p>
              <p className="text-2xl font-black text-zinc-900 my-4">{reward.points} <span className="text-xs font-bold text-zinc-300">XP</span></p>
              <button disabled={!canAfford} className="w-full py-3 bg-zinc-900 text-white rounded-full font-black text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed">
                Redeem
              </button>
            </div>
          )
        })}
      </div>
   </div>
);


export default ImpactHub;