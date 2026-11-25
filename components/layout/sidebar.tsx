"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { brand } from "@/config/brand";
import type { NavItem } from "@/config/navigation";
import { NavIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function Sidebar({
  items,
  companyName,
  userEmail,
  inboxCount,
  darkModeEnabled,
  signOut,
}: {
  items: NavItem[];
  companyName: string;
  userEmail: string | null;
  inboxCount: number;
  darkModeEnabled: boolean;
  signOut?: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const toggleTheme = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white",
              active && "bg-white/15 text-white",
            )}
          >
            <NavIcon name={item.icon} className="size-4" />
            <span className="flex-1">{item.label}</span>
            {item.href === "/inbox" && inboxCount > 0 && (
              <span className="rounded-full bg-accent px-2 text-xs font-semibold text-black">{inboxCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-3 text-xs text-white/60">
      <p className="truncate font-medium text-white/85">{companyName}</p>
      {userEmail && <p className="truncate">{userEmail}</p>}
      <div className="mt-2 flex gap-1">
        {darkModeEnabled && (
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10"
            aria-label="Switch light or dark mode"
          >
            <Sun className="hidden size-3.5 dark:block" />
            <Moon className="size-3.5 dark:hidden" />
            Theme
          </button>
        )}
        {signOut && (
          <form action={signOut}>
            <button className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10">
              <LogOut className="size-3.5" /> Sign out
            </button>
          </form>
        )}
      </div>
    </div>
  );

  const logo = (
    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.logo} alt="" className="size-8 rounded-lg" />
      <span className="text-lg font-semibold text-white">{brand.name}</span>
    </Link>
  );

  return (
    <>
      {/* Phone: top bar + slide-out menu */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-primary pr-2 lg:hidden">
        {logo}
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-white" aria-label="Open menu">
          <Menu className="size-6" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-primary">
            <div className="flex items-center justify-between pr-2">
              {logo}
              <button onClick={() => setOpen(false)} className="p-2 text-white" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-primary lg:flex">
        {logo}
        {nav}
        {footer}
      </aside>
    </>
  );
}
