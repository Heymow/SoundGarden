// Discord OAuth authentication context
import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api.js';

const AuthContext = createContext();

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
        console.log('Discord login successful:', user.username);
        setUser(user);
        localStorage.setItem('soundgarden_user', JSON.stringify(user));
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    } else if (error) {
      console.error('Auth error:', error);
      alert(`Failed to login with Discord: ${error}. Please ensure the backend server is running and Discord OAuth is properly configured.`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    setLoading(false);
  }, []);

  const loginWithDiscord = () => {
    // Redirect to backend OAuth endpoint
    const authUrl = API_ENDPOINTS.AUTH_DISCORD;
    console.log('Redirecting to Discord OAuth:', authUrl);
    window.location.href = authUrl;
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
