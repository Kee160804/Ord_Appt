"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { demoAccounts } from "@/app/data/mock";
import {
  findUserRecordByEmail,
  getUserByEmail,
  getUserById,
  saveStoredUserRecord,
  saveStoredTenant,
  getAllTenants,
} from "@/app/lib/data";
import { isSupabaseEnabled } from "@/app/lib/supabase";
import { supabaseLogin, supabaseSignup } from "@/app/services/authService";
import type { User, Tenant, BusinessType } from "@/app/types/index";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (
    email: string,
    password: string,
    name: string,
    businessName: string,
    businessType: BusinessType,
    city: string,
    phone: string,
    slug: string,
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_KEY = "ls_session";

interface SessionData {
  userId: string;
  user?: User;
}

function parseSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(SESSION_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as SessionData;
    return typeof parsed?.userId === "string" ? parsed : null;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function getInitialUser(): User | null {
  const session = parseSession();
  if (!session) return null;
  if (session.user && typeof session.user.id === "string" && typeof session.user.email === "string") {
    return session.user;
  }
  return getUserById(session.userId);
}

function saveSession(user: User) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, user }));
}

function createUniqueSlug(initial: string) {
  const baseSlug = initial
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const existing = getAllTenants().map((t) => t.slug.toLowerCase());
  if (!existing.includes(baseSlug)) return baseSlug;
  let suffix = 1;
  while (existing.includes(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseSlug}-${suffix}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getInitialUser);

  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const normalizedEmail = email.trim().toLowerCase();

    if (isSupabaseEnabled()) {
      const authResult = await supabaseLogin(normalizedEmail, password);
      if (!authResult.user) {
        setIsLoading(false);
        return { success: false, error: authResult.error ?? "Invalid email or password." };
      }

      setUser(authResult.user);
      saveSession(authResult.user);
      setIsLoading(false);
      return { success: true };
    }

    const storedUser = findUserRecordByEmail(normalizedEmail);

    if (storedUser) {
      if (storedUser.password !== password) {
        setIsLoading(false);
        return { success: false, error: "Invalid email or password." };
      }

      const userData: User = {
        id: storedUser.id,
        email: storedUser.email,
        name: storedUser.name,
        role: storedUser.role,
        tenantId: storedUser.tenantId,
        avatar: storedUser.avatar,
        createdAt: storedUser.createdAt,
        lastLogin: new Date().toISOString().split("T")[0],
      };

      saveStoredUserRecord({ ...storedUser, lastLogin: userData.lastLogin });
      setUser(userData);
      saveSession(userData);
      setIsLoading(false);
      return { success: true };
    }

    const account = demoAccounts.find(
      (a) => a.email.toLowerCase() === normalizedEmail && a.password === password,
    );

    if (!account) {
      setIsLoading(false);
      return { success: false, error: "Invalid email or password." };
    }

    const demoUser = getUserByEmail(account.email);
    if (!demoUser) {
      setIsLoading(false);
      return { success: false, error: "Account not found." };
    }

    const userData: User = {
      ...demoUser,
      lastLogin: new Date().toISOString().split("T")[0],
    };

    setUser(userData);
    saveSession(userData);
    setIsLoading(false);
    return { success: true };
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    businessName: string,
    businessType: BusinessType,
    city: string,
    phone: string,
    slug: string,
  ) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const normalizedEmail = email.trim().toLowerCase();
    if (
      findUserRecordByEmail(normalizedEmail) ||
      demoAccounts.some((a) => a.email.toLowerCase() === normalizedEmail)
    ) {
      setIsLoading(false);
      return { success: false, error: "Email already registered. Please use a different email." };
    }

    if (password.length < 6) {
      setIsLoading(false);
      return { success: false, error: "Password must be at least 6 characters." };
    }

    if (isSupabaseEnabled()) {
      const authResult = await supabaseSignup(
        normalizedEmail,
        password,
        name,
        businessName,
        businessType,
        city,
        phone,
        slug,
      );

      if (!authResult.user) {
        setIsLoading(false);
        return { success: false, error: authResult.error ?? "Unable to create account." };
      }

      setUser(authResult.user);
      saveSession(authResult.user);
      setIsLoading(false);
      return { success: true, user: authResult.user };
    }

    const tenantSlug = createUniqueSlug(slug.trim() || businessName);
    const tenantId = `tenant-${Date.now()}`;

    const newTenant: Tenant = {
      id: tenantId,
      name: businessName.trim(),
      slug: tenantSlug,
      businessType,
      logo: businessName.trim().charAt(0).toUpperCase() || "B",
      logoBg: "#8b5cf6",
      description: `Welcome to ${businessName.trim()}! We're excited to serve you.`,
      phone: phone.trim(),
      email: normalizedEmail,
      address: "",
      city: city.trim(),
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
      createdAt: new Date().toISOString().split("T")[0],
      isActive: true,
      plan: "starter",
      stripeConnected: false,
      subscriptionStatus: "trial",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    };

    const newUser: User = {
      id: normalizedEmail,
      email: normalizedEmail,
      name: name.trim(),
      role: "owner",
      tenantId,
      avatar: name.trim().charAt(0).toUpperCase() || "U",
      createdAt: new Date().toISOString().split("T")[0],
      lastLogin: new Date().toISOString().split("T")[0],
    };

    saveStoredTenant(newTenant);
    saveStoredUserRecord({
      id: newUser.id,
      email: newUser.email,
      password,
      name: newUser.name,
      role: newUser.role,
      tenantId: newUser.tenantId,
      avatar: newUser.avatar,
      createdAt: newUser.createdAt,
      lastLogin: newUser.lastLogin,
    });

    setUser(newUser);
    saveSession(newUser);
    setIsLoading(false);
    return { success: true, user: newUser };
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem("user");
    }
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