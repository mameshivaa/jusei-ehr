"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const companyInfo = {
  name: "Your Company Name",
  tagline: "医療現場を支えるソフトウェア開発",
};

export default function MarketingHeader() {
  const pathname = usePathname() ?? "";

  const navItems = [
    { href: "/landing", label: "ホーム", scroll: false },
    {
      href: "/products/judo-therapy-record",
      label: "プロダクト",
      scroll: false,
    },
    { href: "/blog", label: "コラム", scroll: false },
  ] as const satisfies ReadonlyArray<{
    href: Route;
    label: string;
    scroll: boolean;
  }>;

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/landing" className="text-center md:text-left">
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400">
            {companyInfo.name.toUpperCase()}
          </p>
          <h1 className="text-lg font-semibold">{companyInfo.tagline}</h1>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`hover:text-slate-900 transition-colors ${
                  isActive ? "font-semibold text-slate-900" : ""
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
