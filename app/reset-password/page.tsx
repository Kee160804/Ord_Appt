"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, KeyRound, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { updateAccountPassword } from "@/app/services/authService";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryError = params.get("error");
    if (queryError) {
      setError(queryError);
      setIsChecking(false);
      return;
    }
    if (params.get("recovery") !== "1") {
      setError("Open the secure link from your password reset email before choosing a new password.");
      setIsChecking(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Password recovery is not configured for this deployment.");
      setIsChecking(false);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setHasRecoverySession(Boolean(data.session));
      if (sessionError || !data.session) {
        setError("This password reset link is invalid or has expired. Request a new link.");
      }
      setIsChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const savePassword = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await updateAccountPassword(password);
      await getSupabaseBrowserClient()?.auth.signOut({ scope: "local" });
      setComplete(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update your password.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pwa-page-safe flex min-h-dvh items-center justify-center bg-[#070b14] p-3 text-white light:bg-white light:text-slate-900 sm:p-4">
      <main className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-7 shadow-2xl light:border-slate-200 light:bg-white sm:p-9">
        <Link href="/home" className="mb-8 flex items-center gap-2.5 font-black">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white"><Sparkles className="h-4 w-4" /></span>
          YuhBusiness
        </Link>

        {complete ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-violet-400" />
            <h1 className="mt-5 text-2xl font-black">Yuh password set now</h1>
            <p className="mt-3 text-sm text-slate-400 light:text-slate-600">Your recovery session has been closed. Sign in again using your new password.</p>
            <Link href="/login?passwordUpdated=1" className="mt-7 inline-flex rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-500">Continue to sign in</Link>
          </div>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400"><KeyRound className="h-5 w-5" /></div>
            <h1 className="mt-5 text-2xl font-black">Choose yuh new password</h1>
            <p className="mt-2 text-sm text-slate-400 light:text-slate-600">Use at least eight characters and avoid reusing an old password.</p>
            {error && <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 light:text-red-700">{error}</p>}
            {isChecking ? (
              <p className="mt-6 text-sm text-slate-400">Validating your recovery link...</p>
            ) : hasRecoverySession ? (
              <div className="mt-6 space-y-4">
                <label className="block text-sm font-semibold">
                  New password
                  <span className="relative mt-2 block">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 pr-11 text-sm outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50"
                    />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>
                <label className="block text-sm font-semibold">
                  Confirm new password
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void savePassword()}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50"
                  />
                </label>
                <button disabled={isSaving} onClick={() => void savePassword()} className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
                  {isSaving ? "Updating password..." : "Update password"}
                </button>
              </div>
            ) : (
              <Link href="/forgot-password" className="mt-6 inline-flex rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-500">Request another reset link</Link>
            )}
          </>
        )}
      </main>
    </div>
  );
}
