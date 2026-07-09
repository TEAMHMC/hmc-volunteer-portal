import React from 'react';
import { APP_CONFIG } from '../config';
import PartnerAdminPanel from './PartnerAdminPanel';

interface PartnerAdminPageProps {
  onLogout: () => void;
}

const PartnerAdminPage: React.FC<PartnerAdminPageProps> = ({ onLogout }) => {
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: '#f8f8f8', color: '#0a0e28', minHeight: '100vh', WebkitFontSmoothing: 'antialiased' }}>
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: '#0f0f0f', borderBottom: '1px solid rgba(255,255,255,.08)', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={APP_CONFIG.BRAND.logoUrl} alt="Health Matters Clinic" width={32} height={32} style={{ borderRadius: 7, background: '#fff', objectFit: 'contain' }} />
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#fff' }}>
              HMC <span style={{ color: 'rgba(255,255,255,.4)' }}>Partner Admin</span>
            </span>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 100, padding: '9px 20px', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </nav>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px' }}>
        <PartnerAdminPanel />
      </div>
    </div>
  );
};

export default PartnerAdminPage;
