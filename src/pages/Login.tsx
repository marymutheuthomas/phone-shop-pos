import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, Lock, UserX, Info, UserPlus, Database } from 'lucide-react';
import { db } from '../lib/db/schema';
import { initializeMockData } from '../lib/db/mockData';

const Login = () => {
  const { login } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('MANAGER');
  const [newShop, setNewShop] = useState('shop_1');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedUser = username.toLowerCase().trim();
    try {
      const employee = await db.employees.where('username').equals(normalizedUser).first();
      if (employee && employee.passcode === password) {
        login({ id: `u_${employee.id}`, name: employee.name, role: employee.role, shopId: employee.shopId, shopName: employee.shopName });
      } else {
        setError('Authentication failed. Unrecognized credentials.');
      }
    } catch {
      setError('System error. Try the DB Reset button below.');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const normalizedUser = username.toLowerCase().trim();
    try {
      const existing = await db.employees.where('username').equals(normalizedUser).first();
      if (existing) { setError('Username already exists.'); return; }
      const nameMap: Record<string, string> = { shop_1: 'Nairobi Central', shop_2: 'Mombasa Road', shop_3: 'Kisumu West', warehouse: 'Global Warehouse' };
      await db.employees.add({ username: normalizedUser, name: newName, passcode: password, role: newRole as any, shopId: newShop, shopName: nameMap[newShop] } as any);
      setSuccess('Account created! Logging you in...');
      setTimeout(() => login({ id: `u_${Math.random()}`, name: newName, role: newRole as any, shopId: newShop, shopName: nameMap[newShop] }), 700);
    } catch {
      setError('Database write failed. Try the DB Reset button below.');
    }
  };

  const handleFactoryReset = async () => {
    if (confirm('WARNING: Wipe IndexedDB and rebuild fresh seed data?')) {
      try {
        await db.delete(); await db.open(); await initializeMockData();
        alert('Database reset successfully!');
        window.location.reload();
      } catch (err) { console.error(err); alert('Fatal DB error. Check console.'); }
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)'
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-color)', padding: 'var(--space-lg)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, background: 'var(--primary-light)', borderRadius: '16px', marginBottom: 'var(--space-md)' }}>
            <Store size={32} style={{ color: 'var(--primary-color)' }} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Omni-Shop v1</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Enterprise Resource Planning & POS</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 'var(--space-xl)', boxShadow: 'var(--shadow-lg)' }}>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 'var(--space-md)' }}>
              <UserX size={16} /> {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success" style={{ marginBottom: 'var(--space-md)' }}>
              <Database size={16} /> {success}
            </div>
          )}

          {isSignUp ? (
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <label style={labelStyle}>Login ID (Username)</label>
                <input type="text" placeholder="e.g. john.doe" value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input type="text" placeholder="e.g. John Doe" value={newName} onChange={e => setNewName(e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div>
                  <label style={labelStyle}>Role</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="STAFF">Staff</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Assigned Branch</label>
                <select value={newShop} onChange={e => setNewShop(e.target.value)}>
                  <option value="shop_1">Nairobi Central</option>
                  <option value="shop_2">Mombasa Road</option>
                  <option value="shop_3">Kisumu West</option>
                  <option value="warehouse">Main Warehouse</option>
                </select>
              </div>
              <button type="submit" className="btn-primary btn-full btn-lg" style={{ marginTop: 'var(--space-sm)' }}>
                <UserPlus size={18} /> Create Account
              </button>
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
                Already have an account?{' '}
                <button type="button" onClick={() => { setIsSignUp(false); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  Sign In
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <label style={labelStyle}>Username</label>
                <input type="text" placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingLeft: '42px' }} required />
                  <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>
              <button type="submit" className="btn-primary btn-full btn-lg" style={{ marginTop: 'var(--space-sm)' }}>
                Sign In
              </button>
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
                No account yet?{' '}
                <button type="button" onClick={() => { setIsSignUp(true); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  Create one
                </button>
              </p>

              {/* Hint box */}
              <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-md)', background: 'var(--surface-color-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={12} /> Test Credentials
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <code style={{ fontWeight: 700, color: 'var(--primary-color)' }}>admin / admin123</code> — run DB Reset first if no account exists.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* DB Reset */}
        <p style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
          <button onClick={handleFactoryReset} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}>
            Developer: Force DB Wipe & Reset
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
