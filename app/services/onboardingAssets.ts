"use client";

import type { Tenant } from "@/app/types";
import { uploadBusinessLogo } from "@/app/services/settingsService";

const DATABASE_NAME = "yuhbusiness-onboarding";
const STORE_NAME = "pending-business-assets";
const DATABASE_VERSION = 1;
const logoApplicationByEmail = new Map<string, Promise<Tenant>>();

interface PendingBusinessAssets {
  email: string;
  logo: File;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "email" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function queuePendingBusinessLogo(email: string, logo: File) {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const record: PendingBusinessAssets = {
    email: email.trim().toLowerCase(),
    logo,
  };
  await runRequest("readwrite", (store) => store.put(record));
}

async function applyPendingBusinessLogoOnce(email: string, tenant: Tenant) {
  if (typeof window === "undefined" || !window.indexedDB) return tenant;
  const key = email.trim().toLowerCase();
  const pending = await runRequest<PendingBusinessAssets | undefined>(
    "readonly",
    (store) => store.get(key),
  );
  if (!pending?.logo) return tenant;

  const logoImage = await uploadBusinessLogo(tenant.id, pending.logo);
  await runRequest("readwrite", (store) => store.delete(key));
  return { ...tenant, logoImage };
}

export function applyPendingBusinessLogo(email: string, tenant: Tenant) {
  const key = email.trim().toLowerCase();
  const activeApplication = logoApplicationByEmail.get(key);
  if (activeApplication) return activeApplication;

  const application = applyPendingBusinessLogoOnce(key, tenant).finally(() => {
    logoApplicationByEmail.delete(key);
  });
  logoApplicationByEmail.set(key, application);
  return application;
}
