import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import AdminDashboard from "../components/admin/AdminDashboard";
import CompetitionManagement from "../components/admin/CompetitionManagement";
import AnnouncementSystem from "../components/admin/AnnouncementSystem";
import TeamManagement from "../components/admin/TeamManagement";
import VotingManagement from "../components/admin/VotingManagement";
import AIConfiguration from "../components/admin/AIConfiguration";
import SystemStatus from "../components/admin/SystemStatus";
import AdminTokenSetup from "../components/admin/AdminTokenSetup";
import { AdminOverlayProvider } from "../context/AdminOverlay";
import AuthenticationError from "../components/AuthenticationError";
import * as botApi from "../services/botApi";
import "../styles/admin.css";

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    setIsCheckingAuth(true);
    setAuthError(null);

    try {
      // Check if token exists
      if (!botApi.hasAdminToken()) {
        setIsAdmin(false);
        setIsCheckingAuth(false);
        return;
      }

      // Validate token by making an API call
      // This will throw an error if token is invalid or user is not an admin
      await botApi.getAdminStatus();

      // If successful, user is authenticated and authorized as admin
      setIsAdmin(true);
    } catch (err) {
      console.error("Admin access check failed:", err);
      setAuthError(err.message);
      setIsAdmin(false);

      // Clear invalid token
      botApi.clearAdminToken();
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleTokenValidated = () => {
    // Token was successfully validated, refresh admin status
    checkAdminAccess();
  };

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <div className="loading-spinner"></div>
          <p>Checking admin access...</p>
        </div>
      </div>
    );
  }

  // Show token setup if not authenticated
  if (!isAdmin) {
    // If there's an authentication error, show the enhanced error page
    if (authError) {
      return <AuthenticationError error={authError} />;
    }

    // Otherwise, show the normal token setup
    return (
      <div className="admin-page">
        <div className="admin-header">
          <div className="admin-header-content">
            <h1 className="admin-title">
              <span className="admin-icon">🛡️</span>
              Admin Control Panel
            </h1>
          </div>
        </div>
        <div className="admin-layout">
          <main className="admin-content-full">
            <AdminTokenSetup onTokenValidated={handleTokenValidated} />
          </main>
        </div>
      </div>
    );
  }

  const sections = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "competition", label: "Competition", icon: "🎵" },
    { id: "announcements", label: "Announcements", icon: "📢" },
    { id: "teams", label: "Teams", icon: "👥" },
    { id: "voting", label: "Voting", icon: "🗳️" },
    { id: "ai", label: "AI Config", icon: "🤖" },
    { id: "status", label: "System", icon: "⚙️" },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <AdminDashboard />;
      case "competition":
        return <CompetitionManagement />;
      case "announcements":
        return <AnnouncementSystem />;
      case "teams":
        return <TeamManagement />;
      case "voting":
        return <VotingManagement />;
      case "ai":
        return <AIConfiguration />;
      case "status":
        return <SystemStatus />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <AdminOverlayProvider>
      <div className="admin-page">
        <div className="admin-header">
          <div className="admin-header-content">
            <h1 className="admin-title">
              <span className="admin-icon">🛡️</span>
              Admin Control Panel
            </h1>
            <div className="admin-user-info">
              <span className="admin-username">{user?.username || "Admin User"}</span>
              <span className="admin-badge">Administrator</span>
            </div>
          </div>
        </div>

        <div className="admin-layout">
          <aside className="admin-sidebar">
            <nav className="admin-nav">
              {sections.map((section) => (
                <button
                  key={section.id}
                  className={`admin-nav-item ${activeSection === section.id ? "active" : ""
                    }`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className="admin-nav-icon">{section.icon}</span>
                  <span className="admin-nav-label">{section.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="admin-content">
            {renderSection()}
          </main>
        </div>
      </div>
    </AdminOverlayProvider>
  );
}
