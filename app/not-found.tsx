import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 text-white">
      <div className="max-w-lg text-center">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-400">
          404
        </p>
        <h1 className="mt-4 text-4xl font-black">
          We couldn&apos;t find that page.
        </h1>
        <p className="mt-4 text-slate-400">
          The storefront may be inactive, renamed, or the link may be incorrect.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold hover:bg-violet-500"
        >
          Return to YuhBusiness
        </Link>
      </div>
    </main>
  );
}
