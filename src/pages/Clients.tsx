import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAction, useClient, useClients, useContacts, useDeals } from "../api/hooks";
import { can } from "../api/permissions";
import type { Client, Contact } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { CommentsPanel, FilesPanel } from "../components/Collab";
import {
  Empty,
  ErrorNote,
  Field,
  FormModal,
  PageHead,
  Spinner,
  StageBadge,
} from "../components/ui";
import { fmtDate, money } from "../lib";

function ClientForm({ initial, onClose }: { initial?: Client; onClose: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    industry: initial?.industry ?? "",
    website: initial?.website ?? "",
    notes: initial?.notes ?? "",
  });
  const save = useAction(async () => {
    const body = {
      name: f.name,
      industry: f.industry || null,
      website: f.website || null,
      notes: f.notes || null,
    };
    return initial
      ? api(`/clients/${initial.id}`, { method: "PATCH", body })
      : api("/clients", { body });
  }, ["clients", "client"]);
  return (
    <FormModal
      title={initial ? "Edit client" : "New client"}
      submitLabel={initial ? "Save changes" : "Create client"}
      onClose={onClose}
      onSubmit={() => save.mutateAsync(undefined)}
    >
      <Field label="Name">
        <input
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
          autoFocus
        />
      </Field>
      <div className="grid2">
        <Field label="Industry">
          <input value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} />
        </Field>
        <Field label="Website">
          <input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
    </FormModal>
  );
}

