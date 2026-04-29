/**
 * useAuth.ts
 * ----------
 * Exposes the current Supabase session, the user's role,
 * and their shop_id (read from JWT app_metadata).
 *
 * This is the single source of truth for who is logged in
 * and which shop they belong to.
 */

import { useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/db/supabaseClient';
import type { UserRole } from '../lib/db/database.types';

export interface AuthState {
  session:    Session | null;
  user:       User    | null;
  shopId:     string  | null;   // from app_metadata.shop_id
  role:       UserRole | null;  // from app_metadata.role
  isLoading:  boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [session,   setSession]   = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Read any existing session immediately (no flicker)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // 2. Subscribe to auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Parse role + shop_id out of the JWT app_metadata (set by Supabase edge functions or dashboard)
  const appMeta   = session?.user?.app_metadata ?? {};
  const shopId    = (appMeta.shop_id as string) ?? null;
  const role      = (appMeta.role   as UserRole) ?? null;

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    session,
    user:            session?.user ?? null,
    shopId,
    role,
    isLoading,
    isAuthenticated: !!session,
    signOut,
  };
}
