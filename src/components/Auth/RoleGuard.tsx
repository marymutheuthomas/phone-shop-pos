import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../context/AuthContext';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: Role[];
  fallback?: ReactNode;
}

/**
 * RoleGuard: High-velocity RBAC component for granular UI hardening.
 * Prevents non-privileged users from even seeing sensitive form controls.
 */
export const RoleGuard = ({ children, allowedRoles, fallback = null }: RoleGuardProps) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
