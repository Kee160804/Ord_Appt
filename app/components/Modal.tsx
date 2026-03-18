// "use client";

// import { useEffect } from "react";
// import { X } from "lucide-react";
// import { cn } from "../lib/utils";

// interface ModalProps {
//   open: boolean;
//   onClose: () => void;
//   title?: string;
//   children: React.ReactNode;
//   maxWidth?: string;
//   footer?: React.ReactNode;
// }

// export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg", footer }: ModalProps) {
//   useEffect(() => {
//     if (!open) return;
//     const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
//     window.addEventListener("keydown", handler);
//     return () => window.removeEventListener("keydown", handler);
//   }, [open, onClose]);

//   if (!open) return null;

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center p-4"
//       aria-modal="true"
//       role="dialog"
//     >
//       {/* Backdrop */}
//       <div
//         className="absolute inset-0 bg-black/50 backdrop-blur-sm"
//         onClick={onClose}
//       />
//       {/* Panel */}
//       <div
//         className={cn(
//           "relative bg-white rounded-2xl shadow-2xl w-full flex flex-col",
//           maxWidth,
//           "max-h-[90vh]",
//         )}
//       >
//         {title && (
//           <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
//             <h2 className="text-base font-bold text-slate-900">{title}</h2>
//             <button title=" button"
//               onClick={onClose}
//               className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
//             >
//               <X className="w-4 h-4" />
//             </button>
//           </div>
//         )}
//         <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
//         {footer && (
//           <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">{footer}</div>
//         )}
//       </div>
//     </div>
//   );
// }






"use client";

import { useEffect } from "react";
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
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 w-full flex flex-col",
          maxWidth,
          "max-h-[90vh]",
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
            <h2 className="text-base font-bold text-white">{title}</h2>
            <button title="bttn"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-700 flex-shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
}