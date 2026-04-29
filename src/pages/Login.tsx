import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, Lock, UserX, Info, Database, MapPin } from 'lucide-react';
import { db } from '../lib/db/schema';
import { initializeMockData } from '../lib/db/mockData';
import { useLiveQuery } from '../hooks/useLiveQuery';

const Login = () => {
  const { login } = useAuth();
  
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('');

  const shops = useLiveQuery(() => db.shops.toArray()) || [];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedShopId) {
      setError('Please select a branch to continue.');
      return;
    }

    const normalizedUser = username.toLowerCase().trim();
    try {
      const employee = await db.employees.where('username').equals(normalizedUser).first();
      
      if (employee && employee.passcode === password) {
        // Strict Shop Validation
        if (employee.shopId !== selectedShopId) {
          setError('Access Denied. You are not assigned to this branch.');
          return;
        }

        login({ 
          id: `u_${employee.id}`, 
          name: employee.name, 
          role: employee.role, 
          shopId: employee.shopId, 
          shopName: employee.shopName 
        });

        // Clear states for security
        setUsername('');
        setPassword('');
        setSelectedShopId('');
      } else {
        setError('Authentication failed. Unrecognized credentials.');
      }
    } catch {
      setError('System error. Try the DB Reset button below.');
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
    display: 'block', 
    fontSize: '0.65rem', 
    fontWeight: 700, 
    color: '#547A95',
    textTransform: 'uppercase', 
    letterSpacing: '0.1em', 
    marginBottom: '8px'
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '24px',
      background: '#F8F9FA'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '440px',
        background: '#FFFFFF',
        borderRadius: '24px',
        borderTop: '4px solid #C2A56D',
        boxShadow: '0 20px 50px -12px rgba(44,57,71,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Branding Area */}
        <div style={{ padding: '48px 40px 24px', textAlign: 'center' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '18px', 
            background: 'rgba(44,57,71,0.04)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
          }}>
            <Store size={32} style={{ color: '#2C3947' }} />
          </div>
          <h1 style={{ margin: '0 0 4px', color: '#1A2B4A', fontSize: '1.5rem', fontWeight: 800 }}>Omni-Shop v1</h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#547A95', fontWeight: 500 }}>Enterprise Resource Planning</p>
        </div>

        {/* Form Area */}
        <div style={{ padding: '0 40px 48px' }}>
          {error && (
            <div style={{ 
              background: '#FFF1F1', border: '1px solid #FCA5A5', 
              color: '#B91C1C', padding: '12px 16px', borderRadius: '12px',
              fontSize: '0.82rem', fontWeight: 600, display: 'flex', 
              alignItems: 'center', gap: '8px', marginBottom: '24px'
            }}>
              <UserX size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Select Branch / Shop</label>
              <div style={{ position: 'relative' }}>
                <select 
                  value={selectedShopId}
                  onChange={e => setSelectedShopId(e.target.value)}
                  required
                  style={{ 
                    height: '48px', width: '100%', padding: '0 40px 0 16px', 
                    borderRadius: '12px', border: '1.5px solid #E8EDF2', 
                    outline: 'none', background: '#fff', appearance: 'none',
                    fontSize: '0.875rem', color: '#2C3947'
                  }}
                >
                  <option value="" disabled>Choose a location...</option>
                  {shops.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <MapPin size={18} style={{ position: 'absolute', right: '16px', top: '15px', color: '#94A3B8', pointerEvents: 'none' }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Username</label>
              <input 
                type="text" 
                placeholder="Enter your username" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
                style={{ height: '48px', width: '100%', padding: '0 16px', borderRadius: '12px', border: '1.5px solid #E8EDF2', outline: 'none' }}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  style={{ height: '48px', width: '100%', padding: '0 48px 0 16px', borderRadius: '12px', border: '1.5px solid #E8EDF2', outline: 'none' }}
                />
                <Lock size={18} style={{ position: 'absolute', right: '16px', top: '15px', color: '#94A3B8' }} />
              </div>
            </div>

            <button 
              type="submit" 
              style={{ 
                height: '48px', background: '#2C3947', color: '#FFFFFF', 
                fontWeight: 700, borderRadius: '9999px', border: 'none',
                marginTop: '12px', cursor: 'pointer', transition: 'all 200ms ease'
              }}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>

      {/* Developer / Test Footer */}
      <div style={{ marginTop: '32px', textAlign: 'center', maxWidth: '440px' }}>
        <div style={{ 
          background: 'rgba(44,57,71,0.03)', border: '1px dashed #E2E8F0', 
          borderRadius: '12px', padding: '16px', display: 'flex', 
          flexDirection: 'column', gap: '8px' 
        }}>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#547A95', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Info size={14} /> SYSTEM PROVISIONING DATA
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#2C3947' }}>
            Test Node: <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>admin / admin123</code>
          </p>
          <button 
            onClick={handleFactoryReset} 
            style={{ 
              background: 'transparent', border: 'none', color: '#547A95', 
              fontSize: '0.68rem', fontWeight: 600, textDecoration: 'underline',
              cursor: 'pointer', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', gap: '4px', marginTop: '4px'
            }}
          >
            <Database size={12} /> Force Database Re-Seed
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
