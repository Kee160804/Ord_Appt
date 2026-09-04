import { cn } from "../lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover }: CardProps) {
  return (
    <div
      className={cn(
        "min-w-0 bg-slate-900/70 light:bg-white rounded-xl border border-slate-700/60 light:border-[#e4e9f1] shadow-sm light:shadow-[0_1px_3px_rgba(15,23,42,0.04)]",
        hover &&
          "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface SubProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: SubProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/50 light:border-[#e8ecf3] px-4 py-4 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className }: SubProps) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>;
}

export function CardFooter({ children, className }: SubProps) {
  return (
    <div
      className={cn(
        "border-t border-slate-700/50 light:border-[#e8ecf3] px-4 py-4 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
