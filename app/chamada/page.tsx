"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CheckCheck, ChevronLeft, ChevronRight, ClipboardCheck, Dumbbell, Repeat, Undo2, X } from "lucide-react";
import type { ID, ISODate } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { attendanceService, type RosterEntry } from "@/services/attendance.service";
import { cancellationService } from "@/services/cancellation.service";
import { sessionsOn } from "@/services/class-group.service";
import { settingsService } from "@/services/settings.service";
import { addDays, formatLongDate, timeToMinutes, today } from "@/lib/date";
import { getQueryParam, setQueryParams } from "@/lib/url";
import { cn } from "@/lib/utils";
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, PageLoading } from "@/components/ui/primitives";
import { CreditBadge, LevelBadge, SportBadge } from "@/components/ui/badges";
import { useFeedback } from "@/components/ui/feedback-provider";

function pickDefaultGroup(groups: { id: ID; startTime: string; endTime: string }[], date: ISODate) {
  if (!groups.length) return null;
  if (date !== today()) return groups[0].id;
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  // aula em andamento, senão a próxima, senão a última
  const live = groups.find((g) => now >= timeToMinutes(g.startTime) - 15 && now < timeToMinutes(g.endTime));
  const next = groups.find((g) => timeToMinutes(g.startTime) > now);
  return (live ?? next ?? groups[groups.length - 1]).id;
}

