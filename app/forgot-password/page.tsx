"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound, Sparkles } from "lucide-react";
import { requestPasswordReset } from "@/app/services/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const sendReset = async () => {
    if (!email.trim()) {
      setError("Enter the email address for your account.");
      return;
    }
    setIsSending(true);
    setError("");
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send the reset email.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="pwa-page-safe flex min-h-dvh items-center justify-center bg-[#070b14] p-3 text-white light:bg-white light:text-slate-900 sm:p-5">
      <main className="w-full max-w-xl rounded-4xl border border-slate-800 bg-[#0c1425]/90 p-7 shadow-2xl light:border-slate-200 light:bg-white sm:p-11">
        <Link href="/home" className="mb-10 flex items-center gap-3 font-black text-lg">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white"><Sparkles className="h-5 w-5" /></span>
          YuhBusiness
        </Link>

        {sent ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-violet-400" />
            <h1 className="mt-5 text-2xl font-black">Check yuh email</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400 light:text-slate-600">
              If an account exists for <strong>{email.trim().toLowerCase()}</strong>, a secure password reset link has been sent. The same message is shown for unknown addresses to protect account privacy.
            </p>
            <Link href="/login" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-500">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-500/15 text-violet-400"><KeyRound className="h-7 w-7" /></div>
            <h1 className="mt-7 text-3xl font-black tracking-tight">Reset yuh password</h1>
            <p className="mt-3 max-w-md text-lg leading-8 text-slate-400 light:text-slate-600">Enter your account email and we&apos;ll send you a secure reset link.</p>
            {error && <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 light:text-red-700">{error}</p>}
            <label className="mt-6 block text-base font-semibold">
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void sendReset()}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-800 px-5 py-4 text-base outline-none focus:border-violet-500 light:border-slate-300 light:bg-slate-50"
                placeholder="you@business.com"
              />
            </label>
            <button disabled={isSending} onClick={() => void sendReset()} className="mt-6 w-full rounded-2xl bg-violet-600 px-4 py-4 text-lg font-medium text-white hover:bg-violet-500 disabled:opacity-50">
              {isSending ? "Sending reset link..." : "Send reset link"}
            </button>
            <Link href="/login" className="mt-7 flex items-center justify-center gap-2 text-base font-semibold text-violet-400 hover:text-violet-300 light:text-violet-700">
              <ArrowLeft className="h-5 w-5" /> Back to sign in
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
