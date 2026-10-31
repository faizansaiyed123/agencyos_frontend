import { useState } from "react";
import { api } from "../api/client";
import { useAction, useClients, useInvites, useUsers } from "../api/hooks";
import { can, INVITABLE_ROLES, ROLE_LABEL } from "../api/permissions";
import type { Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Empty, ErrorNote, Field, FormModal, PageHead, Spinner } from "../components/ui";
import { fmtDate } from "../lib";

function InviteForm({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("team_member");
  const [clientId, setClientId] = useState("");
  const clients = useClients(false, role === "client");
  // One key per opened dialog: a retry after a dropped connection can't create a second invite.
  const [key] = useState(() => crypto.randomUUID());
  const create = useAction(
    () =>
      api("/invites", {
        body: { email, role, client_id: role === "client" ? clientId : null },
        headers: { "Idempotency-Key": key },
      }),
    ["invites"],
  );
  return (
    <FormModal
      title="Invite a teammate"
      submitLabel="Send invite"
      onClose={onClose}
      onSubmit={() => create.mutateAsync(undefined)}
    >
      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </Field>
      <Field label="Role">
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {INVITABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </Field>
      {role === "client" && (
        <Field label="Client account">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Choose a client…</option>
            {(clients.data?.items ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
      )}
    </FormModal>
  );
}

export default function Team() {
  const { user } = useAuth();
  const canInvite = can(user?.role, "user:invite");
  const canManage = can(user?.role, "user:manage");
  const users = useUsers();
  const invites = useInvites(canInvite);
  const [inviting, setInviting] = useState(false);
  const setRole = useAction(
    ({ id, role }: { id: string; role: string }) =>
      api(`/users/${id}/role`, { method: "POST", query: { new_role: role } }),
    ["users"],
  );
  const revoke = useAction(
    (id: string) => api(`/invites/${id}`, { method: "DELETE" }),
    ["invites"],
  );
  const pending = (invites.data ?? []).filter((i) => !i.accepted_at);

  return (
    <>
      <PageHead
        title="Team"
        sub="People in your organisation and their roles."
        actions={
          canInvite && (
            <button className="btn primary" onClick={() => setInviting(true)}>
              Invite teammate
            </button>
          )
        }
      />
      <ErrorNote error={setRole.error ?? revoke.error} />
      <div className="panel">
        {users.isLoading ? (
          <Spinner />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Two-factor</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.full_name}</strong>
                    {!u.is_active && (
                      <>
                        {" "}
                        <span className="badge">Inactive</span>
                      </>
                    )}
                    <div className="muted">{u.email}</div>
                  </td>
                  <td>
                    {canManage && u.id !== user?.id ? (
                      <select
                        aria-label={`Role for ${u.full_name}`}
                        style={{ width: "auto" }}
                        value={u.role}
                        disabled={setRole.isPending}
                        onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value })}
                      >
                        {(["owner", ...INVITABLE_ROLES] as Role[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ROLE_LABEL[u.role]
                    )}
                  </td>
                  <td>
                    {u.mfa_enabled ? (
                      <span className="badge moss">On</span>
                    ) : (
                      <span className="badge">Off</span>
                    )}
                  </td>
                  <td className="muted">{fmtDate(u.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {canInvite && (
        <div className="panel" style={{ marginTop: 20 }}>
          <header>
            <h3>Pending invites</h3>
          </header>
          {!pending.length ? (
            <Empty title="No pending invites" />
          ) : (
            <table>
              <tbody>
                {pending.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email}</td>
                    <td>{ROLE_LABEL[i.role]}</td>
                    <td className="muted">Expires {fmtDate(i.expires_at)}</td>
                    <td className="num">
                      <button className="btn sm danger" onClick={() => revoke.mutate(i.id)}>
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {inviting && <InviteForm onClose={() => setInviting(false)} />}
    </>
  );
}
