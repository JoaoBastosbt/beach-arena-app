import type { Level, SportType } from "@/types";
import { LEVELS, SPORTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "./primitives";

export function SportBadge({ sport, short = false, className }: { sport: SportType; short?: boolean; className?: string }) {
  const s = SPORTS[sport];
  return (
    <Badge className={cn(s.badge, className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {short ? s.short : s.label}
    </Badge>
  );
}

export function LevelBadge({ level, className }: { level: Level; className?: string }) {
  return <Badge className={cn(LEVELS[level].badge, className)}>{LEVELS[level].label}</Badge>;
}

export function StatusBadge({ label, badge, className }: { label: string; badge: string; className?: string }) {
  return <Badge className={cn(badge, className)}>{label}</Badge>;
}

/** Saldo de aulas com cor por faixa */
export function CreditBadge({ balance, className }: { balance: number; className?: string }) {
  const tone =
    balance <= 0
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : balance <= 2
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return (
    <Badge className={cn(tone, "tabular-nums", className)}>
      {balance <= 0 ? "Sem saldo" : `${balance} ${balance === 1 ? "aula" : "aulas"}`}
    </Badge>
  );
}
