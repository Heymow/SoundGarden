import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import NavTabs from "./components/NavTabs";
import Current from "./pages/Current";
import History from "./pages/History";

export default function App() {
  return (
    <div className="app-root">
      <header className="app-header">
        <h1 className="site-title">SoundGarden's Collab Warz</h1>
      </header>

      <NavTabs />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/current" replace />} />
          <Route path="/current" element={<Current />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <small>© SoundGarden</small>
      </footer>
    </div>
  );
}