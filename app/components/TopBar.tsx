"use client";

import { Bell, Search, Plus, Sun, Moon } from "lucide-react";
// NEW: Import useTheme hook to access theme state and toggle function
import { useTheme } from "@/app/contexts/theme";

interface TopBarProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

export function TopBar({ title, subtitle, action }: TopBarProps) {
  // NEW: Get current theme and toggle function
  const { theme, toggleTheme } = useTheme();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="flex items-center justify-between px-6 md:px-8 py-4 bg-[#070b14] light:bg-white border-b border-white/5 light:border-gray-200 flex-shrink-0">
      {/* Left: Title and subtitle/date */}
      <div>
        <h1 className="text-xl font-bold text-white light:text-gray-900">
          {title}
        </h1>
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
        <button
          title="Notifications"
          className="relative p-2 text-slate-400 light:text-gray-600 hover:text-white light:hover:text-gray-900 hover:bg-white/5 light:hover:bg-gray-200 rounded-xl transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* NEW: Theme toggle button in TopBar */}
        <button
          onClick={() => {
            // NEW: AGGRESSIVE DEBUG - Verify button click is registered
            console.log("🎯 TOPBAR BUTTON CLICKED!");
            console.log("🎯 Current theme before toggle:", theme);
            toggleTheme();
            console.log("🎯 toggleTheme() function called");
          }}
          className="p-2 rounded-xl text-slate-400 light:text-gray-600 hover:bg-white/10 light:hover:bg-gray-200 hover:text-white light:hover:text-gray-900 transition-colors cursor-pointer"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode (currently ${theme})`}
        >
          {/* NEW: Show Sun icon in dark mode, Moon icon in light mode */}
          {theme === "dark" ? (
            <Sun className="w-5 h-5 text-yellow-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-700" />
          )}
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
