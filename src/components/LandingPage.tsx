
import React, { useState } from 'react';
import { ArrowRight, Globe, Shield, Heart, HeartPulse, ChevronRight, Activity, Zap, Users, LogIn, Eye, EyeOff, Loader2, Mail, AlertTriangle } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { GoogleLogin } from '@react-oauth/google';

interface LandingPageProps {
  onStartOnboarding: () => void;
  onLogin: (email: string, password: string, isAdmin: boolean) => Promise<void>;
  onGoogleLogin: (credentialResponse: any, isAdmin: boolean) => Promise<void>;
  googleClientId?: string;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartOnboarding, onLogin, onGoogleLogin, googleClientId }) => {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleAdminLoginClick = () => {
    setIsAdmin(true);
    setShowLogin(true);
  };

  const handleVolunteerLoginClick = () => {
    setIsAdmin(false);
    setShowLogin(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setError('');
    try {
      await onLogin(email, password, isAdmin);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSubmit = async (credentialResponse: any) => {
    setIsLoading(true);
    setError('');
    try {
        await onGoogleLogin(credentialResponse, isAdmin);
    } catch(err) {
        setError((err as Error).message);
    } finally {
        setIsLoading(false);
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setResetLoading(true);
    setError('');
    try {
      const res = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResetSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSignUpClick = () => {
      setShowLogin(false);
      onStartOnboarding();
  }

  return (
    <div className="min-h-screen bg-[#FDFEFE] flex flex-col font-['Inter'] overflow-x-hidden">
      
      <nav className="max-w-[1400px] mx-auto w-full px-6 md:px-12 py-10 flex justify-between items-center z-50">
        <a
          href="https://www.healthmatters.clinic"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 cursor-pointer group"
        >
          <img
            src={APP_CONFIG.BRAND.logoUrl}
            alt="HMC"
            className="w-10 h-10 md:w-12 md:h-12 object-contain transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:drop-shadow-lg"
          />
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider md:hidden">HMC VMS</span>
          <span className="hidden md:block text-sm font-bold text-zinc-900 uppercase tracking-wider group-hover:text-brand transition-colors">HMC VOLUNTEER PLATFORM</span>
        </a>
        <div className="flex items-center gap-2">
          <button onClick={handleAdminLoginClick} className="bg-white border border-black text-zinc-900 px-4 md:px-8 py-2.5 md:py-3.5 rounded-full font-bold text-[10px] md:text-[11px] uppercase tracking-wide flex items-center gap-2 md:gap-3 transition-all hover:scale-105 active:scale-95 shadow-elevation-1">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-black" />
            Admin Portal
          </button>
          <button onClick={handleVolunteerLoginClick} className="bg-brand border border-black text-white px-4 md:px-8 py-2.5 md:py-3.5 rounded-full font-bold text-[10px] md:text-[11px] uppercase tracking-wide shadow-elevation-2 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 md:gap-3">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white" />
            Volunteer Login
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 pb-16 md:pb-32 relative z-10">
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[1200px] max-h-[1200px] opacity-[0.03] pointer-events-none -z-10">
           <Activity className="w-full h-full text-zinc-900" strokeWidth={0.5} />
        </div>
        
        {showLogin ? (
          <div className="w-full max-w-[1200px] flex justify-center animate-in fade-in">
            <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-container shadow-elevation-3 border border-zinc-100 animate-in fade-in zoom-in-95 duration-500 mx-auto">
              <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tighter uppercase italic">{isAdmin ? 'Admin Portal' : 'Welcome Back'}</h2>
                  <button onClick={() => setShowLogin(false)} className="text-zinc-300 hover:text-zinc-900 text-sm font-bold bg-zinc-50 px-3 py-1 rounded-full transition-colors">Close</button>
              </div>
              <div className="space-y-6">
                
                {googleClientId && (
                  <div className="pb-6 border-b border-zinc-100 space-y-4">
                      <div className="w-full">
                          <GoogleLogin 
                              onSuccess={handleGoogleSubmit} 
                              onError={() => setError("Google login failed. Please try again.")} 
                              theme="outline" 
                              shape="pill" 
                              text="continue_with"
                              logo_alignment="center"
                          />
                      </div>
                      <p className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Or continue with email</p>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2 px-2 flex items-center gap-2"><Mail size={12}/> Email Address</label>
                      <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-brand/30 transition-all" 
                        placeholder="name@healthmatters.clinic"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2 px-2 flex items-center gap-2"><Shield size={12}/> Password</label>
                      <div className="relative">
                          <input 
                            type={showPassword ? 'text' : 'password'} 
                            required 
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-brand/30 transition-all pr-14" 
                            placeholder="••••••••"
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                      </div>
                      <div className="flex justify-end px-1 mt-1.5">
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          disabled={resetLoading}
                          className="text-[11px] font-semibold text-zinc-400 hover:text-brand transition-colors"
                        >
                          {resetLoading ? 'Sending...' : 'Forgot password?'}
                        </button>
                      </div>
                    </div>
                    {resetSent && (
                      <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl text-center text-xs font-bold border border-emerald-100">
                        Password reset link sent! Check your email inbox.
                      </div>
                    )}
                    {error && (
                        <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-center text-xs font-bold border border-rose-100 space-y-2">
                          <div className="flex items-center justify-center gap-2"><Zap size={14} /> {error}</div>
                          {!isAdmin && error.toLowerCase().includes('invalid') && (
                            <p className="text-rose-400 font-medium">Don't have an account? Click <button type="button" onClick={handleSignUpClick} className="underline font-bold text-rose-600 hover:text-rose-800">Apply to Volunteer</button> below to get started.</p>
                          )}
                        </div>
                    )}
                    <button type="submit" disabled={isLoading} className="w-full py-5 bg-brand border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-2 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95">
                      {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><div className="w-2 h-2 rounded-full bg-white" /> Secure Login <ArrowRight size={16} /></>}
                    </button>
                </form>
                {!isAdmin && (
                    <div className="text-center pt-2">
                        <p className="text-xs font-medium text-zinc-400">Don't have an account yet?</p>
                        <button onClick={handleSignUpClick} className="mt-3 bg-white border border-black text-zinc-900 px-6 py-2.5 rounded-full font-bold text-[10px] uppercase tracking-wide flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-elevation-1 mx-auto">
                            <div className="w-1.5 h-1.5 rounded-full bg-black" />
                            Apply to Volunteer
                        </button>
                    </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-[1200px] text-center space-y-12 md:space-y-16 animate-in fade-in duration-1000">
             <div className="space-y-6 md:space-y-8">
                <div className="inline-flex items-center gap-3 px-4 md:px-6 py-2 bg-brand/5 text-brand border border-brand/10 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] mb-4">
                   <Zap size={14} className="animate-pulse" /> Community Operations
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-8xl lg:text-[90px] font-black text-zinc-900 tracking-tighter leading-[0.85] mb-8 italic uppercase">
                  Join our<br/>
                  <span className="bg-gradient-to-r from-brand to-indigo-400 bg-clip-text text-transparent">Community.</span>
                </h1>
                <p className="text-base md:text-lg lg:text-xl text-zinc-400 font-medium max-w-4xl mx-auto leading-relaxed italic">
                  A central platform for Health Matters Clinic volunteers to find missions, complete training, and track their impact.
                </p>
             </div>

             <div className="pt-8 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
                <button
                  onClick={onStartOnboarding}
                  className="bg-brand border border-black text-white px-8 md:px-10 py-5 md:py-6 rounded-full font-bold text-sm md:text-base uppercase tracking-wide shadow-elevation-3 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 group"
                >
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-white" />
                  Get Started <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                </button>
                <div className="flex items-center gap-4 p-3 bg-white border border-zinc-100 rounded-card-lg shadow-elevation-1">
                   <div className="flex -space-x-3">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-elevation-1 ${i === 1 ? 'bg-brand/10' : i === 2 ? 'bg-indigo-100' : i === 3 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                          <Users size={14} className="text-zinc-600" />
                        </div>
                      ))}
                   </div>
                   <div className="text-left pr-2">
                      <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-zinc-900">1,000+ Volunteers</p>
                      <p className="text-[8px] md:text-[9px] font-bold text-zinc-300 uppercase tracking-widest">Join our Community</p>
                   </div>
                </div>
             </div>
          </div>
        )}

      </main>

      <footer className="px-6 md:px-12 py-12 border-t border-zinc-50 flex flex-col md:flex-row justify-between items-center gap-8 mt-auto">
         <p className="text-[10px] md:text-[11px] font-bold text-zinc-300 uppercase tracking-widest text-center md:text-left">© 2026 Health Matters Clinic All rights reserved.</p>
         <div className="flex items-center gap-6 md:gap-10">
            <a href="https://www.healthmatters.clinic/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[10px] md:text-[11px] font-bold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-brand transition-colors">Privacy Policy</a>
            <a href="https://www.healthmatters.clinic/terms" target="_blank" rel="noopener noreferrer" className="text-[10px] md:text-[11px] font-bold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-brand transition-colors">Terms of Service</a>
         </div>
      </footer>
    </div>
  );
};

export default LandingPage;
