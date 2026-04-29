import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import './App.css';
import { useState, useEffect } from 'react';
import { initializeMockData } from './lib/db/mockData';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { DashboardLayout } from './components/Layout/DashboardLayout';

// Pages
import POSDash from './pages/POS/POSDash';
import InventoryList from './pages/Inventory/InventoryList';
import TransferPortal from './pages/Inventory/TransferPortal';
import Audits from './pages/Inventory/Audits';
import PurchasesLedger from './pages/Inventory/PurchasesLedger';
import GlobalAnalytics from './pages/Dashboard/GlobalAnalytics';
import FinancialReportCenter from './pages/Reports/FinancialReportCenter';
import DebtCommandCenter from './pages/Admin/DebtCommandCenter';
import BusinessGuide from './pages/Education/BusinessGuide';
import TrendPulse from './components/Dashboard/TrendPulse';

const Dashboard = () => (
  <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '48px' }}>
    {/* Page header */}
    <div style={{ marginBottom: '8px' }}>
      <h1 style={{ color: 'var(--navy)', fontWeight: 700, marginBottom: '4px' }}>Global Dashboard</h1>
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#547A95' }}>
        Global operations overview and trends.
      </p>
    </div>

    {/* Bento widgets */}
    <TrendPulse />
  </div>
);

const AppContent = () => {
  const { user } = useAuth();
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    initializeMockData().then(() => setDataLoaded(true));
  }, []);

  if (!dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12"></div>
          <p >Waking up local database...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Protected Dashboard Shell */}
        <Route element={<DashboardLayout children={<Outlet />} />}>
           <Route path="/" element={<Navigate to="/pos" replace />} />
           
           <Route path="/dashboard" element={
             <ProtectedRoute allowedRoles={['ADMIN']}>
               <Dashboard />
             </ProtectedRoute>
           } />

           <Route path="/inventory" element={
             <ProtectedRoute allowedRoles={['ADMIN']}>
               <InventoryList />
             </ProtectedRoute>
           } />

           <Route path="/purchases" element={
             <ProtectedRoute allowedRoles={['EMPLOYEE', 'ADMIN', 'MANAGER']}>
               <PurchasesLedger />
             </ProtectedRoute>
           } />

           <Route path="/pos" element={
             <ProtectedRoute allowedRoles={['EMPLOYEE', 'ADMIN', 'MANAGER']}>
               <POSDash />
             </ProtectedRoute>
           } />

           <Route path="/transfers" element={
             <ProtectedRoute allowedRoles={['EMPLOYEE', 'ADMIN', 'MANAGER']}>
               <TransferPortal />
             </ProtectedRoute>
           } />

           <Route path="/audits" element={
             <ProtectedRoute allowedRoles={['EMPLOYEE', 'ADMIN', 'MANAGER']}>
               <Audits />
             </ProtectedRoute>
           } />

           <Route path="/admin" element={
             <ProtectedRoute allowedRoles={['ADMIN']}>
               <GlobalAnalytics />
             </ProtectedRoute>
           } />

           <Route path="/admin/debt" element={
             <ProtectedRoute allowedRoles={['ADMIN']}>
               <DebtCommandCenter />
             </ProtectedRoute>
           } />

           <Route path="/guide" element={<BusinessGuide />} />

           <Route path="/finance" element={
             <ProtectedRoute allowedRoles={['ADMIN']}>
               <FinancialReportCenter />
             </ProtectedRoute>
           } />
        </Route>

        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
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
