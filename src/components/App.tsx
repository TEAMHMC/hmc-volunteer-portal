import React, { useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';
import LandingPage from './LandingPage';
import OnboardingFlow from './OnboardingFlow';
import Dashboard from './Dashboard';
// MigrationFlow removed — all volunteers must complete the full OnboardingFlow
import ClientPortal from './ClientPortal';
import SystemTour from './SystemTour';
import Toast from './Toast';
import { Volunteer, Opportunity, Shift, SupportTicket, Announcement, Message } from '../types';
import { apiService } from '../services/apiService';
import { analyticsService } from '../services/analyticsService';
import { toastService } from '../services/toastService';

interface AppProps {
  googleClientId?: string;
  recaptchaSiteKey?: string;
}

const App: React.FC<AppProps> = ({ googleClientId, recaptchaSiteKey }) => {
  const [currentUser, setCurrentUser] = useState<Volunteer | null>(null);
  const [allVolunteers, setAllVolunteers] = useState<Volunteer[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [gamification, setGamification] = useState<any>(null);

  const [view, setView] = useState<'landing' | 'onboarding' | 'dashboard' | 'clientPortal'>('landing');
  const [loading, setLoading] = useState(true);

  // PWA Install Prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Capture ?ref= referral code from URL on mount
  const [referralCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || null;
  });

  // Deep link params from email buttons (?tab=missions&checkin=SHIFTID)
  const [deepLinkTab] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('tab');
  });
  const [deepLinkCheckin] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('checkin');
  });

  const [forceShowTour] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('tour') === 'true';
  });

  const setAppData = (data: any) => {
      setCurrentUser(data.user);
      setAllVolunteers(data.volunteers || []);
      setOpportunities(data.opportunities || []);
      setShifts(data.shifts || []);
      setSupportTickets(data.supportTickets || []);
      setAnnouncements(data.announcements || []);
      setMessages(data.messages || []);
      if (data.gamification) setGamification(data.gamification);
  }

  // Listen for session-expired events from apiService (replaces the old window.location.reload approach)
  // Don't kick users out during onboarding — they may not have a session yet
  useEffect(() => {
    const handleSessionExpired = () => {
      if (view === 'onboarding' || view === 'landing') {
        console.warn('[App] Session expired during onboarding/landing — ignoring (no session expected).');
        return;
      }
      console.warn('[App] Session expired event received — redirecting to landing.');
      apiService.stopSessionHeartbeat();
      setCurrentUser(null);
      setAllVolunteers([]);
      setView('landing');
    };
    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, [view]);

  useEffect(() => {
    const checkAuth = async () => {
      if (typeof window === 'undefined') { setLoading(false); return; }
      const token = localStorage.getItem('authToken');
      if (!token) {
        // Auto-start onboarding if referral link was used
        if (referralCode) setView('onboarding');
        setLoading(false);
        return;
      }
      try {
        const data = await apiService.get('/auth/me');
        if (data.user) {
          setAppData(data);
          apiService.startSessionHeartbeat();
          // User needs onboarding if: isNewUser flag is set, OR they have no core application data (legalFirstName)
          const needsOnboarding = data.user.isNewUser === true && (!data.user.legalFirstName || data.user.onboardingProgress !== 100);
          if (needsOnboarding) {
            setView('onboarding');
          } else {
            setView('dashboard');
          }
        }
      } catch (error) {
        // Auth check failed — clear the stale token so the user sees the landing page cleanly.
        // The apiService retry logic (tryRefreshSession) already attempted recovery before throwing.
        localStorage.removeItem('authToken');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // PWA Install Detection
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone;
    // Don't show if already installed or if user dismissed it this session
    if (isStandalone || sessionStorage.getItem('pwa-install-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // On iOS, there's no beforeinstallprompt event — show banner anyway with manual instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS && !isStandalone) {
      setShowInstallBanner(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await (installPrompt as any).userChoice;
      if (result.outcome === 'accepted') {
        setShowInstallBanner(false);
        setInstallPrompt(null);
      }
    } else {
      // iOS — show instructions
      alert('Tap the Share button (□↑) at the bottom of Safari, then tap "Add to Home Screen"');
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  // Keep heartbeat alive on ALL authenticated views (dashboard, onboarding, etc.)
  // so sessions don't silently expire while a user is actively working.
  useEffect(() => {
    if (view === 'landing' || view === 'clientPortal') return;
    const token = localStorage.getItem('authToken');
    if (!token) return;
    apiService.startSessionHeartbeat();
    return () => apiService.stopSessionHeartbeat();
  }, [view]);

  const handleLogin = async (email: string, password: string, isAdmin: boolean) => {
    const data = await apiService.post('/auth/login', { email, password, isAdmin });
    if (data?.user) {
      const fullData = await apiService.get('/auth/me'); // Fetch all data after login
      setAppData(fullData);
      apiService.startSessionHeartbeat();
      const needsOnboarding = fullData.user.isNewUser === true && (!fullData.user.legalFirstName || fullData.user.onboardingProgress !== 100);
      if (needsOnboarding) {
        setView('onboarding');
      } else {
        setView('dashboard');
      }
      analyticsService.logEvent('user_login', { userId: fullData.user.id, isAdmin });
    } else {
      throw new Error("Login failed: Invalid user data received from server.");
    }
  };
  
  const handleGoogleLogin = async (credentialResponse: any, isAdmin: boolean) => {
    const data = await apiService.post('/auth/login/google', { credential: credentialResponse.credential, isAdmin });
    if (data?.user) {
        const fullData = await apiService.get('/auth/me');
        setAppData(fullData);
        apiService.startSessionHeartbeat();
        const needsOnboarding = fullData.user.isNewUser === true && (!fullData.user.legalFirstName || fullData.user.onboardingProgress !== 100);
        if (needsOnboarding) {
            setView('onboarding');
        } else {
            setView('dashboard');
        }
        analyticsService.logEvent('user_login_google', { userId: fullData.user.id, isAdmin });
    } else {
        throw new Error("Google login failed: Invalid user data received from server.");
    }
  };

  const handleOnboardingSuccess = async () => {
    setLoading(true);
    try {
        const fullData = await apiService.get('/auth/me');
        setAppData(fullData);
        setView('dashboard');
        analyticsService.logEvent('user_signup_complete', { userId: fullData.user.id });
    } catch(e) {
        console.error("Auto-login after onboarding failed", e);
        setView('landing');
    } finally {
        setLoading(false);
    }
  };

  const handleStartOnboarding = () => { setView('onboarding'); };

  const handleLogout = async () => {
    try {
      await apiService.post('/auth/logout', {});
    } catch(e) {
      console.error("Logout failed, clearing client-side session.", e)
    } finally {
      apiService.stopSessionHeartbeat();
      localStorage.removeItem('authToken');
      setCurrentUser(null);
      setAllVolunteers([]);
      setView('landing');
    }
  };
  
  const handleReturnToLanding = () => { setView('landing'); }

  const handleUpdateUser = async (updatedUser: Volunteer) => {
      const user = await apiService.put('/api/volunteer', updatedUser);
      setCurrentUser(user);
      // Also update this volunteer in allVolunteers so admin directory reflects changes
      setAllVolunteers(prev => prev.map(v => v.id === user.id ? { ...v, ...user } : v));
  }
  
  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
       <div className="w-20 h-20 border-t-4 border-b-4 border-brand rounded-full animate-spin" />
    </div>
  );

  if (view === 'onboarding') return <OnboardingFlow onSuccess={handleOnboardingSuccess} onBackToLanding={handleReturnToLanding} googleClientId={googleClientId} recaptchaSiteKey={recaptchaSiteKey} preAuthUser={currentUser?.isNewUser ? { id: currentUser.id, email: currentUser.email, name: currentUser.name } : undefined} referralCode={referralCode || undefined} />;

  if (view === 'clientPortal') return <ClientPortal onBackToLanding={handleReturnToLanding} />;

  if (view === 'dashboard' && currentUser) {
    const dashboardProps = {
        user: currentUser, allVolunteers, setAllVolunteers, onLogout: handleLogout, onUpdateUser: handleUpdateUser,
        opportunities, setOpportunities, shifts, setShifts, supportTickets, setSupportTickets,
        announcements, setAnnouncements, messages, setMessages, gamification,
        initialTab: deepLinkTab || undefined,
        initialCheckinShiftId: deepLinkCheckin || undefined,
    };
    return (
      <>
        {forceShowTour && (
          <SystemTour
            onComplete={() => { /* no-op — user came via URL, don't mark completed */ }}
            onClose={() => { window.history.replaceState(null, '', window.location.pathname); }}
            onNavigateToTraining={() => { window.history.replaceState(null, '', window.location.pathname); }}
          />
        )}
        <Dashboard {...dashboardProps} />
        {showInstallBanner && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
            background: '#233dff', color: '#fff', padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '14px', fontWeight: 600,
            boxShadow: '0 -4px 20px rgba(0,0,0,.15)', flexWrap: 'wrap' as const
          }}>
            <span style={{ textAlign: 'center' }}>
              Install the HMC Portal as an app for quick access
            </span>
            {/* Primary CTA — white bg, 1px black outline, black dot, blue text on brand bg */}
            <button
              onClick={handleInstallApp}
              style={{
                background: '#fff', color: '#0f0f0f', border: '1px solid #0f0f0f',
                borderRadius: '100px', padding: '8px 20px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap' as const,
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0f0f0f', display: 'inline-block', flexShrink: 0 }} />
              Install
            </button>
            <button
              onClick={dismissInstallBanner}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,.6)',
                fontSize: '20px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <LandingPage
      onStartOnboarding={handleStartOnboarding}
      onLogin={handleLogin}
      onGoogleLogin={handleGoogleLogin}
      googleClientId={googleClientId}
    />
  );
};

const AppWithErrorBoundary: React.FC<AppProps> = (props) => (
  <ErrorBoundary>
    <App {...props} />
    <Toast />
  </ErrorBoundary>
);

export default AppWithErrorBoundary;