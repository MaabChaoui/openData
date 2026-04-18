import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Crown, Eye, Users } from "lucide-react";
import {
  ApiError,
  bootstrap,
  clearStoredSession,
  getCurrentUser,
  getStoredSession,
  login,
  logout as apiLogout,
  setStoredSession,
  type BackendRole,
  type SessionUser,
  type StoredSession,
} from "@/lib/backend-api";

export type Role = "admin" | "hr" | "viewer";

export interface RoleInfo {
  key: Role;
  backendRole: BackendRole | "GUEST";
  label: string;
  user: string;
  icon: typeof Crown;
  description: string;
}

export const ROLES: Record<Role, RoleInfo> = {
  admin: {
    key: "admin",
    backendRole: "ADMIN",
    label: "Administration",
    user: "Administrateur",
    icon: Crown,
    description: "Import, calcul, validation, audit et gestion des comptes.",
  },
  hr: {
    key: "hr",
    backendRole: "HR",
    label: "Ressources humaines",
    user: "Utilisateur RH",
    icon: Users,
    description: "Lecture, audit et administration des utilisateurs.",
  },
  viewer: {
    key: "viewer",
    backendRole: "VIEWER",
    label: "Lecture seule",
    user: "Observateur",
    icon: Eye,
    description: "Consultation des documents, runs, tableaux de bord et bilans.",
  },
};

const GUEST_INFO: RoleInfo = {
  key: "viewer",
  backendRole: "GUEST",
  label: "Non connecté",
  user: "Invité",
  icon: Eye,
  description: "Authentification requise pour accéder aux données backend.",
};

function mapRole(role?: BackendRole): Role {
  if (role === "ADMIN") return "admin";
  if (role === "HR") return "hr";
  return "viewer";
}

function infoForUser(user: SessionUser | null): RoleInfo {
  if (!user) return GUEST_INFO;
  const base = ROLES[mapRole(user.role)];
  return {
    ...base,
    user: user.username,
  };
}

interface Ctx {
  role: Role;
  info: RoleInfo;
  user: SessionUser | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  bootstrap: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
  can: (action: "edit" | "validate" | "export" | "import" | "viewAudit" | "manageUsers") => boolean;
}

const RoleContext = createContext<Ctx | null>(null);

function buildSession(next: StoredSession, user?: SessionUser | null) {
  return {
    ...next,
    user: user ?? next.user,
  };
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const stored = getStoredSession();
      if (!stored) {
        if (active) {
          setSession(null);
          setInitializing(false);
        }
        return;
      }

      try {
        const user = await getCurrentUser();
        const next = buildSession(stored, user);
        setStoredSession(next);
        if (active) setSession(next);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearStoredSession();
          if (active) setSession(null);
        } else if (active) {
          setSession(stored);
        }
      } finally {
        if (active) setInitializing(false);
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  const refreshIdentity = async () => {
    const stored = getStoredSession();
    if (!stored) {
      setSession(null);
      return;
    }
    const user = await getCurrentUser();
    const next = buildSession(stored, user);
    setStoredSession(next);
    setSession(next);
  };

  const handleLogin = async (username: string, password: string) => {
    const next = await login(username, password);
    setSession(next);
  };

  const handleBootstrap = async (username: string, password: string) => {
    const next = await bootstrap(username, password);
    setSession(next);
  };

  const handleLogout = async () => {
    await apiLogout();
    setSession(null);
  };

  const role = mapRole(session?.user.role);
  const info = infoForUser(session?.user ?? null);
  const can = (action: Parameters<Ctx["can"]>[0]) => {
    const matrix: Record<Role, Record<typeof action, boolean>> = {
      admin: { edit: true, validate: true, export: true, import: true, viewAudit: true, manageUsers: true },
      hr: { edit: false, validate: false, export: true, import: false, viewAudit: true, manageUsers: true },
      viewer: { edit: false, validate: false, export: true, import: false, viewAudit: false, manageUsers: false },
    };
    return matrix[role][action];
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        info,
        user: session?.user ?? null,
        isAuthenticated: Boolean(session?.accessToken),
        initializing,
        login: handleLogin,
        bootstrap: handleBootstrap,
        logout: handleLogout,
        refreshIdentity,
        can,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
