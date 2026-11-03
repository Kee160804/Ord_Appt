"use client";

import { FileText } from "lucide-react";

export function ReceiptFilePreview({
  file,
  className = "",
}: {
  file: File;
  className?: string;
}) {
  function openPreview() {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <button
      type="button"
      onClick={openPreview}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-violet-400/50 px-3 py-2 text-xs font-bold text-violet-200 transition hover:border-violet-300 hover:bg-violet-500/10 light:text-violet-700 ${className}`}
    >
      <FileText className="h-4 w-4" />
      View receipt
    </button>
  );
}