export default function AttendancePage() {
  const { run, confirm } = useFeedback();
  const [date, setDate] = useState<ISODate>(() => getQueryParam("data") ?? today());
  const [selected, setSelected] = useState<ID | null>(() => getQueryParam("turma"));
  const [busy, setBusy] = useState<ID | null>(null);

  const base = useLiveQuery(async () => {
    const [groups, teachers, courts, trainings, settings] = await Promise.all([
      db.classGroups.list({ active: true }),
      db.teachers.list(),
      db.courts.list(),
      db.trainings.list(),
      settingsService.get(),
    ]);
    return { sessions: sessionsOn(groups, date), teachers, courts, trainings, settings };
  }, [date]);

  const sessionIds = base?.sessions.map((s) => s.id) ?? [];
  const activeId = selected && sessionIds.includes(selected) ? selected : base ? pickDefaultGroup(base.sessions, date) : null;

  const roster = useLiveQuery(async () => (activeId ? attendanceService.getRoster(activeId, date) : undefined), [activeId, date]);

  if (!base) return <PageLoading />;

  const changeDate = (d: ISODate) => {
    setDate(d);
    setSelected(null);
    setQueryParams({ data: d, turma: null });
  };
  const select = (id: ID) => {
    setSelected(id);
    setQueryParams({ turma: id, data: date });
  };

  const mark = async (entry: RosterEntry, status: "presente" | "falta") => {
    if (!roster) return;
    setBusy(entry.student.id);
    await run(async () => {
      if (entry.attendance?.status === status) {
        await attendanceService.clear(entry.attendance.id);
      } else {
        await attendanceService.mark({
          classGroupId: roster.group.id,
          studentId: entry.student.id,
          date,
          status,
          isMakeup: !!entry.makeup,
        });
      }
    });
    setBusy(null);
  };

  const training = roster
    ? base.trainings.find((t) => t.date === date && t.classGroupIds.includes(roster.group.id)) ??
      base.trainings.find((t) => t.date === date && t.sport_type === roster.group.sport_type && t.level === roster.group.level)
    : undefined;
  const teacher = roster ? base.teachers.find((t) => t.id === roster.group.teacherId) : undefined;
  const court = roster ? base.courts.find((c) => c.id === roster.group.courtId) : undefined;
  const future = roster ? date > today() : false;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Chamada" description="Toque para registrar presença ou falta" icon={ClipboardCheck} />

      {/* Seletor de data */}
      <Card className="mb-3 flex items-center gap-2 p-2">
        <Button size="icon" variant="ghost" onClick={() => changeDate(addDays(date, -1))} aria-label="Dia anterior">
          <ChevronLeft className="size-5" />
        </Button>
        <div className="flex-1 text-center">
          <p className="font-display text-base font-semibold text-slate-900">{date === today() ? "Hoje" : formatLongDate(date)}</p>
          {date === today() && <p className="text-[11px] text-slate-500">{formatLongDate(date)}</p>}
        </div>
        <Input type="date" value={date} onChange={(e) => e.target.value && changeDate(e.target.value)} className="hidden h-9 w-36 sm:block" />
        <Button size="icon" variant="ghost" onClick={() => changeDate(addDays(date, 1))} aria-label="Próximo dia">
          <ChevronRight className="size-5" />
        </Button>
      </Card>

      {/* Aulas do dia */}
      {base.sessions.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardCheck} title="Nenhuma aula neste dia" description="Escolha outra data ou crie turmas para este dia da semana." />
        </Card>
      ) : (
        <div className="scroll-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {base.sessions.map((g) => {
            const active = g.id === activeId;
            const t = base.teachers.find((x) => x.id === g.teacherId);
            return (
              <button
                key={g.id}
                onClick={() => select(g.id)}
                className={cn(
                  "min-w-36 shrink-0 rounded-2xl border px-3 py-2.5 text-left transition",
                  active ? "border-ocean-700 bg-ocean-700 text-white shadow-lg shadow-ocean-900/20" : "border-slate-200 bg-white hover:border-slate-300",
                )}
              >
                <p className={cn("font-display text-lg font-bold", active ? "text-white" : "text-slate-900")}>{g.startTime}</p>
                <p className={cn("truncate text-xs font-medium", active ? "text-ocean-100" : "text-slate-600")}>{g.name}</p>
                <p className={cn("truncate text-[11px]", active ? "text-ocean-200" : "text-slate-400")}>{t?.name.split(" ")[0]}</p>
              </button>
            );
          })}
        </div>
      )}

      {roster && (
        <>
          <Card className="mb-3 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-slate-900">{roster.group.name}</h2>
                <p className="text-xs text-slate-500">
                  {roster.group.startTime}–{roster.group.endTime} · {teacher?.name} · {court?.name}
                </p>
                <div className="mt-1.5 flex gap-1">
                  <SportBadge sport={roster.group.sport_type} />
                  <LevelBadge level={roster.group.level} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {training && (
                  <Link href={`/treinos?aula=${training.id}`}>
                    <Button size="sm" variant="outline" icon={Dumbbell}>
                      Treino
                    </Button>
                  </Link>
                )}
                <Button
                  size="sm"
                  variant="success"
                  icon={CheckCheck}
                  disabled={!roster.stats.pending || future}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Marcar todos presentes?",
                      description: `${roster.stats.pending} aluno(s) sem registro serão marcados como presentes e terão 1 crédito debitado.`,
                      confirmLabel: "Marcar todos",
                      tone: "primary",
                    });
                    if (ok) await run(() => attendanceService.markAllPresent(roster), "Chamada concluída");
                  }}
                >
                  Todos presentes
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/60 text-center">
              <Stat label="Presentes" value={roster.stats.present} tone="text-emerald-600" />
              <Stat label="Faltas" value={roster.stats.absent} tone="text-rose-600" />
              <Stat label="Cancelaram" value={roster.stats.cancelled} tone="text-amber-600" />
              <Stat label="Pendentes" value={roster.stats.pending} tone="text-slate-700" />
            </div>
          </Card>

          {future && (
            <p className="mb-3 rounded-xl bg-ocean-50 px-4 py-2.5 text-sm text-ocean-800">
              Aula futura — a chamada fica disponível no dia. Você já pode ver quem cancelou e as reposições agendadas.
            </p>
          )}

          {roster.entries.length === 0 ? (
            <Card>
              <EmptyState icon={ClipboardCheck} title="Turma sem alunos" description="Adicione alunos em Turmas & Quadras." />
            </Card>
          ) : (
            <ul className="space-y-2">
              {roster.entries.map((entry) => {
                const status = entry.attendance?.status;
                const isBusy = busy === entry.student.id;
                return (
                  <li key={entry.student.id}>
                    <Card
                      className={cn(
                        "flex items-center gap-3 p-3 transition",
                        status === "presente" && "border-emerald-200 bg-emerald-50/50",
                        status === "falta" && "border-rose-200 bg-rose-50/50",
                        entry.cancellation && "bg-amber-50/40",
                      )}
                    >
                      <Avatar name={entry.student.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{entry.student.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {entry.makeup && (
                            <Badge className="bg-ocean-100 text-ocean-800 ring-ocean-200">
                              <Repeat className="size-3" /> Reposição
                            </Badge>
                          )}
                          <CreditBadge balance={entry.balance} />
                          {status && !entry.attendance?.debitedSubscriptionId && status !== "justificada" && (
                            <Badge className="bg-rose-50 text-rose-700 ring-rose-200">Sem crédito debitado</Badge>
                          )}
                        </div>
                      </div>

                      {entry.cancellation ? (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-xs font-semibold text-amber-700">{entry.cancellation.eligibleForMakeup ? "Cancelou no prazo" : "Cancelou fora do prazo"}</p>
                            <p className="max-w-32 truncate text-[11px] text-slate-500">{entry.cancellation.reason}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Desfazer cancelamento"
                            title="Desfazer cancelamento (aluno veio)"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Desfazer cancelamento?",
                                description: "Use se o aluno compareceu mesmo assim. A solicitação de reposição será removida.",
                                confirmLabel: "Desfazer",
                                tone: "primary",
                              });
                              if (ok) await run(() => cancellationService.revoke(entry.cancellation!.id), "Cancelamento desfeito");
                            }}
                          >
                            <Undo2 className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            disabled={isBusy || future}
                            onClick={() => mark(entry, "falta")}
                            className={cn(
                              "flex size-12 items-center justify-center rounded-xl border-2 transition active:scale-95 disabled:opacity-40",
                              status === "falta" ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:text-rose-500",
                            )}
                            aria-label="Falta"
                          >
                            <X className="size-6" strokeWidth={2.5} />
                          </button>
                          <button
                            disabled={isBusy || future}
                            onClick={() => mark(entry, "presente")}
                            className={cn(
                              "flex size-12 items-center justify-center rounded-xl border-2 transition active:scale-95 disabled:opacity-40",
                              status === "presente" ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white text-slate-400 hover:border-emerald-300 hover:text-emerald-600",
                            )}
                            aria-label="Presente"
                          >
                            <Check className="size-6" strokeWidth={2.5} />
                          </button>
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-center text-xs text-slate-400">
            Presença debita 1 crédito{base.settings.debitOnAbsence ? " · falta sem aviso também debita" : " · falta não debita"} · toque novamente para desfazer
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="py-2.5">
      <p className={cn("font-display text-2xl font-bold", tone)}>{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
