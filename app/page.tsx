"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardCheck,
  Gauge,
  HeartHandshake,
  Repeat,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useLiveQuery } from "@/hooks/use-live-query";
import { getDashboard } from "@/services/dashboard.service";
import { tenantService } from "@/services/core/tenant";
import { db } from "@/services/repositories";
import { formatLongDate, formatShortDate, parseISODate, today } from "@/lib/date";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageLoading, ProgressBar, StatCard } from "@/components/ui/primitives";
import { CreditBadge, LevelBadge, SportBadge } from "@/components/ui/badges";
import { GroupedBarChart } from "@/components/charts/bar-chart";

const MONTH_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function DashboardPage() {
  const data = useLiveQuery(async () => {
    const [dash, tenant, teachers, courts] = await Promise.all([
      getDashboard(),
      tenantService.current(),
      db.teachers.list(),
      db.courts.list(),
    ]);
    return { dash, tenant, teachers, courts };
  });

  if (!data) return <PageLoading />;
  const { dash, tenant, teachers, courts } = data;
  const t = today();
  const revenueDelta = dash.revenueLastMonth ? dash.revenueMonth / dash.revenueLastMonth - 1 : 0;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="bg-court relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-ocean-950/20 sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full border-[18px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-24 right-24 size-56 rounded-full border-[14px] border-sun-400/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-ocean-200">{formatLongDate(t)}</p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
              {greeting()}, <span className="text-sun-400">{tenant?.name ?? "Arena"}</span>
            </h1>
            <p className="mt-1 text-sm text-ocean-100/80">
              {dash.todaySessions.length} aulas hoje · {dash.pendingMakeups} reposições aguardando · {dash.expiringSoon.length} renovações próximas
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <QuickAction href="/alunos?novo=1" icon={UserPlus} label="Nova matrícula" primary />
            <QuickAction href="/chamada" icon={ClipboardCheck} label="Chamada do dia" />
            <QuickAction href="/financeiro" icon={Wallet} label="Financeiro" />
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Alunos ativos"
          value={dash.activeStudents}
          icon={Users}
          hint={
            <span className="text-emerald-600">
              +{dash.newStudentsMonth} novos no mês
            </span>
          }
        />
        <StatCard
          label="Ocupação das quadras"
          value={formatPercent(dash.courtOccupancy)}
          icon={Gauge}
          tone="violet"
          hint={
            <div className="space-y-1.5">
              <ProgressBar value={dash.courtOccupancy} tone="ocean" />
              <span>Vagas nas turmas: {formatPercent(dash.seatOccupancy)}</span>
            </div>
          }
        />
        <StatCard
          label="Faturamento do mês"
          value={<span className="text-2xl sm:text-3xl">{formatCurrency(dash.revenueMonth)}</span>}
          icon={TrendingUp}
          tone="emerald"
          hint={
            <span className={cn("inline-flex items-center gap-0.5", revenueDelta >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {revenueDelta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {formatPercent(Math.abs(revenueDelta))} vs. mês anterior
            </span>
          }
        />
        <StatCard
          label="Retenção do mês"
          value={formatPercent(dash.retentionRate, 1)}
          icon={HeartHandshake}
          tone="sun"
          hint={
            <span className={dash.churnedMonth ? "text-rose-600" : undefined}>
              Churn {formatPercent(dash.churnRateMonth, 1)} · {dash.churnedMonth} saída(s)
            </span>
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Aulas de hoje */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Aulas de hoje"
            description="Toque em uma aula para abrir a chamada"
            icon={CalendarClock}
            action={
              <Link href="/agenda" className="text-xs font-semibold text-ocean-700 hover:underline">
                Ver agenda
              </Link>
            }
          />
          {dash.todaySessions.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nenhuma aula hoje" description="Aproveite para planejar os treinos da semana." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {dash.todaySessions.map(({ group, enrolled }) => {
                const teacher = teachers.find((x) => x.id === group.teacherId);
                const court = courts.find((c) => c.id === group.courtId);
                const [sh, sm] = group.startTime.split(":").map(Number);
                const [eh, em] = group.endTime.split(":").map(Number);
                const live = nowMinutes >= sh * 60 + sm && nowMinutes < eh * 60 + em;
                const done = nowMinutes >= eh * 60 + em;
                return (
                  <li key={group.id}>
                    <Link
                      href={`/chamada?turma=${group.id}&data=${t}`}
                      className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-50"
                    >
                      <div className="w-14 shrink-0 text-center">
                        <p className={cn("font-display text-lg font-bold", live ? "text-sun-600" : done ? "text-slate-400" : "text-slate-900")}>
                          {group.startTime}
                        </p>
                        <p className="text-[11px] text-slate-400">{group.endTime}</p>
                      </div>
                      <div className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: teacher?.color ?? "#94a3b8" }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-semibold text-slate-900">{group.name}</p>
                          {live && <Badge className="bg-sun-500 text-white ring-sun-500">Ao vivo</Badge>}
                        </div>
                        <p className="truncate text-xs text-slate-500">
                          {teacher?.name ?? "Sem professor"} · {court?.name ?? "—"}
                        </p>
                      </div>
                      <div className="hidden items-center gap-1.5 sm:flex">
                        <SportBadge sport={group.sport_type} short />
                        <LevelBadge level={group.level} />
                      </div>
                      <div className="w-16 shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-slate-800">
                          {enrolled}/{group.capacity}
                        </p>
                        <ProgressBar value={enrolled / group.capacity} className="mt-1" tone={enrolled >= group.capacity ? "sun" : "ocean"} />
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Alertas */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Atenção hoje" icon={AlertCircle} />
            <div className="space-y-2 p-4">
              <AlertRow
                href="/reposicoes"
                icon={Repeat}
                label="Reposições aguardando alocação"
                value={dash.pendingMakeups}
                tone={dash.pendingMakeups ? "amber" : "slate"}
              />
              <AlertRow
                href="/financeiro?aba=receber"
                icon={Wallet}
                label="Em atraso (contas a receber)"
                value={formatCurrency(dash.overdue)}
                tone={dash.overdue ? "rose" : "slate"}
              />
              <AlertRow
                href="/financeiro?aba=receber"
                icon={CalendarClock}
                label="A receber neste mês"
                value={formatCurrency(dash.pendingMonth)}
                tone="slate"
              />
              <AlertRow
                href="/feedback"
                icon={HeartHandshake}
                label={`NPS (${dash.feedbackCount} avaliações)`}
                value={dash.npsScore ?? "—"}
                tone={dash.npsScore !== null && dash.npsScore >= 50 ? "emerald" : "slate"}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Renovações próximas"
              description="Planos vencendo nos próximos dias"
              action={
                <Link href="/planos?aba=assinaturas" className="text-xs font-semibold text-ocean-700 hover:underline">
                  Gerenciar
                </Link>
              }
            />
            {dash.expiringSoon.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">Nenhuma renovação próxima 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {dash.expiringSoon.map((e) => (
                  <li key={e.student.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{e.student.name}</p>
                      <p className="text-xs text-slate-500">
                        {e.planName} · vence {formatShortDate(e.endDate)}
                      </p>
                    </div>
                    <CreditBadge balance={e.remaining} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Receitas x Despesas" description="Valores pagos nos últimos 6 meses" icon={TrendingUp} />
          <div className="p-5">
            <GroupedBarChart
              data={dash.revenueSeries.map((m) => ({
                label: MONTH_LABEL[parseISODate(`${m.month}-01`).getMonth()],
                values: { revenue: m.revenue, expenses: m.expenses },
              }))}
              series={[
                { key: "revenue", label: "Receitas", color: "bg-ocean-500" },
                { key: "expenses", label: "Despesas", color: "bg-sun-400" },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Saldo de aulas baixo" description="Alunos com 1 aula ou menos" />
          {dash.lowBalance.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">Todos com saldo confortável.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dash.lowBalance.map((e) => (
                <li key={e.student.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <Link href={`/alunos?id=${e.student.id}`} className="truncate text-sm font-medium text-slate-800 hover:text-ocean-700">
                    {e.student.name}
                  </Link>
                  <CreditBadge balance={e.remaining} />
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Frequência média (30 dias): <strong className="text-slate-800">{formatPercent(dash.attendanceRate30d)}</strong>
          </div>
        </Card>
      </section>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, primary }: { href: string; icon: typeof Users; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-2xl px-3 py-3 text-center text-xs font-semibold transition sm:flex-row sm:px-4 sm:text-sm",
        primary ? "bg-sun-500 text-white shadow-lg shadow-sun-900/30 hover:bg-sun-600" : "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15",
      )}
    >
      <Icon className="size-5 sm:size-4" />
      {label}
    </Link>
  );
}

function AlertRow({
  href,
  icon: Icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: typeof Users;
  label: string;
  value: ReactNode;
  tone: "amber" | "rose" | "emerald" | "slate";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-50 text-slate-600",
  };
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50">
      <div className={cn("flex size-8 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="size-4" />
      </div>
      <span className="flex-1 text-sm text-slate-600">{label}</span>
      <span className="font-display text-base font-bold tabular-nums text-slate-900">{value}</span>
    </Link>
  );
}