export function Clients() {
  const { user } = useAuth();
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const q = useClients(archived);
  const canManage = can(user?.role, "client:manage");
  return (
    <>
      <PageHead
        title="Clients"
        sub="Every company you work with or are pitching."
        actions={
          <>
            <label className="row muted" style={{ fontSize: 14 }}>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />{" "}
              Show archived
            </label>
            {canManage && (
              <button className="btn primary" onClick={() => setCreating(true)}>
                New client
              </button>
            )}
          </>
        }
      />
      <div className="panel">
        {q.isLoading ? (
          <Spinner />
        ) : q.error ? (
          <div className="body">
            <ErrorNote error={q.error} />
          </div>
        ) : !q.data?.items.length ? (
          <Empty title="No clients yet">
            {canManage ? "Add your first client to start tracking deals." : "Nothing to show."}
          </Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Industry</th>
                <th>Website</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((c) => (
                <tr key={c.id} className="link">
                  <td>
                    <Link to={`/clients/${c.id}`}>
                      <strong>{c.name}</strong>
                    </Link>{" "}
                    {c.archived_at && <span className="badge">Archived</span>}
                  </td>
                  <td>{c.industry ?? <span className="muted">—</span>}</td>
                  <td>{c.website ?? <span className="muted">—</span>}</td>
                  <td className="muted">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <ClientForm onClose={() => setCreating(false)} />}
    </>
  );
}

function ContactForm({
  clientId,
  initial,
  onClose,
}: {
  clientId: string;
  initial?: Contact;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    full_name: initial?.full_name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    title: initial?.title ?? "",
    is_primary: initial?.is_primary ?? false,
  });
  const save = useAction(async () => {
    const body = {
      full_name: f.full_name,
      email: f.email || null,
      phone: f.phone || null,
      title: f.title || null,
      is_primary: f.is_primary,
    };
    return initial
      ? api(`/contacts/${initial.id}`, { method: "PATCH", body })
      : api(`/clients/${clientId}/contacts`, { body });
  }, ["contacts"]);
  return (
    <FormModal
      title={initial ? "Edit contact" : "Add contact"}
      submitLabel={initial ? "Save changes" : "Add contact"}
      onClose={onClose}
      onSubmit={() => save.mutateAsync(undefined)}
    >
      <Field label="Full name">
        <input
          value={f.full_name}
          onChange={(e) => setF({ ...f, full_name: e.target.value })}
          required
          autoFocus
        />
      </Field>
      <div className="grid2">
        <Field label="Email">
          <input
            type="email"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
      </div>
      <Field label="Job title">
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </Field>
      <label className="row" style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          style={{ width: "auto" }}
          checked={f.is_primary}
          onChange={(e) => setF({ ...f, is_primary: e.target.checked })}
        />{" "}
        Primary contact
      </label>
    </FormModal>
  );
}

export function ClientDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const client = useClient(id);
  const contacts = useContacts(id);
  const deals = useDeals({ client_id: id });
  const [editing, setEditing] = useState(false);
  const [contactForm, setContactForm] = useState<Contact | "new" | null>(null);
  const canManage = can(user?.role, "client:manage");
  const archive = useAction(
    () => api(`/clients/${id}/archive`, { method: "POST" }),
    ["clients", "client"],
  );
  const delContact = useAction(
    (cid: string) => api(`/contacts/${cid}`, { method: "DELETE" }),
    ["contacts"],
  );

  if (client.isLoading) return <Spinner />;
  if (client.error || !client.data)
    return (
      <>
        <ErrorNote error={client.error} />
        <Link to="/clients">Back to clients</Link>
      </>
    );
  const c = client.data;

  return (
    <>
      <PageHead
        crumb={<Link to="/clients">Clients</Link>}
        title={c.name}
        sub={[c.industry, c.website].filter(Boolean).join(" · ") || undefined}
        actions={
          canManage && !c.archived_at ? (
            <>
              <button className="btn ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                className="btn danger"
                disabled={archive.isPending}
                onClick={() => {
                  if (confirm(`Archive ${c.name}? You can't archive a client with open deals.`))
                    archive.mutate(undefined);
                }}
              >
                Archive
              </button>
            </>
          ) : c.archived_at ? (
            <span className="badge">Archived {fmtDate(c.archived_at)}</span>
          ) : undefined
        }
      />
      <ErrorNote error={archive.error ?? delContact.error} />
      <div className="cols">
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <header>
              <h3>Deals</h3>
              {can(user?.role, "deal:manage") && !c.archived_at && (
                <Link className="btn sm ghost" to={`/deals?new=${id}`}>
                  New deal
                </Link>
              )}
            </header>
            {deals.isLoading ? (
              <Spinner />
            ) : !deals.data?.items.length ? (
              <Empty title="No deals with this client" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Deal</th>
                    <th>Stage</th>
                    <th className="num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.data.items.map((d) => (
                    <tr key={d.id} className="link">
                      <td>
                        <Link to={`/deals/${d.id}`}>{d.title}</Link>
                      </td>
                      <td>
                        <StageBadge stage={d.stage} />
                      </td>
                      <td className="num">{money(d.value_amount, d.value_currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="panel">
            <header>
              <h3>Contacts</h3>
              {canManage && !c.archived_at && (
                <button className="btn sm ghost" onClick={() => setContactForm("new")}>
                  Add contact
                </button>
              )}
            </header>
            {contacts.isLoading ? (
              <Spinner />
            ) : !contacts.data?.length ? (
              <Empty title="No contacts yet" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Reach</th>
                    {canManage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {contacts.data.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.full_name}</strong>{" "}
                        {p.is_primary && <span className="badge blue">Primary</span>}
                        <div className="muted">{p.title}</div>
                      </td>
                      <td>
                        {p.email}
                        <div className="muted">{p.phone}</div>
                      </td>
                      {canManage && (
                        <td className="num">
                          <button className="btn sm ghost" onClick={() => setContactForm(p)}>
                            Edit
                          </button>{" "}
                          <button
                            className="btn sm danger"
                            onClick={() => {
                              if (confirm(`Remove ${p.full_name}?`)) delContact.mutate(p.id);
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <header>
              <h3>Notes</h3>
            </header>
            <div className="body">
              {c.notes ? (
                <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{c.notes}</p>
              ) : (
                <span className="muted">No notes.</span>
              )}
            </div>
          </div>
          <FilesPanel type="client" id={id} />
          <CommentsPanel type="client" id={id} />
        </div>
      </div>
      {editing && <ClientForm initial={c} onClose={() => setEditing(false)} />}
      {contactForm && (
        <ContactForm
          clientId={id}
          initial={contactForm === "new" ? undefined : contactForm}
          onClose={() => setContactForm(null)}
        />
      )}
    </>
  );
}
