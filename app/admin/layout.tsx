"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/scenarios", label: "Scenarios" },
  { href: "/admin/playbooks", label: "Playbooks" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/carriers", label: "Carriers" },
  { href: "/admin/faq", label: "Knowledge Base" },
  { href: "/admin/rules", label: "Decision Rules" },
  { href: "/admin/changelog", label: "Changelog" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-paper-100">
      <div className="border-b border-teal-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-semibold text-teal-800">
            Claims Navigator · Admin
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs font-medium text-ink/50 hover:text-ink">
              ← Back to tool
            </Link>
            <button
              onClick={logout}
              className="focus-ring rounded-md border border-teal-100 px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-rust-500 hover:text-rust-600"
            >
              Log out
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${
                pathname === n.href ? "bg-teal-700 text-white" : "text-ink/60 hover:bg-teal-100"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <AdminGuard>{children}</AdminGuard>
      </div>
    </div>
  );
}
