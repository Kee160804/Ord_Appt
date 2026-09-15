"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application route error", error);
  }, [error]);

  return (
    <main className="flex min-h-[70dvh] items-center justify-center bg-slate-950 px-6 text-white">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-violet-400">
          Something went wrong
        </p>
        <h1 className="mt-3 text-3xl font-black">This page could not load.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Your data was not changed. Try the request again, or return home.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold hover:bg-violet-500"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-bold hover:bg-slate-900"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
