// // "use client";

// // import { Bell, Search, Plus } from "lucide-react";

// // interface TopBarProps {
// //   title: string;
// //   subtitle?: string;
// //   action?: { label: string; onClick: () => void };
// // }

// // export function TopBar({ title, subtitle, action }: TopBarProps) {
// //   const today = new Date().toLocaleDateString("en-US", {
// //     weekday: "long", month: "long", day: "numeric",
// //   });

// //   return (
// //     <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 flex-shrink-0">
// //       <div>
// //         <h1 className="text-xl font-bold text-slate-900">{title}</h1>
// //         <p className="text-sm text-slate-500 mt-0.5">{subtitle ?? today}</p>
// //       </div>

// //       <div className="flex items-center gap-3">
// //         {/* Search */}
// //         <div className="relative hidden md:block">
// //           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
// //           <input
// //             type="text"
// //             placeholder="Search..."
// //             className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-52
// //                        focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 transition"
// //           />
// //         </div>

// //         {/* Notifications */}
// //         <button title="button" className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
// //           <Bell className="w-5 h-5" />
// //           <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
// //         </button>

// //         {/* Action */}
// //         {action && (
// //           <button
// //             onClick={action.onClick}
// //             className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-semibold
// //                        rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
// //           >
// //             <Plus className="w-4 h-4" />
// //             {action.label}
// //           </button>
// //         )}
// //       </div>
// //     </header>
// //   );
// // }




// "use client";

// interface TopBarProps {
//   title: string;
//   subtitle?: string;
// }

// export function TopBar({ title, subtitle }: TopBarProps) {
//   return (
//     <div className="p-6 border-b border-slate-800 light:border-gray-200">
//       <h1 className="text-2xl font-black text-white light:text-gray-900">{title}</h1>
//       {subtitle && (
//         <p className="text-sm text-white light:text-gray-700 font-semibold mt-1">{subtitle}</p>
//       )}
//     </div>
//   );
// }



"use client";

import { Bell, Search, Plus } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

export function TopBar({ title, subtitle, action }: TopBarProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="flex items-center justify-between px-6 md:px-8 py-4 bg-[#070b14] light:bg-white border-b border-white/5 light:border-gray-200 flex-shrink-0">
      {/* Left: Title and subtitle/date */}
      <div>
        <h1 className="text-xl font-bold text-white light:text-gray-900">{title}</h1>
        <p className="text-sm text-slate-400 light:text-gray-600 mt-0.5">
          {subtitle ?? today}
        </p>
      </div>

      {/* Right: Search, notifications, action */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 light:text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 text-sm bg-slate-800 light:bg-gray-100 border border-slate-700 light:border-gray-300 rounded-xl w-52
                       focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 light:focus:border-violet-400
                       text-white light:text-gray-900 placeholder:text-slate-500 light:placeholder:text-gray-500"
          />
        </div>

        {/* Notifications */}
        <button title="Notifications" className="relative p-2 text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-white/5 light:hover:bg-gray-200 rounded-xl transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Action button */}
        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 light:bg-violet-600 light:hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {action.label}
          </button>
        )}
      </div>
    </header>
  );
}