// import { cn } from "../lib/utils";

// interface StatCardProps {
//   label: string;
//   value: string;
//   change?: number;
//   icon: React.ReactNode;
//   iconBg?: string;
//   className?: string;
// }

// export function StatCard({ label, value, change, icon, iconBg = "bg-slate-100", className }: StatCardProps) {
//   const positive = change !== undefined && change >= 0;
//   return (
//     <div className={cn("bg-white rounded-2xl border border-slate-100 shadow-sm p-6", className)}>
//       <div className="flex items-start justify-between gap-4">
//         <div className="min-w-0">
//           <p className="text-sm font-medium text-slate-500 truncate">{label}</p>
//           <p className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">{value}</p>
//           {change !== undefined && (
//             <p className={cn("text-xs font-semibold mt-2 flex items-center gap-1",
//               positive ? "text-emerald-600" : "text-red-500")}>
//               <span>{positive ? "↑" : "↓"}</span>
//               {Math.abs(change)}% vs last month
//             </p>
//           )}
//         </div>
//         <div className={cn("p-3 rounded-xl flex-shrink-0", iconBg)}>{icon}</div>
//       </div>
//     </div>
//   );
// }





import { cn } from "../lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  iconBg?: string;
  className?: string;
}

export function StatCard({ label, value, change, icon, iconBg = "bg-slate-700", className }: StatCardProps) {
  const positive = change !== undefined && change >= 0;
  return (
    <div className={cn("bg-slate-800/60 rounded-2xl border border-slate-700/50 shadow-sm p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-400 truncate">{label}</p>
          <p className="text-2xl font-bold text-white mt-1.5 tracking-tight">{value}</p>
          {change !== undefined && (
            <p className={cn("text-xs font-semibold mt-2 flex items-center gap-1",
              positive ? "text-emerald-400" : "text-red-400")}>
              <span>{positive ? "↑" : "↓"}</span>
              {Math.abs(change)}% vs last month
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl flex-shrink-0", iconBg)}>{icon}</div>
      </div>
    </div>
  );
}