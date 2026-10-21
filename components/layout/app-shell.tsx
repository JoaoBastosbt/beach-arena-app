"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, ExternalLink, Menu, Sun, X } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { useLiveQuery } from "@/hooks/use-live-query";
import { cn } from "@/lib/utils";
import { tenantService } from "@/services/core/tenant";
import { ensureSeeded } from "@/services/seed";
import { subscriptionService } from "@/services/subscription.service";
import { cancellationService } from "@/services/cancellation.service";
import { FeedbackProvider } from "@/components/ui/feedback-provider";
import { MOBILE_NAV, NAV_SECTIONS, PUBLIC_ROUTES } from "./nav";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function useBootstrap(enabled: boolean) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      await ensureSeeded();
      await subscriptionService.runMaintenance();
      await cancellationService.runMaintenance();
      if (!cancelled) setReady(true);
    })().catch((err) => {
      console.error(err);
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return ready;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sun-400 to-sun-600 shadow-lg shadow-sun-900/30">
        <Sun className="size-5 text-white" strokeWidth={2.5} />
      </div>
      {!compact && (
        <div className="leading-none">
          <p className="font-display text-lg font-bold tracking-tight text-white">Beach Arena</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ocean-200/80">Gestão esportiva</p>
        </div>
      )}
    </div>
  );
}

function TenantSwitcher() {
  const [open, setOpen] = useState(false);
  const data = useLiveQuery(async () => ({ tenants: await tenantService.list(), current: await tenantService.current() }));
  if (!data?.current) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-left ring-1 ring-white/10 transition hover:bg-white/10"
      >
        <div className="flex size-8 items-center justify-center rounded-lg bg-ocean-500/30 text-xs font-bold text-white">
          {data.current.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{data.current.name}</p>
          <p className="truncate text-[11px] text-ocean-200/70">{data.current.city}</p>
        </div>
        <ChevronsUpDown className="size-4 text-ocean-200/60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="animate-fade-in absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl bg-white py-1 shadow-2xl">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Suas arenas</p>
            {data.tenants.map((t) => (
              <button
                key={t.id}
                onClick={async () => {
                  await tenantService.switchTo(t.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="flex-1 truncate">{t.name}</span>
                {t.id === data.current?.id && <Check className="size-4 text-ocean-600" />}
              </button>
            ))}
            <Link
              href="/configuracoes"
              onClick={() => setOpen(false)}
              className="block border-t border-slate-100 px-3 py-2 text-xs font-medium text-ocean-700 hover:bg-slate-50"
            >
              + Nova arena / gerenciar
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <Logo />
      </div>
      <div className="px-3 pb-3">
        <TenantSwitcher />
      </div>
      <nav className="scroll-thin flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ocean-200/50">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                      active ? "bg-white text-ocean-900 shadow-lg shadow-black/10" : "text-ocean-100/80 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <item.icon className={cn("size-4.5", active ? "text-sun-500" : "text-ocean-300/70 group-hover:text-ocean-200")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3">
        <Link
          href="/avaliar"
          target="_blank"
          className="flex items-center justify-between rounded-xl bg-gradient-to-r from-sun-500/20 to-transparent px-3 py-2.5 text-xs font-medium text-sun-100 ring-1 ring-sun-400/20 hover:from-sun-500/30"
        >
          Formulário público de avaliação
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function Splash() {
  return (
    <div className="bg-court flex min-h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-14 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-sun-400 to-sun-600 shadow-2xl">
          <Sun className="size-7 text-white" strokeWidth={2.5} />
        </div>
        <p className="font-display text-lg font-semibold text-white/90">Preparando a quadra…</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const pathname = usePathname();
  const ready = useBootstrap(mounted);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  if (!mounted || !ready) return <Splash />;

  if (isPublic) return <FeedbackProvider>{children}</FeedbackProvider>;

  return (
    <FeedbackProvider>
      <div className="min-h-dvh lg:pl-72">
        {/* Sidebar desktop */}
        <aside className="bg-court fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Topbar mobile */}
        <header className="bg-court sticky top-0 z-30 flex h-14 items-center justify-between px-4 lg:hidden">
          <Logo />
          <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-2 text-white hover:bg-white/10" aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
        </header>

        {/* Drawer mobile */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="animate-fade-in absolute inset-0 bg-slate-950/60" onClick={() => setDrawerOpen(false)} />
            <aside className="bg-court animate-slide-in-left absolute inset-y-0 left-0 w-[85%] max-w-xs shadow-2xl">
              <button onClick={() => setDrawerOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Fechar menu">
                <X className="size-5" />
              </button>
              <SidebarContent pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>

        {/* Bottom nav mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <div className="grid grid-cols-5">
            {MOBILE_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-ocean-700" : "text-slate-500")}>
                  <item.icon className={cn("size-5", active && "text-sun-500")} />
                  {item.label}
                </Link>
              );
            })}
            <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
              <Menu className="size-5" />
              Mais
            </button>
          </div>
        </nav>
      </div>
    </FeedbackProvider>
  );
}
