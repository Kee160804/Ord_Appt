import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

interface LegalDocumentProps {
  title: string;
  summary: string;
  effectiveDate: string;
  children: React.ReactNode;
}

export function LegalDocument({
  title,
  summary,
  effectiveDate,
  children,
}: LegalDocumentProps) {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-200 light:bg-white light:text-slate-800">
      <header className="border-b border-white/10 light:border-slate-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 font-black">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            YuhBusiness
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-violet-300 hover:text-white light:text-violet-700 light:hover:text-violet-900"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-400">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white light:text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400 light:text-slate-600">
          {summary}
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Effective and last updated: {effectiveDate}
        </p>

        <article className="mt-12 space-y-10 text-sm leading-7 text-slate-300 light:text-slate-700 [&_a]:font-semibold [&_a]:text-violet-300 [&_a]:underline [&_a]:underline-offset-4 light:[&_a]:text-violet-700 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-white light:[&_h2]:text-slate-950 [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3">
          {children}
        </article>
      </main>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-slate-500 light:border-slate-200">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/">YuhBusiness home</Link>
        </div>
        <p className="mt-4">© {new Date().getFullYear()} YuhBusiness</p>
      </footer>
    </div>
  );
}
