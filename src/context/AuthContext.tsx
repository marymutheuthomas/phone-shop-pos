import React, { createContext, useContext, useState } from 'react';

export type Role = 'EMPLOYEE' | 'ADMIN' | 'MANAGER';

interface User {
  id: string;
  name: string;
  role: Role;
  shopId: string;
  shopName: string;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Re-hydrate state on initial load
    const savedLocal = localStorage.getItem('omni_user');
    const savedSession = sessionStorage.getItem('omni_user');
    if (savedSession) return JSON.parse(savedSession);
    if (savedLocal) return JSON.parse(savedLocal);
    return null;
  });

  const login = (userData: User) => {
    setUser(userData);
    if (userData.role === 'ADMIN') {
      sessionStorage.setItem('omni_user', JSON.stringify(userData));
      localStorage.removeItem('omni_user'); // Ensure consistency
    } else {
      localStorage.setItem('omni_user', JSON.stringify(userData));
      sessionStorage.removeItem('omni_user');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('omni_user');
    sessionStorage.removeItem('omni_user');
    window.sessionStorage.clear(); // Complete wipe as requested
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
