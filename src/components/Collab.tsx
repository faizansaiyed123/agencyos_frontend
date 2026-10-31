import { useRef, useState } from "react";
import { api, getAccessToken } from "../api/client";
import { useAction, useApprovals, useComments, useFiles, useUsers } from "../api/hooks";
import { useNames } from "../api/useNames";
import { can } from "../api/permissions";
import type { EntityType } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { ago } from "../lib";
import { Empty, ErrorNote, Field, FormModal, Spinner } from "./ui";

export function CommentsPanel({ type, id }: { type: EntityType; id: string }) {
  const { user } = useAuth();
  const q = useComments(type, id);
  const name = useNames();
  const [body, setBody] = useState("");
  const post = useAction(
    () => api("/comments", { body: { entity_type: type, entity_id: id, body } }),
    ["comments"],
  );
  const del = useAction(
    (cid: string) => api(`/comments/${cid}`, { method: "DELETE" }),
    ["comments"],
  );
  if (!can(user?.role, "comment:write")) return null;
  const submit = async () => {
    if (!body.trim()) return;
    await post.mutateAsync(undefined);
    setBody("");
  };
  return (
    <div className="panel">
      <header>
        <h3>Discussion</h3>
      </header>
      <div className="body">
        {q.isLoading ? (
          <Spinner />
        ) : !q.data?.length ? (
          <p className="muted" style={{ marginTop: 0 }}>
            No comments yet.
          </p>
        ) : (
          <ul className="thread">
            {q.data.map((c) => (
              <li key={c.id}>
                <strong>{name(c.author_id)}</strong>{" "}
                <small className="muted">
                  {ago(c.created_at)}
                  {c.edited_at ? " · edited" : ""}
                </small>
                {(c.author_id === user?.id || can(user?.role, "user:manage")) && (
                  <button className="link-btn" onClick={() => del.mutate(c.id)}>
                    Delete
                  </button>
                )}
                <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
              </li>
            ))}
          </ul>
        )}
        <ErrorNote error={post.error ?? del.error} />
        <textarea
          aria-label="Write a comment"
          placeholder="Write a comment. Type @email to mention a teammate."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <button
            className="btn primary sm"
            disabled={post.isPending || !body.trim()}
            onClick={submit}
          >
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}

const fmtSize = (b: number) =>
  b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

export function FilesPanel({ type, id }: { type: EntityType; id: string }) {
  const { user } = useAuth();
  const q = useFiles(type, id);
  const name = useNames();
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const del = useAction((fid: string) => api(`/files/${fid}`, { method: "DELETE" }), ["files"]);
  const upload = useAction(
    async (file: File) => {
      const fd = new FormData();
      fd.append("entity_type", type);
      fd.append("entity_id", id);
      fd.append("file", file);
      const res = await fetch("/api/v1/files", {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.detail ?? "Upload failed");
      }
    },
    ["files"],
  );
  if (!can(user?.role, "file:read")) return null;

  const download = async (fid: string, filename: string) => {
    // Authenticated download: fetch with the bearer token, then save the blob.
    const res = await fetch(`/api/v1/files/${fid}/download`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!res.ok) {
      setErr(new Error("Download failed"));
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      await upload.mutateAsync(f);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="panel">
      <header>
        <h3>Files</h3>
        {can(user?.role, "file:write") && (
          <>
            <input ref={input} type="file" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <button className="btn sm ghost" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Uploading…" : "Upload"}
            </button>
          </>
        )}
      </header>
      <ErrorNote error={err ?? del.error} />
      {q.isLoading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <Empty title="No files">PDF, images, Office files, CSV, text or zip, up to 20 MB.</Empty>
      ) : (
        <table>
          <tbody>
            {q.data.map((f) => (
              <tr key={f.id}>
                <td>
                  <button
                    className="link-btn"
                    style={{ margin: 0 }}
                    onClick={() => download(f.id, f.filename)}
                  >
                    {f.filename}
                  </button>
                  <div className="muted">
                    {fmtSize(f.size_bytes)} · {name(f.uploaded_by)}
                  </div>
                </td>
                <td className="num">
                  {(f.uploaded_by === user?.id || can(user?.role, "user:manage")) && (
                    <button
                      className="btn sm danger"
                      onClick={() => {
                        if (confirm(`Delete ${f.filename}?`)) del.mutate(f.id);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Ask a teammate to sign off on an item. */
export function RequestApproval({
  type,
  id,
  title,
}: {
  type: EntityType;
  id: string;
  title: string;
}) {
  const { user } = useAuth();
  const users = useUsers();
  const pending = useApprovals(false);
  const [open, setOpen] = useState(false);
  const [approver, setApprover] = useState("");
  const [what, setWhat] = useState(`Please review: ${title}`);
  const create = useAction(
    () =>
      api("/approvals", {
        body: { entity_type: type, entity_id: id, approver_id: approver, title: what },
      }),
    ["approvals"],
  );
  if (!can(user?.role, "approval:manage")) return null;
  const mine = pending.data?.filter((a) => a.entity_id === id && a.status === "pending") ?? [];
  return (
    <>
      <button className="btn ghost" onClick={() => setOpen(true)}>
        Request approval{mine.length ? ` (${mine.length} pending)` : ""}
      </button>
      {open && (
        <FormModal
          title="Request approval"
          submitLabel="Send request"
          onClose={() => setOpen(false)}
          onSubmit={() => create.mutateAsync(undefined)}
        >
          <Field label="Approver">
            <select value={approver} onChange={(e) => setApprover(e.target.value)} required>
              <option value="">Choose…</option>
              {users.data?.items
                .filter((u) => u.is_active && u.id !== user?.id && u.role !== "client")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="What needs approving">
            <input value={what} onChange={(e) => setWhat(e.target.value)} required />
          </Field>
        </FormModal>
      )}
    </>
  );
}
