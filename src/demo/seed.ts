const now = new Date();
const iso = (daysAgo = 0) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
const date = (daysAgo = 0) => iso(daysAgo).slice(0, 10);
const org = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000011";
const admin = "00000000-0000-4000-8000-000000000017";
const accountManager = "00000000-0000-4000-8000-000000000012";
const projectManager = "00000000-0000-4000-8000-000000000013";
const teamMember = "00000000-0000-4000-8000-000000000014";
const finance = "00000000-0000-4000-8000-000000000015";
const clientUser = "00000000-0000-4000-8000-000000000016";
const acme = "00000000-0000-4000-8000-000000000101";
const starlight = "00000000-0000-4000-8000-000000000102";
const health = "00000000-0000-4000-8000-000000000103";
const dealWon = "00000000-0000-4000-8000-000000000201";
const dealNegotiation = "00000000-0000-4000-8000-000000000202";
const dealQualified = "00000000-0000-4000-8000-000000000203";
const dealLead = "00000000-0000-4000-8000-000000000204";
const proposalAccepted = "00000000-0000-4000-8000-000000000301";
const proposalDraft = "00000000-0000-4000-8000-000000000302";
const project = "00000000-0000-4000-8000-000000000401";
const milestoneOne = "00000000-0000-4000-8000-000000000411";
const milestoneTwo = "00000000-0000-4000-8000-000000000412";
const taskOne = "00000000-0000-4000-8000-000000000421";
const taskTwo = "00000000-0000-4000-8000-000000000422";
const taskThree = "00000000-0000-4000-8000-000000000423";
const invoicePaid = "00000000-0000-4000-8000-000000000501";
const invoiceSent = "00000000-0000-4000-8000-000000000502";
const invoiceDraft = "00000000-0000-4000-8000-000000000503";

