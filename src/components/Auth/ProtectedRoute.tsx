import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: Role[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Redirect to login but save the current location they were trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // If user doesn't have the required role, send to unauthorized page
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
