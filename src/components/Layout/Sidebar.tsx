import { NavLink } from 'react-router-dom';
import {
  Store,
  ShoppingCart,
  ArrowLeftRight,
  ShieldAlert,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Package,
  TrendingUp,
  Users,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const Sidebar = ({ isOpen, setOpen }: SidebarProps) => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>

        {/* Logo / Brand */}
        <div className="sidebar-logo">
          <Store size={22} />
          <span>Omni-Shop v1</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">

          {/* ADMIN-only */}
          {isAdmin && (
            <NavLink
              to="/dashboard"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard />
              <span>Dashboard</span>
            </NavLink>
          )}

          {isAdmin && (
            <NavLink
              to="/inventory"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Package />
              <span>Local Inventory</span>
            </NavLink>
          )}

          {/* All roles */}
          <NavLink
            to="/purchases"
            onClick={() => setOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <ShoppingCart />
            <span>Stock In</span>
          </NavLink>

          <NavLink
            to="/pos"
            onClick={() => setOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Store />
            <span>POS System</span>
          </NavLink>

          <NavLink
            to="/transfers"
            onClick={() => setOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <ArrowLeftRight />
            <span>Transfers</span>
          </NavLink>

          <NavLink
            to="/audits"
            onClick={() => setOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <ShieldAlert />
            <span>Security Audits</span>
          </NavLink>

          {/* ADMIN-only */}
          {isAdmin && (
            <NavLink
              to="/finance"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <BarChart3 />
              <span>Financial Reports</span>
            </NavLink>
          )}



          {isAdmin && (
            <NavLink
              to="/admin/debt"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Users />
              <span>Debt Command Center</span>
            </NavLink>
          )}

          {isAdmin && (
            <NavLink
              to="/admin"
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <TrendingUp />
              <span>Global Analytics</span>
            </NavLink>
          )}

          <NavLink
            to="/guide"
            onClick={() => setOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <BookOpen />
            <span>Business Guide</span>
          </NavLink>
        </nav>

        {/* Footer: User + Logout */}
        <div className="sidebar-footer">
          <button onClick={logout}>
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(26,43,74,0.35)',
            zIndex: 39, backdropFilter: 'blur(2px)'
          }}
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
