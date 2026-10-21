"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarPlus, CalendarX2, CheckCircle2, Clock, Repeat, Settings2, Undo2, XCircle } from "lucide-react";
import type { CancellationRequest, ID, ISODate } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { settingsService } from "@/services/settings.service";
import { cancellationService, hoursUntilClass, type MakeupSlot } from "@/services/cancellation.service";
import { CANCELLATION_STATUS } from "@/lib/constants";
import { addDays, diffDays, formatDate, formatDateTime, formatLongDate, today, weekdayOf, WEEKDAY_SHORT } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Avatar, Badge, Button, Card, EmptyState, Field, PageHeader, PageLoading, Select, Switch, Tabs, Textarea } from "@/components/ui/primitives";
import { LevelBadge, SportBadge, StatusBadge } from "@/components/ui/badges";
import { Modal } from "@/components/ui/modal";
import { useFeedback } from "@/components/ui/feedback-provider";

type Tab = "pendentes" | "agendadas" | "historico";

async function load() {
  const [cancellations, students, groups, teachers, settings] = await Promise.all([
    db.cancellations.list(),
    db.students.list(),
    db.classGroups.list(),
    db.teachers.list(),
    settingsService.get(),
  ]);
  return { cancellations, students, groups, teachers, settings };
}

export default function MakeupPage() {
  const { run, confirm } = useFeedback();
  const data = useLiveQuery(load);
  const [tab, setTab] = useState<Tab>("pendentes");
  const [requestOpen, setRequestOpen] = useState(false);
  const [allocating, setAllocating] = useState<CancellationRequest | null>(null);
  const [rejecting, setRejecting] = useState<CancellationRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  if (!data) return <PageLoading />;

  const lists = {
    pendentes: data.cancellations.filter((c) => c.status === "pendente").sort((a, b) => (a.makeupDeadline ?? "").localeCompare(b.makeupDeadline ?? "")),
    agendadas: data.cancellations.filter((c) => c.status === "reposicao_agendada").sort((a, b) => (a.makeupDate ?? "").localeCompare(b.makeupDate ?? "")),
    historico: data.cancellations.filter((c) => !["pendente", "reposicao_agendada"].includes(c.status)).sort((a, b) => b.classDate.localeCompare(a.classDate)),
  };
  const student = (id: ID) => data.students.find((s) => s.id === id);
  const group = (id?: ID) => data.groups.find((g) => g.id === id);

  return (
    <div>
      <PageHeader
        title="Cancelamentos & Reposições"
        description="Solicitações dos alunos e alocação em turmas com vaga"
        icon={Repeat}
        actions={
          <Button variant="secondary" icon={CalendarX2} onClick={() => setRequestOpen(true)}>
            Registrar cancelamento
          </Button>
        }
      />

      <Card className="mb-4 flex flex-col gap-3 bg-gradient-to-r from-ocean-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ocean-700 text-white">
            <Clock className="size-4" />
          </div>
          <p className="text-sm text-slate-700">
            Cancelando com <strong>{data.settings.cancellationMinHours}h ou mais</strong> de antecedência, o aluno tem direito a reposição em até{" "}
            <strong>{data.settings.makeupValidityDays} dias</strong>. Fora do prazo, a aula é registrada como falta
            {data.settings.debitOnAbsence ? " e o crédito é debitado" : ""}.
          </p>
        </div>
        <Link href="/configuracoes" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-ocean-700 hover:underline">
          <Settings2 className="size-3.5" /> Alterar regras
        </Link>
      </Card>

      <Tabs
        className="mb-4 w-fit"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "pendentes", label: "Aguardando reposição", count: lists.pendentes.length },
          { value: "agendadas", label: "Agendadas", count: lists.agendadas.length },
          { value: "historico", label: "Histórico", count: lists.historico.length },
        ]}
      />

      {lists[tab].length === 0 ? (
        <Card>
          <EmptyState
            icon={tab === "pendentes" ? CheckCircle2 : Repeat}
            title={tab === "pendentes" ? "Nenhuma reposição pendente" : tab === "agendadas" ? "Nenhuma reposição agendada" : "Sem histórico"}
            description={tab === "pendentes" ? "Todas as solicitações foram tratadas." : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lists[tab].map((c) => {
            const s = student(c.studentId);
            const g = group(c.classGroupId);
            const mg = group(c.makeupClassGroupId);
            const daysLeft = c.makeupDeadline ? diffDays(c.makeupDeadline, today()) : null;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={s?.name ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate font-semibold text-slate-900">{s?.name ?? "Aluno removido"}</p>
                      <StatusBadge {...CANCELLATION_STATUS[c.status]} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Faltou em <strong className="text-slate-700">{g?.name ?? "turma removida"}</strong> · {formatDate(c.classDate)}
                      {g && ` às ${g.startTime}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      “{c.reason}” · avisou {c.hoursInAdvance}h antes · {formatDateTime(c.requestedAt)}
                    </p>
                    {c.status === "pendente" && daysLeft !== null && (
                      <p className={cn("mt-2 text-xs font-semibold", daysLeft <= 5 ? "text-rose-600" : "text-amber-700")}>
                        Prazo para repor: {formatDate(c.makeupDeadline)} ({daysLeft} dia{daysLeft === 1 ? "" : "s"})
                      </p>
                    )}
                    {c.status === "reposicao_agendada" && mg && (
                      <div className="mt-2 rounded-xl bg-ocean-50 px-3 py-2 text-sm text-ocean-900">
                        Reposição: <strong>{mg.name}</strong>
                        <span className="block text-xs text-ocean-700">
                          {formatLongDate(c.makeupDate!)} · {mg.startTime}–{mg.endTime}
                        </span>
                      </div>
                    )}
                    {c.status === "reposta" && mg && (
                      <p className="mt-2 text-xs text-emerald-700">
                        Reposto em {mg.name} · {formatDate(c.makeupDate)}
                      </p>
                    )}
                    {c.decisionNote && <p className="mt-2 text-xs italic text-slate-500">Obs.: {c.decisionNote}</p>}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.status === "pendente" && (
                        <>
                          <Button size="sm" icon={CalendarPlus} onClick={() => setAllocating(c)}>
                            Alocar reposição
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={XCircle}
                            onClick={() => {
                              setRejectNote("");
                              setRejecting(c);
                            }}
                          >
                            Recusar
                          </Button>
                        </>
                      )}
                      {c.status === "reposicao_agendada" && (
                        <>
                          <Button size="sm" variant="outline" icon={CalendarPlus} onClick={() => setAllocating(c)}>
                            Trocar horário
                          </Button>
                          <Button size="sm" variant="ghost" icon={Undo2} onClick={() => run(() => cancellationService.unschedule(c.id), "Reposição desmarcada")}>
                            Desmarcar
                          </Button>
                        </>
                      )}
                      {c.status !== "reposta" && c.classDate >= today() && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (await confirm({ title: "Desfazer cancelamento?", description: "O aluno volta para a lista da aula original.", confirmLabel: "Desfazer", tone: "primary" }))
                              await run(() => cancellationService.revoke(c.id), "Cancelamento desfeito");
                          }}
                        >
                          Desfazer cancelamento
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <RequestModal open={requestOpen} onClose={() => setRequestOpen(false)} data={data} />
      <AllocateModal request={allocating} onClose={() => setAllocating(null)} data={data} />

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        size="sm"
        title="Recusar reposição"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!rejecting) return;
                const ok = await run(() => cancellationService.reject(rejecting.id, rejectNote.trim() || "Recusado pelo gestor"), "Reposição recusada");
                if (ok) setRejecting(null);
              }}
            >
              Recusar
            </Button>
          </>
        }
      >
        <Field label="Motivo (visível no histórico)">
          <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Ex.: limite de reposições do mês atingido" />
        </Field>
      </Modal>
    </div>
  );
}

type PageData = Awaited<ReturnType<typeof load>>;

function RequestModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: PageData }) {
  const { run } = useFeedback();
  const [studentId, setStudentId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [date, setDate] = useState<ISODate>("");
  const [reason, setReason] = useState("");

  const studentGroups = data.groups.filter((g) => g.active && g.studentIds.includes(studentId));
  const g = data.groups.find((x) => x.id === groupId);
  const upcoming = useMemo(() => {
    if (!g) return [];
    const out: ISODate[] = [];
    const now = new Date();
    for (let d = today(); out.length < 8 && d <= addDays(today(), 30); d = addDays(d, 1)) {
      if (g.weekdays.includes(weekdayOf(d)) && hoursUntilClass(g, d, now) > 0) out.push(d);
    }
    return out;
  }, [g]);

  const hours = g && date ? hoursUntilClass(g, date) : null;
  const eligible = hours !== null && hours >= data.settings.cancellationMinHours;

  const reset = () => {
    setStudentId("");
    setGroupId("");
    setDate("");
    setReason("");
  };

  const submit = async () => {
    if (!studentId || !groupId || !date) return run(async () => Promise.reject(new Error("Selecione aluno, turma e data")));
    const ok = await run(
      () => cancellationService.request({ studentId, classGroupId: groupId, classDate: date, reason: reason.trim() || "Não informado" }),
      eligible ? "Cancelamento registrado — aluno tem direito a reposição" : "Cancelamento fora do prazo registrado",
    );
    if (ok) {
      reset();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar cancelamento de aula"
      description="O sistema verifica automaticamente a antecedência"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Registrar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Aluno" required>
          <Select
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setGroupId("");
              setDate("");
            }}
          >
            <option value="">Selecione</option>
            {data.students
              .filter((s) => s.status === "ativo" && data.groups.some((x) => x.studentIds.includes(s.id)))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </Field>
        {studentId && (
          <Field label="Turma" required>
            <div className="grid gap-2 sm:grid-cols-2">
              {studentGroups.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => {
                    setGroupId(x.id);
                    setDate("");
                  }}
                  className={cn("rounded-xl border p-3 text-left", groupId === x.id ? "border-ocean-500 bg-ocean-50 ring-2 ring-ocean-200" : "border-slate-200")}
                >
                  <p className="text-sm font-semibold text-slate-900">{x.name}</p>
                  <p className="text-xs text-slate-500">
                    {x.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")} · {x.startTime}
                  </p>
                </button>
              ))}
            </div>
          </Field>
        )}
        {g && (
          <Field label="Aula a cancelar" required>
            <div className="flex flex-wrap gap-2">
              {upcoming.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-xs",
                    date === d ? "border-ocean-600 bg-ocean-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                  )}
                >
                  <span className="block font-semibold">{WEEKDAY_SHORT[weekdayOf(d)]} {formatDate(d).slice(0, 5)}</span>
                  <span className={date === d ? "text-ocean-100" : "text-slate-400"}>{g.startTime}</span>
                </button>
              ))}
            </div>
          </Field>
        )}
        {hours !== null && (
          <div className={cn("flex items-start gap-2 rounded-xl p-3 text-sm ring-1", eligible ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200")}>
            {eligible ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
            <span>
              Faltam <strong>{hours.toFixed(1).replace(".", ",")}h</strong> para a aula.{" "}
              {eligible
                ? `Dentro do prazo — gera direito a reposição em até ${data.settings.makeupValidityDays} dias.`
                : `Fora do prazo mínimo de ${data.settings.cancellationMinHours}h — será registrado como falta, sem reposição.`}
            </span>
          </div>
        )}
        <Field label="Motivo">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: viagem a trabalho" />
        </Field>
      </div>
    </Modal>
  );
}

function AllocateModal({ request, onClose, data }: { request: CancellationRequest | null; onClose: () => void; data: PageData }) {
  const { run } = useFeedback();
  const [sameLevel, setSameLevel] = useState(true);
  const student = request ? data.students.find((s) => s.id === request.studentId) : undefined;
  const original = request ? data.groups.find((g) => g.id === request.classGroupId) : undefined;

  const slots = useLiveQuery<MakeupSlot[]>(async () => {
    if (!request || !original || !student) return [];
    return cancellationService.availableSlots({
      studentId: student.id,
      sport: original.sport_type,
      level: sameLevel ? original.level : undefined,
      to: request.makeupDeadline,
    });
  }, [request?.id, sameLevel]);

  const choose = async (slot: MakeupSlot) => {
    if (!request) return;
    const ok = await run(() => cancellationService.schedule(request.id, slot.group.id, slot.date), "Reposição agendada ✅");
    if (ok) onClose();
  };

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      size="lg"
      title="Alocar reposição"
      description={student && original ? `${student.name} · ${original.name} (${formatDate(request?.classDate)})` : undefined}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {original && <SportBadge sport={original.sport_type} />}
          {original && <LevelBadge level={original.level} />}
          {request?.makeupDeadline && <Badge>Até {formatDate(request.makeupDeadline)}</Badge>}
        </div>
        <div className="w-60">
          <Switch checked={sameLevel} onChange={setSameLevel} label="Somente mesmo nível" />
        </div>
      </div>
      {!slots ? (
        <p className="py-8 text-center text-sm text-slate-500">Buscando vagas…</p>
      ) : slots.length === 0 ? (
        <EmptyState icon={CalendarX2} title="Nenhuma turma com vaga no período" description={sameLevel ? "Tente incluir outros níveis." : "Aguarde novas vagas ou amplie o prazo nas configurações."} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {slots.map((slot) => {
            const teacher = data.teachers.find((t) => t.id === slot.group.teacherId);
            return (
              <li key={`${slot.group.id}-${slot.date}`}>
                <button onClick={() => choose(slot)} className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-ocean-400 hover:bg-ocean-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{formatLongDate(slot.date)}</p>
                      <p className="text-xs text-slate-500">
                        {slot.group.startTime}–{slot.group.endTime} · {slot.group.name}
                      </p>
                      <p className="text-xs text-slate-400">{teacher?.name}</p>
                    </div>
                    <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{slot.spotsLeft} vaga(s)</span>
                  </div>
                  <div className="mt-2">
                    <LevelBadge level={slot.group.level} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
