import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
import { can, type Perm } from "./api/permissions";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import { AcceptInvite, ForgotPassword, Login, ResetPassword, Signup } from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Homepage from "./pages/Homepage";
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
import Portal from "./pages/Portal";

function Guard({
  perm,
  clientOnly,
  children,
}: {
  perm?: Perm;
  clientOnly?: boolean;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (clientOnly && user?.role !== "client") {
    return <Navigate to="/" replace />;
  }
  if (perm && !can(user?.role, perm)) {
    return (
      <div className="empty">
        <strong>You don't have access to this page</strong>Ask an admin if you need it.
      </div>
    );
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { user } = useAuth();
  return user?.role === "client" ? <Navigate to="/portal" replace /> : <Dashboard />;
}

function Private() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <Spinner />;
  if (!user) {
    return pathname === "/" ? <Homepage /> : <Navigate to="/login" replace />;
  }
  return <Layout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Private />}>
        <Route index element={<HomeRedirect />} />
        <Route
          path="portal"
          element={
            <Guard clientOnly>
              <Portal />
            </Guard>
          }
        />
        <Route
          path="clients"
          element={
            <Guard perm="client:read">
              <Clients />
            </Guard>
          }
        />
        <Route
          path="clients/:id"
          element={
            <Guard perm="client:read">
              <ClientDetail />
            </Guard>
          }
        />
        <Route
          path="deals"
          element={
            <Guard perm="deal:read">
              <Pipeline />
            </Guard>
          }
        />
        <Route
          path="deals/:id"
          element={
            <Guard perm="deal:read">
              <DealDetail />
            </Guard>
          }
        />
        <Route
          path="proposals"
          element={
            <Guard perm="proposal:read">
              <Proposals />
            </Guard>
          }
        />
        <Route
          path="proposals/:id"
          element={
            <Guard perm="proposal:read">
              <ProposalDetail />
            </Guard>
          }
        />
        <Route
          path="projects"
          element={
            <Guard perm="project:read">
              <Projects />
            </Guard>
          }
        />
        <Route
          path="projects/:id"
          element={
            <Guard perm="project:read">
              <ProjectDetail />
            </Guard>
          }
        />
        <Route
          path="work"
          element={
            <Guard perm="time:log">
              <Work />
            </Guard>
          }
        />
        <Route
          path="invoices"
          element={
            <Guard perm="invoice:read">
              <Invoices />
            </Guard>
          }
        />
        <Route
          path="invoices/:id"
          element={
            <Guard perm="invoice:read">
              <InvoiceDetail />
            </Guard>
          }
        />
        <Route
          path="reports"
          element={
            <Guard perm="report:read">
              <Reports />
            </Guard>
          }
        />
        <Route path="settings" element={<Settings />} />
        <Route
          path="team"
          element={
            <Guard perm="user:read">
              <Team />
            </Guard>
          }
        />
        <Route path="security" element={<Security />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
