
// import { cn } from "../lib/utils";

// interface CardProps { children: React.ReactNode; className?: string; hover?: boolean; }

// export function Card({ children, className, hover }: CardProps) {
//   return (
//     <div
//       className={cn(
//         "bg-white rounded-2xl border border-slate-100 shadow-sm",
//         hover && "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
//         className,
//       )}
//     >
//       {children}
//     </div>
//   );
// }

// interface SubProps { children: React.ReactNode; className?: string; }

// export function CardHeader({ children, className }: SubProps) {
//   return (
//     <div className={cn("px-6 py-4 border-b border-slate-50 flex items-center justify-between", className)}>
//       {children}
//     </div>
//   );
// }

// export function CardBody({ children, className }: SubProps) {
//   return <div className={cn("px-6 py-4", className)}>{children}</div>;
// }

// export function CardFooter({ children, className }: SubProps) {
//   return (
//     <div className={cn("px-6 py-4 border-t border-slate-50", className)}>{children}</div>
//   );
// }




import { cn } from "../lib/utils";

interface CardProps { children: React.ReactNode; className?: string; hover?: boolean; }

export function Card({ children, className, hover }: CardProps) {
  return (
    <div
      className={cn(
        "bg-slate-800/60 rounded-2xl border border-slate-700/50 shadow-sm",
        hover && "hover:shadow-md hover:shadow-slate-900/50 hover:-translate-y-0.5 transition-all duration-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SubProps { children: React.ReactNode; className?: string; }

export function CardHeader({ children, className }: SubProps) {
  return (
    <div className={cn("px-6 py-4 border-b border-slate-700/50 flex items-center justify-between", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: SubProps) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

export function CardFooter({ children, className }: SubProps) {
  return (
    <div className={cn("px-6 py-4 border-t border-slate-700/50", className)}>{children}</div>
  );
}