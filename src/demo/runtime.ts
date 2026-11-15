import { emitDemoEvent } from "./events";
import { withDemoState } from "./store";

type AnyRecord = Record<string, any>;
type DemoRequest = { request: Request; path: string; method: string; query: URLSearchParams; body: AnyRecord };
class DemoFault extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: AnyRecord[]) {
    super(message);
  }
}
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const cents = (n: number) => Math.round(Number(n) || 0);
const notFound = (name = "Resource") => { throw new DemoFault(404, "not_found", name + " not found"); };
const conflict = (message: string, code = "conflict") => { throw new DemoFault(409, code, message); };
const invalid = (message: string, code = "business_rule_violation") => { throw new DemoFault(422, code, message); };
const required = (value: unknown, field: string) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new DemoFault(422, "validation_error", "One or more fields are invalid.", [{ field, message: "Field required" }]);
  }
};
const page = <T,>(items: T[], q: URLSearchParams) => {
  const limit = Math.min(100, Math.max(1, Number(q.get("limit") || 100)));
  const offset = Math.max(0, Number(q.get("offset") || 0));
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
};
const match = (path: string, pattern: RegExp) => path.match(pattern);
const byId = (rows: AnyRecord[], id: string) => rows.find((row) => row.id === id);
const assertRow = (rows: AnyRecord[], id: string, label: string) => byId(rows, id) ?? notFound(label);
const amount = (qty: unknown, unit: unknown) => Math.round(Number(qty) * Number(unit));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const permissionMap: Record<string, string[]> = {
  owner: ["*"],
  admin: ["*"],
  account_manager: ["user:read","client:read","client:manage","deal:read","deal:manage","proposal:read","proposal:manage","project:read","invoice:read","report:read","time:log","approval:manage","comment:write","file:read","file:write"],
  project_manager: ["user:read","client:read","deal:read","proposal:read","project:read","project:manage","task:update","time:log","time:read_all","time:approve","report:read","approval:manage","comment:write","file:read","file:write"],
  team_member: ["user:read","client:read","project:read","task:update","time:log","comment:write","file:read","file:write"],
  finance: ["user:read","client:read","deal:read","proposal:read","project:read","time:read_all","time:approve","invoice:read","invoice:manage","report:read","comment:write","file:read"],
  client: [],
};
function hasPermission(user: AnyRecord, permission: string): boolean {
  const permissions = permissionMap[user.role] ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}
function needPermission(user: AnyRecord, permission: string): void {
  if (!hasPermission(user, permission)) throw new DemoFault(403, "forbidden", "You do not have permission to perform this action");
}
function currentUser(state: AnyRecord): AnyRecord {
  const user = byId(state.users, state.activeUserId);
  if (!user || !user.is_active) throw new DemoFault(401, "unauthorized", "Authentication required");
  return user;
}
const entityPermission: Record<string, string> = {
  client: "client:read",
  deal: "deal:read",
  proposal: "proposal:read",
  invoice: "invoice:read",
  project: "project:read",
  task: "project:read",
};

function authorizeEntity(state: AnyRecord, user: AnyRecord, entityType: string, entityId: string): AnyRecord {
  const permission = entityPermission[entityType];
  if (!permission) throw new DemoFault(403, "forbidden", "You do not have access to that item");
  needPermission(user, permission);
  const collection: Record<string, AnyRecord[]> = {
    client: state.clients,
    deal: state.deals,
    proposal: state.proposals,
    invoice: state.invoices,
    project: state.projects,
    task: state.tasks,
  };
  const entity = assertRow(collection[entityType], entityId, entityType);
  if (user.role === "team_member" && (entityType === "project" || entityType === "task")) {
    const projectId = entityType === "project" ? entity.id : entity.project_id;
    const isMember = state.members.some((member: AnyRecord) =>
      member.project_id === projectId && member.user_id === user.id
    );
    if (!isMember) notFound("Project");
  }
  return entity;
}

function loggableProject(state: AnyRecord, user: AnyRecord, projectId: string, taskId?: string | null): AnyRecord {
  const project = assertRow(state.projects, projectId, "Project");
  if (project.status === "completed" || project.status === "cancelled") {
    conflict("Project is " + project.status, "project_closed");
  }
  const member = state.members.find((row: AnyRecord) =>
    row.project_id === project.id && row.user_id === user.id
  );
  if (!member) invalid("You are not on this project's team", "not_project_member");
  if (taskId) {
    const task = assertRow(state.tasks, taskId, "Task");
    if (task.project_id !== project.id) invalid("Task is not part of this project", "task_mismatch");
  }
  return member;
}

function audit(state: AnyRecord, user: AnyRecord, action: string, entityType: string, entityId: string, data: AnyRecord = {}): void {
  state.audit.unshift({ id: uid(), org_id: user.org_id, actor_user_id: user.id, action, entity_type: entityType, entity_id: entityId, data, created_at: now() });
}
function notify(state: AnyRecord, kind: string, title: string, entityType: string | null = null, entityId: string | null = null, recipientUserId: string | null = state.activeUserId): void {
  const notification = { id: uid(), user_id: recipientUserId, kind, title, entity_type: entityType, entity_id: entityId, is_read: false, created_at: now() };
  state.notifications.unshift(notification);
  emitDemoEvent("notification", notification);
}
function recordLocalWebhookEvent(state: AnyRecord, eventType: string, data: AnyRecord): void {
  const createdAt = now();
  const payload = { type: eventType, created_at: createdAt, data };
  state.webhooks
    .filter((endpoint: AnyRecord) => endpoint.is_active && (endpoint.events.includes("*") || endpoint.events.includes(eventType)))
    .forEach((endpoint: AnyRecord) => {
      state.deliveries.unshift({
        id: uid(),
        endpoint_id: endpoint.id,
        event_type: eventType,
        payload,
        status: "pending",
        attempts: 0,
        response_status: null,
        last_error: null,
        created_at: createdAt,
        delivered_at: null,
        local_simulation: true,
      });
    });
}
function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}
function empty(): Response { return new Response(null, { status: 204 }); }
function faultResponse(error: unknown): Response {
  const e = error instanceof DemoFault ? error : new DemoFault(500, "internal_error", "An unexpected error occurred.");
  const payload: AnyRecord = {
    type: "https://agencyos.dev/problems/" + e.code,
    title: e.status === 401 ? "Authentication required" : e.status === 403 ? "Forbidden" : e.status === 404 ? "Not found" : e.status === 409 ? "Conflict" : e.status === 422 ? "Validation failed" : "Request failed",
    status: e.status,
    code: e.code,
    detail: e.message,
    request_id: uid(),
  };
  if (e.fields) payload.errors = e.fields;
  return json(payload, e.status, { "Content-Type": "application/problem+json" });
}
function recordResponse(row: AnyRecord, status = 200): Response { return json(row, status); }
function refreshBalances(state: AnyRecord, invoice: AnyRecord): void {
  const invoiceLines = state.invoiceLines.filter((line: AnyRecord) => line.invoice_id === invoice.id);
  invoice.subtotal_cents = sum(invoiceLines.map((line: AnyRecord) => line.amount_cents));
  invoice.tax_cents = Math.round(invoice.subtotal_cents * invoice.tax_rate_bps / 10_000);
  invoice.total_cents = invoice.subtotal_cents + invoice.tax_cents;
  const refunds = sum(state.refunds.filter((r: AnyRecord) => state.payments.some((p: AnyRecord) => p.id === r.payment_id && p.invoice_id === invoice.id)).map((r: AnyRecord) => r.amount_cents));
  invoice.amount_refunded_cents = refunds;
  invoice.credit_note_cents = sum(state.creditNotes.filter((r: AnyRecord) => r.invoice_id === invoice.id).map((r: AnyRecord) => r.amount_cents));
  const netPosition = invoice.total_cents - invoice.credit_note_cents - (invoice.amount_paid_cents - invoice.amount_refunded_cents);
  invoice.balance_cents = Math.max(0, netPosition);
  invoice.credit_balance_cents = Math.max(0, -netPosition);
  invoice.is_overdue = invoice.status !== "draft" && invoice.status !== "paid" && invoice.status !== "void" && !!invoice.due_date && invoice.due_date < today() && invoice.balance_cents > 0;
  if (invoice.credit_note_cents === invoice.total_cents && invoice.total_cents > 0) invoice.status = "credited";
  else if (invoice.amount_paid_cents - invoice.amount_refunded_cents >= invoice.total_cents - invoice.credit_note_cents && invoice.total_cents > 0) invoice.status = "paid";
  else if (invoice.amount_paid_cents - invoice.amount_refunded_cents > 0 && invoice.status !== "draft" && invoice.status !== "void") invoice.status = "partially_paid";
  else if (invoice.status !== "draft" && invoice.status !== "void" && invoice.status !== "credited") invoice.status = "sent";
}
function invoiceDetail(state: AnyRecord, invoiceId: string): AnyRecord {
  const invoice = assertRow(state.invoices, invoiceId, "Invoice");
  refreshBalances(state, invoice);
  return {
    invoice,
    lines: state.invoiceLines.filter((r: AnyRecord) => r.invoice_id === invoiceId),
    payments: state.payments.filter((r: AnyRecord) => r.invoice_id === invoiceId),
    refunds: state.refunds.filter((r: AnyRecord) => state.payments.some((p: AnyRecord) => p.id === r.payment_id && p.invoice_id === invoiceId)),
    credit_notes: state.creditNotes.filter((r: AnyRecord) => r.invoice_id === invoiceId),
  };
}
function createProjectFromProposal(state: AnyRecord, proposal: AnyRecord, user: AnyRecord): AnyRecord {
  const deal = assertRow(state.deals, proposal.deal_id, "Deal");
  const existing = state.projects.find((p: AnyRecord) => p.deal_id === deal.id);
  if (existing) return existing;
  const items = state.proposalItems.filter((item: AnyRecord) => item.proposal_id === proposal.id);
  const total = sum(items.map((item: AnyRecord) => amount(item.quantity, item.unit_amount)));
  const created = {
    id: uid(), client_id: proposal.client_id, deal_id: deal.id, proposal_id: proposal.id,
    name: deal.title, description: "Created from the accepted proposal.", status: "planning",
    budget_amount: total, currency: proposal.currency, start_date: today(), due_date: null,
    manager_user_id: deal.owner_user_id || user.id, created_at: now(), updated_at: now(),
  };
  state.projects.unshift(created);
  state.members.push({ project_id: created.id, user_id: created.manager_user_id, hourly_rate_cents: null });
  items.forEach((item: AnyRecord, index: number) => state.milestones.push({
    id: uid(), project_id: created.id, name: item.description.slice(0, 200),
    due_date: null, amount_cents: amount(item.quantity, item.unit_amount), status: "pending",
    position: index, completed_at: null,
  }));
  audit(state, user, "project.created_from_deal", "project", created.id, { deal_id: deal.id, budget: total });
  notify(state, "project.created", "A project was created from an accepted proposal", "project", created.id);
  recordLocalWebhookEvent(state, "project.created", { project_id: created.id, name: created.name });
  return created;
}
function acceptProposal(state: AnyRecord, proposal: AnyRecord, user: AnyRecord): AnyRecord {
  if (proposal.status !== "sent") conflict("Cannot accept a proposal that is '" + proposal.status + "'", "invalid_status_transition");
  const items = state.proposalItems.filter((item: AnyRecord) => item.proposal_id === proposal.id);
  const total = sum(items.map((item: AnyRecord) => amount(item.quantity, item.unit_amount)));
  if (total <= 0) invalid("Cannot accept a proposal with a zero total", "proposal_has_no_value");
  const deal = assertRow(state.deals, proposal.deal_id, "Deal");
  if (deal.stage === "lost") conflict("The linked deal was already marked lost", "deal_stage_blocks_acceptance");
  proposal.status = "accepted";
  proposal.accepted_at = now();
  proposal.updated_at = now();
  audit(state, user, "proposal.accepted", "proposal", proposal.id, { total });
  deal.value_amount = total;
  const order = ["lead", "qualified", "proposal_sent", "negotiation", "won"];
  let index = order.indexOf(deal.stage);
  while (index >= 0 && index < order.length - 1) {
    const previous = deal.stage;
    const next = order[index + 1];
    deal.stage = next;
    state.dealHistory.unshift({ id: uid(), deal_id: deal.id, from_stage: previous, to_stage: next, changed_by: user.id, note: "Advanced on accepted proposal: " + proposal.title, created_at: now() });
    index += 1;
  }
  deal.closed_at = now();
  deal.updated_at = now();
  createProjectFromProposal(state, proposal, user);
  notify(state, "proposal.accepted", "Proposal accepted: " + proposal.title, "proposal", proposal.id);
  return proposal;
}
function pdfResponse(title: string, lines: string[]): Response {
  const clean = [title, ...lines].map((line) => String(line).replace(/[^\x20-\x7E]/g, " ").replace(/[()\\]/g, (c) => "\\" + c).slice(0, 110));
  const stream = "BT /F1 12 Tf 48 760 Td " + clean.map((line, i) => (i ? "0 -18 Td " : "") + "(" + line + ") Tj").join(" ") + " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + new TextEncoder().encode(stream).length + " >>\nstream\n" + stream + "\nendstream",
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(output).length); output += (index + 1) + " 0 obj\n" + object + "\nendobj\n"; });
  const xref = new TextEncoder().encode(output).length;
  output += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) output += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  output += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return new Response(new Blob([output], { type: "application/pdf" }), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=\"" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf\"" } });
}

