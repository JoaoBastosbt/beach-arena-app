"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, HeartCrack, MessageSquareHeart, RotateCcw, Smile, Star, TrendingDown, Users } from "lucide-react";
import type { ChurnReason, SportType } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { tenantService } from "@/services/core/tenant";
import { studentService } from "@/services/student.service";
import { CHURN_REASONS, SPORT_OPTIONS, SPORTS } from "@/lib/constants";
import { addDays, formatDate, formatDateTime, startOfMonth, today } from "@/lib/date";
import { cn, formatPercent, sum } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, PageLoading, Select, StatCard, Stars, Tabs } from "@/components/ui/primitives";
import { HorizontalBars } from "@/components/charts/bar-chart";
import { useFeedback } from "@/components/ui/feedback-provider";

type Period = "30" | "90" | "todos";

async function load() {
  const [feedbacks, teachers, churn, students, tenant] = await Promise.all([
    db.feedbacks.list(),
    db.teachers.list(),
    db.churn.list(),
    db.students.list(),
    tenantService.current(),
  ]);
  return { feedbacks, teachers, churn, students, tenant };
}

const avg = (values: number[]) => (values.length ? sum(values, (v) => v) / values.length : 0);

export default function FeedbackPage() {
  const { toast, run } = useFeedback();
  const data = useLiveQuery(load);
  const [tab, setTab] = useState<"avaliacoes" | "churn">("avaliacoes");
  const [period, setPeriod] = useState<Period>("90");
  const [sport, setSport] = useState<SportType | "">("");

  const view = useMemo(() => {
    if (!data) return null;
    const since = period === "todos" ? "0000-00-00" : addDays(today(), -Number(period));
    const fb = data.feedbacks
      .filter((f) => f.createdAt.slice(0, 10) >= since && (!sport || f.sport_type === sport))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const promoters = fb.filter((f) => f.nps >= 9).length;
    const detractors = fb.filter((f) => f.nps <= 6).length;
    const passives = fb.length - promoters - detractors;
    const nps = fb.length ? Math.round(((promoters - detractors) / fb.length) * 100) : null;
    const byTeacher = data.teachers
      .map((t) => {
        const list = fb.filter((f) => f.teacherId === t.id);
        return { label: t.name, value: Number(avg(list.map((f) => f.teacherRating)).toFixed(2)), hint: `(${list.length})` };
      })
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);

    const churn = data.churn.filter((c) => c.date >= since).sort((a, b) => b.date.localeCompare(a.date));
    const reasons = (Object.keys(CHURN_REASONS) as ChurnReason[])
      .map((r) => ({ label: CHURN_REASONS[r], value: churn.filter((c) => c.reason === r).length }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
    const active = data.students.filter((s) => s.status === "ativo").length;
    const churnMonth = data.churn.filter((c) => c.date >= startOfMonth(today())).length;
    return {
      fb,
      promoters,
      passives,
      detractors,
      nps,
      byTeacher,
      avgClass: avg(fb.map((f) => f.classRating)),
      avgTeacher: avg(fb.map((f) => f.teacherRating)),
      avgStructure: avg(fb.map((f) => f.structureRating)),
      churn,
      reasons,
      churnRate: active + churnMonth ? churnMonth / (active + churnMonth) : 0,
      wouldReturn: churn.length ? churn.filter((c) => c.wouldReturn).length / churn.length : 0,
    };
  }, [data, period, sport]);

  if (!data || !view) return <PageLoading />;

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/avaliar?arena=${data.tenant?.id ?? ""}` : "/avaliar";

  return (
    <div>
      <PageHeader
        title="Feedback & Churn"
        description="Avaliações anônimas dos alunos e motivos de saída"
        icon={MessageSquareHeart}
        actions={
          <>
            <Button
              variant="outline"
              icon={Copy}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publicUrl);
                  toast("Link do formulário copiado");
                } catch {
                  toast(publicUrl, "info");
                }
              }}
            >
              Copiar link público
            </Button>
            <Link href="/avaliar" target="_blank">
              <Button variant="secondary" icon={ExternalLink}>
                Abrir formulário
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "avaliacoes", label: "Avaliações", count: view.fb.length, icon: Smile },
            { value: "churn", label: "Motivos de saída", count: view.churn.length, icon: HeartCrack },
          ]}
        />
        <div className="flex gap-2">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="h-9 w-auto">
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="todos">Todo o período</option>
          </Select>
          {tab === "avaliacoes" && (
            <Select value={sport} onChange={(e) => setSport(e.target.value as SportType | "")} className="h-9 w-auto">
              <option value="">Todos esportes</option>
              {SPORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {tab === "avaliacoes" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="NPS"
              value={view.nps ?? "—"}
              icon={Smile}
              tone={view.nps !== null && view.nps >= 50 ? "emerald" : view.nps !== null && view.nps >= 0 ? "sun" : "rose"}
              hint={view.nps === null ? "Sem respostas" : view.nps >= 75 ? "Excelente" : view.nps >= 50 ? "Muito bom" : view.nps >= 0 ? "Razoável" : "Crítico"}
            />
            <StatCard label="Aulas" value={view.avgClass.toFixed(1).replace(".", ",")} icon={Star} hint={<Stars value={view.avgClass} />} />
            <StatCard label="Professores" value={view.avgTeacher.toFixed(1).replace(".", ",")} icon={Users} tone="violet" hint={<Stars value={view.avgTeacher} />} />
            <StatCard label="Estrutura" value={view.avgStructure.toFixed(1).replace(".", ",")} icon={Star} tone="sun" hint={<Stars value={view.avgStructure} />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader title="Distribuição NPS" description={`${view.fb.length} respostas`} />
              <div className="space-y-4 p-5">
                <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                  {view.fb.length > 0 && (
                    <>
                      <div className="bg-emerald-500" style={{ width: `${(view.promoters / view.fb.length) * 100}%` }} />
                      <div className="bg-amber-400" style={{ width: `${(view.passives / view.fb.length) * 100}%` }} />
                      <div className="bg-rose-500" style={{ width: `${(view.detractors / view.fb.length) * 100}%` }} />
                    </>
                  )}
                </div>
                <ul className="space-y-2 text-sm">
                  <Legend color="bg-emerald-500" label="Promotores (9–10)" value={view.promoters} total={view.fb.length} />
                  <Legend color="bg-amber-400" label="Neutros (7–8)" value={view.passives} total={view.fb.length} />
                  <Legend color="bg-rose-500" label="Detratores (0–6)" value={view.detractors} total={view.fb.length} />
                </ul>
              </div>
              <div className="border-t border-slate-100 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Nota por professor</p>
                {view.byTeacher.length ? (
                  <HorizontalBars items={view.byTeacher} format={(v) => v.toFixed(1).replace(".", ",")} color="bg-violet-500" />
                ) : (
                  <p className="text-sm text-slate-500">Sem avaliações de professores.</p>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Comentários" description="Respostas anônimas — não é possível identificar o aluno" />
              {view.fb.filter((f) => f.comment).length === 0 ? (
                <EmptyState icon={MessageSquareHeart} title="Nenhum comentário no período" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {view.fb
                    .filter((f) => f.comment)
                    .slice(0, 30)
                    .map((f) => {
                      const teacher = data.teachers.find((t) => t.id === f.teacherId);
                      return (
                        <li key={f.id} className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "flex size-7 items-center justify-center rounded-lg text-xs font-bold text-white",
                                f.nps >= 9 ? "bg-emerald-500" : f.nps >= 7 ? "bg-amber-400" : "bg-rose-500",
                              )}
                            >
                              {f.nps}
                            </span>
                            <Stars value={(f.classRating + f.teacherRating + f.structureRating) / 3} />
                            {f.sport_type && <Badge>{SPORTS[f.sport_type].label}</Badge>}
                            {teacher && <Badge>{teacher.name}</Badge>}
                            <span className="ml-auto text-xs text-slate-400">{formatDateTime(f.createdAt)}</span>
                          </div>
                          <p className="mt-1.5 text-sm text-slate-700">“{f.comment}”</p>
                        </li>
                      );
                    })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Saídas no período" value={view.churn.length} icon={HeartCrack} tone="rose" />
            <StatCard label="Churn do mês" value={formatPercent(view.churnRate, 1)} icon={TrendingDown} tone="sun" hint="saídas ÷ base ativa" />
            <StatCard label="Voltariam" value={formatPercent(view.wouldReturn)} icon={RotateCcw} tone="emerald" hint="potencial de reativação" />
            <StatCard label="Motivo nº 1" value={<span className="text-lg">{view.reasons[0]?.label ?? "—"}</span>} icon={MessageSquareHeart} tone="violet" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Motivos de saída" />
              <div className="p-5">{view.reasons.length ? <HorizontalBars items={view.reasons} color="bg-rose-400" /> : <p className="text-sm text-slate-500">Nenhuma saída no período 🎉</p>}</div>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader title="Cancelamentos de matrícula" description="Registrados em Alunos → Cancelar matrícula" />
              {view.churn.length === 0 ? (
                <EmptyState icon={HeartCrack} title="Nenhum cancelamento no período" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {view.churn.map((c) => {
                    const s = data.students.find((x) => x.id === c.studentId);
                    return (
                      <li key={c.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">
                            {s?.name ?? "Aluno removido"} <span className="text-xs font-normal text-slate-400">· {formatDate(c.date)}</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            <strong className="text-rose-700">{CHURN_REASONS[c.reason]}</strong>
                            {c.details && ` — ${c.details}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.wouldReturn && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Voltaria</Badge>}
                          {s?.status === "inativo" && (
                            <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => run(() => studentService.reactivate(s.id), `${s.name} reativado(a)`)}>
                              Reativar
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("size-2.5 rounded-sm", color)} />
      <span className="flex-1 text-slate-600">{label}</span>
      <span className="font-semibold tabular-nums text-slate-900">{value}</span>
      <span className="w-10 text-right text-xs text-slate-400">{total ? Math.round((value / total) * 100) : 0}%</span>
    </li>
  );
}
