// Mock authentication context
import React, { createContext, useContext, useState, useEffect } from 'react';

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
    setLoading(false);
  }, []);

  const loginWithDiscord = () => {
    // Mock Discord login - in production, this would redirect to Discord OAuth
    const mockUser = {
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      username: 'TestUser#1234',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
    setUser(mockUser);
    localStorage.setItem('soundgarden_user', JSON.stringify(mockUser));
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
