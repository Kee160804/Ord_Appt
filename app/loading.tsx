export default function Loading() {
  return (
    <main
      className="min-h-dvh animate-pulse bg-slate-950 p-5 sm:p-8"
      aria-label="Loading page"
      aria-busy="true"
    >
      <div className="mx-auto max-w-6xl">
        <div className="h-12 w-48 rounded-xl bg-slate-800" />
        <div className="mt-8 h-64 rounded-3xl bg-slate-900" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-36 rounded-2xl bg-slate-900" />
          ))}
        </div>
      </div>
    </main>
  );
}
