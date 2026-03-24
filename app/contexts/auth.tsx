"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { demoAccounts } from "@/app/data/mock";   // Ensure this path is correct
import { User } from "@/app/types/index";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initializer – runs only once when the component mounts on the client
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          localStorage.removeItem("user");
        }
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    // Simulate network delay – replace with real API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const account = demoAccounts.find(
      a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );

    if (!account) {
      setIsLoading(false);
      return { success: false, error: "Invalid email or password." };
    }

    // Build user object – adjust fields to match your User type
    const userData: User = {
      id: account.email,                     // Using email as a unique ID
      email: account.email,
      name: account.label,                    // Display name from mock
      role: account.role,
      tenantId: account.tenantId,
      avatar: account.label.charAt(0).toUpperCase(),
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: new Date().toISOString().split('T')[0],
    };

    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    setIsLoading(false);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  // Safe fallback for server-side rendering (if the hook is called on the server)
  if (typeof window === "undefined") {
    return {
      user: null,
      login: async () => ({ success: false, error: "Server-side" }),
      logout: () => {},
      isLoading: false,
    };
  }

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}