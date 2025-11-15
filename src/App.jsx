import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AudioPlayerProvider, useAudioPlayer } from "./context/AudioPlayerContext";
import NavTabs from "./components/NavTabs";
import AudioPlayer from "./components/AudioPlayer";
import Current from "./pages/Current";
import History from "./pages/History";
import Artists from "./pages/Artists";
import Teams from "./pages/Teams";
import Admin from "./pages/Admin";
import { artistsData, teamsData } from "./data/mockData";
import LavaLamp from "./components/LavaLamp";

// Component to handle auth callback before redirecting
function AuthCallbackHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const authStatus = urlParams.get('auth');

    if (authStatus === 'success' || urlParams.get('error')) {
      // Let AuthContext handle the auth logic, then redirect
      const timer = setTimeout(() => {
        navigate('/current', { replace: true });
      }, 100); // Small delay to let AuthContext process

      return () => clearTimeout(timer);
    } else {
      // No auth params, redirect immediately
      navigate('/current', { replace: true });
    }
  }, [location, navigate]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <p>Processing authentication...</p>
    </div>
  );
}

function AppContent() {
  const { user, loginWithDiscord, logout } = useAuth();
  const { playSong } = useAudioPlayer();
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handlePlaySong = (song) => {
    playSong(song);
  };

  const handleNavigateToArtist = (artistName) => {
    const artist = artistsData.find(a => a.name === artistName);
    if (artist) {
      setSelectedArtist(artist);
      navigate('/artists');
    }
  };

  const handleNavigateToTeam = (teamName) => {
    const team = teamsData.find(t => t.name === teamName);
    if (team) {
      setSelectedTeam(team);
      navigate('/teams');
    }
  };

  const isAdminPage = location.pathname === '/admin';

  return (
    <div className="app-root">
      {!isAdminPage && (
        <>
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
        </>
      )}

      <main className={isAdminPage ? "" : "app-main"}>
        <Routes>
          <Route path="/" element={<AuthCallbackHandler />} />
          <Route path="/auth/discord/callback" element={<AuthCallbackHandler />} />
          <Route path="/current" element={<Current onPlaySong={handlePlaySong} onNavigateToTeam={handleNavigateToTeam} onNavigateToArtist={handleNavigateToArtist} />} />
          <Route path="/history" element={<History onPlaySong={handlePlaySong} onNavigateToTeam={handleNavigateToTeam} onNavigateToArtist={handleNavigateToArtist} />} />
          <Route path="/artists" element={<Artists selectedArtist={selectedArtist} setSelectedArtist={setSelectedArtist} onNavigateToTeam={handleNavigateToTeam} onPlaySong={handlePlaySong} />} />
          <Route path="/teams" element={<Teams selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} onPlaySong={handlePlaySong} onNavigateToArtist={handleNavigateToArtist} />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>

      {!isAdminPage && (
        <>
          <footer className="app-footer">
            <small>© Heymow - SoundGarden · Collab Warz</small>
          </footer>

          <AudioPlayer />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AudioPlayerProvider>
        <AppContent />

        <LavaLamp
          blobCount={8}
          colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 215, 0, 0.4)', 'rgba(255, 165, 0, 0.3)']}
          size="medium"
          opacity={0.4}
          animationDuration="25s"
        />

      </AudioPlayerProvider>
    </AuthProvider>
  );
}