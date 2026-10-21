"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, List, Repeat } from "lucide-react";
import type { CancellationRequest, ClassGroup, Court, ISODate, SportType, Teacher } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { settingsService } from "@/services/settings.service";
import { sessionsOn } from "@/services/class-group.service";
import { spotsLeftOn } from "@/services/cancellation.service";
import { SPORT_OPTIONS, SPORTS } from "@/lib/constants";
import { addDays, formatLongDate, formatShortDate, minutesToTime, timeToMinutes, today, WEEKDAY_SHORT, weekDates } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Button, Card, EmptyState, Input, PageHeader, PageLoading, Select, Tabs } from "@/components/ui/primitives";
import { LevelBadge, SportBadge } from "@/components/ui/badges";

type View = "dia" | "semana" | "lista";
const HOUR_PX = 64;

async function load() {
  const [groups, courts, teachers, cancellations, settings] = await Promise.all([
    db.classGroups.list({ active: true }),
    db.courts.list({ active: true }),
    db.teachers.list(),
    db.cancellations.list(),
    settingsService.get(),
  ]);
  return { groups, courts, teachers, cancellations, settings };
}

export default function AgendaPage() {
  const data = useLiveQuery(load);
  const [date, setDate] = useState<ISODate>(today);
  const [view, setView] = useState<View>(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "lista" : "dia"));
  const [sport, setSport] = useState<SportType | "">("");
  const [teacherId, setTeacherId] = useState("");

  if (!data) return <PageLoading />;

  const groups = data.groups.filter((g) => (!sport || g.sport_type === sport) && (!teacherId || g.teacherId === teacherId));
  const step = view === "semana" ? 7 : 1;

  // Janela de horário visível: abertura→fechamento, expandida se houver turma fora
  const startMin = Math.min(timeToMinutes(data.settings.openingTime), ...groups.map((g) => timeToMinutes(g.startTime)));
  const endMin = Math.max(timeToMinutes(data.settings.closingTime), ...groups.map((g) => timeToMinutes(g.endTime)));
  const firstHour = Math.floor(startMin / 60);
  const lastHour = Math.ceil(endMin / 60);
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);

  const week = weekDates(date);

  return (
    <div>
      <PageHeader title="Agenda" description="Grade de aulas por quadra e horário" icon={CalendarDays} />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setDate(addDays(date, -step))} aria-label="Anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="sm" variant={date === today() ? "primary" : "outline"} onClick={() => setDate(today())} className="h-9">
              Hoje
            </Button>
            <Button size="icon" variant="outline" onClick={() => setDate(addDays(date, step))} aria-label="Próximo">
              <ChevronRight className="size-4" />
            </Button>
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-9 w-auto" />
            <p className="font-display ml-1 text-lg font-semibold text-slate-800">
              {view === "semana" ? `${formatShortDate(week[0])} – ${formatShortDate(week[6])}` : formatLongDate(date)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sport} onChange={(e) => setSport(e.target.value as SportType | "")} className="h-9 w-auto">
              <option value="">Todos esportes</option>
              {SPORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="h-9 w-auto">
              <option value="">Todos professores</option>
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Tabs
              value={view}
              onChange={setView}
              tabs={[
                { value: "dia", label: "Dia" },
                { value: "semana", label: "Semana" },
                { value: "lista", label: "Lista", icon: List },
              ]}
            />
          </div>
        </div>
      </Card>

      {view === "lista" && <ListView date={date} groups={groups} courts={data.courts} teachers={data.teachers} cancellations={data.cancellations} />}

      {view !== "lista" && (
        <Card className="overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            {(() => {
              const columns =
                view === "dia"
                  ? data.courts.map((c) => ({ key: c.id, title: c.name, subtitle: SPORTS[c.sport_type].label, date, filter: (g: ClassGroup) => g.courtId === c.id }))
                  : week.map((d) => ({
                      key: d,
                      title: `${WEEKDAY_SHORT[new Date(`${d}T12:00`).getDay()]} ${d.slice(8)}`,
                      subtitle: d === today() ? "Hoje" : "",
                      date: d,
                      filter: () => true,
                    }));
              if (!columns.length) return <EmptyState icon={CalendarDays} title="Cadastre quadras para ver a grade" />;
              return (
                <div style={{ minWidth: 80 + columns.length * (view === "dia" ? 200 : 150) }}>
                  {/* Cabeçalho */}
                  <div className="sticky top-0 z-10 grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: `64px repeat(${columns.length}, 1fr)` }}>
                    <div />
                    {columns.map((c) => (
                      <div key={c.key} className={cn("border-l border-slate-100 px-3 py-2.5", c.subtitle === "Hoje" && "bg-sun-50")}>
                        <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                        <p className="text-[11px] text-slate-500">{c.subtitle || " "}</p>
                      </div>
                    ))}
                  </div>
                  {/* Grade */}
                  <div className="relative grid pt-3" style={{ gridTemplateColumns: `64px repeat(${columns.length}, 1fr)` }}>
                    <div>
                      {hours.map((h) => (
                        <div key={h} className="relative border-b border-slate-100 pr-2 text-right text-[11px] text-slate-400" style={{ height: HOUR_PX }}>
                          <span className="relative -top-2 bg-white px-1">{minutesToTime(h * 60)}</span>
                        </div>
                      ))}
                    </div>
                    {columns.map((col) => {
                      const sessions = sessionsOn(groups, col.date).filter(col.filter);
                      const lanes = assignLanes(sessions);
                      return (
                        <div key={col.key} className={cn("relative border-l border-slate-100", col.date === today() && view === "semana" && "bg-sun-50/30")}>
                          {hours.map((h) => (
                            <div key={h} className="border-b border-dashed border-slate-100" style={{ height: HOUR_PX }} />
                          ))}
                          {col.date === today() && <NowLine firstHour={firstHour} />}
                          {sessions.map((g) => {
                            const top = ((timeToMinutes(g.startTime) - firstHour * 60) / 60) * HOUR_PX;
                            const height = Math.max(28, ((timeToMinutes(g.endTime) - timeToMinutes(g.startTime)) / 60) * HOUR_PX - 4);
                            const lane = lanes.get(g.id)!;
                            const teacher = data.teachers.find((t) => t.id === g.teacherId);
                            const court = data.courts.find((c) => c.id === g.courtId);
                            const cancelled = data.cancellations.filter((c) => c.classGroupId === g.id && c.classDate === col.date && c.status !== "recusada").length;
                            const makeups = data.cancellations.filter((c) => c.makeupClassGroupId === g.id && c.makeupDate === col.date && (c.status === "reposicao_agendada" || c.status === "reposta")).length;
                            const spots = spotsLeftOn(g, col.date, data.cancellations);
                            return (
                              <Link
                                key={g.id}
                                href={`/chamada?turma=${g.id}&data=${col.date}`}
                                className="group absolute overflow-hidden rounded-xl border-l-4 bg-white p-2 text-left shadow-sm ring-1 ring-slate-200 transition hover:z-10 hover:shadow-lg"
                                style={{
                                  top: top + 2,
                                  height,
                                  left: `calc(${(lane.index / lane.total) * 100}% + 4px)`,
                                  width: `calc(${100 / lane.total}% - 8px)`,
                                  borderLeftColor: teacher?.color ?? "#94a3b8",
                                }}
                              >
                                <p className="truncate text-xs font-semibold text-slate-900">{g.name}</p>
                                <p className="truncate text-[11px] text-slate-500">
                                  {g.startTime}–{g.endTime} · {teacher?.name.split(" ")[0]}
                                  {view === "semana" && ` · ${court?.name}`}
                                </p>
                                {height > 50 && (
                                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-semibold">
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                                      {g.studentIds.length - cancelled + makeups}/{g.capacity}
                                    </span>
                                    {spots > 0 && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{spots} vaga(s)</span>}
                                    {makeups > 0 && <span className="rounded bg-ocean-50 px-1.5 py-0.5 text-ocean-700">+{makeups} rep.</span>}
                                  </div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        {data.teachers
          .filter((t) => t.active)
          .map((t) => (
            <span key={t.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name}
            </span>
          ))}
      </div>
    </div>
  );
}

function NowLine({ firstHour }: { firstHour: number }) {
  const d = new Date();
  const minutes = d.getHours() * 60 + d.getMinutes();
  const top = ((minutes - firstHour * 60) / 60) * HOUR_PX;
  if (top < 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top }}>
      <div className="relative h-0.5 bg-sun-500">
        <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-sun-500" />
      </div>
    </div>
  );
}

/** Distribui sessões sobrepostas em colunas (lanes) */
function assignLanes(sessions: ClassGroup[]) {
  const result = new Map<string, { index: number; total: number }>();
  const sorted = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));
  let cluster: ClassGroup[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const idx = new Map<string, number>();
    for (const g of cluster) {
      const s = timeToMinutes(g.startTime);
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = timeToMinutes(g.endTime);
      idx.set(g.id, lane);
    }
    for (const g of cluster) result.set(g.id, { index: idx.get(g.id)!, total: laneEnds.length });
    cluster = [];
  };
  for (const g of sorted) {
    const s = timeToMinutes(g.startTime);
    if (cluster.length && s >= clusterEnd) flush();
    cluster.push(g);
    clusterEnd = Math.max(clusterEnd, timeToMinutes(g.endTime));
  }
  if (cluster.length) flush();
  return result;
}

function ListView({
  date,
  groups,
  courts,
  teachers,
  cancellations,
}: {
  date: ISODate;
  groups: ClassGroup[];
  courts: Court[];
  teachers: Teacher[];
  cancellations: CancellationRequest[];
}) {
  const sessions = sessionsOn(groups, date);
  if (!sessions.length)
    return (
      <Card>
        <EmptyState icon={CalendarDays} title="Sem aulas neste dia" description="Use as setas para navegar entre os dias." />
      </Card>
    );
  return (
    <div className="space-y-3">
      {sessions.map((g) => {
        const teacher = teachers.find((t) => t.id === g.teacherId);
        const court = courts.find((c) => c.id === g.courtId);
        const cancelled = cancellations.filter((c) => c.classGroupId === g.id && c.classDate === date && c.status !== "recusada").length;
        const makeups = cancellations.filter((c) => c.makeupClassGroupId === g.id && c.makeupDate === date && (c.status === "reposicao_agendada" || c.status === "reposta")).length;
        return (
          <Card key={g.id} className="overflow-hidden">
            <div className="flex items-stretch">
              <div className="w-1.5 shrink-0" style={{ backgroundColor: teacher?.color }} />
              <div className="flex flex-1 items-center gap-4 p-4">
                <div className="w-14 text-center">
                  <p className="font-display text-xl font-bold text-slate-900">{g.startTime}</p>
                  <p className="text-[11px] text-slate-400">{g.endTime}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{g.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {teacher?.name} · {court?.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <SportBadge sport={g.sport_type} short />
                    <LevelBadge level={g.level} />
                    {cancelled > 0 && <span className="text-[11px] font-medium text-amber-700">{cancelled} cancelou</span>}
                    {makeups > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-ocean-700">
                        <Repeat className="size-3" /> {makeups} reposição
                      </span>
                    )}
                  </div>
                </div>
                <Link href={`/chamada?turma=${g.id}&data=${date}`}>
                  <Button size="sm" icon={ClipboardCheck}>
                    Chamada
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
