"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Dumbbell, MonitorPlay, Pencil, Plus, Target, Trash2 } from "lucide-react";
import type { ID, Level, NewEntity, SportType, TrainingPlan } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { FUNDAMENTALS, LEVEL_OPTIONS, SPORT_OPTIONS } from "@/lib/constants";
import { addDays, formatShortDate, today, WEEKDAY_SHORT, weekDates, weekdayOf } from "@/lib/date";
import { getQueryParam, setQueryParams } from "@/lib/url";
import { cn, stripBase, sum } from "@/lib/utils";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, PageLoading, Select, Textarea } from "@/components/ui/primitives";
import { LevelBadge, SportBadge } from "@/components/ui/badges";
import { Modal } from "@/components/ui/modal";
import { useFeedback } from "@/components/ui/feedback-provider";
import { CourtMode } from "@/components/trainings/court-mode";

async function load() {
  const [trainings, exercises, groups] = await Promise.all([db.trainings.list(), db.exercises.list(), db.classGroups.list({ active: true })]);
  return { trainings, exercises, groups };
}

const emptyTraining = (date: string): NewEntity<TrainingPlan> => ({
  title: "",
  date,
  sport_type: "beach_tennis",
  level: "iniciante",
  classGroupIds: [],
  objective: "",
  warmup: "",
  mainDrill: "",
  exerciseIds: [],
  cooldown: "",
  notes: "",
  durationMin: 60,
});

