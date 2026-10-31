import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, refreshSession, setAccessToken, setSessionLostHandler } from "../api/client";
import type { LoginResult, User } from "../api/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ mfaToken?: string }>;
  verifyMfa: (token: string, code: string) => Promise<void>;
  signup: (b: {
    organization_name: string;
    full_name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  acceptInvite: (b: { token: string; full_name: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const loadMe = useCallback(async () => {
    setUser(await api<User>("/auth/me"));
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => {
      setUser(null);
      qc.clear();
    });
    (async () => {
      if (await refreshSession()) {
        try {
          await loadMe();
        } catch {
          /* fall through to login */
        }
      }
      setLoading(false);
    })();
  }, [loadMe, qc]);

  const finish = async (token: string) => {
    setAccessToken(token);
    await loadMe();
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const r = await api<LoginResult>("/auth/login", { body: { email, password }, auth: false });
        if (r.mfa_required) return { mfaToken: r.mfa_pending_token! };
        await finish(r.access_token!);
        return {};
      },
      async verifyMfa(token, code) {
        const r = await api<{ access_token: string }>("/auth/mfa/verify", {
          body: { mfa_pending_token: token, code },
          auth: false,
        });
        await finish(r.access_token);
      },
      async signup(b) {
        const r = await api<{ access_token: string }>("/auth/signup", { body: b, auth: false });
        await finish(r.access_token);
      },
      async acceptInvite(b) {
        const r = await api<{ access_token: string }>("/invites/accept", { body: b, auth: false });
        await finish(r.access_token);
      },
      async logout() {
        try {
          await api("/auth/logout", { method: "POST" });
        } catch {
          /* cookie may already be gone */
        }
        setAccessToken(null);
        setUser(null);
        qc.clear();
      },
      reload: loadMe,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }),
    [user, loading, loadMe, qc],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
