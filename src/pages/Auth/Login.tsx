/**
 * Login.tsx
 * ---------
 * Clean enterprise light theme login form.
 * Authenticates against Supabase Auth (email + password).
 * On success, the useAuth hook automatically picks up the
 * new session and App.tsx renders the main layout.
 */

import { useState, type FormEvent } from 'react';
import { Store, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/db/supabaseClient';

const Login = () => {
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [isLoading,  setIsLoading]  = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg(error.message ?? 'Login failed. Please try again.');
      setIsLoading(false);
    }
    // On success: onAuthStateChange fires in useAuth → App re-renders automatically.
    // No need to navigate manually.
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-color)',
      padding: 'var(--space-md)',
    }}>
      {/* Narrow form container — max 480px, centered */}
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'var(--primary-color)',
            marginBottom: 'var(--space-md)',
            boxShadow: '0 8px 24px rgba(79,70,229,0.3)',
          }}>
            <Store size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 4 }}>
            Omni-Shop
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Sign in to your store account
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 'var(--space-xl)' }}>
          <form onSubmit={handleSubmit} noValidate>

            {/* Error banner */}
            {errorMsg && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-sm)',
                background: 'var(--danger-alpha)',
                border: '1px solid rgba(220,38,38,0.25)',
                borderRadius: 'var(--input-radius)',
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-lg)',
                color: 'var(--danger-color)',
                fontSize: 'var(--text-sm)',
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Email */}
            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label htmlFor="login-email" className="form-label">Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  style={{
                    position: 'absolute', left: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none',
                  }}
                />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ paddingLeft: 40 }}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group" style={{ marginBottom: 'var(--space-xl)' }}>
              <label htmlFor="login-password" className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{
                    position: 'absolute', left: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none',
                  }}
                />
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: 40, paddingRight: 44 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 4,
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="btn-login"
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isLoading}
              style={{ fontSize: 'var(--text-base)', position: 'relative' }}
            >
              {isLoading ? (
                <>
                  <span className="spin" style={{ display: 'block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>

          </form>
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center',
          marginTop: 'var(--space-lg)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}>
          Forgot your password? Contact your system administrator.
        </p>
      </div>
    </div>
  );
};

export default Login;
