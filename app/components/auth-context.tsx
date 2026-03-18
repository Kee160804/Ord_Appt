// "use client";

// import { createContext, useContext, useState, useEffect, ReactNode } from "react";
// import { mockUsers, mockTenants, demoAccounts } from "../data/mock";
// import type { User, Tenant } from "../types/index";

// interface AuthContextType {
//   user: User | null;
//   tenant: Tenant | null;
//   login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
//   logout: () => void;
//   switchTenant: (tenantId: string) => void;
//   isLoading: boolean;
// }

// const AuthContext = createContext<AuthContextType | null>(null);

// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [user, setUser] = useState<User | null>(null);
//   const [tenant, setTenant] = useState<Tenant | null>(null);
//   const [isLoading, setIsLoading] = useState(true);

//   useEffect(() => {
//     // Restore session from localStorage
//     const stored = typeof window !== "undefined" ? localStorage.getItem("ls_session") : null;
//     if (stored) {
//       try {
//         const { userId, tenantId } = JSON.parse(stored);
//         const foundUser = mockUsers.find(u => u.id === userId) ?? null;
//         const foundTenant = tenantId ? mockTenants.find(t => t.id === tenantId) ?? null : null;
//         setUser(foundUser);
//         setTenant(foundTenant);
//       } catch { /* ignore */ }
//     }
//     setIsLoading(false);
//   }, []);

//   const login = async (email: string, _password: string): Promise<{ success: boolean; error?: string }> => {
//     await new Promise(r => setTimeout(r, 800));
//     const account = demoAccounts.find(a => a.email.toLowerCase() === email.toLowerCase());
//     if (!account) return { success: false, error: "Invalid email or password" };

//     const foundUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null;
//     if (!foundUser) return { success: false, error: "User not found" };

//     const foundTenant = account.tenantId ? mockTenants.find(t => t.id === account.tenantId) ?? null : null;

//     setUser(foundUser);
//     setTenant(foundTenant);

//     if (typeof window !== "undefined") {
//       localStorage.setItem("ls_session", JSON.stringify({ userId: foundUser.id, tenantId: account.tenantId }));
//     }
//     return { success: true };
//   };

//   const logout = () => {
//     setUser(null);
//     setTenant(null);
//     if (typeof window !== "undefined") localStorage.removeItem("ls_session");
//   };

//   const switchTenant = (tenantId: string) => {
//     const found = mockTenants.find(t => t.id === tenantId) ?? null;
//     setTenant(found);
//     if (user && typeof window !== "undefined") {
//       localStorage.setItem("ls_session", JSON.stringify({ userId: user.id, tenantId }));
//     }
//   };

//   return (
//     <AuthContext.Provider value={{ user, tenant, login, logout, switchTenant, isLoading }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
//   return ctx;
// }




























"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { mockUsers, mockTenants, demoAccounts } from "../data/mock";
import type { User, Tenant } from "../types/index";

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchTenant: (tenantId: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("ls_session") : null;
    if (stored) {
      try {
        const { userId, tenantId } = JSON.parse(stored);
        const foundUser = mockUsers.find(u => u.id === userId) ?? null;
        const foundTenant = tenantId ? mockTenants.find(t => t.id === tenantId) ?? null : null;
        setUser(foundUser);
        setTenant(foundTenant);
      } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, _password: string): Promise<{ success: boolean; error?: string }> => {
    await new Promise(r => setTimeout(r, 900));
    const account = demoAccounts.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (!account) return { success: false, error: "No account found with that email." };
    const foundUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null;
    if (!foundUser) return { success: false, error: "User not found." };
    const foundTenant = account.tenantId ? mockTenants.find(t => t.id === account.tenantId) ?? null : null;
    setUser(foundUser);
    setTenant(foundTenant);
    if (typeof window !== "undefined") {
      localStorage.setItem("ls_session", JSON.stringify({ userId: foundUser.id, tenantId: account.tenantId ?? null }));
    }
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setTenant(null);
    if (typeof window !== "undefined") localStorage.removeItem("ls_session");
  };

  const switchTenant = (tenantId: string) => {
    const found = mockTenants.find(t => t.id === tenantId) ?? null;
    setTenant(found);
    if (user && typeof window !== "undefined") {
      localStorage.setItem("ls_session", JSON.stringify({ userId: user.id, tenantId }));
    }
  };

  return (
    <AuthContext.Provider value={{ user, tenant, login, logout, switchTenant, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}