"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { loadAuthenticatedAppSession } from "@/app/services/authService";
import { acceptBusinessTeamInvitation } from "@/app/services/teamService";

type Mode = "signin" | "create";

export default function TeamInvitationPage() {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<Mode>("create");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [error, setError] = useState("");

  const finishAcceptance = async (invitationToken: string, name = "") => {
    const tenantId = await acceptBusinessTeamInvitation(invitationToken, name);
    const session = await loadAuthenticatedAppSession(undefined, tenantId);
    if (!session.user || session.tenant?.id !== tenantId) {
      throw new Error(
        session.error ??
          "Your business access was added, but the dashboard session could not be prepared. Sign in again to continue.",
      );
    }
    window.location.replace("/dashboard");
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const invitationToken =
        new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
      if (!active) return;
      setToken(invitationToken);
      if (!invitationToken) {
        setError("This invitation link is missing its secure token.");
        setIsLoading(false);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setError("Team invitations require a connected Supabase project.");
        setIsLoading(false);
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) {
        try {
          await finishAcceptance(invitationToken);
          return;
        } catch (acceptError) {
          if (!active) return;
          setError(
            acceptError instanceof Error
              ? acceptError.message
              : "Unable to accept this invitation.",
          );
        }
      }
      if (active) setIsLoading(false);
    };
    void initialize();
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setIsSubmitting(true);
    setError("");

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInError) throw signInError;
        await finishAcceptance(token);
        return;
      }

      if (fullName.trim().length < 2) throw new Error("Enter your full name.");
      if (password.length < 8)
        throw new Error("Use a password with at least 8 characters.");
      const invitationPath = `/team/invite?token=${encodeURIComponent(token)}`;
      const confirmationUrl = new URL("/auth/confirm", window.location.origin);
      confirmationUrl.searchParams.set("next", invitationPath);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim(), team_invitation: true },
          emailRedirectTo: confirmationUrl.toString(),
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        await finishAcceptance(token, fullName);
        return;
      }
      setConfirmationSent(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to join this business.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDifferentAccount = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut({ scope: "local" });
    setError("");
    setMode("signin");
  };

  if (isLoading) {
    return (
      <div className="pwa-page-safe flex min-h-dvh items-center justify-center bg-[#070b14] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        <span className="ml-3 text-sm text-slate-400">
          Securing your invitation...
        </span>
      </div>
    );
  }

  return (
    <div className="pwa-page-safe flex min-h-dvh items-center justify-center bg-[#070b14] px-4 py-8 text-white light:bg-white light:text-slate-900">
      <main className="w-full max-w-md">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-black">YuhBusiness</span>
        </Link>
        <section className="mt-8 rounded-3xl border border-slate-700 bg-slate-900/70 p-5 shadow-2xl light:border-slate-200 light:bg-white sm:p-7">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-center text-2xl font-black">
            Join the business team
          </h1>
          <p className="mt-2 text-center text-sm leading-6 text-slate-400 light:text-slate-600">
            Use the exact email address invited by the business owner. Your
            account will be connected only to that business.
          </p>

          {confirmationSent ? (
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-100 light:text-emerald-800">
              <p className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-5 w-5" /> Check your email
              </p>
              <p className="mt-2">
                Confirm your email using the link we sent. You will return here
                automatically to finish joining the business.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-800 p-1 light:bg-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMode("create");
                    setError("");
                  }}
                  className={`rounded-lg px-3 py-2.5 text-xs font-bold ${mode === "create" ? "bg-violet-600 text-white" : "text-slate-400 light:text-slate-600"}`}
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                  }}
                  className={`rounded-lg px-3 py-2.5 text-xs font-bold ${mode === "signin" ? "bg-violet-600 text-white" : "text-slate-400 light:text-slate-600"}`}
                >
                  I have an account
                </button>
              </div>

              <form onSubmit={submit} className="mt-5 space-y-4">
                {mode === "create" && (
                  <InviteField
                    label="Full name"
                    value={fullName}
                    onChange={setFullName}
                    placeholder="Jordan Smith"
                    autoComplete="name"
                  />
                )}
                <InviteField
                  label="Invited email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="staff@business.com"
                  autoComplete="email"
                />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold">
                    Password
                  </span>
                  <span className="relative block">
                    <input
                      required
                      minLength={8}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={
                        mode === "create" ? "new-password" : "current-password"
                      }
                      className="h-11 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 pr-11 text-sm outline-none focus:border-violet-500 light:border-slate-300 light:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-slate-400"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </span>
                </label>
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-300 light:text-rose-700"
                  >
                    {error}
                    <button
                      type="button"
                      onClick={() => void handleDifferentAccount()}
                      className="ml-1 font-bold underline"
                    >
                      Use a different account
                    </button>
                  </div>
                )}
                <button
                  disabled={isSubmitting}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {mode === "create"
                    ? "Create account and join"
                    : "Sign in and join"}
                </button>
              </form>
            </>
          )}
        </section>
        <p className="mt-5 text-center text-[11px] leading-5 text-slate-500">
          Invitation access is controlled by the business owner and protected by
          YuhBusiness tenant permissions.
        </p>
      </main>
    </div>
  );
}

function InviteField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 text-sm outline-none placeholder:text-slate-500 focus:border-violet-500 light:border-slate-300 light:bg-white"
      />
    </label>
  );
}
