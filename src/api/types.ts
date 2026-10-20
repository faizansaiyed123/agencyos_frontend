export type Role =
  | "owner" | "admin" | "account_manager" | "project_manager"
  | "team_member" | "finance" | "client";

export interface User {
  id: string; org_id: string; email: string; full_name: string; role: Role;
  client_id: string | null; is_active: boolean; mfa_enabled: boolean; last_login_at: string | null; created_at: string;
}
export interface Page<T> { items: T[]; total: number; limit: number; offset: number }

export interface Client {
  id: string; name: string; industry: string | null; website: string | null;
  notes: string | null; archived_at: string | null; created_at: string; updated_at: string;
}
export interface Contact {
  id: string; client_id: string; full_name: string; email: string | null;
  phone: string | null; title: string | null; is_primary: boolean; created_at: string;
}

export const STAGES = ["lead", "qualified", "proposal_sent", "negotiation", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export interface Deal {
  id: string; client_id: string; title: string; description: string | null; stage: Stage;
  value_amount: number | null; value_currency: string; owner_user_id: string;
  expected_close_date: string | null; closed_at: string | null; lost_reason: string | null;
  created_at: string; updated_at: string;
}
export interface DealHistory {
  from_stage: Stage | null; to_stage: Stage; changed_by: string; note: string | null; created_at: string;
}

export type ProposalStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export interface Proposal {
  id: string; client_id: string; deal_id: string; title: string; status: ProposalStatus;
  currency: string; valid_until: string | null; sent_at: string | null; accepted_at: string | null;
  rejected_at: string | null; rejection_reason: string | null; created_at: string; updated_at: string;
}
export interface ProposalItem {
  id: string; proposal_id: string; description: string; quantity: string; unit_amount: number; position: number;
}
export interface ProposalWithItems { proposal: Proposal; items: ProposalItem[]; total_amount: number }

export interface Invite {
  id: string; email: string; role: Role; client_id: string | null; expires_at: string; accepted_at: string | null; created_at: string;
}
export interface LoginResult {
  mfa_required: boolean; access_token: string | null; expires_in: number | null; mfa_pending_token: string | null;
}
export interface MfaStatus { mfa_enabled: boolean; enrolled_at: string | null; recovery_codes_remaining: number }
export interface MfaEnroll { secret: string; otpauth_uri: string; qr_code_svg: string }

// ---- projects, time, billing, collaboration, files, reports ----
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";
export const PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold", "completed", "cancelled"];
export interface Project {
  id: string; client_id: string; deal_id: string | null; proposal_id: string | null; name: string;
  description: string | null; status: ProjectStatus; budget_amount: number | null; currency: string;
  start_date: string | null; due_date: string | null; manager_user_id: string; created_at: string;
}
export interface Member { project_id: string; user_id: string; hourly_rate_cents: number | null }
export interface Milestone {
  id: string; project_id: string; name: string; due_date: string | null; amount_cents: number | null;
  status: "pending" | "done"; position: number; completed_at: string | null;
}
export interface ProjectDetail { project: Project; members: Member[]; milestones: Milestone[]; task_counts: Record<string, number> }
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "done"];
export interface Task {
  id: string; project_id: string; milestone_id: string | null; title: string; description: string | null;
  status: TaskStatus; priority: "low" | "medium" | "high"; assignee_user_id: string | null;
  due_date: string | null; estimate_minutes: number | null; completed_at: string | null; created_at: string;
}
export interface TimeEntry {
  id: string; user_id: string; project_id: string; task_id: string | null; description: string | null;
  entry_date: string; started_at: string; ended_at: string | null; minutes: number; billable: boolean;
  rate_cents: number | null; status: "draft" | "approved" | "invoiced"; approved_by: string | null;
}
export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "void";
export interface Invoice {
  id: string; client_id: string; project_id: string | null; number: string | null; status: InvoiceStatus;
  currency: string; issue_date: string | null; due_date: string | null; tax_rate_bps: number;
  subtotal_cents: number; tax_cents: number; total_cents: number; amount_paid_cents: number;
  balance_cents: number; is_overdue: boolean; notes: string | null; void_reason: string | null; voided_at: string | null; created_at: string;
}
export interface InvoiceLine { id: string; description: string; quantity: string; unit_cents: number; amount_cents: number; milestone_id: string | null }
export interface Payment { id: string; invoice_id: string; amount_cents: number; paid_on: string; method: string; reference: string | null }
export interface InvoiceDetail { invoice: Invoice; lines: InvoiceLine[]; payments: Payment[] }
export interface UnbilledRow { entry_id: string; user_id: string; entry_date: string; minutes: number; rate_cents: number | null; amount_cents: number }
export interface Comment { id: string; entity_type: string; entity_id: string; author_id: string; body: string; edited_at: string | null; created_at: string }
export interface Approval { id: string; entity_type: string; entity_id: string; title: string; requested_by: string; approver_id: string; status: "pending" | "approved" | "rejected" | "cancelled"; decision_note: string | null; created_at: string }
export interface Notification { id: string; kind: string; title: string; entity_type: string | null; entity_id: string | null; is_read: boolean; created_at: string }
export interface FileAsset { id: string; entity_type: string; entity_id: string; filename: string; content_type: string; size_bytes: number; uploaded_by: string }
export type EntityType = "project" | "task" | "client" | "deal" | "proposal" | "invoice";
export interface Overview {
  open_pipeline_cents: number; won_this_month_cents: number; won_ytd_cents: number; outstanding_cents: number;
  overdue_cents: number; collected_this_month_cents: number; active_projects: number; unbilled_time_cents: number; pending_time_approvals: number;
}
export interface AttentionItem { kind: string; severity: "high" | "medium" | "low"; entity_type: string; entity_id: string | null; title: string; detail: string }
export interface RevenueMonth { month: string; invoiced_cents: number; collected_cents: number }
export interface UtilRow { user_id: string; full_name: string; minutes: number; billable_minutes: number; billable_pct: number | null }
export interface PipelineReport { stages: { stage: string; deals: number; value_cents: number }[]; win_rate: number | null; avg_days_to_win: number }
export interface ProjectHealth { budget_cents: number | null; invoiced_cents: number; paid_cents: number; time_value_cents: number; minutes_logged: number; tasks_total: number; tasks_done: number; budget_used_pct: number | null }
export interface SearchHit { type: string; id: string; title: string; snippet: string; rank: number }
export interface AskResult { mode: string; answer: string; sources: { type: string; id: string; title: string }[] }
export interface WebhookEndpoint { id: string; url: string; events: string[]; is_active: boolean; created_at: string; secret?: string | null }
export interface WebhookDelivery { id: string; event_type: string; status: string; attempts: number; response_status: number | null; last_error: string | null; created_at: string }
export interface FlagRow { key: string; description: string; enabled: boolean; rollout_percent: number; effective_for_me: boolean }


export interface PortalClient {
  id: string; name: string; industry: string | null; website: string | null;
}
export interface PortalProject {
  id: string; name: string; description: string | null; status: ProjectStatus;
  budget_amount: number | null; currency: string; start_date: string | null; due_date: string | null;
}
export interface PortalProposal {
  id: string; title: string; status: ProposalStatus; currency: string; valid_until: string | null;
  sent_at: string | null; accepted_at: string | null; rejected_at: string | null;
  rejection_reason: string | null; total_amount: number;
}
export interface PortalInvoice {
  id: string; number: string | null; status: InvoiceStatus; currency: string;
  issue_date: string | null; due_date: string | null; total_cents: number;
  amount_paid_cents: number; balance_cents: number; notes: string | null;
}
export interface PortalOverview {
  client: PortalClient; projects: PortalProject[]; proposals: PortalProposal[]; invoices: PortalInvoice[];
}
export interface PortalProposalItem {
  id: string; description: string; quantity: string; unit_amount: number; amount: number; position: number;
}
export interface PortalProposalDetail {
  proposal: PortalProposal; items: PortalProposalItem[];
}
