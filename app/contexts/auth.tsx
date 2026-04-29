"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { demoAccounts } from "@/app/data/mock";   // Ensure this path is correct
import { User, Tenant } from "@/app/types/index";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  // NEW: Added signup method to create new accounts
  signup: (email: string, password: string, name: string, businessName: string, businessType: "appointment" | "ordering") => Promise<{ success: boolean; error?: string; user?: User }>;
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
        } catch {
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

  // NEW: Signup method to create new user accounts and businesses
  const signup = async (email: string, password: string, name: string, businessName: string, businessType: "appointment" | "ordering") => {
    setIsLoading(true);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if email already exists in demo accounts or registered users
    const existingUser = demoAccounts.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      setIsLoading(false);
      return { success: false, error: "Email already registered. Please use a different email." };
    }

    // Check registered users in localStorage
    try {
      const registeredUsers = localStorage.getItem("registered_users");
      if (registeredUsers) {
        const users: Array<{email: string; password: string; name: string; tenantId: string}> = JSON.parse(registeredUsers);
        if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
          setIsLoading(false);
          return { success: false, error: "Email already registered. Please use a different email." };
        }
      }
    } catch {
      console.log("Error checking registered users");
    }

    // Validate password
    if (password.length < 6) {
      setIsLoading(false);
      return { success: false, error: "Password must be at least 6 characters." };
    }

    // Create new tenant
    const tenantId = `tenant-${Date.now()}`;
    const newTenant: Tenant = {
      id: tenantId,
      name: businessName,
      slug: businessName.toLowerCase().replace(/\s+/g, "-"),
      businessType: businessType,
      logo: name.charAt(0).toUpperCase(),
      logoBg: "#8b5cf6",
      description: `Welcome to ${businessName}! We're excited to serve you.`,
      phone: "",
      email: email,
      address: "",
      city: "",
      coverImage: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=80",
      businessHours: [
        { day: "Monday", open: "09:00", close: "18:00", closed: false },
        { day: "Tuesday", open: "09:00", close: "18:00", closed: false },
        { day: "Wednesday", open: "09:00", close: "18:00", closed: false },
        { day: "Thursday", open: "09:00", close: "18:00", closed: false },
        { day: "Friday", open: "09:00", close: "18:00", closed: false },
        { day: "Saturday", open: "10:00", close: "16:00", closed: false },
        { day: "Sunday", open: "", close: "", closed: true },
      ],
      socialLinks: {},
      primaryColor: "#8b5cf6",
      accentColor: "#a78bfa",
      createdAt: new Date().toISOString().split('T')[0],
      isActive: true,
      plan: "starter",
      stripeConnected: false,
      subscriptionStatus: "trial",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    // Create new user
    const newUser: User = {
      id: email,
      email: email,
      name: name,
      role: "owner",
      tenantId: tenantId,
      avatar: name.charAt(0).toUpperCase(),
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: new Date().toISOString().split('T')[0],
    };

    // Save registered user
    try {
      const existingUsers = localStorage.getItem("registered_users");
      const users: Array<{email: string; password: string; name: string; tenantId: string}> = existingUsers ? JSON.parse(existingUsers) : [];
      users.push({ email, password, name, tenantId });
      localStorage.setItem("registered_users", JSON.stringify(users));
    } catch {
      console.log("Error saving registered user");
    }

    // Save tenant
    try {
      const existingTenants = localStorage.getItem("custom_tenants");
      const tenants: Tenant[] = existingTenants ? JSON.parse(existingTenants) : [];
      tenants.push(newTenant);
      localStorage.setItem("custom_tenants", JSON.stringify(tenants));
    } catch {
      console.log("Error saving tenant");
    }

    // NEW: Emit realtime event for new tenant creation (so it shows in All Businesses)
    try {
      const realtimeEvents = localStorage.getItem("realtime_events");
      // ENHANCED: Changed to emit tenant_created instead of user_registered
      // This allows getTenantTenants() to find the new business
      const events: Array<{type: string; tenant: Tenant; user?: User}> = realtimeEvents ? JSON.parse(realtimeEvents) : [];
      events.unshift({
        type: "tenant_created",
        tenant: newTenant,
        user: newUser,
      });
      localStorage.setItem("realtime_events", JSON.stringify(events));
    } catch {
      console.log("Error emitting realtime event");
    }

    setUser(newUser);
    localStorage.setItem("user", JSON.stringify(newUser));
    setIsLoading(false);
    return { success: true, user: newUser };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
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
      signup: async () => ({ success: false, error: "Server-side" }),
      logout: () => {},
      isLoading: false,
    };
  }

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}