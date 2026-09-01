"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { demoAccounts } from "@/app/data/mock";
import {
  findUserRecordByEmail,
  getAllTenants,
  getUserByEmail,
  getUserById,
  getTenantById,
  saveStoredTenant,
  saveStoredUserRecord,
} from "@/app/lib/data";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import {
  isDemoModeEnabled,
  isSupabaseConfigured,
  missingSupabaseConfigMessage,
} from "@/app/lib/supabase/config";
import {
  loadAuthenticatedAppSession,
  supabaseLogin,
  supabaseLogout,
  supabaseSignup,
} from "@/app/services/authService";
import type { BusinessType, Tenant, User } from "@/app/types/index";

interface AuthActionResult {
  success: boolean;
  error?: string;
  user?: User;
  requiresEmailConfirmation?: boolean;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  updateTenant: (updatedTenant: Tenant) => void;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthActionResult>;
  signup: (
    email: string,
    password: string,
    name: string,
    businessName: string,
    businessType: BusinessType,
    city: string,
    phone: string,
    slug: string,
  ) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEMO_SESSION_KEY = "ls_demo_session";
const SESSION_PREFERENCE_KEY = "ls_session_preference";
const SESSION_TAB_KEY = "ls_session_tab_active";

function getDemoSessionUser() {
  if (!isDemoModeEnabled()) return null;
  const userId = window.sessionStorage.getItem(DEMO_SESSION_KEY)
    ?? window.localStorage.getItem(DEMO_SESSION_KEY);
  return userId ? getUserById(userId) : null;
}

function saveSessionPreference(rememberMe: boolean) {
  window.localStorage.setItem(SESSION_PREFERENCE_KEY, rememberMe ? "persistent" : "session");
  if (rememberMe) window.sessionStorage.removeItem(SESSION_TAB_KEY);
  else window.sessionStorage.setItem(SESSION_TAB_KEY, "true");
}

function saveDemoSession(user: User, rememberMe = true) {
  window.localStorage.removeItem(DEMO_SESSION_KEY);
  window.sessionStorage.removeItem(DEMO_SESSION_KEY);
  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  storage.setItem(DEMO_SESSION_KEY, user.id);
}

function createUniqueSlug(initial: string) {
  const baseSlug = initial
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const existing = getAllTenants().map((tenant) => tenant.slug.toLowerCase());
  if (!existing.includes(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existing.includes(`${baseSlug}-${suffix}`)) suffix += 1;
  return `${baseSlug}-${suffix}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      const frame = window.requestAnimationFrame(() => {
        const demoUser = getDemoSessionUser();
        setUser(demoUser);
        setTenant(
          demoUser?.tenantId ? getTenantById(demoUser.tenantId) ?? null : null,
        );
        setIsLoading(false);
      });

      return () => window.cancelAnimationFrame(frame);
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const frame = window.requestAnimationFrame(() => setIsLoading(false));
      return () => window.cancelAnimationFrame(frame);
    }
    let active = true;

    const hydrate = async () => {
      const sessionOnly = window.localStorage.getItem(SESSION_PREFERENCE_KEY) === "session";
      const sameTabSession = window.sessionStorage.getItem(SESSION_TAB_KEY) === "true";
      if (sessionOnly && !sameTabSession) {
        await supabase.auth.signOut({ scope: "local" });
        if (!active) return;
        setUser(null);
        setTenant(null);
        setIsLoading(false);
        return;
      }
      const result = await loadAuthenticatedAppSession();
      if (!active) return;
      setUser(result.user ?? null);
      setTenant(result.tenant ?? null);
      setIsLoading(false);
    };

    void hydrate();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setTenant(null);
        setIsLoading(false);
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        window.setTimeout(() => void hydrate(), 0);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string, rememberMe = true): Promise<AuthActionResult> => {
    setIsLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured()) {
      const result = await supabaseLogin(normalizedEmail, password);
      setIsLoading(false);
      if (!result.user) return { success: false, error: result.error ?? "Unable to sign in." };

      saveSessionPreference(rememberMe);
      setUser(result.user);
      setTenant(result.tenant ?? null);
      return { success: true, user: result.user };
    }

    if (!isDemoModeEnabled()) {
      setIsLoading(false);
      return { success: false, error: missingSupabaseConfigMessage };
    }

    const account = demoAccounts.find(
      (candidate) =>
        candidate.email.toLowerCase() === normalizedEmail && candidate.password === password,
    );
    const demoUser = account ? getUserByEmail(account.email) : null;
    if (!demoUser) {
      setIsLoading(false);
      return {
        success: false,
        error: findUserRecordByEmail(normalizedEmail)
          ? "Local demo signups do not store passwords. Use Supabase or a built-in demo account to sign in again."
          : "Invalid email or password.",
      };
    }

    setUser(demoUser);
    setTenant(demoUser.tenantId ? getTenantById(demoUser.tenantId) ?? null : null);
    saveDemoSession(demoUser, rememberMe);
    setIsLoading(false);
    return { success: true, user: demoUser };
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
  ): Promise<AuthActionResult> => {
    setIsLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 8) {
      setIsLoading(false);
      return { success: false, error: "Password must be at least 8 characters." };
    }

    if (isSupabaseConfigured()) {
      const result = await supabaseSignup(
        normalizedEmail,
        password,
        name,
        businessName,
        businessType,
        city,
        phone,
        slug,
      );
      setIsLoading(false);

      if (result.requiresEmailConfirmation) {
        return { success: true, requiresEmailConfirmation: true };
      }
      if (!result.user) return { success: false, error: result.error ?? "Unable to sign up." };

      setUser(result.user);
      setTenant(result.tenant ?? null);
      return { success: true, user: result.user };
    }

    if (!isDemoModeEnabled()) {
      setIsLoading(false);
      return { success: false, error: missingSupabaseConfigMessage };
    }
    if (findUserRecordByEmail(normalizedEmail)) {
      setIsLoading(false);
      return { success: false, error: "Email already registered." };
    }

    const tenantId = `tenant-${Date.now()}`;
    const tenantSlug = createUniqueSlug(slug || businessName);
    const createdAt = new Date().toISOString();
    const newTenant: Tenant = {
      id: tenantId,
      name: businessName.trim(),
      slug: tenantSlug,
      businessType,
      logo: businessName.trim().charAt(0).toUpperCase() || "B",
      logoBg: "#8b5cf6",
      description: `Welcome to ${businessName.trim()}!`,
      phone: phone.trim(),
      email: normalizedEmail,
      address: "",
      city: city.trim(),
      coverImage: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=80",
      businessHours: [],
      socialLinks: {},
      primaryColor: "#8b5cf6",
      accentColor: "#a78bfa",
      createdAt,
      isActive: true,
      plan: "starter",
      stripeConnected: false,
      subscriptionStatus: "trial",
      trialEndsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    };
    const newUser: User = {
      id: normalizedEmail,
      tenantId,
      name: name.trim(),
      email: normalizedEmail,
      role: "owner",
      avatar: name.trim().charAt(0).toUpperCase() || "U",
      createdAt,
      lastLogin: createdAt,
    };

    saveStoredTenant(newTenant);
    saveStoredUserRecord(newUser);
    saveDemoSession(newUser);
    setUser(newUser);
    setTenant(newTenant);
    setIsLoading(false);
    return { success: true, user: newUser };
  };

  const logout = async () => {
    setIsLoading(true);
    if (isSupabaseConfigured()) await supabaseLogout();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
      window.sessionStorage.removeItem(DEMO_SESSION_KEY);
      window.localStorage.removeItem(SESSION_PREFERENCE_KEY);
      window.sessionStorage.removeItem(SESSION_TAB_KEY);
    }
    setUser(null);
    setTenant(null);
    setIsLoading(false);
    router.push("/login");
  };

  const updateTenant = (updatedTenant: Tenant) => {
    setTenant((current) => (current?.id === updatedTenant.id ? updatedTenant : current));
  };

  return (
    <AuthContext.Provider value={{ user, tenant, updateTenant, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
