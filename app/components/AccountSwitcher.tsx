"use client";

import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "@/app/components/Modal";
import { useAuth } from "@/app/contexts/auth";
import { cn } from "@/app/lib/utils";
import type { User } from "@/app/types";

interface AccountSwitcherProps {
  currentUser: User;
  collapsed?: boolean;
  onAccountSelected?: () => void;
}

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 light:border-slate-300 light:bg-white light:text-slate-900";

export function AccountSwitcher({
  currentUser,
  collapsed = false,
  onAccountSelected,
}: AccountSwitcherProps) {
  const { switchAccount, isSwitchingAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");

  const close = () => {
    if (isSwitchingAccount) return;
    setOpen(false);
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const result = await switchAccount(email, password, rememberMe);
    if (!result.success) {
      setPassword("");
      setError(result.error ?? "Unable to switch accounts.");
      return;
    }

    onAccountSelected?.();
    const destination =
      result.user?.role === "superadmin" ? "/admin" : "/dashboard";
    window.location.replace(destination);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Switch account"
        title="Switch account"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border border-white/6 bg-white/3 text-slate-300 transition-colors hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
          collapsed
            ? "w-9 justify-center"
            : "w-full justify-start px-3 text-[10px] font-semibold",
        )}
      >
        <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && <span>Switch account</span>}
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Switch account"
        maxWidth="max-w-md"
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-300 light:text-violet-700" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-violet-100 light:text-violet-950">
                  Currently signed in as
                </p>
                <p className="mt-1 truncate text-xs text-violet-200/80 light:text-violet-800">
                  {currentUser.email}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs leading-5 text-slate-400 light:text-slate-600">
            Enter the other account&apos;s credentials. That account&apos;s own
            businesses will load after verification.
          </p>

          <label className="block text-xs font-semibold text-slate-200 light:text-slate-700">
            Other account email
            <input
              autoFocus
              required
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@example.com"
              className={inputClass}
            />
          </label>

          <label className="block text-xs font-semibold text-slate-200 light:text-slate-700">
            Password
            <span className="relative mt-1.5 block">
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter the other account password"
                className={cn(inputClass, "mt-0 pr-12")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300 light:text-slate-700">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-slate-500 accent-violet-600"
            />
            Keep the new account signed in on this device
          </label>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300 light:text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={isSwitchingAccount}
              className="h-11 rounded-xl border border-slate-600 px-5 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-50 light:border-slate-300 light:text-slate-700 light:hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSwitchingAccount || !email.trim() || password.length === 0
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-xs font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSwitchingAccount && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Verify and switch
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
