"use client";

import { useEffect, useRef } from "react";
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

interface ScrollLockSnapshot {
  scrollY: number;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  htmlScrollBehavior: string;
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyPaddingRight: string;
}

let scrollLockDepth = 0;
let scrollLockSnapshot: ScrollLockSnapshot | null = null;

function lockPageScroll() {
  scrollLockDepth += 1;
  if (scrollLockDepth > 1) return;

  const html = document.documentElement;
  const body = document.body;
  const scrollY = window.scrollY;
  const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);

  scrollLockSnapshot = {
    scrollY,
    htmlOverflow: html.style.overflow,
    htmlOverscrollBehavior: html.style.overscrollBehavior,
    htmlScrollBehavior: html.style.scrollBehavior,
    bodyOverflow: body.style.overflow,
    bodyOverscrollBehavior: body.style.overscrollBehavior,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    bodyPaddingRight: body.style.paddingRight,
  };

  html.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.width = "100%";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
}

function unlockPageScroll() {
  scrollLockDepth = Math.max(0, scrollLockDepth - 1);
  if (scrollLockDepth > 0 || !scrollLockSnapshot) return;

  const html = document.documentElement;
  const body = document.body;
  const snapshot = scrollLockSnapshot;
  scrollLockSnapshot = null;

  html.style.overflow = snapshot.htmlOverflow;
  html.style.overscrollBehavior = snapshot.htmlOverscrollBehavior;
  html.style.scrollBehavior = "auto";
  body.style.overflow = snapshot.bodyOverflow;
  body.style.overscrollBehavior = snapshot.bodyOverscrollBehavior;
  body.style.position = snapshot.bodyPosition;
  body.style.top = snapshot.bodyTop;
  body.style.width = snapshot.bodyWidth;
  body.style.paddingRight = snapshot.bodyPaddingRight;
  window.scrollTo(0, snapshot.scrollY);
  html.style.scrollBehavior = snapshot.htmlScrollBehavior;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
  footer,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const backgroundElements = Array.from(document.body.children)
      .filter((element) => element !== overlayRef.current)
      .map((element) => ({
        element: element as HTMLElement,
        inert: (element as HTMLElement).inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      }));
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    const getFocusableElements = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ??
          [],
      ).filter(
        (element) =>
          !element.hasAttribute("hidden") &&
          element.getClientRects().length > 0,
      );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      const focusableElements = getFocusableElements();
      if (!panel || focusableElements.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (
        event.shiftKey &&
        (activeElement === first || !panel.contains(activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === last || !panel.contains(activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    const keepFocusInModal = (event: FocusEvent) => {
      const panel = panelRef.current;
      if (!panel || panel.contains(event.target as Node)) return;
      (getFocusableElements()[0] ?? panel).focus();
    };

    lockPageScroll();
    backgroundElements.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", keepFocusInModal);
    const focusFrame = window.requestAnimationFrame(() => {
      (getFocusableElements()[0] ?? panelRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", keepFocusInModal);
      backgroundElements.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      unlockPageScroll();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex touch-none items-end justify-center overflow-hidden overscroll-none p-0 sm:items-center sm:p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        aria-modal="true"
        role="dialog"
        tabIndex={-1}
        className={cn(
          "relative flex w-full min-w-0 touch-auto flex-col overflow-hidden overscroll-contain rounded-t-2xl border border-slate-700 bg-slate-800 shadow-2xl shadow-black/20 outline-none light:border-[#e1e6ef] light:bg-white sm:rounded-xl",
          maxWidth,
          "max-h-[calc(100dvh-env(safe-area-inset-top))] sm:max-h-[90dvh]",
        )}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 px-4 py-4 light:border-[#e8ecf3] sm:px-6">
            <h2 className="min-w-0 truncate text-base font-bold text-white light:text-slate-900">
              {title}
            </h2>
            <button
              title="Close"
              aria-label="Close dialog"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white light:hover:text-slate-900 hover:bg-slate-700 light:hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-slate-700 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] light:border-[#e8ecf3] sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
