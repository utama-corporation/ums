"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  departmentName?: string | null;
  position?: string | null;
  roles: string[];
  permissions: string[];
}

interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await apiClient<SessionUser>("/me");
    setUser(res.success && res.data ? res.data : null);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await apiClient("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <SessionContext.Provider value={{ user, loading, refresh, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
