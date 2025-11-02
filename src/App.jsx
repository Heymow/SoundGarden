import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import NavTabs from "./components/NavTabs";
import AudioPlayer from "./components/AudioPlayer";
import Current from "./pages/Current";
import History from "./pages/History";
import Artists from "./pages/Artists";
import Teams from "./pages/Teams";

function AppContent() {
  const { user, loginWithDiscord, logout } = useAuth();
  const [currentSong, setCurrentSong] = useState(null);

  const handlePlaySong = (song) => {
    setCurrentSong(song);
  };

  const handleClosePlayer = () => {
    setCurrentSong(null);
  };

  return (
    <div className="app-root">
      <div className="main-banner">
        <h1 className="main-banner-title">🌿 SoundGarden</h1>
        <p className="main-banner-subtitle">SUNO AI MUSIC COMMUNITY</p>
      </div>

      <header className="app-header">
        <h1 className="site-title">SoundGarden's Collab Warz</h1>
        <div className="auth-actions">
          {user ? (
            <div className="user-menu">
              <span className="username">{user.username}</span>
              <button onClick={logout} className="btn-logout">
                Logout
              </button>
            </div>
          ) : (
            <button onClick={loginWithDiscord} className="btn-login">
              Login with Discord
            </button>
          )}
        </div>
      </header>

      <NavTabs />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/current" replace />} />
          <Route path="/current" element={<Current onPlaySong={handlePlaySong} />} />
          <Route path="/history" element={<History onPlaySong={handlePlaySong} />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/teams" element={<Teams />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <small>© Heymow - SoundGarden · Collab Warz</small>
      </footer>

      <AudioPlayer 
        currentSong={currentSong} 
        onClose={handleClosePlayer}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}