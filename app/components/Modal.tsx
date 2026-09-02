"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg", footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "relative flex w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-800 shadow-2xl shadow-black/20 light:border-[#e1e6ef] light:bg-white sm:rounded-xl",
          maxWidth,
          "max-h-[calc(100dvh-env(safe-area-inset-top))] sm:max-h-[90dvh]",
        )}
      >
        {title && (
          <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-700 px-4 py-4 light:border-[#e8ecf3] sm:px-6">
            <h2 className="min-w-0 truncate text-base font-bold text-white light:text-slate-900">{title}</h2>
            <button title="Close" aria-label="Close dialog"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white light:hover:text-slate-900 hover:bg-slate-700 light:hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex-shrink-0 border-t border-slate-700 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] light:border-[#e8ecf3] sm:px-6">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
