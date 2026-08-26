import { demoAccounts, mockTenants, mockUsers } from "@/app/data/mock";
import type { Tenant, User, UserRole } from "@/app/types/index";

const STORED_USERS_KEY = "registered_users";
const STORED_TENANTS_KEY = "custom_tenants";

export interface StoredUserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
  avatar: string;
  createdAt: string;
  lastLogin: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function parseStoredData<T>(key: string): T | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function getStoredUserRecords(): StoredUserRecord[] {
  const stored = parseStoredData<(StoredUserRecord & { password?: string })[]>(STORED_USERS_KEY) ?? [];
  const sanitized = stored.map((user) => {
    const sanitizedUser = { ...user };
    delete sanitizedUser.password;
    return sanitizedUser;
  });
  if (isBrowser() && stored.some((user) => "password" in user)) {
    window.localStorage.setItem(STORED_USERS_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
}

export function getStoredTenants(): Tenant[] {
  return parseStoredData<Tenant[]>(STORED_TENANTS_KEY) ?? [];
}

export function saveStoredUserRecord(user: StoredUserRecord) {
  if (!isBrowser()) return;
  const users = getStoredUserRecords();
  const existingIndex = users.findIndex((u) => u.id === user.id);
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.unshift(user);
  }
  window.localStorage.setItem(STORED_USERS_KEY, JSON.stringify(users));
}

export function saveStoredTenant(tenant: Tenant) {
  if (!isBrowser()) return;
  const tenants = getStoredTenants();
  const existingIndex = tenants.findIndex((t) => t.id === tenant.id);
  if (existingIndex >= 0) {
    tenants[existingIndex] = tenant;
  } else {
    tenants.unshift(tenant);
  }
  window.localStorage.setItem(STORED_TENANTS_KEY, JSON.stringify(tenants));
}

export function getAllUsers(): User[] {
  const storedUsers = getStoredUserRecords().map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    avatar: user.avatar,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  }));
  return [...mockUsers, ...storedUsers];
}

export function getAllTenants(): Tenant[] {
  return [...mockTenants, ...getStoredTenants()];
}

export function getTenantById(id: string): Tenant | undefined {
  return getAllTenants().find((tenant) => tenant.id === id);
}

export function getTenantBySlug(slug: string): Tenant | undefined {
  return getAllTenants().find((tenant) => tenant.slug === slug);
}

export function findUserRecordByEmail(email: string): StoredUserRecord | null {
  const normalized = email.trim().toLowerCase();
  return getStoredUserRecords().find((user) => user.email.toLowerCase() === normalized) ?? null;
}

export function getUserByEmail(email: string): User | null {
  const normalized = email.trim().toLowerCase();
  const stored = getStoredUserRecords().find((user) => user.email.toLowerCase() === normalized);
  if (stored) {
    return {
      id: stored.id,
      email: stored.email,
      name: stored.name,
      role: stored.role,
      tenantId: stored.tenantId,
      avatar: stored.avatar,
      createdAt: stored.createdAt,
      lastLogin: stored.lastLogin,
    };
  }
  const demoAccount = demoAccounts.find((account) => account.email.toLowerCase() === normalized);
  if (!demoAccount) return null;
  const existingUser = mockUsers.find((user) => user.email.toLowerCase() === normalized);
  if (existingUser) return existingUser;
  return {
    id: demoAccount.email,
    email: demoAccount.email,
    name: demoAccount.label,
    role: demoAccount.role,
    tenantId: demoAccount.tenantId,
    avatar: demoAccount.label.charAt(0).toUpperCase(),
    createdAt: new Date().toISOString().split("T")[0],
    lastLogin: new Date().toISOString().split("T")[0],
  };
}

export function getUserById(id: string): User | null {
  const normalized = id.trim().toLowerCase();
  const stored = getStoredUserRecords().find((user) => user.id.toLowerCase() === normalized);
  if (stored) {
    return {
      id: stored.id,
      email: stored.email,
      name: stored.name,
      role: stored.role,
      tenantId: stored.tenantId,
      avatar: stored.avatar,
      createdAt: stored.createdAt,
      lastLogin: stored.lastLogin,
    };
  }
  return mockUsers.find((user) => user.id.toLowerCase() === normalized) ?? null;
}

export function getTenantCount(): number {
  return getAllTenants().length;
}
