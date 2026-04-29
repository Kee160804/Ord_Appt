"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { Product, Appointment, Order, User, Tenant } from "@/app/types/index";

// NEW: Realtime event types for tracking real-time updates
type RealtimeEvent = 
  | { type: "product_added"; tenantId: string; product: Product }
  | { type: "product_updated"; tenantId: string; product: Product }
  | { type: "product_deleted"; tenantId: string; productId: string }
  | { type: "appointment_created"; tenantId: string; appointment: Appointment }
  | { type: "appointment_updated"; tenantId: string; appointment: Appointment }
  | { type: "order_created"; tenantId: string; order: Order }
  | { type: "order_updated"; tenantId: string; order: Order }
  | { type: "user_registered"; user: User; tenant: Tenant }
  | { type: "tenant_created"; tenant: Tenant };

interface RealtimeContextType {
  events: RealtimeEvent[];
  addEvent: (event: RealtimeEvent) => void;
  getEventsByTenant: (tenantId: string) => RealtimeEvent[];
  clearEvents: () => void;
  getTenantTenants: () => Tenant[];
  getAllRegisteredUsers: () => User[];
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  // NEW: Store all real-time events in state
  const [events, setEvents] = useState<RealtimeEvent[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("realtime_events");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // NEW: Add a new real-time event and persist to localStorage
  const addEvent = useCallback((event: RealtimeEvent) => {
    setEvents((prev) => {
      const updated = [event, ...prev]; // Add to front for most recent first
      localStorage.setItem("realtime_events", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // NEW: Get all events for a specific tenant
  const getEventsByTenant = useCallback((tenantId: string) => {
    return events.filter((event) => {
      if (event.type === "user_registered" || event.type === "tenant_created") {
        return false;
      }
      return ("tenantId" in event && event.tenantId === tenantId);
    });
  }, [events]);

  // NEW: Get all tenants that have been created/registered
  const getTenantTenants = useCallback(() => {
    const tenants: Tenant[] = [];
    const seenIds = new Set<string>();
    
    events.forEach((event) => {
      if (event.type === "tenant_created" && !seenIds.has(event.tenant.id)) {
        tenants.push(event.tenant);
        seenIds.add(event.tenant.id);
      }
    });
    
    return tenants;
  }, [events]);

  // NEW: Get all users that have registered
  const getAllRegisteredUsers = useCallback(() => {
    const users: User[] = [];
    const seenIds = new Set<string>();
    
    events.forEach((event) => {
      if (event.type === "user_registered" && !seenIds.has(event.user.id)) {
        users.push(event.user);
        seenIds.add(event.user.id);
      }
    });
    
    return users;
  }, [events]);

  // NEW: Clear all events (for testing/reset)
  const clearEvents = useCallback(() => {
    setEvents([]);
    localStorage.setItem("realtime_events", JSON.stringify([]));
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        events,
        addEvent,
        getEventsByTenant,
        clearEvents,
        getTenantTenants,
        getAllRegisteredUsers,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return context;
}
