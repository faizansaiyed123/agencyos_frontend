import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ErrorNote, Field } from "../components/ui";

function Shell({ title, sub, children, footer }: { title: string; sub: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="authwrap">
      <aside className="authside">
        <div className="brand">Agency<b>OS</b></div>
        <div>
          <h1>From first call to signed proposal.</h1>
          <p>Clients, deals and proposals for your agency in one place, with each organisation's data kept separate.</p>
        </div>
        <p style={{ fontSize: 13 }}>Two-factor sign-in supported.</p>
      </aside>
      <section className="authform">
        <div style={{ width: "min(380px,100%)" }}>
          <h2>{title}</h2><p className="sub">{sub}</p>
          {children}
          {footer && <p className="muted" style={{ marginTop: 18 }}>{footer}</p>}
        </div>
      </section>
    </div>
  );
}

function useSubmit(fn: () => Promise<void>) {
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await fn(); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return { err, busy, submit };
}

export function Login() {
  const { user, login, verifyMfa } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null); const [code, setCode] = useState("");
  const { err, busy, submit } = useSubmit(async () => {
    if (mfaToken) { await verifyMfa(mfaToken, code.trim()); nav("/"); return; }
    const r = await login(email, password);
    if (r.mfaToken) setMfaToken(r.mfaToken); else nav("/");
  });
  if (user) return <Navigate to="/" replace />;

  if (mfaToken) {
    return (
      <Shell title="Two-factor code" sub="Enter the 6-digit code from your authenticator app, or a recovery code (XXXX-XXXX).">
        <form onSubmit={submit}>
          <ErrorNote error={err} />
          <Field label="Code"><input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" autoFocus required minLength={6} maxLength={9} /></Field>
          <button className="btn primary" disabled={busy}>{busy ? "Verifying…" : "Verify and sign in"}</button>
          <button type="button" className="btn ghost" style={{ marginLeft: 8 }} onClick={() => { setMfaToken(null); setCode(""); }}>Back</button>
        </form>
      </Shell>
    );
  }
  return (
    <Shell title="Sign in" sub="Welcome back." footer={<>New agency? <Link to="/signup">Create an organisation</Link></>}>
      <form onSubmit={submit}>
        <ErrorNote error={err} />
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus /></Field>
        <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Field>
        <div style={{ marginBottom: 14 }}><Link to="/forgot-password">Forgot password?</Link></div>
        <button className="btn primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </Shell>
  );
}

export function Signup() {
  const { user, signup } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ organization_name: "", full_name: "", email: "", password: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const { err, busy, submit } = useSubmit(async () => { await signup(f); nav("/"); });
  if (user) return <Navigate to="/" replace />;
  return (
    <Shell title="Create your organisation" sub="You'll be its owner." footer={<>Already have an account? <Link to="/login">Sign in</Link></>}>
      <form onSubmit={submit}>
        <ErrorNote error={err} />
        <Field label="Agency name"><input value={f.organization_name} onChange={set("organization_name")} required minLength={2} autoFocus /></Field>
        <Field label="Your name"><input value={f.full_name} onChange={set("full_name")} required autoComplete="name" /></Field>
        <Field label="Work email"><input type="email" value={f.email} onChange={set("email")} required autoComplete="username" /></Field>
        <Field label="Password" hint="At least 10 characters, with upper and lower case letters and a digit."><input type="password" value={f.password} onChange={set("password")} required minLength={10} autoComplete="new-password" /></Field>
        <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create organisation"}</button>
      </form>
    </Shell>
  );
}

export function AcceptInvite() {
  const { user, acceptInvite } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState({ token: params.get("token") ?? "", full_name: "", password: "" });
  const { err, busy, submit } = useSubmit(async () => { await acceptInvite(f); nav("/"); });
  if (user) return <Navigate to="/" replace />;
  return (
    <Shell title="Join your team" sub="Set your name and password to accept the invite.">
      <form onSubmit={submit}>
        <ErrorNote error={err} />
        <Field label="Invite token"><input value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} required /></Field>
        <Field label="Your name"><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
        <Field label="Password" hint="At least 10 characters, with upper and lower case letters and a digit."><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={10} autoComplete="new-password" /></Field>
        <button className="btn primary" disabled={busy}>{busy ? "Joining…" : "Accept invite"}</button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const { err, busy, submit } = useSubmit(async () => {
    await api("/auth/password/forgot", {
      body: { email },
      auth: false,
    });
    setDone(true);
  });
  return (
    <Shell
      title="Forgot your password?"
      sub="Enter your work email and we’ll send a reset link if an account exists."
      footer={<>Remember it? <Link to="/login">Back to sign in</Link></>}
    >
      {done ? (
        <div className="notice">
          Check your email for a reset link. For security, the same message is shown whether or not an account exists.
          <div style={{ marginTop: 12 }}><button className="btn primary" onClick={() => nav("/login")}>Back to sign in</button></div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <ErrorNote error={err} />
          <Field label="Work email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus /></Field>
          <button className="btn primary" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [token] = useState(params.get("token") ?? "");
  const { err, busy, submit } = useSubmit(async () => {
    await api("/auth/password/reset", { body: { token, password }, auth: false });
    setDone(true);
  });
  return (
    <Shell title="Set a new password" sub="Choose a new password for your AgencyOS account.">
      {done ? (
        <div className="notice">
          Your password has been changed. Old refresh sessions have been revoked.
          <div style={{ marginTop: 12 }}><button className="btn primary" onClick={() => nav("/login")}>Sign in</button></div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <ErrorNote error={err} />
          <Field label="New password" hint="At least 10 characters, with upper and lower case letters and a digit.">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} autoComplete="new-password" autoFocus />
          </Field>
          <button className="btn primary" disabled={busy || token.length < 20}>{busy ? "Saving…" : "Change password"}</button>
        </form>
      )}
    </Shell>
  );
}
