
import React, { useState } from 'react';
import { ArrowRight, Globe, Shield, Heart, HeartPulse, ChevronRight, Activity, Zap, Users, LogIn, Eye, EyeOff, Loader2, Mail, AlertTriangle } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { useGoogleLogin } from '@react-oauth/google';

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
  const [googleLoading, setGoogleLoading] = useState(false);

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        await handleGoogleSubmit({ credential: tokenResponse.access_token });
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => setError('Google sign-in failed. Please try again.'),
    scope: 'openid email profile',
  });

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
      setError('Unable to send reset email. Check your connection and try again, or contact support@healthmatters.clinic.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSignUpClick = () => {
      setShowLogin(false);
      onStartOnboarding();
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-['Inter'] overflow-x-hidden">
      
      <nav className="max-w-[1400px] mx-auto w-full px-4 md:px-12 py-4 md:py-10 flex justify-between items-center z-50">
        <a
          href="https://www.healthmatters.clinic"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 md:gap-4 cursor-pointer group shrink-0"
        >
          <img
            src={APP_CONFIG.BRAND.logoUrl}
            alt="HMC"
            className="w-9 h-9 md:w-12 md:h-12 object-contain transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:drop-shadow-lg"
          />
          <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider md:hidden">HMC</span>
          <span className="hidden md:block text-sm font-bold text-zinc-900 uppercase tracking-wider group-hover:text-brand transition-colors">HMC VOLUNTEER PLATFORM</span>
        </a>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button onClick={handleAdminLoginClick} className="bg-white border border-black text-zinc-900 px-3 md:px-8 py-2 md:py-3.5 min-h-[44px] rounded-full font-bold text-[9px] md:text-[11px] uppercase tracking-wide flex items-center gap-1.5 md:gap-3 transition-all hover:scale-105 active:scale-95 shadow-elevation-1">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-black" />
            Admin
          </button>
          <button onClick={handleVolunteerLoginClick} className="bg-brand border border-black text-white px-3 md:px-8 py-2 md:py-3.5 min-h-[44px] rounded-full font-bold text-[9px] md:text-[11px] uppercase tracking-wide shadow-elevation-2 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 md:gap-3">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white" />
            Login
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-start pt-8 md:justify-center md:pt-0 px-4 md:px-12 pb-12 md:pb-32 relative z-10">
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[1200px] max-h-[1200px] opacity-[0.03] pointer-events-none -z-10">
           <Activity className="w-full h-full text-zinc-900" strokeWidth={0.5} />
        </div>
        
        {showLogin ? (
          <div className="w-full max-w-[1200px] flex justify-center animate-in fade-in">
            <div className="max-w-md w-full bg-white p-4 md:p-8 rounded-2xl shadow-elevation-3 border border-zinc-100 animate-in fade-in zoom-in-95 duration-500 mx-auto">
              <div className="flex justify-between items-center mb-5 md:mb-8">
                  <h2 className="text-xl md:text-3xl font-black text-zinc-900 tracking-tighter uppercase italic">{isAdmin ? 'Admin' : 'Welcome Back'}</h2>
                  <button onClick={() => setShowLogin(false)} className="text-zinc-300 hover:text-zinc-900 text-sm font-bold bg-zinc-50 px-3 py-1 rounded-full transition-colors">Close</button>
              </div>
              <div className="space-y-4 md:space-y-6">
                
                {googleClientId && (
                  <div className="pb-6 border-b border-zinc-100 space-y-4">
                      <button
                        type="button"
                        onClick={() => triggerGoogleLogin()}
                        disabled={googleLoading || isLoading}
                        className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white border border-zinc-200 rounded-full font-bold text-sm text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                        style={{ minHeight: 48 }}
                      >
                        {googleLoading ? (
                          <Loader2 size={18} className="animate-spin text-zinc-400" />
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                          </svg>
                        )}
                        Continue with Google
                      </button>
                      <p className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Or continue with email</p>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 md:mb-2 px-2 flex items-center gap-2"><Mail size={12}/> Email Address</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        className="w-full px-4 md:px-6 py-3 md:py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-brand/30 transition-all"
                        placeholder="name@healthmatters.clinic"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 md:mb-2 px-2 flex items-center gap-2"><Shield size={12}/> Password</label>
                      <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            className="w-full px-4 md:px-6 py-3 md:py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-brand/30 transition-all pr-14"
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
                          className="text-[11px] font-bold text-zinc-400 hover:text-brand transition-colors"
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
                            <p className="text-rose-400 font-bold">Don't have an account? Click <button type="button" onClick={handleSignUpClick} className="underline font-bold text-rose-600 hover:text-rose-800">Apply to Volunteer</button> below to get started.</p>
                          )}
                        </div>
                    )}
                    <button type="submit" disabled={isLoading} className="w-full py-4 md:py-5 bg-brand border border-black text-white rounded-full font-bold text-xs uppercase tracking-wide shadow-elevation-2 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95">
                      {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><div className="w-2 h-2 rounded-full bg-white" /> Secure Login <ArrowRight size={16} /></>}
                    </button>
                </form>
                {!isAdmin && (
                    <div className="text-center pt-2">
                        <p className="text-xs font-bold text-zinc-400">Don't have an account yet?</p>
                        <button onClick={handleSignUpClick} className="mt-3 bg-white border border-black text-zinc-900 px-6 py-2.5 min-h-[44px] rounded-full font-bold text-[10px] uppercase tracking-wide flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-elevation-1 mx-auto">
                            <div className="w-1.5 h-1.5 rounded-full bg-black" />
                            Apply to Volunteer
                        </button>
                    </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-[1200px] text-center space-y-8 md:space-y-16 animate-in fade-in duration-1000">
             <div className="space-y-4 md:space-y-8">
                <div className="inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-1.5 md:py-2 bg-brand/5 text-brand border border-brand/10 rounded-full text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] mb-2 md:mb-4">
                   <Zap size={12} className="animate-pulse md:w-[14px] md:h-[14px]" /> Community Operations
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-8xl lg:text-[90px] font-black text-zinc-900 tracking-tighter leading-[0.9] md:leading-[0.85] mb-4 md:mb-8 italic uppercase">
                  Join our<br/>
                  <span className="bg-gradient-to-r from-brand to-indigo-400 bg-clip-text text-transparent">Community.</span>
                </h1>
                <p className="text-sm md:text-lg lg:text-xl text-zinc-400 font-bold max-w-4xl mx-auto leading-relaxed italic px-2">
                  A central platform for Health Matters Clinic volunteers to find missions, complete training, and track their impact.
                </p>
             </div>

             <div className="pt-4 md:pt-8 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                <button
                  onClick={onStartOnboarding}
                  className="w-full md:w-auto bg-brand border border-black text-white px-8 md:px-10 py-4 md:py-6 rounded-full font-bold text-sm md:text-base uppercase tracking-wide shadow-elevation-2 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 md:gap-4 group"
                >
                  <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-white" />
                  Get Started <ArrowRight size={20} className="md:w-6 md:h-6 group-hover:translate-x-2 transition-transform" />
                </button>
                <div className="flex items-center gap-3 md:gap-4 bg-zinc-900 border border-zinc-700 rounded-full px-2 py-2 md:px-3 md:py-2.5 shadow-elevation-2">
                   <div className="flex -space-x-2 md:-space-x-2.5">
                      {[
                        'https://cdn.prod.website-files.com/67359e6040140078962e8a54/690aa961f15351ec1bc5243e_P1100963.jpeg',
                        'https://cdn.prod.website-files.com/67359e6040140078962e8a54/690aa9a26489edb0895bc219_Website_Kerry.jpeg',
                        'https://cdn.prod.website-files.com/67359e6040140078962e8a54/690aa9607ca39931abff9f95_Profile%20Image.jpeg',
                        'https://cdn.prod.website-files.com/67359e6040140078962e8a54/69ca36bc8816b348b95101c9_IMG_7321.jpg',
                        'https://cdn.prod.website-files.com/67359e6040140078962e8a54/690aa7619fae2db0b4ec877e_headshot%20(1).jpg',
                      ].map((src, i) => (
                        <img key={i} src={src} alt="HMC volunteer" className="w-8 h-8 md:w-11 md:h-11 rounded-full border-2 border-zinc-900 object-cover" />
                      ))}
                   </div>
                   <div className="text-left pr-2 md:pr-3">
                      <p className="text-[11px] md:text-[13px] font-bold text-white leading-tight">1,000+ Volunteers</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Serving Los Angeles</p>
                   </div>
                </div>
             </div>
          </div>
        )}

      </main>

      <footer className="px-4 md:px-12 py-6 md:py-12 border-t border-zinc-50 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-8 mt-auto">
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
