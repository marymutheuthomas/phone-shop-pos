import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WifiOff, Wifi, LayoutDashboard } from 'lucide-react';
import './App.css';
import { useState, useEffect } from 'react';
import { initializeMockData } from './lib/db/mockData';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';

// Pages
import POSDash from './pages/POS/POSDash';
import InventoryList from './pages/Inventory/InventoryList';
import TransferPortal from './pages/Inventory/TransferPortal';
import BlindAudit from './pages/Inventory/BlindAudit';
import PurchasesLedger from './pages/Inventory/PurchasesLedger';
import TrendPulse from './components/Dashboard/TrendPulse';
import GlobalAnalytics from './pages/Dashboard/GlobalAnalytics';
import FinancialReportCenter from './pages/Reports/FinancialReportCenter';
import Sidebar from './components/Layout/Sidebar';

const Dashboard = () => <div className="animate-fade-in"><h1 className="text-2xl font-bold mb-4">Dashboard</h1><div className="glass-panel p-6"><p className="text-text-secondary">Global operations overview and trends.</p></div><TrendPulse /></div>;

import { useSyncEngine } from './hooks/useSyncEngine';

const Topbar = ({ toggleSidebar, syncData }: { toggleSidebar: () => void, syncData: any }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { user } = useAuth();
  const { status, pendingCount, triggerSync } = syncData;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="topbar">
      <div className="flex gap-4 items-center">
        <button className="hamburger-btn" onClick={toggleSidebar}>
          <LayoutDashboard size={24} />
        </button>
        <h2 className="topbar-location">
          Node: <span>{user?.shopName}</span>
        </h2>
      </div>
      <div className="topbar-right flex gap-3 items-center flex-wrap">
        {pendingCount > 0 && (
          <div className="badge badge-warning flex gap-1 items-center animate-pulse" onClick={triggerSync} style={{ cursor: 'pointer' }}>
            <WifiOff size={12} />
            <span>{pendingCount} Pending</span>
          </div>
        )}
        <div className={`connectivity-status ${!isOnline ? 'offline' : ''} ${status === 'syncing' ? 'syncing' : ''}`}>
          <div className="pulse"></div>
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>
            {status === 'syncing' ? 'Syncing...' : isOnline ? 'Cloud Synced' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
};

const AppContent = () => {
  const { user } = useAuth();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const syncData = useSyncEngine(user?.shopId || 'warehouse');

  useEffect(() => {
    initializeMockData().then(() => setDataLoaded(true));
  }, []);

  if (!dataLoaded) {
    return <div className="app-container flex items-center justify-center">Loading Local Storage...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <div className="app-container">
        <Sidebar isOpen={isSidebarOpen} setOpen={setIsSidebarOpen} />

        <main className="main-content">
          <Topbar
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            syncData={syncData}
          />
          <div className="page-container">
            <div className="content-center-wall">
              <Routes>
                <Route path="/" element={<Navigate to="/pos" replace />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                <Route path="/dashboard" element={
                  <ProtectedRoute allowedRoles={['STAFF', 'MANAGER', 'ADMIN']}>
                    <Dashboard />
                  </ProtectedRoute>
                } />

                <Route path="/inventory" element={
                  <ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}>
                    <InventoryList />
                  </ProtectedRoute>
                } />

                <Route path="/purchases" element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <PurchasesLedger />
                  </ProtectedRoute>
                } />

                <Route path="/pos" element={
                  <ProtectedRoute allowedRoles={['STAFF', 'MANAGER', 'ADMIN']}>
                    <POSDash />
                  </ProtectedRoute>
                } />

                <Route path="/transfers" element={
                  <ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}>
                    <TransferPortal />
                  </ProtectedRoute>
                } />

                <Route path="/audits" element={
                  <ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}>
                    <BlindAudit />
                  </ProtectedRoute>
                } />

                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <GlobalAnalytics />
                  </ProtectedRoute>
                } />

                <Route path="/finance" element={
                  <ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}>
                    <FinancialReportCenter />
                  </ProtectedRoute>
                } />

                <Route path="/login" element={<Login />} />

                <Route path="*" element={<Navigate to="/pos" replace />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
