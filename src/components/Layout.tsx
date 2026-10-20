import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { can, ROLE_LABEL } from "../api/permissions";
import TopBar from "./TopBar";

function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online ? null : <div className="notice" role="status">You're offline. Changes cannot be saved until the connection returns.</div>;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const role = user?.role;
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">Agency<b>OS</b></div>
        {role === "client" ? <NavLink className="nav" to="/portal">Client portal</NavLink> : <NavLink className="nav" to="/" end>Overview</NavLink>}
        {can(role, "client:read") && <NavLink className="nav" to="/clients">Clients</NavLink>}
        {can(role, "deal:read") && <NavLink className="nav" to="/deals">Pipeline</NavLink>}
        {can(role, "proposal:read") && <NavLink className="nav" to="/proposals">Proposals</NavLink>}
        {can(role, "project:read") && <NavLink className="nav" to="/projects">Projects</NavLink>}
        {can(role, "time:log") && <NavLink className="nav" to="/work">My work</NavLink>}
        {can(role, "invoice:read") && <NavLink className="nav" to="/invoices">Invoices</NavLink>}
        {can(role, "report:read") && <NavLink className="nav" to="/reports">Reports</NavLink>}
        {can(role, "user:read") && <NavLink className="nav" to="/team">Team</NavLink>}
        <NavLink className="nav" to="/security">Security</NavLink>
        <NavLink className="nav" to="/settings">Settings</NavLink>
        <div className="spacer" />
        <div className="me">
          <strong>{user?.full_name}</strong>
          {role && ROLE_LABEL[role]}
          <br /><button onClick={logout}>Sign out</button>
        </div>
      </nav>
      <main className="main"><TopBar /><OfflineBanner /><Outlet /></main>
    </div>
  );
}
