import { cn } from "../lib/utils";
import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export function Input({ label, error, className, ...rest }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <input
        className={cn(
          "w-full px-4 py-2.5 text-sm border border-slate-600 rounded-xl bg-slate-700/50 text-white",
          "focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500",
          "placeholder:text-slate-500 transition",
          error && "border-red-500 focus:ring-red-500/20",
          className,
        )}
        {...rest}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}
export function Textarea({ label, error, className, ...rest }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <textarea
        className={cn(
          "w-full px-4 py-2.5 text-sm border border-slate-600 rounded-xl bg-slate-700/50 text-white resize-none",
          "focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500",
          "placeholder:text-slate-500 transition",
          error && "border-red-500",
          className,
        )}
        {...rest}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}
export function Select({ label, options, error, className, ...rest }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <select
        className={cn(
          "w-full px-4 py-2.5 text-sm border border-slate-600 rounded-xl bg-slate-700/50 text-white",
          "focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition",
          className,
        )}
        {...rest}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-slate-800">{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}