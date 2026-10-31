import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Client,
  Contact,
  Deal,
  DealHistory,
  Invite,
  Page,
  Proposal,
  ProposalWithItems,
  User,
  PortalInvoice,
  PortalOverview,
  PortalProject,
  PortalProposal,
  PortalProposalDetail,
} from "./types";

export const useClients = (includeArchived = false, enabled = true) =>
  useQuery({
    queryKey: ["clients", includeArchived],
    enabled,
    queryFn: () =>
      api<Page<Client>>("/clients", { query: { limit: 100, include_archived: includeArchived } }),
  });
export const useClient = (id: string) =>
  useQuery({ queryKey: ["client", id], queryFn: () => api<Client>(`/clients/${id}`) });
export const useContacts = (clientId: string) =>
  useQuery({
    queryKey: ["contacts", clientId],
    queryFn: () => api<Contact[]>(`/clients/${clientId}/contacts`),
  });

export const useDeals = (params: { stage?: string; client_id?: string } = {}, enabled = true) =>
  useQuery({
    queryKey: ["deals", params],
    enabled,
    queryFn: () => api<Page<Deal>>("/deals", { query: { limit: 100, ...params } }),
  });
export const useDeal = (id: string) =>
  useQuery({ queryKey: ["deal", id], queryFn: () => api<Deal>(`/deals/${id}`) });
export const useDealHistory = (id: string) =>
  useQuery({
    queryKey: ["deal-history", id],
    queryFn: () => api<DealHistory[]>(`/deals/${id}/history`),
  });

export const useProposals = (params: { deal_id?: string; status?: string } = {}, enabled = true) =>
  useQuery({
    queryKey: ["proposals", params],
    enabled,
    queryFn: () => api<Page<Proposal>>("/proposals", { query: { limit: 100, ...params } }),
  });
export const useProposal = (id: string) =>
  useQuery({
    queryKey: ["proposal", id],
    queryFn: () => api<ProposalWithItems>(`/proposals/${id}`),
  });

export const useUsers = (enabled = true) =>
  useQuery({
    queryKey: ["users"],
    enabled,
    queryFn: () => api<Page<User>>("/users", { query: { limit: 100 } }),
  });
export const useInvites = (enabled: boolean) =>
  useQuery({ queryKey: ["invites"], enabled, queryFn: () => api<Invite[]>("/invites") });

/** Mutation that invalidates the given query-key prefixes on success. */
export function useAction<TArgs, TOut = unknown>(
  fn: (a: TArgs) => Promise<TOut>,
  invalidate: string[] = [],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

// ---- projects, time, billing, collaboration, reports ----
import type {
  Approval,
  AttentionItem,
  Comment as Cmt,
  EntityType,
  FileAsset,
  FlagRow,
  Invoice,
  InvoiceDetail,
  Notification,
  Overview,
  PipelineReport,
  Project,
  ProjectDetail,
  ProjectHealth,
  RevenueMonth,
  SearchHit,
  Task,
  TimeEntry,
  UnbilledRow,
  UtilRow,
  WebhookDelivery,
  WebhookEndpoint,
} from "./types";

export const useProjects = (params: { status?: string; client_id?: string } = {}) =>
  useQuery({
    queryKey: ["projects", params],
    queryFn: () => api<Page<Project>>("/projects", { query: { limit: 100, ...params } }),
  });
export const useProject = (id: string) =>
  useQuery({ queryKey: ["project", id], queryFn: () => api<ProjectDetail>(`/projects/${id}`) });
export const useTasks = (projectId: string) =>
  useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => api<Task[]>(`/projects/${projectId}/tasks`),
  });
export const useMyTasks = () =>
  useQuery({ queryKey: ["tasks", "mine"], queryFn: () => api<Task[]>("/tasks/mine") });
export const useProjectHealth = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["health", id],
    enabled,
    queryFn: () => api<ProjectHealth>(`/reports/projects/${id}`),
  });

export const useTimer = () =>
  useQuery({
    queryKey: ["timer"],
    queryFn: () => api<TimeEntry | null>("/time/timer"),
    refetchInterval: 30_000,
  });
export const useTimeEntries = (params: Record<string, string | undefined> = {}, enabled = true) =>
  useQuery({
    queryKey: ["time", params],
    enabled,
    queryFn: () => api<TimeEntry[]>("/time/entries", { query: { limit: 100, ...params } }),
  });

