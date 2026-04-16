import { NavLink } from 'react-router-dom';
import { Store, ShoppingCart, ArrowLeftRight, ShieldAlert, BarChart3, LayoutDashboard, LogOut, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const Sidebar = ({ isOpen, setOpen }: SidebarProps) => {
  const { user, logout } = useAuth();
  
  const isManagerOrAdmin = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Store className="logo-icon w-8 h-8" />
          <span className="sidebar-title">Omni-Shop v1</span>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard className="icon" />
            <span>Dashboard</span>
          </NavLink>

          {isManagerOrAdmin && (
            <NavLink to="/inventory" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard className="icon" />
              <span>Local Inventory</span>
            </NavLink>
          )}

          {isAdmin && (
            <NavLink to="/purchases" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Package className="icon" />
              <span>Stock In</span>
            </NavLink>
          )}

          <NavLink to="/pos" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ShoppingCart className="icon" />
            <span>POS System</span>
          </NavLink>
          
          {isManagerOrAdmin && (
            <NavLink to="/transfers" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ArrowLeftRight className="icon" />
              <span>Transfers</span>
            </NavLink>
          )}
          
          {isManagerOrAdmin && (
            <NavLink to="/audits" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ShieldAlert className="icon" />
              <span>Security Audits</span>
            </NavLink>
          )}

          {isManagerOrAdmin && (
            <NavLink to="/finance" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
               <BarChart3 className="icon" />
               <span>Financial Reports</span>
            </NavLink>
          )}

          {isAdmin && (
            <NavLink to="/admin" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
               <BarChart3 className="icon" />
               <span>Global Analytics</span>
            </NavLink>
          )}
        </nav>
          
        <div className="sidebar-footer">
           <button onClick={logout} className="nav-link text-left w-full">
             <LogOut className="icon" />
             <span>Log Out</span>
           </button>
        </div>
      </aside>
      {isOpen && <div className="sidebar-overlay" onClick={() => setOpen(false)}></div>}
    </>
  );
};

export default Sidebar;