async function execute(req: DemoRequest, state: AnyRecord): Promise<Response> {
  const { path, method, query, body, request } = req;
  const publicRoutes = [
    method === "POST" && ["/auth/login", "/auth/signup", "/auth/refresh", "/auth/password/forgot", "/auth/password/reset", "/auth/mfa/verify", "/invites/accept"].includes(path),
  ].some(Boolean);
  const user = publicRoutes ? byId(state.users, state.activeUserId) : currentUser(state);

  if (method === "POST" && path === "/auth/refresh") {
    if (!user) throw new DemoFault(401, "missing_refresh_token", "No interactive workspace session is available");
    return json({ access_token: "agencyos-local-session", expires_in: 900 });
  }
  if (method === "POST" && path === "/auth/login") {
    const email = String(body.email || "").toLowerCase();
    const found = state.users.find((u: AnyRecord) => u.email.toLowerCase() === email && u.is_active);
    if (!found) throw new DemoFault(401, "invalid_credentials", "No workspace account matches that email address");
    state.activeUserId = found.id;
    found.last_login_at = now();
    return json({ mfa_required: false, access_token: "agencyos-local-session", expires_in: 900, mfa_pending_token: null });
  }
  if (method === "POST" && path === "/auth/signup") {
    required(body.organization_name, "organization_name"); required(body.full_name, "full_name"); required(body.email, "email");
    const created = { id: uid(), org_id: uid(), email: String(body.email).toLowerCase(), full_name: body.full_name, role: "owner", client_id: null, is_active: true, mfa_enabled: false, last_login_at: now(), created_at: now() };
    state.users = [created];
    state.activeUserId = created.id;
    state.org = { id: created.org_id, name: body.organization_name, currency: "USD" };
    for (const key of ["clients","contacts","deals","dealHistory","proposals","proposalItems","projects","members","milestones","tasks","timeEntries","invoices","invoiceLines","payments","refunds","creditNotes","comments","approvals","notifications","files","invites","webhooks","deliveries","audit"]) state[key] = [];
    state.idempotency = {};
    return json({ access_token: "agencyos-local-session", expires_in: 900 }, 201);
  }
  if (method === "POST" && path === "/auth/password/forgot") return json({ detail: "If the account exists, password recovery instructions have been prepared." }, 202);
  if (method === "POST" && path === "/auth/password/reset") return empty();
  if (method === "POST" && path === "/invites/accept") {
    const created = { id: uid(), org_id: state.org.id, email: "new.member@agencyos.local", full_name: body.full_name || "New teammate", role: "team_member", client_id: null, is_active: true, mfa_enabled: false, last_login_at: now(), created_at: now() };
    state.users.unshift(created); state.activeUserId = created.id;
    return json({ access_token: "agencyos-local-session", expires_in: 900 }, 201);
  }
  if (method === "POST" && path === "/auth/mfa/verify") {
    const target = byId(state.users, state.activeUserId) ?? state.users[0];
    state.activeUserId = target.id;
    return json({ access_token: "agencyos-local-session", expires_in: 900 });
  }
  if (method === "POST" && path === "/auth/logout") { state.activeUserId = null; return empty(); }
  if (method === "GET" && path === "/auth/me") return recordResponse(currentUser(state));
  if (method === "GET" && path === "/auth/mfa/status") {
    const settings = state.mfa[user!.id] ?? {};
    return json({ mfa_enabled: Boolean(settings.enabled), enrolled_at: settings.enrolled_at ?? null, recovery_codes_remaining: settings.recovery_codes_remaining ?? 0 });
  }
  if (method === "POST" && path === "/auth/mfa/enroll") {
    const secret = "JBSWY3DPEHPK3PXP";
    state.mfa[user!.id] = { secret, pending: true };
    return json({ secret, otpauth_uri: "otpauth://totp/AgencyOS:" + encodeURIComponent(user!.email) + "?secret=" + secret + "&issuer=AgencyOS", qr_code_svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\"><rect width=\"120\" height=\"120\" fill=\"white\"/><text x=\"8\" y=\"60\" font-size=\"10\">AgencyOS local MFA</text></svg>" });
  }
  if (method === "POST" && path === "/auth/mfa/enroll/confirm") {
    const settings = state.mfa[user!.id] ?? {};
    if (!settings.pending) conflict("Start MFA enrollment first", "mfa_not_pending");
    settings.enabled = true; settings.pending = false; settings.enrolled_at = now(); settings.recovery_codes_remaining = 10;
    user!.mfa_enabled = true;
    return json({ recovery_codes: Array.from({ length: 10 }, (_, i) => "AGENCY-" + String(i + 1).padStart(4, "0")) });
  }
  if (method === "POST" && path === "/auth/mfa/disable") {
    user!.mfa_enabled = false; state.mfa[user!.id] = { enabled: false, recovery_codes_remaining: 0 };
    return empty();
  }

  if (method === "GET" && path === "/users") { needPermission(user!, "user:read"); return json(page(state.users.filter((u: AnyRecord) => u.org_id === user!.org_id), query)); }
  if (method === "POST" && path === "/invites") {
    needPermission(user!, "user:invite"); required(body.email, "email");
    const row = { id: uid(), email: String(body.email).toLowerCase(), role: body.role || "team_member", client_id: body.client_id ?? null, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), accepted_at: null, created_at: now() };
    state.invites.unshift(row); audit(state, user!, "invite.created", "invite", row.id); return json(row, 201);
  }
  if (method === "GET" && path === "/invites") { needPermission(user!, "user:invite"); return json(state.invites); }
  let m = match(path, /^\/invites\/([^/]+)$/);
  if (m && method === "DELETE") { needPermission(user!, "user:invite"); state.invites = state.invites.filter((r: AnyRecord) => r.id !== m![1]); return empty(); }
  m = match(path, /^\/users\/([^/]+)\/role$/);
  if (m && method === "POST") {
    needPermission(user!, "user:manage");
    const target = assertRow(state.users, m[1], "User");
    const role = query.get("new_role");
    if (!["owner","admin","account_manager","project_manager","team_member","finance","client"].includes(role || "")) invalid("Unsupported role", "invalid_role");
    target.role = role; return recordResponse(target);
  }

  if (method === "GET" && path === "/clients") {
    needPermission(user!, "client:read");
    const rows = state.clients.filter((c: AnyRecord) => c.archived_at ? query.get("include_archived") === "true" : true);
    return json(page(rows, query));
  }
  if (method === "POST" && path === "/clients") {
    needPermission(user!, "client:manage"); required(body.name, "name");
    const row = { id: uid(), name: body.name, industry: body.industry ?? null, website: body.website ?? null, notes: body.notes ?? null, archived_at: null, created_at: now(), updated_at: now() };
    state.clients.unshift(row); audit(state, user!, "client.created", "client", row.id); return json(row, 201);
  }
  m = match(path, /^\/clients\/([^/]+)$/);
  if (m && method === "GET") { needPermission(user!, "client:read"); return recordResponse(assertRow(state.clients, m[1], "Client")); }
  if (m && method === "PATCH") {
    needPermission(user!, "client:manage"); const row = assertRow(state.clients, m[1], "Client");
    Object.assign(row, body, { updated_at: now() }); return recordResponse(row);
  }
  m = match(path, /^\/clients\/([^/]+)\/archive$/);
  if (m && method === "POST") { needPermission(user!, "client:manage"); const row = assertRow(state.clients, m[1], "Client"); row.archived_at = now(); row.updated_at = now(); return recordResponse(row); }
  m = match(path, /^\/clients\/([^/]+)\/contacts$/);
  if (m && method === "GET") { needPermission(user!, "client:read"); return json(state.contacts.filter((r: AnyRecord) => r.client_id === m![1])); }
  if (m && method === "POST") {
    needPermission(user!, "client:manage"); assertRow(state.clients, m[1], "Client"); required(body.full_name, "full_name");
    const row = { id: uid(), client_id: m[1], full_name: body.full_name, email: body.email ?? null, phone: body.phone ?? null, title: body.title ?? null, is_primary: Boolean(body.is_primary), created_at: now() };
    if (row.is_primary) state.contacts.filter((c: AnyRecord) => c.client_id === m![1]).forEach((c: AnyRecord) => c.is_primary = false);
    state.contacts.push(row); return json(row, 201);
  }
  m = match(path, /^\/contacts\/([^/]+)$/);
  if (m && method === "PATCH") { needPermission(user!, "client:manage"); const row = assertRow(state.contacts, m[1], "Contact"); Object.assign(row, body); return recordResponse(row); }
  if (m && method === "DELETE") { needPermission(user!, "client:manage"); state.contacts = state.contacts.filter((r: AnyRecord) => r.id !== m![1]); return empty(); }

  if (method === "GET" && path === "/deals") {
    needPermission(user!, "deal:read"); let rows = state.deals.slice();
    if (query.get("stage")) rows = rows.filter((r: AnyRecord) => r.stage === query.get("stage"));
    if (query.get("client_id")) rows = rows.filter((r: AnyRecord) => r.client_id === query.get("client_id"));
    return json(page(rows, query));
  }
  if (method === "POST" && path === "/deals") {
    needPermission(user!, "deal:manage"); required(body.client_id, "client_id"); required(body.title, "title");
    assertRow(state.clients, body.client_id, "Client");
    const row = { id: uid(), client_id: body.client_id, title: body.title, description: body.description ?? null, stage: "lead", value_amount: body.value_amount ?? null, value_currency: body.value_currency || "USD", owner_user_id: body.owner_user_id || user!.id, expected_close_date: body.expected_close_date ?? null, closed_at: null, lost_reason: null, created_at: now(), updated_at: now() };
    state.deals.unshift(row); return json(row, 201);
  }
  m = match(path, /^\/deals\/([^/]+)\/history$/);
  if (m && method === "GET") { needPermission(user!, "deal:read"); return json(state.dealHistory.filter((r: AnyRecord) => r.deal_id === m![1])); }
  m = match(path, /^\/deals\/([^/]+)\/stage$/);
  if (m && method === "POST") {
    needPermission(user!, "deal:manage"); const row = assertRow(state.deals, m[1], "Deal"); const to = body.to_stage;
    const allowed: Record<string, string[]> = { lead: ["qualified","lost"], qualified: ["proposal_sent","lost"], proposal_sent: ["negotiation","lost"], negotiation: ["won","lost"], won: [], lost: [] };
    if (!(allowed[row.stage] || []).includes(to)) conflict("Cannot move a deal from '" + row.stage + "' to '" + to + "'", "invalid_stage_transition");
    if (to === "won" && !(row.value_amount > 0)) invalid("A deal must have a value greater than zero before it can be won", "won_requires_value");
    if (to === "lost" && !body.lost_reason) invalid("lost_reason is required when losing a deal", "lost_requires_reason");
    const from = row.stage; row.stage = to; row.updated_at = now();
    if (to === "lost") row.lost_reason = body.lost_reason;
    if (to === "won" || to === "lost") row.closed_at = now();
    state.dealHistory.unshift({ id: uid(), deal_id: row.id, from_stage: from, to_stage: to, changed_by: user!.id, note: body.note ?? null, created_at: now() });
    audit(state, user!, "deal.stage_changed", "deal", row.id, { from, to });
    return recordResponse(row);
  }
  m = match(path, /^\/deals\/([^/]+)$/);
  if (m && method === "GET") { needPermission(user!, "deal:read"); return recordResponse(assertRow(state.deals, m[1], "Deal")); }
  if (m && method === "PATCH") { needPermission(user!, "deal:manage"); const row = assertRow(state.deals, m[1], "Deal"); Object.assign(row, body, { updated_at: now() }); return recordResponse(row); }

  if (method === "GET" && path === "/proposals") {
    needPermission(user!, "proposal:read"); let rows = state.proposals.slice();
    if (query.get("deal_id")) rows = rows.filter((r: AnyRecord) => r.deal_id === query.get("deal_id"));
    if (query.get("status")) rows = rows.filter((r: AnyRecord) => r.status === query.get("status"));
    return json(page(rows, query));
  }
  if (method === "POST" && path === "/proposals") {
    needPermission(user!, "proposal:manage"); required(body.client_id, "client_id"); required(body.deal_id, "deal_id"); required(body.title, "title");
    assertRow(state.clients, body.client_id, "Client"); assertRow(state.deals, body.deal_id, "Deal");
    const row = { id: uid(), client_id: body.client_id, deal_id: body.deal_id, title: body.title, status: "draft", currency: body.currency || "USD", valid_until: body.valid_until ?? null, sent_at: null, accepted_at: null, rejected_at: null, rejection_reason: null, created_at: now(), updated_at: now() };
    state.proposals.unshift(row); return json(row, 201);
  }
  m = match(path, /^\/proposals\/([^/]+)\/items$/);
  if (m && method === "POST") {
    needPermission(user!, "proposal:manage"); const proposal = assertRow(state.proposals, m[1], "Proposal"); if (proposal.status !== "draft") conflict("Only draft proposals can be edited", "proposal_not_editable");
    required(body.description, "description"); if (!(Number(body.quantity) > 0) || Number(body.unit_amount) < 0) invalid("Quantity must be positive and price cannot be negative", "validation_error");
    const row = { id: uid(), proposal_id: proposal.id, description: body.description, quantity: String(body.quantity), unit_amount: cents(body.unit_amount), position: Number(body.position ?? 0) };
    state.proposalItems.push(row); return json(row, 201);
  }
  m = match(path, /^\/proposal-items\/([^/]+)$/);
  if (m && (method === "PATCH" || method === "DELETE")) {
    needPermission(user!, "proposal:manage"); const item = assertRow(state.proposalItems, m[1], "Proposal item"); const proposal = assertRow(state.proposals, item.proposal_id, "Proposal");
    if (proposal.status !== "draft") conflict("Only draft proposals can be edited", "proposal_not_editable");
    if (method === "DELETE") { state.proposalItems = state.proposalItems.filter((r: AnyRecord) => r.id !== m![1]); return empty(); }
    Object.assign(item, body); if (item.quantity !== undefined) item.quantity = String(item.quantity); return recordResponse(item);
  }
  m = match(path, /^\/proposals\/([^/]+)\/(send|accept|reject)$/);
  if (m && method === "POST") {
    needPermission(user!, "proposal:manage"); const proposal = assertRow(state.proposals, m[1], "Proposal"); const action = m[2];
    if (action === "send") {
      if (proposal.status !== "draft") conflict("Cannot send a proposal that is '" + proposal.status + "'", "invalid_status_transition");
      if (!state.proposalItems.some((i: AnyRecord) => i.proposal_id === proposal.id)) invalid("Cannot send a proposal with no line items", "proposal_has_no_items");
      proposal.status = "sent"; proposal.sent_at = now(); proposal.updated_at = now(); audit(state, user!, "proposal.sent", "proposal", proposal.id);
    } else if (action === "accept") acceptProposal(state, proposal, user!);
    else {
      if (proposal.status !== "sent") conflict("Cannot reject a proposal that is '" + proposal.status + "'", "invalid_status_transition");
      required(body.reason, "reason"); proposal.status = "rejected"; proposal.rejected_at = now(); proposal.rejection_reason = body.reason; proposal.updated_at = now();
    }
    return recordResponse(proposal);
  }
  m = match(path, /^\/proposals\/([^/]+)$/);
  if (m && method === "GET") { needPermission(user!, "proposal:read"); const p = assertRow(state.proposals, m[1], "Proposal"); const items = state.proposalItems.filter((r: AnyRecord) => r.proposal_id === p.id); return json({ proposal: p, items, total_amount: sum(items.map((i: AnyRecord) => amount(i.quantity, i.unit_amount))) }); }

  if (method === "GET" && path === "/projects") {
    needPermission(user!, "project:read"); let rows = state.projects.slice();
    if (query.get("status")) rows = rows.filter((r: AnyRecord) => r.status === query.get("status"));
    if (query.get("client_id")) rows = rows.filter((r: AnyRecord) => r.client_id === query.get("client_id"));
    if (user!.role === "team_member") rows = rows.filter((p: AnyRecord) => state.members.some((m: AnyRecord) => m.project_id === p.id && m.user_id === user!.id));
    return json(page(rows, query));
  }
  if (method === "POST" && path === "/projects") {
    needPermission(user!, "project:manage"); required(body.client_id, "client_id"); required(body.name, "name"); assertRow(state.clients, body.client_id, "Client");
    const row = { id: uid(), client_id: body.client_id, deal_id: null, proposal_id: null, name: body.name, description: body.description ?? null, status: "planning", budget_amount: body.budget_amount ?? null, currency: body.currency || "USD", start_date: body.start_date ?? null, due_date: body.due_date ?? null, manager_user_id: body.manager_user_id || user!.id, created_at: now(), updated_at: now() };
    state.projects.unshift(row); state.members.push({ project_id: row.id, user_id: row.manager_user_id, hourly_rate_cents: null }); audit(state, user!, "project.created", "project", row.id); recordLocalWebhookEvent(state, "project.created", { project_id: row.id, name: row.name }); return json(row, 201);
  }
  m = match(path, /^\/projects\/([^/]+)\/status$/);
  if (m && method === "POST") {
    needPermission(user!, "project:manage"); const p = assertRow(state.projects, m[1], "Project");
    const allowed: Record<string, string[]> = { planning: ["active","cancelled"], active: ["on_hold","completed","cancelled"], on_hold: ["active","cancelled"], completed: [], cancelled: [] };
    if (!(allowed[p.status] || []).includes(body.status)) conflict("Cannot move a project from '" + p.status + "' to '" + body.status + "'", "invalid_status_transition");
    if (body.status === "completed") {
      const remaining = state.tasks.filter((t: AnyRecord) => t.project_id === p.id && t.status !== "done").length;
      if (remaining) invalid(remaining + " task(s) are not done yet", "open_tasks_remain");
    }
    const previous = p.status; p.status = body.status; p.updated_at = now(); audit(state, user!, "project.status_changed", "project", p.id, { from: previous, to: p.status }); notify(state, "project." + p.status, p.name + " is now " + p.status, "project", p.id); recordLocalWebhookEvent(state, "project." + p.status, { project_id: p.id, from: previous, to: p.status }); return recordResponse(p);
  }
  m = match(path, /^\/projects\/([^/]+)\/members(?:\/([^/]+))?$/);
  if (m && method === "POST") {
    needPermission(user!, "project:manage"); const p = assertRow(state.projects, m[1], "Project"); required(body.user_id, "user_id"); assertRow(state.users, body.user_id, "User");
    if (state.members.some((r: AnyRecord) => r.project_id === p.id && r.user_id === body.user_id)) conflict("User is already a project member");
    const row = { project_id: p.id, user_id: body.user_id, hourly_rate_cents: body.hourly_rate_cents ?? null }; state.members.push(row); return json(row, 201);
  }
  if (m && m[2] && method === "PATCH") { needPermission(user!, "project:manage"); const row = state.members.find((r: AnyRecord) => r.project_id === m![1] && r.user_id === m![2]); if (!row) notFound("Project member"); Object.assign(row, body); return recordResponse(row); }
  if (m && m[2] && method === "DELETE") { needPermission(user!, "project:manage"); state.members = state.members.filter((r: AnyRecord) => !(r.project_id === m![1] && r.user_id === m![2])); return empty(); }
  m = match(path, /^\/projects\/([^/]+)\/milestones$/);
  if (m && method === "POST") {
    needPermission(user!, "project:manage"); const p = assertRow(state.projects, m[1], "Project"); required(body.name, "name");
    const row = { id: uid(), project_id: p.id, name: body.name, due_date: body.due_date ?? null, amount_cents: body.amount_cents ?? null, status: "pending", position: Number(body.position ?? 0), completed_at: null };
    state.milestones.push(row); return json(row, 201);
  }
  m = match(path, /^\/milestones\/([^/]+)$/);
  if (m && (method === "PATCH" || method === "DELETE")) {
    needPermission(user!, "project:manage"); const row = assertRow(state.milestones, m[1], "Milestone");
    if (method === "DELETE") { if (state.tasks.some((t: AnyRecord) => t.milestone_id === row.id)) conflict("Move or remove milestone tasks before deleting this milestone"); state.milestones = state.milestones.filter((r: AnyRecord) => r.id !== row.id); return empty(); }
    const wasDone = row.status === "done"; Object.assign(row, body); if (body.done !== undefined) { row.status = body.done ? "done" : "pending"; row.completed_at = body.done ? now() : null; }
    if (!wasDone && row.status === "done") recordLocalWebhookEvent(state, "milestone.completed", { milestone_id: row.id, project_id: row.project_id });
    return recordResponse(row);
  }
  m = match(path, /^\/projects\/([^/]+)\/tasks$/);
  if (m && method === "GET") {
    needPermission(user!, "project:read");
    const p = assertRow(state.projects, m[1], "Project");
    if (user!.role === "team_member" && !state.members.some((member: AnyRecord) => member.project_id === p.id && member.user_id === user!.id)) notFound("Project");
    return json(state.tasks.filter((r: AnyRecord) => r.project_id === m![1] && (!query.get("status") || r.status === query.get("status"))));
  }
  if (m && method === "POST") {
    needPermission(user!, "project:manage"); const p = assertRow(state.projects, m[1], "Project"); required(body.title, "title");
    const row = { id: uid(), project_id: p.id, milestone_id: body.milestone_id ?? null, title: body.title, description: body.description ?? null, status: "todo", priority: body.priority || "medium", assignee_user_id: body.assignee_user_id ?? null, due_date: body.due_date ?? null, estimate_minutes: body.estimate_minutes ?? null, completed_at: null, created_at: now() };
    state.tasks.push(row);
    if (row.assignee_user_id) recordLocalWebhookEvent(state, "task.assigned", { task_id: row.id, assignee: row.assignee_user_id, title: row.title });
    return json(row, 201);
  }
  if (method === "GET" && path === "/tasks/mine") { return json(state.tasks.filter((r: AnyRecord) => r.assignee_user_id === user!.id)); }
  m = match(path, /^\/tasks\/([^/]+)$/);
  if (m && (method === "PATCH" || method === "DELETE")) {
    const task = assertRow(state.tasks, m[1], "Task"); const manager = hasPermission(user!, "project:manage");
    if (!manager && !(hasPermission(user!, "task:update") && task.assignee_user_id === user!.id)) throw new DemoFault(403, "forbidden", "You cannot update this task");
    if (method === "DELETE") { if (!manager) throw new DemoFault(403, "forbidden", "Only project managers can delete tasks"); state.tasks = state.tasks.filter((r: AnyRecord) => r.id !== task.id); return empty(); }
    if (body.status && !["todo","in_progress","review","done"].includes(body.status)) invalid("Invalid task status", "invalid_task_status");
    const previousAssignee = task.assignee_user_id; const previousStatus = task.status;
    Object.assign(task, body); if (body.unassign) task.assignee_user_id = null; if (body.status === "done") task.completed_at = now(); if (body.status && body.status !== "done") task.completed_at = null;
    if (task.assignee_user_id && task.assignee_user_id !== previousAssignee) recordLocalWebhookEvent(state, "task.assigned", { task_id: task.id, assignee: task.assignee_user_id, title: task.title });
    if (previousStatus !== "done" && task.status === "done") recordLocalWebhookEvent(state, "task.completed", { task_id: task.id, project_id: task.project_id });
    return recordResponse(task);
  }
  m = match(path, /^\/projects\/([^/]+)$/);
  if (m && method === "GET") {
    needPermission(user!, "project:read"); const p = assertRow(state.projects, m[1], "Project");
    if (user!.role === "team_member" && !state.members.some((member: AnyRecord) => member.project_id === p.id && member.user_id === user!.id)) notFound("Project");
    const tasks = state.tasks.filter((t: AnyRecord) => t.project_id === p.id);
    const task_counts: AnyRecord = { todo: 0, in_progress: 0, review: 0, done: 0 }; tasks.forEach((t: AnyRecord) => task_counts[t.status] = (task_counts[t.status] || 0) + 1);
    return json({ project: p, members: state.members.filter((r: AnyRecord) => r.project_id === p.id), milestones: state.milestones.filter((r: AnyRecord) => r.project_id === p.id), task_counts });
  }
  if (m && method === "PATCH") { needPermission(user!, "project:manage"); const p = assertRow(state.projects, m[1], "Project"); Object.assign(p, body, { updated_at: now() }); return recordResponse(p); }

  if (method === "POST" && path === "/time/timer/start") {
    needPermission(user!, "time:log");
    if (state.timeEntries.some((r: AnyRecord) => r.user_id === user!.id && !r.ended_at)) conflict("You already have a running timer", "timer_already_running");
    required(body.project_id, "project_id");
    const member = loggableProject(state, user!, body.project_id, body.task_id);
    const row = { id: uid(), user_id: user!.id, project_id: body.project_id, task_id: body.task_id ?? null, description: body.description ?? null, entry_date: today(), started_at: now(), ended_at: null, minutes: 0, billable: body.billable !== false, rate_cents: member.hourly_rate_cents ?? null, status: "draft", approved_by: null, approved_at: null, invoice_id: null };
    state.timeEntries.unshift(row); audit(state, user!, "time.timer_started", "time_entry", row.id); return json(row, 201);
  }
  if (method === "POST" && path === "/time/timer/stop") {
    needPermission(user!, "time:log");
    const row = state.timeEntries.find((r: AnyRecord) => r.user_id === user!.id && !r.ended_at); if (!row) notFound("Running timer");
    row.ended_at = now(); row.minutes = Math.min(1440, Math.max(1, Math.ceil((Date.now() - new Date(row.started_at).getTime()) / 60_000))); return recordResponse(row);
  }
  if (method === "GET" && path === "/time/timer") { needPermission(user!, "time:log"); return json(state.timeEntries.find((r: AnyRecord) => r.user_id === user!.id && !r.ended_at) ?? null); }
  if (method === "POST" && path === "/time/entries") {
    needPermission(user!, "time:log"); required(body.project_id, "project_id");
    const minutes = Number(body.minutes);
    if (!(Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440)) invalid("Minutes must be between 1 and 1440", "validation_error");
    const entryDate = body.entry_date || today();
    if (entryDate > today()) invalid("Cannot log time in the future", "future_entry");
    const member = loggableProject(state, user!, body.project_id, body.task_id);
    const loggedToday = sum(state.timeEntries.filter((entry: AnyRecord) => entry.user_id === user!.id && entry.entry_date === entryDate).map((entry: AnyRecord) => entry.minutes));
    if (loggedToday + minutes > 1440) invalid("That would exceed 24 hours in a day", "day_overflow");
    const row = { id: uid(), user_id: user!.id, project_id: body.project_id, task_id: body.task_id ?? null, description: body.description ?? null, entry_date: entryDate, started_at: now(), ended_at: now(), minutes, billable: body.billable !== false, rate_cents: member.hourly_rate_cents ?? null, status: "draft", approved_by: null, approved_at: null, invoice_id: null };
    state.timeEntries.unshift(row); audit(state, user!, "time.logged", "time_entry", row.id, { minutes: row.minutes }); return json(row, 201);
  }
  if (method === "GET" && path === "/time/entries") {
    needPermission(user!, "time:log");
    let rows = state.timeEntries.slice();
    if (hasPermission(user!, "time:read_all")) {
      if (query.get("user_id")) rows = rows.filter((r: AnyRecord) => r.user_id === query.get("user_id"));
    } else rows = rows.filter((r: AnyRecord) => r.user_id === user!.id);
    if (query.get("project_id")) rows = rows.filter((r: AnyRecord) => r.project_id === query.get("project_id"));
    if (query.get("status")) rows = rows.filter((r: AnyRecord) => r.status === query.get("status"));
    if (query.get("date_from")) rows = rows.filter((r: AnyRecord) => r.entry_date >= query.get("date_from")!);
    if (query.get("date_to")) rows = rows.filter((r: AnyRecord) => r.entry_date <= query.get("date_to")!);
    const offset = Math.max(0, Number(query.get("offset") || 0));
    return json(rows.slice(offset, offset + Number(query.get("limit") || 100)));
  }
  if (method === "GET" && path === "/time/summary") {
    needPermission(user!, "time:log");
    let entries = state.timeEntries.slice();
    if (!hasPermission(user!, "time:read_all")) entries = entries.filter((r: AnyRecord) => r.user_id === user!.id);
    if (query.get("project_id")) entries = entries.filter((r: AnyRecord) => r.project_id === query.get("project_id"));
    if (query.get("date_from")) entries = entries.filter((r: AnyRecord) => r.entry_date >= query.get("date_from")!);
    if (query.get("date_to")) entries = entries.filter((r: AnyRecord) => r.entry_date <= query.get("date_to")!);
    const groups = new Map<string, AnyRecord>();
    entries.forEach((e: AnyRecord) => { const key = e.project_id + ":" + e.user_id; const row = groups.get(key) ?? { project_id: e.project_id, user_id: e.user_id, minutes: 0, billable_minutes: 0, amount_cents: 0 }; row.minutes += e.minutes; if (e.billable) { row.billable_minutes += e.minutes; row.amount_cents += Math.round(e.minutes / 60 * (e.rate_cents || 0)); } groups.set(key, row); });
    return json(Array.from(groups.values()));
  }
  m = match(path, /^\/time\/entries\/([^/]+)$/);
  if (m && (method === "PATCH" || method === "DELETE")) {
    needPermission(user!, "time:log");
    const row = state.timeEntries.find((entry: AnyRecord) => entry.id === m![1] && entry.user_id === user!.id);
    if (!row) notFound("Time entry");
    if (row.status !== "draft") conflict("Entry is " + row.status + " and can no longer be changed", "entry_locked");
    if (!row.ended_at) conflict("Stop the timer first", "timer_running");
    if (method === "DELETE") { state.timeEntries = state.timeEntries.filter((r: AnyRecord) => r.id !== row.id); audit(state, user!, "time.deleted", "time_entry", row.id); return empty(); }
    if (body.entry_date && body.entry_date > today()) invalid("Cannot log time in the future", "future_entry");
    if (body.minutes !== undefined && !(Number.isInteger(Number(body.minutes)) && Number(body.minutes) >= 1 && Number(body.minutes) <= 1440)) invalid("Minutes must be between 1 and 1440", "validation_error");
    if (body.task_id) { const task = assertRow(state.tasks, body.task_id, "Task"); if (task.project_id !== row.project_id) invalid("Task is not part of this project", "task_mismatch"); }
    Object.assign(row, body); audit(state, user!, "time.updated", "time_entry", row.id); return recordResponse(row);
  }
  if (method === "POST" && path === "/time/approve") {
    needPermission(user!, "time:approve"); const ids: string[] = Array.from(new Set(body.entry_ids ?? [])); if (!ids.length) invalid("Select at least one time entry", "validation_error");
    const rows = ids.map((id) => assertRow(state.timeEntries, id, "Time entry"));
    rows.forEach((r) => {
      if (r.user_id === user!.id) throw new DemoFault(403, "forbidden", "You cannot approve your own time");
      if (!r.ended_at) conflict("A running timer cannot be approved", "timer_running");
      if (r.status !== "draft") conflict("Entry is already " + r.status, "invalid_status_transition");
    });
    rows.forEach((r) => { r.status = "approved"; r.approved_by = user!.id; r.approved_at = now(); notify(state, "time_approved", "Your " + r.minutes + " min entry was approved", "project", r.project_id, r.user_id); });
    audit(state, user!, "time.approved", "time_entry", rows[0].id, { count: rows.length });
    recordLocalWebhookEvent(state, "time.approved", { entry_ids: rows.map((row: AnyRecord) => row.id) });
    return json(rows);
  }

  if (method === "GET" && path === "/invoices") {
    needPermission(user!, "invoice:read"); let rows = state.invoices.slice().map((r: AnyRecord) => { refreshBalances(state, r); return r; });
    if (query.get("status")) rows = rows.filter((r: AnyRecord) => r.status === query.get("status"));
    if (query.get("client_id")) rows = rows.filter((r: AnyRecord) => r.client_id === query.get("client_id"));
    if (query.get("overdue") === "true") rows = rows.filter((r: AnyRecord) => r.is_overdue);
    return json(page(rows, query));
  }
  if (method === "POST" && path === "/invoices") {
    needPermission(user!, "invoice:manage"); required(body.client_id, "client_id"); assertRow(state.clients, body.client_id, "Client");
    const row = { id: uid(), client_id: body.client_id, project_id: body.project_id ?? null, number: null, status: "draft", currency: body.currency || "USD", issue_date: null, due_date: body.due_date ?? null, tax_rate_bps: cents(body.tax_rate_bps), subtotal_cents: 0, tax_cents: 0, total_cents: 0, amount_paid_cents: 0, amount_refunded_cents: 0, credit_note_cents: 0, balance_cents: 0, credit_balance_cents: 0, is_overdue: false, notes: body.notes ?? null, void_reason: null, voided_at: null, sent_at: null, paid_at: null, created_at: now() };
    state.invoices.unshift(row); audit(state, user!, "invoice.created", "invoice", row.id); recordLocalWebhookEvent(state, "invoice.created", { invoice_id: row.id }); return json(row, 201);
  }
  if (method === "GET" && path === "/invoices/unbilled-time") {
    needPermission(user!, "invoice:read"); const projectId = query.get("project_id");
    return json(state.timeEntries.filter((r: AnyRecord) => r.project_id === projectId && r.status === "approved" && r.billable && !r.invoice_id).map((r: AnyRecord) => ({ entry_id: r.id, user_id: r.user_id, entry_date: r.entry_date, minutes: r.minutes, rate_cents: r.rate_cents, amount_cents: Math.round(r.minutes / 60 * (r.rate_cents || 0)) })));
  }
  m = match(path, /^\/invoices\/([^/]+)\/lines$/);
  if (m && method === "POST") {
    needPermission(user!, "invoice:manage"); const inv = assertRow(state.invoices, m[1], "Invoice"); if (inv.status !== "draft") conflict("Only draft invoices can be edited", "invoice_not_draft");
    required(body.description, "description"); if (!(Number(body.quantity) > 0)) invalid("Quantity must be greater than zero", "validation_error");
    const line = { id: uid(), invoice_id: inv.id, description: body.description, quantity: String(body.quantity), unit_cents: cents(body.unit_cents), amount_cents: amount(body.quantity, body.unit_cents), position: state.invoiceLines.filter((r: AnyRecord) => r.invoice_id === inv.id).length, milestone_id: null, time_entry_ids: [] };
    state.invoiceLines.push(line); refreshBalances(state, inv); return json(invoiceDetail(state, inv.id), 201);
  }
  m = match(path, /^\/invoices\/([^/]+)\/lines\/(milestone|time)$/);
  if (m && method === "POST") {
    needPermission(user!, "invoice:manage"); const inv = assertRow(state.invoices, m[1], "Invoice"); if (inv.status !== "draft") conflict("Only draft invoices can be edited", "invoice_not_draft");
    if (m[2] === "milestone") {
      const ms = assertRow(state.milestones, body.milestone_id, "Milestone"); if (ms.project_id !== inv.project_id) invalid("Milestone belongs to another project");
      if (state.invoiceLines.some((r: AnyRecord) => r.milestone_id === ms.id)) conflict("This milestone has already been billed");
      state.invoiceLines.push({ id: uid(), invoice_id: inv.id, description: ms.name, quantity: "1.00", unit_cents: ms.amount_cents || 0, amount_cents: ms.amount_cents || 0, position: state.invoiceLines.length, milestone_id: ms.id, time_entry_ids: [] });
    } else {
      const entries = state.timeEntries.filter((r: AnyRecord) => r.project_id === inv.project_id && r.status === "approved" && r.billable && !r.invoice_id && (!body.entry_ids || body.entry_ids.includes(r.id)));
      if (!entries.length) invalid("There is no approved, billable time available to add", "no_unbilled_time");
      const groups = new Map<string, AnyRecord[]>();
      entries.forEach((e: AnyRecord) => { const key = String(e.rate_cents || 0); groups.set(key, [...(groups.get(key) || []), e]); });
      groups.forEach((rows, rateText) => {
        const rate = Number(rateText); const minutes = sum(rows.map((e) => e.minutes)); const qty = (minutes / 60).toFixed(2);
        const line = { id: uid(), invoice_id: inv.id, description: "Approved time · " + rows.length + " entries", quantity: qty, unit_cents: rate, amount_cents: Math.round(minutes / 60 * rate), position: state.invoiceLines.length, milestone_id: null, time_entry_ids: rows.map((e) => e.id) };
        state.invoiceLines.push(line); rows.forEach((e) => { e.status = "invoiced"; e.invoice_id = inv.id; });
      });
    }
    refreshBalances(state, inv); return json(invoiceDetail(state, inv.id), 201);
  }
  m = match(path, /^\/invoices\/([^/]+)\/lines\/([^/]+)$/);
  if (m && method === "DELETE") {
    needPermission(user!, "invoice:manage"); const inv = assertRow(state.invoices, m[1], "Invoice"); if (inv.status !== "draft") conflict("Only draft invoices can be edited", "invoice_not_draft");
    const line = assertRow(state.invoiceLines.filter((r: AnyRecord) => r.invoice_id === inv.id), m[2], "Invoice line");
    (line.time_entry_ids || []).forEach((id: string) => { const e = byId(state.timeEntries, id); if (e && e.status === "invoiced") { e.status = "approved"; e.invoice_id = null; } });
    state.invoiceLines = state.invoiceLines.filter((r: AnyRecord) => r.id !== line.id); refreshBalances(state, inv); return json(invoiceDetail(state, inv.id));
  }
  m = match(path, /^\/invoices\/([^/]+)\/(issue|void|send|payments|credit-notes)$/);
  if (m && method === "POST") {
    const inv = assertRow(state.invoices, m[1], "Invoice");
    if (m[2] === "issue") {
      needPermission(user!, "invoice:manage"); if (inv.status !== "draft") conflict("Only draft invoices can be issued", "invoice_not_draft");
      refreshBalances(state, inv); if (!state.invoiceLines.some((l: AnyRecord) => l.invoice_id === inv.id) || inv.total_cents <= 0) invalid("Add at least one priced line before issuing", "invoice_empty");
      inv.number = "INV-" + new Date().getFullYear() + "-" + String(state.nextNumber++).padStart(4, "0"); inv.status = "sent"; inv.issue_date = today(); inv.due_date = inv.due_date || addDays(30); inv.sent_at = now(); audit(state, user!, "invoice.issued", "invoice", inv.id); notify(state, "invoice.issued", "Invoice " + inv.number + " has been issued", "invoice", inv.id); recordLocalWebhookEvent(state, "invoice.sent", { invoice_id: inv.id, number: inv.number, total_cents: inv.total_cents }); return recordResponse(inv);
    }
    if (m[2] === "send") {
      needPermission(user!, "invoice:manage"); if (inv.status === "draft") invalid("Issue an invoice before sending it", "invoice_not_issued");
      notify(state, "invoice.email_queued", "Invoice " + (inv.number || "") + " email prepared", "invoice", inv.id);
      return json({ detail: "The invoice email has been added to the local delivery queue." }, 202);
    }
    if (m[2] === "void") {
      needPermission(user!, "invoice:manage"); if (inv.status !== "sent" || inv.amount_paid_cents || inv.credit_note_cents) conflict("Only an issued invoice with no payments or credit notes can be voided", "invoice_not_voidable");
      inv.status = "void"; inv.voided_at = now(); inv.void_reason = body.reason; recordLocalWebhookEvent(state, "invoice.voided", { invoice_id: inv.id, number: inv.number }); return recordResponse(inv);
    }
    if (m[2] === "payments") {
      needPermission(user!, "invoice:manage"); refreshBalances(state, inv);
      if (!["sent","partially_paid"].includes(inv.status)) conflict("Cannot record a payment on a " + inv.status + " invoice", "invoice_not_payable");
      const paymentAmount = cents(body.amount_cents); if (paymentAmount <= 0) invalid("Payment amount must be positive", "validation_error");
      if (paymentAmount > inv.balance_cents) invalid("Payment exceeds the outstanding balance of " + inv.balance_cents + " cents", "overpayment");
      const payment = { id: uid(), invoice_id: inv.id, amount_cents: paymentAmount, paid_on: body.paid_on || today(), method: body.method || "bank_transfer", reference: body.reference ?? null, created_at: now() };
      state.payments.push(payment); inv.amount_paid_cents += paymentAmount; refreshBalances(state, inv);
      recordLocalWebhookEvent(state, "payment.recorded", { invoice_id: inv.id, amount_cents: paymentAmount });
      if (inv.status === "paid") { inv.paid_at = now(); notify(state, "invoice.paid", "Invoice " + inv.number + " has been paid", "invoice", inv.id); recordLocalWebhookEvent(state, "invoice.paid", { invoice_id: inv.id, number: inv.number }); }
      return json(payment, 201);
    }
    if (m[2] === "credit-notes") {
      needPermission(user!, "invoice:manage"); if (["draft","void","credited"].includes(inv.status)) conflict("This invoice cannot accept a credit note", "invoice_not_creditable");
      const credit = cents(body.amount_cents); if (credit <= 0 || credit > inv.total_cents - inv.credit_note_cents) invalid("Credit note exceeds the remaining creditable amount", "credit_note_exceeds_invoice");
      const row = { id: uid(), invoice_id: inv.id, number: "CN-" + new Date().getFullYear() + "-" + String(state.nextNumber++).padStart(4, "0"), amount_cents: credit, issued_on: body.issued_on || today(), reason: body.reason, created_by: user!.id, created_at: now() };
      state.creditNotes.push(row); refreshBalances(state, inv); recordLocalWebhookEvent(state, "credit_note.issued", { invoice_id: inv.id, credit_note_id: row.id, number: row.number, amount_cents: credit }); return json(row, 201);
    }
  }
  m = match(path, /^\/invoices\/([^/]+)\/payments\/([^/]+)\/refunds$/);
  if (m && method === "POST") {
    needPermission(user!, "invoice:manage"); const inv = assertRow(state.invoices, m[1], "Invoice"); const payment = assertRow(state.payments.filter((p: AnyRecord) => p.invoice_id === inv.id), m[2], "Payment");
    const already = sum(state.refunds.filter((r: AnyRecord) => r.payment_id === payment.id).map((r: AnyRecord) => r.amount_cents));
    const value = cents(body.amount_cents); if (value <= 0 || value > payment.amount_cents - already) invalid("Refund exceeds the remaining refundable amount", "refund_exceeds_payment");
    const row = { id: uid(), payment_id: payment.id, amount_cents: value, refunded_on: body.refunded_on || today(), method: body.method || payment.method, reference: body.reference ?? null, reason: body.reason, created_by: user!.id, created_at: now() };
    state.refunds.push(row); refreshBalances(state, inv); recordLocalWebhookEvent(state, "payment.refunded", { invoice_id: inv.id, payment_id: payment.id, refund_id: row.id, amount_cents: value }); return json(row, 201);
  }
  m = match(path, /^\/invoices\/([^/]+)$/);
  if (m && method === "GET") { needPermission(user!, "invoice:read"); return json(invoiceDetail(state, m[1])); }
  if (m && method === "PATCH") { needPermission(user!, "invoice:manage"); const inv = assertRow(state.invoices, m[1], "Invoice"); if (inv.status !== "draft") conflict("Only draft invoices can be edited", "invoice_not_draft"); Object.assign(inv, body); refreshBalances(state, inv); return recordResponse(inv); }
  if (m && method === "DELETE") { needPermission(user!, "invoice:manage"); const inv = assertRow(state.invoices, m[1], "Invoice"); if (inv.status !== "draft") conflict("Only draft invoices can be discarded", "invoice_not_draft"); state.invoices = state.invoices.filter((r: AnyRecord) => r.id !== inv.id); state.invoiceLines = state.invoiceLines.filter((r: AnyRecord) => r.invoice_id !== inv.id); return empty(); }
  m = match(path, /^\/(invoices|credit-notes)\/([^/]+)\/pdf$/);
  if (m && method === "GET") {
    needPermission(user!, "invoice:read");
    if (m[1] === "invoices") { const detail = invoiceDetail(state, m[2]); if (detail.invoice.status === "draft") invalid("Draft invoices cannot be downloaded as final PDFs", "invoice_not_issued"); const client = assertRow(state.clients, detail.invoice.client_id, "Client"); return pdfResponse(detail.invoice.number || "Invoice", [client.name, "Total: " + detail.invoice.total_cents, ...detail.lines.map((l: AnyRecord) => l.description)]); }
    const note = assertRow(state.creditNotes, m[2], "Credit note"); return pdfResponse(note.number, [note.reason, "Amount: " + note.amount_cents]);
  }

  if (method === "GET" && path === "/comments") {
    needPermission(user!, "comment:write");
    required(query.get("entity_type"), "entity_type"); required(query.get("entity_id"), "entity_id");
    authorizeEntity(state, user!, query.get("entity_type")!, query.get("entity_id")!);
    return json(state.comments.filter((r: AnyRecord) => r.entity_type === query.get("entity_type") && r.entity_id === query.get("entity_id")));
  }
  if (method === "POST" && path === "/comments") {
    needPermission(user!, "comment:write"); required(body.body, "body"); required(body.entity_type, "entity_type"); required(body.entity_id, "entity_id");
    authorizeEntity(state, user!, body.entity_type, body.entity_id);
    const row = { id: uid(), entity_type: body.entity_type, entity_id: body.entity_id, author_id: user!.id, body: body.body, edited_at: null, created_at: now() };
    state.comments.push(row); notify(state, "comment.created", "New comment added", body.entity_type, body.entity_id); return json(row, 201);
  }
  m = match(path, /^\/comments\/([^/]+)$/);
  if (m && method === "PATCH") { needPermission(user!, "comment:write"); const row = assertRow(state.comments, m[1], "Comment"); if (row.author_id !== user!.id && !hasPermission(user!, "user:manage")) throw new DemoFault(403, "forbidden", "You cannot edit this comment"); row.body = body.body; row.edited_at = now(); return recordResponse(row); }
  if (m && method === "DELETE") { needPermission(user!, "comment:write"); const row = assertRow(state.comments, m[1], "Comment"); if (row.author_id !== user!.id && !hasPermission(user!, "user:manage")) throw new DemoFault(403, "forbidden", "You cannot delete this comment"); state.comments = state.comments.filter((r: AnyRecord) => r.id !== row.id); return empty(); }
  if (method === "POST" && path === "/approvals") {
    needPermission(user!, "approval:manage"); required(body.approver_id, "approver_id"); required(body.title, "title"); required(body.entity_type, "entity_type"); required(body.entity_id, "entity_id");
    authorizeEntity(state, user!, body.entity_type, body.entity_id);
    const approver = assertRow(state.users, body.approver_id, "Approver");
    if (!approver.is_active || approver.role === "client") invalid("Choose an active staff approver", "invalid_approver");
    const row = { id: uid(), entity_type: body.entity_type, entity_id: body.entity_id, title: body.title, requested_by: user!.id, approver_id: body.approver_id, status: "pending", decision_note: null, created_at: now() };
    state.approvals.unshift(row); notify(state, "approval.requested", row.title, row.entity_type, row.entity_id, row.approver_id); recordLocalWebhookEvent(state, "approval.requested", { approval_id: row.id, entity_type: row.entity_type, entity_id: row.entity_id }); return json(row, 201);
  }
  if (method === "GET" && path === "/approvals") {
    let rows = state.approvals.slice(); if (query.get("inbox") === "true") rows = rows.filter((a: AnyRecord) => a.approver_id === user!.id); else rows = rows.filter((a: AnyRecord) => a.requested_by === user!.id || a.approver_id === user!.id);
    if (query.get("status")) rows = rows.filter((a: AnyRecord) => a.status === query.get("status")); return json(rows);
  }
  m = match(path, /^\/approvals\/([^/]+)\/(decide|cancel)$/);
  if (m && method === "POST") {
    const approval = assertRow(state.approvals, m[1], "Approval"); if (approval.status !== "pending") conflict("This approval has already been decided", "approval_already_decided");
    if (m[2] === "decide") { if (approval.approver_id !== user!.id && !hasPermission(user!, "user:manage")) throw new DemoFault(403, "forbidden", "Only the assigned approver can decide this request"); approval.status = body.approve ? "approved" : "rejected"; approval.decision_note = body.note ?? null; }
    else { if (approval.requested_by !== user!.id) throw new DemoFault(403, "forbidden", "Only the requester can cancel this request"); approval.status = "cancelled"; }
    notify(state, "approval." + approval.status, approval.title, approval.entity_type, approval.entity_id, approval.requested_by);
    if (m[2] === "decide") recordLocalWebhookEvent(state, "approval.decided", { approval_id: approval.id, status: approval.status });
    return recordResponse(approval);
  }
  if (method === "GET" && path === "/notifications") return json(state.notifications.filter((r: AnyRecord) => r.user_id === user!.id).slice(0, Number(query.get("limit") || 30)));
  if (method === "GET" && path === "/notifications/unread-count") return json({ unread: state.notifications.filter((r: AnyRecord) => r.user_id === user!.id && !r.is_read).length });
  if (method === "POST" && path === "/notifications/read") {
    const ids: string[] | null = body.ids ?? null; let count = 0;
    state.notifications.forEach((r: AnyRecord) => { if (r.user_id === user!.id && (ids === null || ids.includes(r.id))) { if (!r.is_read) count += 1; r.is_read = true; } });
    return json({ marked: count });
  }
  if (method === "POST" && path === "/notifications/stream-ticket") return json({ ticket: "local-event-stream", expires_in: 300 });

  if (method === "GET" && path === "/reports/overview") {
    needPermission(user!, "report:read"); const open = state.deals.filter((d: AnyRecord) => !["won","lost"].includes(d.stage));
    const won = state.deals.filter((d: AnyRecord) => d.stage === "won");
    const active = state.projects.filter((p: AnyRecord) => p.status === "active");
    const unpaid = state.invoices.filter((i: AnyRecord) => !["draft","void","paid","credited"].includes(i.status));
    const unbilled = state.timeEntries.filter((e: AnyRecord) => e.status === "approved" && e.billable && !e.invoice_id);
    return json({ open_pipeline_cents: sum(open.map((d: AnyRecord) => d.value_amount || 0)), won_this_month_cents: sum(won.filter((d: AnyRecord) => d.closed_at?.slice(0,7) === today().slice(0,7)).map((d: AnyRecord) => d.value_amount || 0)), won_ytd_cents: sum(won.map((d: AnyRecord) => d.value_amount || 0)), outstanding_cents: sum(unpaid.map((i: AnyRecord) => { refreshBalances(state, i); return i.balance_cents; })), overdue_cents: sum(unpaid.map((i: AnyRecord) => { refreshBalances(state, i); return i.is_overdue ? i.balance_cents : 0; })), collected_this_month_cents: sum(state.payments.filter((p: AnyRecord) => p.paid_on.slice(0,7) === today().slice(0,7)).map((p: AnyRecord) => p.amount_cents)), active_projects: active.length, unbilled_time_cents: sum(unbilled.map((e: AnyRecord) => Math.round(e.minutes / 60 * (e.rate_cents || 0)))), pending_time_approvals: state.timeEntries.filter((e: AnyRecord) => e.status === "draft").length });
  }
  if (method === "GET" && path === "/reports/attention") {
    needPermission(user!, "report:read");
    const rows: AnyRecord[] = [];
    state.invoices.forEach((i: AnyRecord) => { refreshBalances(state, i); if (i.is_overdue) rows.push({ kind: "overdue_invoice", severity: "high", entity_type: "invoice", entity_id: i.id, title: "Overdue invoice " + i.number, detail: "Outstanding balance: " + i.balance_cents }); });
    state.projects.forEach((p: AnyRecord) => { const late = p.due_date && p.due_date < today() && p.status === "active"; if (late) rows.push({ kind: "late_project", severity: "medium", entity_type: "project", entity_id: p.id, title: p.name + " is past its due date", detail: "Review project delivery status" }); });
    state.deals.forEach((d: AnyRecord) => { if (d.stage === "negotiation") rows.push({ kind: "stalled_deal", severity: "low", entity_type: "deal", entity_id: d.id, title: d.title + " needs follow-up", detail: "Deal is in negotiation" }); });
    return json(rows);
  }
  if (method === "GET" && path === "/reports/revenue") {
    needPermission(user!, "report:read");
    const months = Math.min(36, Math.max(1, Number(query.get("months") || 12)));
    return json(Array.from({ length: months }, (_, index) => { const at = new Date(); at.setDate(1); at.setMonth(at.getMonth() - (months - index - 1)); const key = at.toISOString().slice(0,7); const invoices = state.invoices.filter((i: AnyRecord) => i.issue_date?.slice(0,7) === key); const invoiceIds = invoices.map((i: AnyRecord) => i.id); return { month: key, invoiced_cents: sum(invoices.map((i: AnyRecord) => i.total_cents)), collected_cents: sum(state.payments.filter((p: AnyRecord) => invoiceIds.includes(p.invoice_id) && p.paid_on.slice(0,7) === key).map((p: AnyRecord) => p.amount_cents)) }; }));
  }
  if (method === "GET" && path === "/reports/pipeline") {
    needPermission(user!, "report:read");
    const stages = ["lead","qualified","proposal_sent","negotiation","won","lost"].map((stage) => { const deals = state.deals.filter((d: AnyRecord) => d.stage === stage); return { stage, deals: deals.length, value_cents: sum(deals.map((d: AnyRecord) => d.value_amount || 0)) }; });
    const won = state.deals.filter((d: AnyRecord) => d.stage === "won").length; const closed = state.deals.filter((d: AnyRecord) => ["won","lost"].includes(d.stage)).length;
    return json({ stages, win_rate: closed ? won / closed : null, avg_days_to_win: 24 });
  }
  if (method === "GET" && path === "/reports/utilization") {
    needPermission(user!, "report:read");
    return json(state.users.filter((u: AnyRecord) => u.role !== "client").map((u: AnyRecord) => { const entries = state.timeEntries.filter((e: AnyRecord) => e.user_id === u.id); const minutes = sum(entries.map((e: AnyRecord) => e.minutes)); const billable_minutes = sum(entries.filter((e: AnyRecord) => e.billable).map((e: AnyRecord) => e.minutes)); return { user_id: u.id, full_name: u.full_name, minutes, billable_minutes, billable_pct: minutes ? billable_minutes / minutes * 100 : 0 }; }));
  }
  m = match(path, /^\/reports\/projects\/([^/]+)$/);
  if (m && method === "GET") {
    needPermission(user!, "report:read");
    const p = assertRow(state.projects, m[1], "Project"); const tasks = state.tasks.filter((t: AnyRecord) => t.project_id === p.id);
    const invoiced = state.invoices.filter((i: AnyRecord) => i.project_id === p.id); const time = state.timeEntries.filter((e: AnyRecord) => e.project_id === p.id);
    const timeValue = sum(time.map((e: AnyRecord) => Math.round(e.minutes / 60 * (e.rate_cents || 0))));
    const invoicedCents = sum(invoiced.map((i: AnyRecord) => i.total_cents));
    return json({ budget_cents: p.budget_amount, invoiced_cents: invoicedCents, paid_cents: sum(invoiced.map((i: AnyRecord) => i.amount_paid_cents)), time_value_cents: timeValue, minutes_logged: sum(time.map((e: AnyRecord) => e.minutes)), tasks_total: tasks.length, tasks_done: tasks.filter((t: AnyRecord) => t.status === "done").length, budget_used_pct: p.budget_amount ? timeValue / p.budget_amount * 100 : null });
  }
  if (method === "GET" && path === "/search") {
    const q = (query.get("q") || "").toLowerCase(); if (q.length < 2) return json([]);
    const collections = [
      { type: "client", permission: "client:read", rows: state.clients, title: "name" },
      { type: "deal", permission: "deal:read", rows: state.deals, title: "title" },
      { type: "proposal", permission: "proposal:read", rows: state.proposals, title: "title" },
      { type: "project", permission: "project:read", rows: state.projects, title: "name" },
      { type: "invoice", permission: "invoice:read", rows: state.invoices, title: "number" },
      { type: "task", permission: "project:read", rows: state.tasks, title: "title" },
    ].filter((collection) => hasPermission(user!, collection.permission));
    const visible = collections.map((collection) => {
      let rows = collection.rows;
      if (user!.role === "team_member") {
        if (collection.type === "project") rows = rows.filter((p: AnyRecord) => state.members.some((member: AnyRecord) => member.project_id === p.id && member.user_id === user!.id));
        if (collection.type === "task") rows = rows.filter((task: AnyRecord) => state.members.some((member: AnyRecord) => member.project_id === task.project_id && member.user_id === user!.id));
      }
      return { ...collection, rows };
    });
    const hits: AnyRecord[] = [];
    visible.forEach((collection) => collection.rows.forEach((r: AnyRecord) => {
      const title = String(r[collection.title] || "");
      const extra = String(r.description || r.notes || "");
      if ((title + " " + extra).toLowerCase().includes(q)) hits.push({ type: collection.type, id: r.id, title: title || collection.type, snippet: extra || title, rank: 1 });
    }));
    return json(hits.slice(0, 20));
  }
  if (method === "POST" && path === "/assistant/ask") {
    const flag = state.flags.find((f: AnyRecord) => f.key === "assistant");
    if (!flag?.enabled || !hasPermission(user!, "client:read")) throw new DemoFault(403, "forbidden", "The assistant is not enabled for this account", undefined);
    const q = String(body.question || "").toLowerCase().trim();
    if (hasPermission(user!, "report:read") && /overdue|late invoices|unpaid/.test(q)) {
      const overdue = state.invoices.filter((i: AnyRecord) => { refreshBalances(state, i); return i.is_overdue; });
      return json({ mode: "keyword", answer: overdue.length ? overdue.map((i: AnyRecord) => "- Overdue invoice " + i.number).join("\n") : "No invoices are overdue.", sources: overdue.map((i: AnyRecord) => ({ type: "invoice", id: i.id, title: i.number || "Invoice" })) });
    }
    if (hasPermission(user!, "report:read") && /pipeline|open deals|forecast/.test(q)) {
      const open = state.deals.filter((d: AnyRecord) => !["won","lost"].includes(d.stage));
      const total = sum(open.map((d: AnyRecord) => d.value_amount || 0));
      return json({ mode: "keyword", answer: "Open pipeline is " + total + " cents across " + open.length + " deals.", sources: [] });
    }
    const words = q.split(/\s+/).filter((word) => word.length > 2 && !["tell","about","what","who","where","when","how","show","find","the","and","for","with","can","you","please","give","any"].includes(word));
    const term = words.join(" ");
    const visibleCollections = [
      { type: "client", permission: "client:read", rows: state.clients, title: "name" },
      { type: "deal", permission: "deal:read", rows: state.deals, title: "title" },
      { type: "proposal", permission: "proposal:read", rows: state.proposals, title: "title" },
      { type: "project", permission: "project:read", rows: state.projects, title: "name" },
      { type: "invoice", permission: "invoice:read", rows: state.invoices, title: "number" },
      { type: "task", permission: "project:read", rows: state.tasks, title: "title" },
    ].filter((collection) => hasPermission(user!, collection.permission));
    const sources: AnyRecord[] = [];
    if (term) visibleCollections.forEach((collection) => collection.rows.forEach((row: AnyRecord) => {
      if (user!.role === "team_member" && collection.type === "task" && !state.members.some((member: AnyRecord) => member.project_id === row.project_id && member.user_id === user!.id)) return;
      if ((String(row[collection.title] || "") + " " + String(row.description || row.notes || "")).toLowerCase().includes(term)) sources.push({ type: collection.type, id: row.id, title: row[collection.title] || collection.type });
    }));
    return json({ mode: "keyword", answer: sources.length ? "Closest matches:\n" + sources.slice(0,5).map((source) => "- " + source.type + ": " + source.title).join("\n") : "I couldn't find anything matching that.", sources: sources.slice(0,5) });
  }

  if (method === "GET" && path === "/flags/me") return json(Object.fromEntries(state.flags.map((f: AnyRecord) => [f.key, f.enabled && f.rollout_percent >= 100 && (f.key !== "assistant" || hasPermission(user!, "client:read"))])));
  if (method === "GET" && path === "/flags") { needPermission(user!, "flag:manage"); return json(state.flags.map((f: AnyRecord) => ({ ...f, effective_for_me: f.enabled && f.rollout_percent >= 100 }))); }
  m = match(path, /^\/flags\/([^/]+)$/);
  if (m && method === "PUT") {
    needPermission(user!, "flag:manage"); let row = state.flags.find((f: AnyRecord) => f.key === m![1]);
    if (!row) { row = { key: m[1], description: "Workspace feature flag", enabled: false, rollout_percent: 0 }; state.flags.push(row); }
    row.enabled = Boolean(body.enabled); row.rollout_percent = Math.max(0, Math.min(100, cents(body.rollout_percent))); return recordResponse({ ...row, effective_for_me: row.enabled && row.rollout_percent >= 100 });
  }
  if (method === "GET" && path === "/webhooks/event-types") { needPermission(user!, "webhook:manage"); return json(["project.created","project.active","project.on_hold","project.completed","project.cancelled","milestone.completed","task.assigned","task.completed","invoice.created","invoice.sent","invoice.paid","invoice.voided","payment.recorded","payment.refunded","credit_note.issued","approval.requested","approval.decided","time.approved"]); }
  if (method === "GET" && path === "/webhooks") { needPermission(user!, "webhook:manage"); return json(state.webhooks); }
  if (method === "POST" && path === "/webhooks") {
    needPermission(user!, "webhook:manage"); required(body.url, "url"); if (!String(body.url).startsWith("https://")) invalid("Webhook endpoints must use HTTPS", "invalid_webhook_url");
    const row = { id: uid(), url: body.url, events: body.events ?? [], is_active: true, created_at: now(), secret: "whsec_" + uid().replace(/-/g,"") }; state.webhooks.push(row); return json(row, 201);
  }
  m = match(path, /^\/webhooks\/([^/]+)\/deliveries$/);
  if (m && method === "GET") { needPermission(user!, "webhook:manage"); assertRow(state.webhooks, m[1], "Webhook"); return json(state.deliveries.filter((d: AnyRecord) => d.endpoint_id === m![1])); }
  m = match(path, /^\/webhooks\/([^/]+)$/);
  if (m && method === "PATCH") { needPermission(user!, "webhook:manage"); const row = assertRow(state.webhooks, m[1], "Webhook"); Object.assign(row, body); return recordResponse(row); }
  if (m && method === "DELETE") { needPermission(user!, "webhook:manage"); state.webhooks = state.webhooks.filter((r: AnyRecord) => r.id !== m![1]); state.deliveries = state.deliveries.filter((r: AnyRecord) => r.endpoint_id !== m![1]); return empty(); }

  if (method === "GET" && path === "/privacy/export/me") return json({ exported_at: now(), user, organization: state.org, clients: state.clients, deals: state.deals, projects: state.projects, time_entries: state.timeEntries.filter((e: AnyRecord) => e.user_id === user!.id), audit: state.audit.filter((a: AnyRecord) => a.actor_user_id === user!.id) });
  m = match(path, /^\/privacy\/export\/([^/]+)$/);
  if (m && method === "GET") { needPermission(user!, "privacy:manage"); const target = assertRow(state.users, m[1], "User"); return json({ exported_at: now(), user: target, projects: state.projects.filter((p: AnyRecord) => state.members.some((member: AnyRecord) => member.project_id === p.id && member.user_id === target.id)), time_entries: state.timeEntries.filter((e: AnyRecord) => e.user_id === target.id) }); }
  m = match(path, /^\/privacy\/erase\/([^/]+)$/);
  if (m && method === "POST") { needPermission(user!, "privacy:manage"); const target = assertRow(state.users, m[1], "User"); if (target.id === user!.id) conflict("You cannot erase your own active account"); target.is_active = false; target.full_name = "Erased user"; target.email = "erased+" + target.id + "@agencyos.local"; audit(state, user!, "privacy.erase", "user", target.id); return json({ retained: ["Financial records required for accounting", "Audit records required for security"] }); }

  if (method === "GET" && path === "/portal/overview") {
    if (user!.role !== "client" || !user!.client_id) throw new DemoFault(403, "forbidden", "Client account required");
    const client = assertRow(state.clients, user!.client_id, "Client");
    const projects = state.projects.filter((p: AnyRecord) => p.client_id === client.id);
    const proposals = state.proposals.filter((p: AnyRecord) => p.client_id === client.id).map((p: AnyRecord) => ({ ...p, total_amount: sum(state.proposalItems.filter((i: AnyRecord) => i.proposal_id === p.id).map((i: AnyRecord) => amount(i.quantity, i.unit_amount))) }));
    const invoices = state.invoices.filter((i: AnyRecord) => i.client_id === client.id).map((i: AnyRecord) => { refreshBalances(state, i); return i; });
    return json({ client, projects, proposals, invoices });
  }
  if (method === "GET" && path === "/portal/projects") return json(state.projects.filter((p: AnyRecord) => p.client_id === user!.client_id));
  if (method === "GET" && path === "/portal/proposals") return json(state.proposals.filter((p: AnyRecord) => p.client_id === user!.client_id));
  m = match(path, /^\/portal\/proposals\/([^/]+)$/);
  if (m && method === "GET") { const p = assertRow(state.proposals, m[1], "Proposal"); if (p.client_id !== user!.client_id) notFound("Proposal"); const items = state.proposalItems.filter((i: AnyRecord) => i.proposal_id === p.id); return json({ proposal: { ...p, total_amount: sum(items.map((i: AnyRecord) => amount(i.quantity, i.unit_amount))) }, items: items.map((i: AnyRecord) => ({ ...i, amount: amount(i.quantity, i.unit_amount) })) }); }
  m = match(path, /^\/portal\/proposals\/([^/]+)\/(accept|reject)$/);
  if (m && method === "POST") {
    const p = assertRow(state.proposals, m[1], "Proposal"); if (p.client_id !== user!.client_id) notFound("Proposal");
    if (m[2] === "accept") acceptProposal(state, p, user!);
    else { if (p.status !== "sent") conflict("This proposal cannot be rejected"); required(body.reason, "reason"); p.status = "rejected"; p.rejected_at = now(); p.rejection_reason = body.reason; }
    const items = state.proposalItems.filter((i: AnyRecord) => i.proposal_id === p.id); return json({ proposal: { ...p, total_amount: sum(items.map((i: AnyRecord) => amount(i.quantity, i.unit_amount))) }, items });
  }
  if (method === "GET" && path === "/portal/invoices") return json(state.invoices.filter((i: AnyRecord) => i.client_id === user!.client_id).map((i: AnyRecord) => { refreshBalances(state, i); return i; }));
  m = match(path, /^\/portal\/invoices\/([^/]+)\/pdf$/);
  if (m && method === "GET") { const inv = assertRow(state.invoices, m[1], "Invoice"); if (inv.client_id !== user!.client_id || inv.status === "draft") notFound("Invoice"); return pdfResponse(inv.number || "Invoice", ["Client portal copy", "Total: " + inv.total_cents]); }
  if (method === "GET" && path === "/portal/credit-notes") return json(state.creditNotes.filter((n: AnyRecord) => state.invoices.some((i: AnyRecord) => i.id === n.invoice_id && i.client_id === user!.client_id)));
  m = match(path, /^\/portal\/credit-notes\/([^/]+)\/pdf$/);
  if (m && method === "GET") { const note = assertRow(state.creditNotes, m[1], "Credit note"); const inv = assertRow(state.invoices, note.invoice_id, "Invoice"); if (inv.client_id !== user!.client_id) notFound("Credit note"); return pdfResponse(note.number, [note.reason, "Amount: " + note.amount_cents]); }

  if (path === "/files" && method === "GET") {
    needPermission(user!, "file:read"); required(query.get("entity_type"), "entity_type"); required(query.get("entity_id"), "entity_id");
    authorizeEntity(state, user!, query.get("entity_type")!, query.get("entity_id")!);
    return json(state.files.filter((f: AnyRecord) => f.entity_type === query.get("entity_type") && f.entity_id === query.get("entity_id")).map(({ data, ...rest }: AnyRecord) => rest));
  }
  if (path === "/files" && method === "POST") {
    needPermission(user!, "file:write");
    const form = await request.clone().formData();
    const fileEntry = form.get("file");
    const entityType = String(form.get("entity_type") || "project");
    const entityId = String(form.get("entity_id") || "");
    if (!fileEntry || typeof fileEntry === "string") invalid("A file is required", "file_required");
    required(entityId, "entity_id");
    authorizeEntity(state, user!, entityType, entityId);
    const file = fileEntry as File;
    if (!file.size) invalid("The file is empty", "empty_file");
    if (file.size > 20 * 1024 * 1024) throw new DemoFault(413, "file_too_large", "Files may be at most 20 MB");
    const filename = file.name.replace(/\\/g, "/").split("/").pop()!.replace(/[\u0000-\u001F\u007F]/g, "").replace(/^\.+|\.+$/g, "").trim().replace(/\s+/g, " ").slice(0, 200) || "file";
    const extension = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
    const allowed: Record<string, string[]> = {
      pdf: ["application/pdf"], png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"],
      gif: ["image/gif"], webp: ["image/webp"], txt: ["text/plain"], csv: ["text/csv", "text/plain", "application/vnd.ms-excel"],
      docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"], zip: ["application/zip", "application/x-zip-compressed"],
    };
    if (!allowed[extension]) invalid("This file type is not allowed", "file_type_not_allowed");
    const declared = file.type || "application/octet-stream";
    if (declared !== "application/octet-stream" && !allowed[extension].includes(declared)) invalid("Content type does not match the file extension", "content_type_mismatch");
    const data = new Uint8Array(await file.arrayBuffer());
    const signatures: Record<string, number[]> = {
      pdf: [37,80,68,70,45], png: [137,80,78,71,13,10,26,10], jpg: [255,216,255], jpeg: [255,216,255],
      gif: [71,73,70,56], docx: [80,75,3,4], xlsx: [80,75,3,4], pptx: [80,75,3,4], zip: [80,75,3,4],
    };
    if (signatures[extension] && !signatures[extension].every((byte, index) => data[index] === byte)) invalid("File contents do not match its extension", "content_mismatch");
    if (extension === "webp" && (String.fromCharCode(...data.slice(0,4)) !== "RIFF" || String.fromCharCode(...data.slice(8,12)) !== "WEBP")) invalid("File contents do not match its extension", "content_mismatch");
    const digest = await crypto.subtle.digest("SHA-256", data);
    const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const row = { id: uid(), entity_type: entityType, entity_id: entityId, filename, content_type: allowed[extension][0], size_bytes: file.size, sha256, uploaded_by: user!.id, created_at: now(), data };
    state.files.push(row); const { data: _data, ...result } = row; return json(result, 201);
  }
  m = match(path, /^\/files\/([^/]+)\/download$/);
  if (m && method === "GET") {
    needPermission(user!, "file:read"); const file = assertRow(state.files, m[1], "File");
    authorizeEntity(state, user!, file.entity_type, file.entity_id);
    return new Response(new Blob([file.data], { type: file.content_type }), { headers: { "Content-Type": file.content_type, "X-Content-Type-Options": "nosniff", "Content-Disposition": "attachment; filename=\"" + file.filename.replace(/"/g,"") + "\"" } });
  }
  m = match(path, /^\/files\/([^/]+)$/);
  if (m && method === "DELETE") {
    needPermission(user!, "file:write"); const file = assertRow(state.files, m[1], "File");
    if (file.uploaded_by !== user!.id && !hasPermission(user!, "user:manage")) throw new DemoFault(403, "forbidden", "You can only delete files you uploaded");
    state.files = state.files.filter((r: AnyRecord) => r.id !== file.id); return empty();
  }

  throw new DemoFault(404, "not_found", "No local API route matches " + method + " " + path);
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Native fetch accepts relative paths; Request requires an absolute URL.
  const target = input instanceof Request ? input : new URL(String(input), window.location.origin);
  const request = new Request(target, init);
  const url = new URL(request.url, window.location.origin);
  const path = url.pathname.replace(/^\/api\/v1/, "") || "/";
  let body: AnyRecord = {};
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) body = await request.clone().json();
      else if (contentType.includes("application/x-www-form-urlencoded")) body = Object.fromEntries(new URLSearchParams(await request.clone().text()));
    }
    return await withDemoState(async (state) => {
      const method = request.method.toUpperCase();
      const activeUser = state.users.find((candidate: AnyRecord) =>
        candidate.id === state.activeUserId && candidate.is_active
      );
      const key = request.headers.get("Idempotency-Key")?.trim();
      let keySlot: string | null = null;
      let requestFingerprint = "";

      if (key && activeUser) {
        if (key.length > 200) invalid("Idempotency-Key must be 200 characters or fewer", "invalid_idempotency_key");
        keySlot = String(activeUser.org_id) + ":" + key;
        requestFingerprint = JSON.stringify({ method, path, body });
        const previous = state.idempotency[keySlot];
        if (previous) {
          if (previous.request_fingerprint !== requestFingerprint) {
            conflict("The Idempotency-Key was reused with a different request", "idempotency_key_conflict");
          }
          return previous.response_status === 204 ? empty() : json(previous.response_body, previous.response_status);
        }
      }

      const response = await execute({ request, path, method, query: url.searchParams, body }, state);
      if (keySlot && response.ok && response.headers.get("Content-Type")?.includes("application/json")) {
        const responseBody = await response.clone().json();
        state.idempotency[keySlot] = {
          request_fingerprint: requestFingerprint,
          response_status: response.status,
          response_body: responseBody,
          created_at: now(),
        };
      }
      return response;
    });
  } catch (error) {
    return faultResponse(error);
  }
}

export async function resetWorkspace(): Promise<void> {
  const { resetDemoState } = await import("./store");
  await resetDemoState();
  emitDemoEvent("workspace.reset");
}
