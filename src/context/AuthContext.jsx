// Discord OAuth authentication context
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (check localStorage)
    const storedUser = localStorage.getItem('soundgarden_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    
    // Check if returning from Discord OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const userData = urlParams.get('user');
    const error = urlParams.get('error');
    
    if (authStatus === 'success' && userData) {
      try {
        const user = JSON.parse(decodeURIComponent(userData));
        setUser(user);
        localStorage.setItem('soundgarden_user', JSON.stringify(user));
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    } else if (error) {
      console.error('Auth error:', error);
      alert('Failed to login with Discord. Please try again.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    setLoading(false);
  }, []);

  const loginWithDiscord = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${API_URL}/auth/discord`;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('soundgarden_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithDiscord, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
