import React, { useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';
import LandingPage from './LandingPage';
import OnboardingFlow from './OnboardingFlow';
import Dashboard from './Dashboard';
// MigrationFlow removed — all volunteers must complete the full OnboardingFlow
import ClientPortal from './ClientPortal';
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
  useEffect(() => {
    const handleSessionExpired = () => {
      console.warn('[App] Session expired event received — redirecting to landing.');
      apiService.stopSessionHeartbeat();
      setCurrentUser(null);
      setAllVolunteers([]);
      setView('landing');
    };
    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (typeof window === 'undefined') { setLoading(false); return; }
      const token = localStorage.getItem('authToken');
      if (!token) { setLoading(false); return; }
      try {
        const data = await apiService.get('/auth/me');
        if (data.user) {
          setAppData(data);
          apiService.startSessionHeartbeat();
          const needsOnboarding = data.user.isNewUser && !data.user.applicationStatus && data.user.onboardingProgress !== 100;
          if (needsOnboarding) {
            setView('onboarding');
          } else {
            setView('dashboard');
          }
        }
      } catch (error) {
        // No active session — clear stale token
        localStorage.removeItem('authToken');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Periodic session revalidation every 15 minutes
  useEffect(() => {
    if (view !== 'dashboard') return;
    const interval = setInterval(async () => {
      const token = localStorage.getItem('authToken');
      if (!token) { handleLogout(); return; }
      try {
        await apiService.get('/auth/me');
      } catch {
        localStorage.removeItem('authToken');
        setCurrentUser(null);
        setView('landing');
      }
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [view]);

  const handleLogin = async (email: string, password: string, isAdmin: boolean) => {
    const data = await apiService.post('/auth/login', { email, password, isAdmin });
    if (data?.user) {
      const fullData = await apiService.get('/auth/me'); // Fetch all data after login
      setAppData(fullData);
      apiService.startSessionHeartbeat();
      const needsOnboarding = fullData.user.isNewUser && !fullData.user.applicationStatus && fullData.user.onboardingProgress !== 100;
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
        const needsOnboarding = fullData.user.isNewUser && !fullData.user.applicationStatus && fullData.user.onboardingProgress !== 100;
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

  if (view === 'onboarding') return <OnboardingFlow onSuccess={handleOnboardingSuccess} onBackToLanding={handleReturnToLanding} googleClientId={googleClientId} recaptchaSiteKey={recaptchaSiteKey} preAuthUser={currentUser?.isNewUser ? { id: currentUser.id, email: currentUser.email, name: currentUser.name } : undefined} />;

  if (view === 'clientPortal') return <ClientPortal onBackToLanding={handleReturnToLanding} />;

  if (view === 'dashboard' && currentUser) {
    const dashboardProps = {
        user: currentUser, allVolunteers, setAllVolunteers, onLogout: handleLogout, onUpdateUser: handleUpdateUser,
        opportunities, setOpportunities, shifts, setShifts, supportTickets, setSupportTickets,
        announcements, setAnnouncements, messages, setMessages, gamification
    };
    return <Dashboard {...dashboardProps} />;
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