export const useInvoices = (
  params: { status?: string; overdue?: boolean; client_id?: string } = {},
  enabled = true,
) =>
  useQuery({
    queryKey: ["invoices", params],
    enabled,
    queryFn: () => api<Page<Invoice>>("/invoices", { query: { limit: 100, ...params } }),
  });
export const useInvoice = (id: string) =>
  useQuery({ queryKey: ["invoice", id], queryFn: () => api<InvoiceDetail>(`/invoices/${id}`) });
export const useUnbilled = (projectId: string | null) =>
  useQuery({
    queryKey: ["unbilled", projectId],
    enabled: !!projectId,
    queryFn: () =>
      api<UnbilledRow[]>("/invoices/unbilled-time", { query: { project_id: projectId } }),
  });

export const useComments = (type: EntityType, id: string) =>
  useQuery({
    queryKey: ["comments", type, id],
    queryFn: () => api<Cmt[]>("/comments", { query: { entity_type: type, entity_id: id } }),
  });
export const useFiles = (type: EntityType, id: string) =>
  useQuery({
    queryKey: ["files", type, id],
    queryFn: () => api<FileAsset[]>("/files", { query: { entity_type: type, entity_id: id } }),
  });
export const useApprovals = (inbox: boolean) =>
  useQuery({
    queryKey: ["approvals", inbox],
    queryFn: () => api<Approval[]>("/approvals", { query: { inbox } }),
  });
export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Notification[]>("/notifications", { query: { limit: 30 } }),
  });
export const useUnread = () =>
  useQuery({
    queryKey: ["unread"],
    queryFn: () => api<{ unread: number }>("/notifications/unread-count"),
  });

export const useOverview = (enabled: boolean) =>
  useQuery({ queryKey: ["overview"], enabled, queryFn: () => api<Overview>("/reports/overview") });
export const useAttention = (enabled: boolean) =>
  useQuery({
    queryKey: ["attention"],
    enabled,
    queryFn: () => api<AttentionItem[]>("/reports/attention"),
  });
export const useRevenue = (enabled: boolean, months = 12) =>
  useQuery({
    queryKey: ["revenue", months],
    enabled,
    queryFn: () => api<RevenueMonth[]>("/reports/revenue", { query: { months } }),
  });
export const usePipelineReport = (enabled: boolean) =>
  useQuery({
    queryKey: ["pipeline-report"],
    enabled,
    queryFn: () => api<PipelineReport>("/reports/pipeline"),
  });
export const useUtilization = (enabled: boolean) =>
  useQuery({
    queryKey: ["utilization"],
    enabled,
    queryFn: () => api<UtilRow[]>("/reports/utilization"),
  });
export const useSearch = (q: string) =>
  useQuery({
    queryKey: ["search", q],
    enabled: q.trim().length >= 2,
    queryFn: () => api<SearchHit[]>("/search", { query: { q } }),
  });

export const useWebhooks = () =>
  useQuery({ queryKey: ["webhooks"], queryFn: () => api<WebhookEndpoint[]>("/webhooks") });
export const useWebhookEvents = () =>
  useQuery({ queryKey: ["webhook-events"], queryFn: () => api<string[]>("/webhooks/event-types") });
export const useDeliveries = (id: string | null) =>
  useQuery({
    queryKey: ["deliveries", id],
    enabled: !!id,
    queryFn: () => api<WebhookDelivery[]>(`/webhooks/${id}/deliveries`),
  });
export const useFlags = () =>
  useQuery({ queryKey: ["flags"], queryFn: () => api<FlagRow[]>("/flags") });
export const useMyFlags = () =>
  useQuery({ queryKey: ["flags-me"], queryFn: () => api<Record<string, boolean>>("/flags/me") });

export const usePortalOverview = () =>
  useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => api<PortalOverview>("/portal/overview"),
  });
export const usePortalProjects = () =>
  useQuery({
    queryKey: ["portal-projects"],
    queryFn: () => api<PortalProject[]>("/portal/projects"),
  });
export const usePortalProposals = () =>
  useQuery({
    queryKey: ["portal-proposals"],
    queryFn: () => api<PortalProposal[]>("/portal/proposals"),
  });
export const usePortalProposal = (id: string | null) =>
  useQuery({
    queryKey: ["portal-proposal", id],
    enabled: !!id,
    queryFn: () => api<PortalProposalDetail>(`/portal/proposals/${id}`),
  });
export const usePortalInvoices = () =>
  useQuery({
    queryKey: ["portal-invoices"],
    queryFn: () => api<PortalInvoice[]>("/portal/invoices"),
  });
