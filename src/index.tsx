
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './components/App';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Extend Window interface for TypeScript
declare global {
  interface Window {
    env?: {
      GOOGLE_CLIENT_ID?: string;
      RECAPTCHA_SITE_KEY?: string;
    };
  }
}

/**
 * Resolves the Google Client ID for production and development.
 * - In Production (Cloud Run), it exclusively uses the server-injected `window.env.GOOGLE_CLIENT_ID`.
 * - In Development, it falls back to Vite's `import.meta.env.VITE_GOOGLE_CLIENT_ID`.
 */
export const getGoogleClientId = (): string => {
  // Production: Use runtime variable injected by the server.
  if (window.env?.GOOGLE_CLIENT_ID) {
    return window.env.GOOGLE_CLIENT_ID;
  }
  // Development: Use Vite's build-time variable.
  const viteClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (viteClientId) {
    return viteClientId;
  }
  console.warn("Google Client ID not found. Google login may be disabled.");
  return '';
};

/**
 * Resolves the reCAPTCHA Site Key for production and development.
 * - In Production (Cloud Run), it exclusively uses the server-injected `window.env.RECAPTCHA_SITE_KEY`.
 * - In Development, it falls back to Vite's `import.meta.env.VITE_RECAPTCHA_SITE_KEY`.
 */
export const getRecaptchaSiteKey = (): string => {
  // Production: Use runtime variable injected by the server.
  if (window.env?.RECAPTCHA_SITE_KEY) {
    return window.env.RECAPTCHA_SITE_KEY;
  }
  // Development: Use Vite's build-time variable.
  const viteSiteKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY;
  if (viteSiteKey) {
    return viteSiteKey;
  }
  console.warn("reCAPTCHA Site Key not found. reCAPTCHA may be disabled.");
  return '';
};


const GOOGLE_CLIENT_ID = getGoogleClientId();
const RECAPTCHA_SITE_KEY = getRecaptchaSiteKey();

console.log("App Config:", { 
  googleAuth: !!GOOGLE_CLIENT_ID, 
  recaptcha: !!RECAPTCHA_SITE_KEY,
  source: window.env ? 'runtime (production)' : 'build-time (development)'
});

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("PLATFORM_CRASH:", error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('authToken');
      sessionStorage.clear();
    } catch (e) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FDFEFE] flex items-center justify-center p-8 font-['Inter']">
          <div className="text-center bg-white p-16 rounded-[64px] shadow-2xl border border-zinc-100 max-w-xl animate-in fade-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-rose-50 rounded-[32px] flex items-center justify-center mx-auto mb-10 border border-rose-100">
              <AlertTriangle className="text-rose-500" size={48} />
            </div>
            <h1 className="text-5xl font-medium text-zinc-900 tracking-normal leading-none mb-6">System<br/>Interruption</h1>
            <p className="text-zinc-500 text-lg font-medium leading-relaxed mb-12">
              The platform encountered a critical initialization error. 
              <span className="block mt-4 text-xs font-mono text-zinc-400 bg-zinc-50 p-4 rounded-2xl border border-zinc-100 overflow-hidden text-ellipsis">
                {this.state.error?.message || 'Check Browser Console for Details'}
              </span>
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button 
                onClick={() => window.location.reload()} 
                className="w-full sm:flex-1 px-10 py-6 bg-zinc-900 text-white font-medium rounded-full text-[11px] uppercase tracking-wide hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3"
              >
                <RotateCcw size={16} /> Reload Platform
              </button>
              <button 
                onClick={this.handleReset} 
                className="w-full sm:flex-1 px-10 py-6 bg-zinc-50 text-zinc-400 font-medium rounded-full text-[11px] uppercase tracking-wide hover:text-zinc-900 transition-all border border-zinc-100"
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        {GOOGLE_CLIENT_ID ? (
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <App googleClientId={GOOGLE_CLIENT_ID} recaptchaSiteKey={RECAPTCHA_SITE_KEY} />
          </GoogleOAuthProvider>
        ) : (
          <App recaptchaSiteKey={RECAPTCHA_SITE_KEY} />
        )}
      </ErrorBoundary>
    </React.StrictMode>
  );
}
