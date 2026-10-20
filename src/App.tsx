import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
import { can, type Perm } from "./api/permissions";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import { AcceptInvite, Login, Signup } from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { ClientDetail, Clients } from "./pages/Clients";
import { DealDetail, Pipeline } from "./pages/Deals";
import { ProposalDetail, Proposals } from "./pages/Proposals";
import Team from "./pages/Team";
import Security from "./pages/Security";
import { InvoiceDetail, Invoices } from "./pages/Invoices";
import { ProjectDetail, Projects } from "./pages/Projects";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Work from "./pages/Work";

function Guard({ perm, children }: { perm?: Perm; children: ReactNode }) {
  const { user } = useAuth();
  if (perm && !can(user?.role, perm)) {
    return <div className="empty"><strong>You don't have access to this page</strong>Ask an admin if you need it.</div>;
  }
  return <>{children}</>;
}

function Private() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route element={<Private />}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Guard perm="client:read"><Clients /></Guard>} />
        <Route path="clients/:id" element={<Guard perm="client:read"><ClientDetail /></Guard>} />
        <Route path="deals" element={<Guard perm="deal:read"><Pipeline /></Guard>} />
        <Route path="deals/:id" element={<Guard perm="deal:read"><DealDetail /></Guard>} />
        <Route path="proposals" element={<Guard perm="proposal:read"><Proposals /></Guard>} />
        <Route path="proposals/:id" element={<Guard perm="proposal:read"><ProposalDetail /></Guard>} />
        <Route path="projects" element={<Guard perm="project:read"><Projects /></Guard>} />
        <Route path="projects/:id" element={<Guard perm="project:read"><ProjectDetail /></Guard>} />
        <Route path="work" element={<Guard perm="time:log"><Work /></Guard>} />
        <Route path="invoices" element={<Guard perm="invoice:read"><Invoices /></Guard>} />
        <Route path="invoices/:id" element={<Guard perm="invoice:read"><InvoiceDetail /></Guard>} />
        <Route path="reports" element={<Guard perm="report:read"><Reports /></Guard>} />
        <Route path="settings" element={<Settings />} />
        <Route path="team" element={<Guard perm="user:read"><Team /></Guard>} />
        <Route path="security" element={<Security />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
