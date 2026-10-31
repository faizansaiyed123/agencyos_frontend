import type { Role } from "./types";

// Mirror of backend/app/core/permissions.py. The server is the authority;
// this only decides which controls to show.
export type Perm =
  | "user:read"
  | "user:invite"
  | "user:manage"
  | "audit:read"
  | "client:read"
  | "client:manage"
  | "deal:read"
  | "deal:manage"
  | "proposal:read"
  | "proposal:manage"
  | "project:read"
  | "project:manage"
  | "task:update"
  | "time:log"
  | "time:read_all"
  | "time:approve"
  | "invoice:read"
  | "invoice:manage"
  | "comment:write"
  | "approval:manage"
  | "file:read"
  | "file:write"
  | "report:read"
  | "webhook:manage"
  | "flag:manage"
  | "privacy:manage";

const ALL: Perm[] = [
  "user:read",
  "user:invite",
  "user:manage",
  "audit:read",
  "client:read",
  "client:manage",
  "deal:read",
  "deal:manage",
  "proposal:read",
  "proposal:manage",
  "project:read",
  "project:manage",
  "task:update",
  "time:log",
  "time:read_all",
  "time:approve",
  "invoice:read",
  "invoice:manage",
  "comment:write",
  "approval:manage",
  "file:read",
  "file:write",
  "report:read",
  "webhook:manage",
  "flag:manage",
  "privacy:manage",
];
const COLLAB: Perm[] = ["comment:write", "file:read", "file:write"];

const MATRIX: Record<Role, Perm[]> = {
  owner: ALL,
  admin: ALL,
  account_manager: [
    "user:read",
    "client:read",
    "client:manage",
    "deal:read",
    "deal:manage",
    "proposal:read",
    "proposal:manage",
    "project:read",
    "invoice:read",
    "report:read",
    "time:log",
    "approval:manage",
    ...COLLAB,
  ],
  project_manager: [
    "user:read",
    "client:read",
    "deal:read",
    "proposal:read",
    "project:read",
    "project:manage",
    "task:update",
    "time:log",
    "time:read_all",
    "time:approve",
    "report:read",
    "approval:manage",
    ...COLLAB,
  ],
  team_member: ["user:read", "client:read", "project:read", "task:update", "time:log", ...COLLAB],
  finance: [
    "user:read",
    "client:read",
    "deal:read",
    "proposal:read",
    "project:read",
    "time:read_all",
    "time:approve",
    "invoice:read",
    "invoice:manage",
    "report:read",
    "comment:write",
    "file:read",
  ],
  client: [],
};

export const can = (role: Role | undefined, perm: Perm) => !!role && MATRIX[role].includes(perm);

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  account_manager: "Account manager",
  project_manager: "Project manager",
  team_member: "Team member",
  finance: "Finance",
  client: "Client",
};
export const INVITABLE_ROLES: Role[] = [
  "admin",
  "account_manager",
  "project_manager",
  "team_member",
  "finance",
  "client",
];
