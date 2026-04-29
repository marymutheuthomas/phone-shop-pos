import { useState, useEffect, type ReactNode } from 'react';
import { WifiOff, Menu, X, Terminal, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSyncEngine } from '../../hooks/useSyncEngine';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * DashboardLayout: The universal shell for all Omni-Shop nodes.
 * Provides responsive navigation, cloud sync status, and a clean Navy/Canvas topbar.
 */
export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const syncData = useSyncEngine(user?.shopId || 'shop_techplanet');
  const { status, pendingCount, triggerSync } = syncData;

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="app-container">
      {/* Off-canvas Responsive Sidebar */}
      <Sidebar isOpen={isSidebarOpen} setOpen={setIsSidebarOpen} />

      <main className="main-content">
        {/* Standardized Topbar */}
        <header className="topbar">
          {/* Left: hamburger + shop identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{
                background: 'transparent',
                color: 'var(--navy)',
                border: '1.5px solid var(--surface-border)',
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                <Terminal size={15} style={{ color: 'var(--gold)' }} />
                <span style={{ color: 'var(--navy)', fontWeight: 700 }}>{user?.shopName}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  Node: {user?.shopId}
                </span>
              </h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1 }}>
                {user?.role} Mode
              </p>
            </div>
          </div>

          {/* Right: sync pill + connectivity + user */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Pending sync notification */}
            {pendingCount > 0 && (
              <button
                onClick={triggerSync}
                style={{
                  background: 'rgba(245,158,11,0.10)',
                  color: 'var(--warning)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  fontSize: '0.75rem',
                  padding: '6px 12px',
                  borderRadius: '20px',
                }}
              >
                <WifiOff size={12} />
                <span>{pendingCount} Pending</span>
              </button>
            )}

            {/* Connectivity dot */}
            <div className={`connectivity-status ${!isOnline ? 'offline' : ''} ${status === 'syncing' ? 'syncing' : ''}`}>
              <div />
              <span style={{ fontSize: '0.75rem' }}>
                {status === 'syncing' ? 'Syncing…' : isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* User chip */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              paddingLeft: '16px', borderLeft: '1px solid var(--surface-border)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy)', lineHeight: 1 }}>
                  {user?.name}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1 }}>
                  {user?.role}
                </p>
              </div>
              <div style={{
                width: '34px', height: '34px',
                background: 'var(--navy)', color: 'var(--text-on-navy)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <User size={16} />
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="page-content" style={{ overflowX: 'hidden' }}>
          <div style={{ maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
