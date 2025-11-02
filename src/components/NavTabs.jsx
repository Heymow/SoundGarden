import React from "react";
import { NavLink } from "react-router-dom";

export default function NavTabs() {
  return (
    <nav className="nav-tabs">
      <NavLink
        to="/current"
        className={({ isActive }) => (isActive ? "tab active" : "tab")}
      >
        Current
      </NavLink>
      <NavLink
        to="/history"
        className={({ isActive }) => (isActive ? "tab active" : "tab")}
      >
        History
      </NavLink>
      <NavLink
        to="/artists"
        className={({ isActive }) => (isActive ? "tab active" : "tab")}
      >
        Artists
      </NavLink>
      <NavLink
        to="/teams"
        className={({ isActive }) => (isActive ? "tab active" : "tab")}
      >
        Teams
      </NavLink>
    </nav>
  );
}