export function createSeedState(): Record<string, any> {
  return {
    version: 1,
    nextNumber: 9000,
    activeUserId: owner,
    org: { id: org, name: "Northstar Creative Studio", currency: "USD" },
    users: [
      { id: owner, org_id: org, email: "owner@agencyos.local", full_name: "Morgan Chen", role: "owner", client_id: null, is_active: true, mfa_enabled: false, last_login_at: iso(0), created_at: iso(180) },
      { id: admin, org_id: org, email: "admin@agencyos.local", full_name: "Casey Jordan", role: "admin", client_id: null, is_active: true, mfa_enabled: false, last_login_at: iso(1), created_at: iso(160) },
      { id: accountManager, org_id: org, email: "alex@agencyos.local", full_name: "Alex Rivera", role: "account_manager", client_id: null, is_active: true, mfa_enabled: false, last_login_at: iso(1), created_at: iso(150) },
      { id: projectManager, org_id: org, email: "sarah@agencyos.local", full_name: "Sarah Lin", role: "project_manager", client_id: null, is_active: true, mfa_enabled: false, last_login_at: iso(0), created_at: iso(120) },
      { id: teamMember, org_id: org, email: "jamie@agencyos.local", full_name: "Jamie Patel", role: "team_member", client_id: null, is_active: true, mfa_enabled: false, last_login_at: iso(2), created_at: iso(90) },
      { id: finance, org_id: org, email: "taylor@agencyos.local", full_name: "Taylor Brooks", role: "finance", client_id: null, is_active: true, mfa_enabled: false, last_login_at: iso(0), created_at: iso(80) },
      { id: clientUser, org_id: org, email: "client@agencyos.local", full_name: "Jordan Lee", role: "client", client_id: acme, is_active: true, mfa_enabled: false, last_login_at: iso(3), created_at: iso(60) },
    ],
    clients: [
      { id: acme, name: "Acme Global", industry: "Technology", website: "https://acme.example", notes: "Enterprise platform modernization partner.", archived_at: null, created_at: iso(120), updated_at: iso(2) },
      { id: starlight, name: "Starlight Interactive", industry: "Media", website: "https://starlight.example", notes: "Digital experience and content systems.", archived_at: null, created_at: iso(85), updated_at: iso(5) },
      { id: health, name: "Hyperion Health", industry: "Healthcare", website: "https://hyperion.example", notes: "Healthcare operations product.", archived_at: null, created_at: iso(65), updated_at: iso(8) },
    ],
    contacts: [
      { id: "00000000-0000-4000-8000-000000000111", client_id: acme, full_name: "Jordan Lee", email: "jordan@acme.example", phone: "+1 415 555 0142", title: "VP Operations", is_primary: true, created_at: iso(100) },
      { id: "00000000-0000-4000-8000-000000000112", client_id: starlight, full_name: "Avery Morgan", email: "avery@starlight.example", phone: "+1 212 555 0198", title: "Product Director", is_primary: true, created_at: iso(80) },
    ],
    deals: [
      { id: dealWon, client_id: acme, title: "Payment Platform Modernization", description: "Modernize payment operations and reconciliation.", stage: "won", value_amount: 11000000, value_currency: "USD", owner_user_id: accountManager, expected_close_date: date(-14), closed_at: iso(12), lost_reason: null, created_at: iso(100), updated_at: iso(12) },
      { id: dealNegotiation, client_id: starlight, title: "Digital Experience Rebuild", description: "Rebuild the customer-facing digital experience.", stage: "negotiation", value_amount: 4600000, value_currency: "USD", owner_user_id: accountManager, expected_close_date: date(-3), closed_at: null, lost_reason: null, created_at: iso(48), updated_at: iso(2) },
      { id: dealQualified, client_id: health, title: "Clinical Operations Portal", description: "A secure operational portal for care teams.", stage: "qualified", value_amount: 3200000, value_currency: "USD", owner_user_id: owner, expected_close_date: date(-20), closed_at: null, lost_reason: null, created_at: iso(30), updated_at: iso(4) },
      { id: dealLead, client_id: starlight, title: "Content Workflow Automation", description: "Discovery for a content workflow product.", stage: "lead", value_amount: 1800000, value_currency: "USD", owner_user_id: accountManager, expected_close_date: date(-10), closed_at: null, lost_reason: null, created_at: iso(14), updated_at: iso(1) },
    ],
    dealHistory: [
      { id: "00000000-0000-4000-8000-000000000211", deal_id: dealWon, from_stage: "lead", to_stage: "qualified", changed_by: accountManager, note: "Discovery completed", created_at: iso(95) },
      { id: "00000000-0000-4000-8000-000000000212", deal_id: dealWon, from_stage: "qualified", to_stage: "proposal_sent", changed_by: accountManager, note: "Proposal shared", created_at: iso(75) },
      { id: "00000000-0000-4000-8000-000000000213", deal_id: dealWon, from_stage: "proposal_sent", to_stage: "negotiation", changed_by: accountManager, note: "Commercial review", created_at: iso(55) },
      { id: "00000000-0000-4000-8000-000000000214", deal_id: dealWon, from_stage: "negotiation", to_stage: "won", changed_by: owner, note: "Proposal accepted", created_at: iso(12) },
    ],
    proposals: [
      { id: proposalAccepted, client_id: acme, deal_id: dealWon, title: "Payment Platform Delivery Proposal", status: "accepted", currency: "USD", valid_until: date(-20), sent_at: iso(30), accepted_at: iso(12), rejected_at: null, rejection_reason: null, created_at: iso(40), updated_at: iso(12) },
      { id: proposalDraft, client_id: starlight, deal_id: dealNegotiation, title: "Digital Experience Proposal", status: "draft", currency: "USD", valid_until: date(-18), sent_at: null, accepted_at: null, rejected_at: null, rejection_reason: null, created_at: iso(3), updated_at: iso(1) },
    ],
    proposalItems: [
      { id: "00000000-0000-4000-8000-000000000311", proposal_id: proposalAccepted, description: "Discovery and solution architecture", quantity: "1.00", unit_amount: 1500000, position: 0 },
      { id: "00000000-0000-4000-8000-000000000312", proposal_id: proposalAccepted, description: "Payment workflow implementation", quantity: "1.00", unit_amount: 6500000, position: 1 },
      { id: "00000000-0000-4000-8000-000000000313", proposal_id: proposalAccepted, description: "Quality assurance and launch", quantity: "1.00", unit_amount: 3000000, position: 2 },
      { id: "00000000-0000-4000-8000-000000000314", proposal_id: proposalDraft, description: "Experience research and UX", quantity: "1.00", unit_amount: 900000, position: 0 },
      { id: "00000000-0000-4000-8000-000000000315", proposal_id: proposalDraft, description: "Frontend product engineering", quantity: "1.00", unit_amount: 3700000, position: 1 },
    ],
    projects: [
      { id: project, client_id: acme, deal_id: dealWon, proposal_id: proposalAccepted, name: "Payment Platform Modernization", description: "Delivery workspace for the accepted proposal.", status: "active", budget_amount: 11000000, currency: "USD", start_date: date(10), due_date: date(-35), manager_user_id: projectManager, created_at: iso(12), updated_at: iso(1) },
    ],
    members: [
      { project_id: project, user_id: projectManager, hourly_rate_cents: 12500 },
      { project_id: project, user_id: teamMember, hourly_rate_cents: 9500 },
    ],
    milestones: [
      { id: milestoneOne, project_id: project, name: "Architecture and foundations", due_date: date(-5), amount_cents: 1500000, status: "done", position: 0, completed_at: iso(8) },
      { id: milestoneTwo, project_id: project, name: "Payment workflows and launch", due_date: date(-30), amount_cents: 9500000, status: "pending", position: 1, completed_at: null },
    ],
    tasks: [
      { id: taskOne, project_id: project, milestone_id: milestoneOne, title: "Complete technical discovery", description: "Confirm service boundaries and integration contracts.", status: "done", priority: "high", assignee_user_id: projectManager, due_date: date(8), estimate_minutes: 480, completed_at: iso(8), created_at: iso(20) },
      { id: taskTwo, project_id: project, milestone_id: milestoneTwo, title: "Implement payment orchestration", description: "Build the core payment workflow and reconciliation path.", status: "in_progress", priority: "high", assignee_user_id: teamMember, due_date: date(-4), estimate_minutes: 1800, completed_at: null, created_at: iso(16) },
      { id: taskThree, project_id: project, milestone_id: milestoneTwo, title: "Prepare release verification", description: "Add regression coverage for the release workflow.", status: "review", priority: "medium", assignee_user_id: projectManager, due_date: date(5), estimate_minutes: 600, completed_at: null, created_at: iso(9) },
    ],
    timeEntries: [
      { id: "00000000-0000-4000-8000-000000000451", user_id: teamMember, project_id: project, task_id: taskOne, description: "Architecture review", entry_date: date(8), started_at: iso(8), ended_at: iso(8), minutes: 240, billable: true, rate_cents: 9500, status: "approved", approved_by: projectManager, approved_at: iso(7), invoice_id: invoiceSent },
      { id: "00000000-0000-4000-8000-000000000452", user_id: teamMember, project_id: project, task_id: taskTwo, description: "Payment orchestration implementation", entry_date: date(1), started_at: iso(1), ended_at: iso(1), minutes: 180, billable: true, rate_cents: 9500, status: "draft", approved_by: null, approved_at: null, invoice_id: null },
      { id: "00000000-0000-4000-8000-000000000453", user_id: projectManager, project_id: project, task_id: taskThree, description: "Release review", entry_date: date(2), started_at: iso(2), ended_at: iso(2), minutes: 90, billable: false, rate_cents: 12500, status: "approved", approved_by: owner, approved_at: iso(1), invoice_id: null },
    ],
    invoices: [
      { id: invoicePaid, client_id: acme, project_id: project, number: "INV-2026-0001", status: "paid", currency: "USD", issue_date: date(35), due_date: date(5), tax_rate_bps: 0, subtotal_cents: 3000000, tax_cents: 0, total_cents: 3000000, amount_paid_cents: 3000000, amount_refunded_cents: 0, credit_note_cents: 0, balance_cents: 0, credit_balance_cents: 0, is_overdue: false, notes: "Discovery milestone", void_reason: null, voided_at: null, sent_at: iso(35), paid_at: iso(20), created_at: iso(38) },
      { id: invoiceSent, client_id: acme, project_id: project, number: "INV-2026-0002", status: "sent", currency: "USD", issue_date: date(9), due_date: date(10), tax_rate_bps: 800, subtotal_cents: 420000, tax_cents: 33600, total_cents: 453600, amount_paid_cents: 100000, amount_refunded_cents: 0, credit_note_cents: 0, balance_cents: 353600, credit_balance_cents: 0, is_overdue: true, notes: "Implementation services", void_reason: null, voided_at: null, sent_at: iso(9), paid_at: null, created_at: iso(11) },
      { id: invoiceDraft, client_id: starlight, project_id: null, number: null, status: "draft", currency: "USD", issue_date: null, due_date: date(-5), tax_rate_bps: 0, subtotal_cents: 0, tax_cents: 0, total_cents: 0, amount_paid_cents: 0, amount_refunded_cents: 0, credit_note_cents: 0, balance_cents: 0, credit_balance_cents: 0, is_overdue: false, notes: "Draft for review", void_reason: null, voided_at: null, sent_at: null, paid_at: null, created_at: iso(2) },
    ],
    invoiceLines: [
      { id: "00000000-0000-4000-8000-000000000511", invoice_id: invoicePaid, description: "Discovery and architecture", quantity: "1.00", unit_cents: 3000000, amount_cents: 3000000, milestone_id: milestoneOne, time_entry_ids: [] },
      { id: "00000000-0000-4000-8000-000000000512", invoice_id: invoiceSent, description: "Approved engineering time", quantity: "7.00", unit_cents: 60000, amount_cents: 420000, milestone_id: null, time_entry_ids: [] },
    ],
    payments: [
      { id: "00000000-0000-4000-8000-000000000521", invoice_id: invoicePaid, amount_cents: 3000000, paid_on: date(20), method: "bank_transfer", reference: "BANK-4421", created_at: iso(20) },
      { id: "00000000-0000-4000-8000-000000000522", invoice_id: invoiceSent, amount_cents: 100000, paid_on: date(3), method: "card", reference: "CARD-1208", created_at: iso(3) },
    ],
    refunds: [],
    creditNotes: [],
    comments: [
      { id: "00000000-0000-4000-8000-000000000601", entity_type: "project", entity_id: project, author_id: projectManager, body: "Architecture review is complete. The implementation milestone is underway.", edited_at: null, created_at: iso(2) },
    ],
    approvals: [
      { id: "00000000-0000-4000-8000-000000000611", entity_type: "time_entry", entity_id: "00000000-0000-4000-8000-000000000452", title: "Approve implementation time · 3 hours", requested_by: teamMember, approver_id: projectManager, status: "pending", decision_note: null, created_at: iso(1) },
    ],
    notifications: [
      { id: "00000000-0000-4000-8000-000000000621", kind: "task.updated", title: "Payment orchestration is in progress", entity_type: "task", entity_id: taskTwo, is_read: false, created_at: iso(1) },
      { id: "00000000-0000-4000-8000-000000000622", kind: "invoice.overdue", title: "Invoice INV-2026-0002 is overdue", entity_type: "invoice", entity_id: invoiceSent, is_read: false, created_at: iso(2) },
    ],
    files: [],
    invites: [],
    webhooks: [],
    deliveries: [],
    flags: [
      { key: "assistant", description: "Enable the keyword assistant", enabled: true, rollout_percent: 100, effective_for_me: true },
      { key: "client_portal", description: "Enable client portal workflows", enabled: true, rollout_percent: 100, effective_for_me: true },
      { key: "advanced_billing", description: "Enable advanced billing adjustments", enabled: true, rollout_percent: 100, effective_for_me: true },
    ],
    audit: [],
    idempotency: {},
    mfa: {},
  };
}
