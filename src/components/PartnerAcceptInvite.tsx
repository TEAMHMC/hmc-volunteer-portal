import React, { useState } from 'react';
import { apiService } from '../services/apiService';
import { APP_CONFIG } from '../config';
import { Loader2, CheckCircle, X } from 'lucide-react';

interface PartnerAcceptInviteProps {
  partnerToken: string;
  partnerId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const inputCls = 'w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 placeholder-zinc-400 outline-none focus:border-[#233DFF] focus:ring-2 focus:ring-[#233DFF]/10 min-h-[44px]';

const PartnerAcceptInvite: React.FC<PartnerAcceptInviteProps> = ({ partnerToken, partnerId, onSuccess, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await apiService.post('/api/partners/accept-invite', {
        token: partnerToken,
        partnerId,
        name,
        email,
        password,
      });
      if (data?.token) {
        localStorage.setItem('authToken', data.token);
      }
      setDone(true);
      setTimeout(() => onSuccess(), 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to set up your account. The invite link may be expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-['Inter']">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a1a2e] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={APP_CONFIG.BRAND.logoUrl} alt="Health Matters Clinic" className="w-8 h-8 rounded-lg" />
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">Partner Portal</p>
              <p className="text-sm font-black text-white">Create Your Account</p>
            </div>
          </div>
          <button onClick={onCancel} aria-label="Close" className="p-2 text-white/40 hover:text-white/70 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="text-center py-14 px-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-emerald-500" size={32} />
            </div>
            <h3 className="font-black text-zinc-900 text-lg">Account created.</h3>
            <p className="text-sm text-zinc-500 font-medium mt-2">Redirecting you to the partner portal...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-sm text-zinc-500 font-medium">
              You have been invited to access the HMC Partner Portal. Set up your login to get started.
            </p>

            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1.5">Your Name</label>
              <input
                required
                type="text"
                placeholder="Full name"
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1.5">Email Address</label>
              <input
                required
                type="email"
                placeholder="you@organization.org"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1.5">Password</label>
              <input
                required
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1.5">Confirm Password</label>
              <input
                required
                type="password"
                placeholder="Repeat your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={inputCls}
              />
            </div>

            {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] bg-[#233DFF] text-white font-black uppercase tracking-wider rounded-full hover:bg-[#1a2de0] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors text-sm"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Create Account and Access Portal'}
            </button>

            <p className="text-[11px] text-zinc-400 font-medium text-center">
              This invite link is for your organization only. Do not share it.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default PartnerAcceptInvite;
