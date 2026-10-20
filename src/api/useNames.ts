import { useUsers } from "./hooks";

/** Resolve a user id to a display name using the (cached) team list. */
export function useNames() {
  const users = useUsers();
  return (id: string | null | undefined) => (id ? users.data?.items.find((u) => u.id === id)?.full_name ?? "Someone" : "—");
}
