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
import "../styles/admin.css";

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is admin - for now, check if logged in
    // In production, this would check against a list of admin user IDs
    // TEMPORARY: Allow access without login for demonstration
    setIsAdmin(true);
    
    // Uncomment for production:
    // if (!user) {
    //   navigate("/current");
    //   return;
    // }
    // setIsAdmin(true);
  }, [user, navigate]);

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-unauthorized">
          <h2>🔒 Unauthorized Access</h2>
          <p>You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  const sections = [
    { id: "dashboard", label: "📊 Dashboard", icon: "📊" },
    { id: "competition", label: "🎵 Competition", icon: "🎵" },
    { id: "announcements", label: "📢 Announcements", icon: "📢" },
    { id: "teams", label: "👥 Teams", icon: "👥" },
    { id: "voting", label: "🗳️ Voting", icon: "🗳️" },
    { id: "ai", label: "🤖 AI Config", icon: "🤖" },
    { id: "status", label: "⚙️ System", icon: "⚙️" },
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
                className={`admin-nav-item ${
                  activeSection === section.id ? "active" : ""
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
  );
}
