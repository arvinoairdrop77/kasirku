"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Store, Package, BarChart3, LogOut, Coffee } from "lucide-react";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/kasir") {
    return <>{children}</>;
  }

  const menuItems = [
    { name: "Kasir", href: "/kasir", icon: Store },
    { name: "Produk", href: "/produk", icon: Package },
    { name: "Laporan", href: "/laporan", icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100/90">
      <aside className="z-20 flex w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-300">
        <div className="flex h-16 items-center gap-3 border-b border-slate-800/50 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Coffee className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold tracking-wide text-white">
            KasirKu<span className="text-indigo-400">POS</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-slate-500"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800/50 p-4">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-medium text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
          >
            <LogOut className="h-5 w-5" />
            Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-100/90">{children}</main>
    </div>
  );
}
