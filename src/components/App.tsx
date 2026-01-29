import React, { useState, useEffect } from 'react';
import LandingPage from './LandingPage';
import OnboardingFlow from './OnboardingFlow';
import Dashboard from './Dashboard';
import MigrationFlow from './MigrationFlow';
import ClientPortal from './ClientPortal';
import { Volunteer, Opportunity, Shift, SupportTicket, Announcement, Message } from '../types';
import { apiService } from '../services/apiService';
import { analyticsService } from '../services/analyticsService';

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

  const [view, setView] = useState<'landing' | 'onboarding' | 'dashboard' | 'migration' | 'clientPortal'>('landing');
  const [loading, setLoading] = useState(true);
  
  const setAppData = (data: any) => {
      setCurrentUser(data.user);
      setAllVolunteers(data.volunteers || []);
      setOpportunities(data.opportunities || []);
      setShifts(data.shifts || []);
      setSupportTickets(data.supportTickets || []);
      setAnnouncements(data.announcements || []);
      setMessages(data.messages || []);
  }

  useEffect(() => {
    const checkAuth = async () => {
      if (typeof window === 'undefined') { setLoading(false); return; }
      const token = localStorage.getItem('authToken');
      if (!token) { setLoading(false); return; }
      try {
        const data = await apiService.get('/auth/me');
        if (data.user) {
          setAppData(data);
          if (data.user.isNewUser) {
            setView('migration');
          } else {
            setView('dashboard');
          }
        }
      } catch (error) {
        console.log("No active session.");
        localStorage.removeItem('authToken');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (email: string, password: string, isAdmin: boolean) => {
    const data = await apiService.post('/auth/login', { email, password, isAdmin });
    if (data?.user) {
      const fullData = await apiService.get('/auth/me'); // Fetch all data after login
      setAppData(fullData);
      if (fullData.user.isNewUser) {
        setView('migration');
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
        if (fullData.user.isNewUser) {
            setView('migration');
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
  }
  
  const handleMigrationComplete = async () => {
    if (!currentUser) return;
    try {
        const user = await apiService.put('/api/volunteer', { ...currentUser, isNewUser: false, status: 'active' });
        setCurrentUser(user);
        setView('dashboard');
    } catch(e) {
        console.error("Failed to finalize migration.", e);
        alert("There was an error completing your profile setup. Please try logging in again.");
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
       <div className="w-20 h-20 border-t-4 border-b-4 border-[#233DFF] rounded-full animate-spin" />
    </div>
  );

  if (view === 'onboarding') return <OnboardingFlow onSuccess={handleOnboardingSuccess} onBackToLanding={handleReturnToLanding} googleClientId={googleClientId} recaptchaSiteKey={recaptchaSiteKey} />;
  
  if (view === 'clientPortal') return <ClientPortal onBackToLanding={handleReturnToLanding} />;

  if (view === 'migration' && currentUser) return <MigrationFlow user={currentUser} onUpdateUser={handleUpdateUser} onComplete={handleMigrationComplete} />;

  if (view === 'dashboard' && currentUser) {
    const dashboardProps = {
        user: currentUser, allVolunteers, setAllVolunteers, onLogout: handleLogout, onUpdateUser: handleUpdateUser,
        opportunities, setOpportunities, shifts, setShifts, supportTickets, setSupportTickets,
        announcements, setAnnouncements, messages, setMessages
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

export default App;