"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";

interface PrivacyRequestRecord {
  id: string;
  reference_code: string;
  request_type: string;
  relationship: string;
  requester_name: string;
  requester_email: string;
  business_reference: string | null;
  details: string;
  status: string;
  identity_status: string;
  target_due_at: string;
  resolution_notes: string | null;
  created_at: string;
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500 light:border-slate-300 light:bg-white light:text-slate-950";

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function AdminPrivacyRequests() {
  const [requests, setRequests] = useState<PrivacyRequestRecord[]>([]);
  const [selected, setSelected] = useState<PrivacyRequestRecord | null>(null);
  const [status, setStatus] = useState("RECEIVED");
  const [identityStatus, setIdentityStatus] = useState("PENDING");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/privacy-requests", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        error?: string;
        requests?: PrivacyRequestRecord[];
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load privacy requests.");
      }
      setRequests(payload.requests ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load privacy requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openRequest = (record: PrivacyRequestRecord) => {
    setSelected(record);
    setStatus(record.status);
    setIdentityStatus(record.identity_status);
    setNotes(record.resolution_notes ?? "");
    setError("");
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/privacy-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          status,
          identityStatus,
          resolutionNotes: notes,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        request?: PrivacyRequestRecord;
      };
      if (!response.ok || !payload.request) {
        throw new Error(payload.error || "Unable to update the request.");
      }
      setRequests((current) =>
        current.map((record) =>
          record.id === payload.request?.id ? payload.request : record,
        ),
      );
      setSelected(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update the request.",
      );
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(
    () => ({
      open: requests.filter(
        (request) => !["COMPLETED", "DENIED"].includes(request.status),
      ).length,
      dueSoon: requests.filter((request) => {
        if (["COMPLETED", "DENIED"].includes(request.status)) return false;
        const remaining =
          new Date(request.target_due_at).getTime() - new Date().getTime();
        return remaining <= 7 * 86_400_000;
      }).length,
      completed: requests.filter((request) => request.status === "COMPLETED")
        .length,
    }),
    [requests],
  );

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Open requests", value: summary.open, icon: ShieldCheck },
          { label: "Due within 7 days", value: summary.dueSoon, icon: Clock3 },
          { label: "Completed", value: summary.completed, icon: CheckCircle2 },
        ].map(({ label: title, value, icon: Icon }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-800 bg-[#0c1423] p-5 light:border-slate-200 light:bg-white"
          >
            <Icon className="h-5 w-5 text-violet-400" />
            <p className="mt-3 text-2xl font-black">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{title}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0c1423] light:border-slate-200 light:bg-white">
        <div className="flex items-center justify-between border-b border-slate-800 p-5 light:border-slate-200">
          <div>
            <h2 className="font-black">Privacy request queue</h2>
            <p className="mt-1 text-xs text-slate-500">
              Verify identity before disclosure, export, correction, or
              deletion.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            loading={loading}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {error && !selected && (
          <p className="m-5 flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 light:text-rose-700">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <div className="divide-y divide-slate-800 light:divide-slate-200">
          {!loading && requests.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">
              No privacy requests have been submitted.
            </p>
          )}
          {requests.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => openRequest(record)}
              className="grid w-full gap-3 p-5 text-left transition hover:bg-white/3 light:hover:bg-slate-50 md:grid-cols-[1.2fr_1fr_0.8fr_auto] md:items-center"
            >
              <span>
                <span className="block text-sm font-black">
                  {record.requester_name}
                </span>
                <span className="block text-xs text-slate-500">
                  {record.requester_email}
                </span>
              </span>
              <span className="text-xs">
                <span className="block font-bold">
                  {label(record.request_type)}
                </span>
                <span className="text-slate-500">{record.reference_code}</span>
              </span>
              <span className="text-xs">
                <span className="block font-bold">{label(record.status)}</span>
                <span className="text-slate-500">
                  Identity: {label(record.identity_status)}
                </span>
              </span>
              <span className="text-xs font-bold text-violet-400">
                Review →
              </span>
            </button>
          ))}
        </div>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? selected.reference_code : "Privacy request"}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              Save case
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="grid gap-3 rounded-xl bg-slate-900/70 p-4 light:bg-slate-50 sm:grid-cols-2">
              <p>
                <span className="block text-xs text-slate-500">Requester</span>
                {selected.requester_name} · {selected.requester_email}
              </p>
              <p>
                <span className="block text-xs text-slate-500">
                  Relationship
                </span>
                {label(selected.relationship)}
              </p>
              <p>
                <span className="block text-xs text-slate-500">Business</span>
                {selected.business_reference || "Not supplied"}
              </p>
              <p>
                <span className="block text-xs text-slate-500">
                  Target date
                </span>
                {new Date(selected.target_due_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">
                Request details
              </p>
              <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-700 p-4 leading-6 light:border-slate-200">
                {selected.details}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Case status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className={inputClass + " mt-1.5"}
                >
                  <option value="RECEIVED">Received</option>
                  <option value="IDENTITY_VERIFICATION">
                    Identity verification
                  </option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DENIED">Denied</option>
                </select>
              </label>
              <label className="text-xs font-bold">
                Identity status
                <select
                  value={identityStatus}
                  onChange={(event) => setIdentityStatus(event.target.value)}
                  className={inputClass + " mt-1.5"}
                >
                  <option value="PENDING">Pending</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="FAILED">Failed</option>
                  <option value="NOT_REQUIRED">Not required</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-bold">
              Internal resolution notes
              <textarea
                rows={5}
                maxLength={5000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={inputClass + " mt-1.5 resize-y"}
              />
            </label>
            {error && (
              <p className="text-sm font-semibold text-rose-400">{error}</p>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