export default function TrainingsPage() {
  const { run, confirm } = useFeedback();
  const data = useLiveQuery(load);
  const [anchor, setAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: ID | null; form: NewEntity<TrainingPlan> } | null>(null);
  const [courtId, setCourtId] = useState<ID | null>(() => getQueryParam("aula"));

  if (!data) return <PageLoading />;

  const week = weekDates(anchor);
  const visible = data.trainings
    .filter((t) => (selectedDay ? t.date === selectedDay : t.date >= week[0] && t.date <= week[6]))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const court = courtId ? data.trainings.find((t) => t.id === courtId) : undefined;

  const openCourt = (id: ID | null) => {
    setCourtId(id);
    setQueryParams({ aula: id });
  };

  const save = async () => {
    if (!editing) return;
    const f = editing.form;
    if (f.title.trim().length < 3) return run(async () => Promise.reject(new Error("Dê um título ao treino")));
    if (!f.objective.trim()) return run(async () => Promise.reject(new Error("Defina o objetivo técnico")));
    const payload = { ...f, title: f.title.trim(), cooldown: f.cooldown?.trim() || undefined, notes: f.notes?.trim() || undefined };
    const ok = await run(() => (editing.id ? db.trainings.update(editing.id, payload) : db.trainings.create(payload)), "Treino salvo");
    if (ok) setEditing(null);
  };

  const duplicate = (t: TrainingPlan) => {
    setEditing({ id: null, form: { ...stripBase(t), title: `${t.title} (cópia)`, date: addDays(t.date, 7) } });
  };

  const f = editing?.form;
  const exerciseOptions = f ? data.exercises.filter((e) => e.sport_type === f.sport_type) : [];
  const groupOptions = f ? data.groups.filter((g) => g.sport_type === f.sport_type) : [];
  const exerciseMinutes = f ? sum(data.exercises.filter((e) => f.exerciseIds.includes(e.id)), (e) => e.durationMin) : 0;

  return (
    <div>
      <PageHeader
        title="Treinos"
        description="Planejamento técnico do dia e da semana"
        icon={Dumbbell}
        actions={
          <Button variant="secondary" icon={Plus} onClick={() => setEditing({ id: null, form: emptyTraining(selectedDay ?? today()) })}>
            Novo treino
          </Button>
        }
      />

      {/* Semana */}
      <Card className="mb-4 p-3">
        <div className="mb-3 flex items-center justify-between">
          <Button size="icon" variant="ghost" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Semana anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <button onClick={() => { setAnchor(today()); setSelectedDay(null); }} className="font-display text-base font-semibold text-slate-800 hover:text-ocean-700">
            Semana de {formatShortDate(week[0])} a {formatShortDate(week[6])}
          </button>
          <Button size="icon" variant="ghost" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Próxima semana">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const count = data.trainings.filter((t) => t.date === d).length;
            const active = selectedDay === d;
            return (
              <button
                key={d}
                onClick={() => setSelectedDay(active ? null : d)}
                className={cn(
                  "rounded-xl border py-2 text-center transition",
                  active ? "border-ocean-700 bg-ocean-700 text-white" : d === today() ? "border-sun-300 bg-sun-50" : "border-slate-200 hover:border-slate-300",
                )}
              >
                <p className={cn("text-[11px] font-medium", active ? "text-ocean-100" : "text-slate-500")}>{WEEKDAY_SHORT[weekdayOf(d)]}</p>
                <p className="font-display text-lg font-bold">{d.slice(8)}</p>
                <div className="mt-0.5 flex h-1.5 justify-center gap-0.5">
                  {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                    <span key={i} className={cn("size-1.5 rounded-full", active ? "bg-sun-300" : "bg-sun-500")} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Dumbbell}
            title={selectedDay ? "Nenhum treino neste dia" : "Nenhum treino nesta semana"}
            action={
              <Button icon={Plus} onClick={() => setEditing({ id: null, form: emptyTraining(selectedDay ?? today()) })}>
                Planejar treino
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((t) => {
            const exercises = t.exerciseIds.map((id) => data.exercises.find((e) => e.id === id)).filter((e) => !!e);
            const groups = data.groups.filter((g) => t.classGroupIds.includes(g.id));
            return (
              <Card key={t.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={cn("text-xs font-semibold uppercase tracking-wider", t.date === today() ? "text-sun-600" : "text-slate-400")}>
                      {t.date === today() ? "Hoje" : `${WEEKDAY_SHORT[weekdayOf(t.date)]}, ${formatShortDate(t.date)}`} · {t.durationMin} min
                    </p>
                    <h3 className="mt-0.5 text-xl font-bold text-slate-900">{t.title}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <SportBadge sport={t.sport_type} />
                      <LevelBadge level={t.level} />
                      {groups.map((g) => (
                        <Badge key={g.id}>{g.name}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 rounded-xl bg-sun-50 p-3 text-sm text-sun-900 ring-1 ring-sun-100">
                  <Target className="mt-0.5 size-4 shrink-0 text-sun-600" />
                  <p>{t.objective}</p>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aquecimento</dt>
                    <dd className="line-clamp-2 text-slate-700">{t.warmup || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Drill principal</dt>
                    <dd className="line-clamp-3 text-slate-700">{t.mainDrill || "—"}</dd>
                  </div>
                </dl>
                {exercises.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {exercises.map((e) => (
                      <span key={e!.id} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        <span className={cn("size-1.5 rounded-full", FUNDAMENTALS[e!.fundamental].color)} />
                        {e!.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex gap-2 pt-5">
                  <Button icon={MonitorPlay} onClick={() => openCourt(t.id)} className="flex-1">
                    Modo quadra
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing({ id: t.id, form: { ...t } })} aria-label="Editar">
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => duplicate(t)} aria-label="Duplicar para próxima semana" title="Duplicar para a próxima semana">
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir"
                    onClick={async () => {
                      if (await confirm({ title: `Excluir “${t.title}”?`, confirmLabel: "Excluir" })) await run(() => db.trainings.remove(t.id), "Treino excluído");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Formulário */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="xl"
        title={editing?.id ? "Editar treino" : "Novo treino"}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar treino</Button>
          </>
        }
      >
        {editing && f && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <Field label="Título" required>
                <Input value={f.title} onChange={(e) => setEditing({ ...editing, form: { ...f, title: e.target.value } })} placeholder="Ex.: Consistência no saque" autoFocus />
              </Field>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Data">
                  <Input type="date" value={f.date} onChange={(e) => setEditing({ ...editing, form: { ...f, date: e.target.value } })} />
                </Field>
                <Field label="Esporte">
                  <Select value={f.sport_type} onChange={(e) => setEditing({ ...editing, form: { ...f, sport_type: e.target.value as SportType, exerciseIds: [], classGroupIds: [] } })}>
                    {SPORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nível">
                  <Select value={f.level} onChange={(e) => setEditing({ ...editing, form: { ...f, level: e.target.value as Level } })}>
                    {LEVEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Duração (min)">
                  <Input type="number" min={15} step={5} value={f.durationMin} onChange={(e) => setEditing({ ...editing, form: { ...f, durationMin: Number(e.target.value) } })} />
                </Field>
              </div>
              <Field label="Objetivo técnico" required>
                <Textarea rows={2} value={f.objective} onChange={(e) => setEditing({ ...editing, form: { ...f, objective: e.target.value } })} placeholder="O que o aluno deve conquistar ao final da aula?" />
              </Field>
              <Field label="Aquecimento">
                <Textarea value={f.warmup} onChange={(e) => setEditing({ ...editing, form: { ...f, warmup: e.target.value } })} />
              </Field>
              <Field label="Drill principal">
                <Textarea rows={4} value={f.mainDrill} onChange={(e) => setEditing({ ...editing, form: { ...f, mainDrill: e.target.value } })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Finalização / jogo">
                  <Textarea value={f.cooldown ?? ""} onChange={(e) => setEditing({ ...editing, form: { ...f, cooldown: e.target.value } })} />
                </Field>
                <Field label="Observações">
                  <Textarea value={f.notes ?? ""} onChange={(e) => setEditing({ ...editing, form: { ...f, notes: e.target.value } })} />
                </Field>
              </div>
            </div>
            <aside className="space-y-5">
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Turmas</p>
                <div className="space-y-1.5">
                  {groupOptions.length === 0 && <p className="text-xs text-slate-500">Nenhuma turma deste esporte.</p>}
                  {groupOptions.map((g) => {
                    const on = f.classGroupIds.includes(g.id);
                    return (
                      <label key={g.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", on ? "border-ocean-400 bg-ocean-50" : "border-slate-200")}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setEditing({ ...editing, form: { ...f, classGroupIds: on ? f.classGroupIds.filter((x) => x !== g.id) : [...f.classGroupIds, g.id] } })}
                          className="accent-ocean-600"
                        />
                        <span className="flex-1 truncate">{g.name}</span>
                        {g.level === f.level && <span className="text-[10px] font-semibold text-emerald-600">nível</span>}
                      </label>
                    );
                  })}
                </div>
              </section>
              <section>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exercícios da biblioteca</p>
                  <span className={cn("text-xs font-semibold", exerciseMinutes > f.durationMin ? "text-rose-600" : "text-slate-500")}>
                    {exerciseMinutes}/{f.durationMin} min
                  </span>
                </div>
                <div className="scroll-thin max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {exerciseOptions.map((e) => {
                    const pos = f.exerciseIds.indexOf(e.id);
                    const on = pos >= 0;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setEditing({ ...editing, form: { ...f, exerciseIds: on ? f.exerciseIds.filter((x) => x !== e.id) : [...f.exerciseIds, e.id] } })}
                        className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition", on ? "border-sun-400 bg-sun-50" : "border-slate-200 hover:border-slate-300")}
                      >
                        <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", on ? "bg-sun-500 text-white" : "bg-slate-100 text-slate-400")}>
                          {on ? pos + 1 : "+"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-800">{e.name}</span>
                          <span className="text-[11px] text-slate-500">
                            {FUNDAMENTALS[e.fundamental].label} · {e.durationMin} min
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </aside>
          </div>
        )}
      </Modal>

      {court && <CourtMode training={court} exercises={data.exercises} groups={data.groups} onClose={() => openCourt(null)} />}
    </div>
  );
}
