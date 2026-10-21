"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  LogOut,
  Mail,
  Pencil,
  Phone,
  RotateCcw,
  Ticket,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { ChurnReason, ID, Level, SportType, Student, StudentStatus } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { studentService } from "@/services/student.service";
import { classGroupService } from "@/services/class-group.service";
import { creditBalance, currentSubscription, remainingCredits } from "@/services/subscription.service";
import { ATTENDANCE_STATUS, CHURN_REASONS, LEVEL_OPTIONS, SPORT_OPTIONS, STUDENT_STATUS } from "@/lib/constants";
import { diffDays, formatDate, formatShortDate, today, WEEKDAY_SHORT } from "@/lib/date";
import { getQueryParam, setQueryParams } from "@/lib/url";
import { cn, formatPercent, normalize } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  PageLoading,
  SearchInput,
  Select,
  Switch,
  Tabs,
  Textarea,
} from "@/components/ui/primitives";
import { CreditBadge, LevelBadge, SportBadge, StatusBadge } from "@/components/ui/badges";
import { Modal } from "@/components/ui/modal";
import { useFeedback } from "@/components/ui/feedback-provider";
import {
  emptyStudentForm,
  StudentForm,
  studentToForm,
  validateStudentForm,
  type StudentFormValues,
} from "@/components/students/student-form";

type StatusFilter = StudentStatus | "todos";

async function loadPageData() {
  const [students, groups, teachers, plans, subs, attendances, churn] = await Promise.all([
    db.students.list(),
    db.classGroups.list(),
    db.teachers.list(),
    db.plans.list(),
    db.subscriptions.list(),
    db.attendances.list(),
    db.churn.list(),
  ]);
  return { students, groups, teachers, plans, subs, attendances, churn };
}
type PageData = Awaited<ReturnType<typeof loadPageData>>;

export default function StudentsPage() {
  const { run, confirm } = useFeedback();
  const data = useLiveQuery(loadPageData);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ativo");
  const [sport, setSport] = useState<SportType | "">("");
  const [level, setLevel] = useState<Level | "">("");
  const [formOpen, setFormOpen] = useState(() => getQueryParam("novo") === "1");
  const [editingId, setEditingId] = useState<ID | null>(null);
  const [form, setForm] = useState<StudentFormValues>(emptyStudentForm);
  const [errors, setErrors] = useState<Partial<Record<keyof StudentFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState<ID | null>(() => getQueryParam("id"));
  const [churnFor, setChurnFor] = useState<Student | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = normalize(search);
    return data.students
      .filter((s) => status === "todos" || s.status === status)
      .filter((s) => !sport || s.sports.includes(sport))
      .filter((s) => !level || s.level === level)
      .filter((s) => !q || normalize(`${s.name} ${s.email} ${s.phone}`).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search, status, sport, level]);

  if (!data) return <PageLoading />;

  const counts = {
    ativo: data.students.filter((s) => s.status === "ativo").length,
    trancado: data.students.filter((s) => s.status === "trancado").length,
    inativo: data.students.filter((s) => s.status === "inativo").length,
    todos: data.students.length,
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyStudentForm());
    setErrors({});
    setFormOpen(true);
  };
  const openEdit = (s: Student) => {
    setEditingId(s.id);
    setForm(studentToForm(s, data.groups));
    setErrors({});
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setQueryParams({ novo: null });
  };
  const openDetail = (id: ID | null) => {
    setDetailId(id);
    setQueryParams({ id });
  };

  const save = async () => {
    const errs = validateStudentForm(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone,
      email: form.email.trim(),
      birthDate: form.birthDate || undefined,
      level: form.level,
      sports: form.sports,
      notes: form.notes.trim() || undefined,
    };
    const ok = await run(async () => {
      if (editingId) {
        await studentService.update(editingId, payload);
        await classGroupService.setStudentGroups(editingId, form.classGroupIds);
        return editingId;
      }
      const created = await studentService.enroll({
        student: payload,
        classGroupIds: form.classGroupIds,
        planId: form.planId || undefined,
        paid: form.paid,
        method: form.method,
      });
      return created.id;
    }, editingId ? "Aluno atualizado" : "Matrícula realizada! 🎾");
    setSaving(false);
    if (ok) {
      closeForm();
      if (!editingId) openDetail(ok);
    }
  };

  const detail = detailId ? data.students.find((s) => s.id === detailId) : undefined;

  return (
    <div>
      <PageHeader
        title="Alunos"
        description="Cadastro, matrículas, saldo de aulas e histórico"
        icon={Users}
        actions={
          <Button icon={UserPlus} variant="secondary" onClick={openCreate}>
            Nova matrícula
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              { value: "ativo", label: "Ativos", count: counts.ativo },
              { value: "trancado", label: "Trancados", count: counts.trancado },
              { value: "inativo", label: "Inativos", count: counts.inativo },
              { value: "todos", label: "Todos", count: counts.todos },
            ]}
          />
          <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, e-mail ou telefone" />
            <Select value={sport} onChange={(e) => setSport(e.target.value as SportType | "")}>
              <option value="">Todos os esportes</option>
              {SPORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select value={level} onChange={(e) => setLevel(e.target.value as Level | "")}>
              <option value="">Todos os níveis</option>
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum aluno encontrado"
            description="Ajuste os filtros ou faça uma nova matrícula."
            action={
              <Button icon={UserPlus} onClick={openCreate}>
                Nova matrícula
              </Button>
            }
          />
        ) : (
          <>
            {/* Tabela desktop */}
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Aluno</th>
                  <th className="px-3 py-3">Esporte / nível</th>
                  <th className="px-3 py-3">Turmas</th>
                  <th className="px-3 py-3">Plano</th>
                  <th className="px-3 py-3">Saldo</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const sub = currentSubscription(data.subs, s.id);
                  const plan = data.plans.find((p) => p.id === sub?.planId);
                  const groups = data.groups.filter((g) => g.studentIds.includes(s.id));
                  return (
                    <tr key={s.id} onClick={() => openDetail(s.id)} className="cursor-pointer transition hover:bg-ocean-50/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{s.name}</p>
                            <p className="truncate text-xs text-slate-500">{s.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {s.sports.map((sp) => (
                            <SportBadge key={sp} sport={sp} short />
                          ))}
                          <LevelBadge level={s.level} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {groups.length ? groups.map((g) => g.name).join(", ") : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {plan ? (
                          <>
                            <p className="font-medium text-slate-800">{plan.name}</p>
                            <p className="text-slate-400">até {formatShortDate(sub!.endDate)}</p>
                          </>
                        ) : (
                          <span className="text-slate-400">Sem plano</span>
                        )}
                      </td>
                      <td className="px-3 py-3">{s.status === "ativo" && <CreditBadge balance={creditBalance(data.subs, s.id)} />}</td>
                      <td className="px-3 py-3">
                        <StatusBadge {...STUDENT_STATUS[s.status]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Cards mobile */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button onClick={() => openDetail(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <Avatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{s.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.sports.map((sp) => (
                          <SportBadge key={sp} sport={sp} short />
                        ))}
                        <LevelBadge level={s.level} />
                      </div>
                    </div>
                    {s.status === "ativo" ? <CreditBadge balance={creditBalance(data.subs, s.id)} /> : <StatusBadge {...STUDENT_STATUS[s.status]} />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* Formulário */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        size="lg"
        title={editingId ? "Editar aluno" : "Nova matrícula"}
        description={editingId ? undefined : "Cadastre o aluno, escolha as turmas e o plano"}
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              {editingId ? "Salvar alterações" : "Concluir matrícula"}
            </Button>
          </>
        }
      >
        <StudentForm
          value={form}
          onChange={setForm}
          groups={data.groups}
          teachers={data.teachers}
          plans={data.plans}
          mode={editingId ? "edit" : "create"}
          studentId={editingId ?? undefined}
          errors={errors}
        />
      </Modal>

      {/* Ficha do aluno */}
      <Modal open={!!detail} onClose={() => openDetail(null)} side size="lg" title="Ficha do aluno">
        {detail && (
          <StudentDetail
            student={detail}
            data={data}
            onEdit={() => {
              openDetail(null);
              openEdit(detail);
            }}
            onChurn={() => setChurnFor(detail)}
            onReactivate={() => run(() => studentService.reactivate(detail.id), "Aluno reativado")}
            onLock={() =>
              run(
                () => studentService.update(detail.id, { status: detail.status === "trancado" ? "ativo" : "trancado" }),
                detail.status === "trancado" ? "Matrícula destrancada" : "Matrícula trancada",
              )
            }
            onDelete={async () => {
              const ok = await confirm({
                title: "Excluir cadastro?",
                description: "Use apenas para cadastros feitos por engano. Para saídas de alunos, use “Cancelar matrícula” e registre o motivo.",
                confirmLabel: "Excluir",
              });
              if (!ok) return;
              await run(() => studentService.remove(detail.id), "Cadastro excluído");
              openDetail(null);
            }}
          />
        )}
      </Modal>

      <ChurnModal student={churnFor} onClose={() => setChurnFor(null)} />
    </div>
  );
}

function StudentDetail({
  student,
  data,
  onEdit,
  onChurn,
  onReactivate,
  onLock,
  onDelete,
}: {
  student: Student;
  data: PageData;
  onEdit: () => void;
  onChurn: () => void;
  onReactivate: () => void;
  onLock: () => void;
  onDelete: () => void;
}) {
  const subs = data.subs.filter((s) => s.studentId === student.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const current = currentSubscription(data.subs, student.id);
  const plan = data.plans.find((p) => p.id === current?.planId);
  const groups = data.groups.filter((g) => g.studentIds.includes(student.id));
  const history = data.attendances.filter((a) => a.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date));
  const last30 = history.filter((a) => diffDays(today(), a.date) <= 30 && a.date <= today());
  const freq = last30.length ? last30.filter((a) => a.status === "presente").length / last30.length : 0;
  const churn = data.churn.filter((c) => c.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const balance = creditBalance(data.subs, student.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Avatar name={student.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-slate-900">{student.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            <StatusBadge {...STUDENT_STATUS[student.status]} />
            {student.sports.map((s) => (
              <SportBadge key={s} sport={s} />
            ))}
            <LevelBadge level={student.level} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <a href={`https://wa.me/55${student.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ocean-700">
              <Phone className="size-3.5" /> {student.phone}
            </a>
            {student.email && (
              <a href={`mailto:${student.email}`} className="inline-flex items-center gap-1 hover:text-ocean-700">
                <Mail className="size-3.5" /> {student.email}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Saldo" value={balance} sub="aulas" tone={balance <= 0 ? "rose" : balance <= 2 ? "amber" : "emerald"} />
        <MiniStat label="Frequência" value={formatPercent(freq)} sub="últimos 30 dias" />
        <MiniStat label="Aluno desde" value={formatShortDate(student.joinedAt)} sub={student.joinedAt.slice(0, 4)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={Pencil} onClick={onEdit}>
          Editar
        </Button>
        <Link href={`/planos?aba=assinaturas&aluno=${student.id}`}>
          <Button size="sm" variant="outline" icon={Ticket}>
            {current ? "Renovar / vender plano" : "Vender plano"}
          </Button>
        </Link>
        {student.status === "inativo" ? (
          <Button size="sm" variant="success" icon={RotateCcw} onClick={onReactivate}>
            Reativar
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={onLock}>
              {student.status === "trancado" ? "Destrancar" : "Trancar matrícula"}
            </Button>
            <Button size="sm" variant="danger" icon={LogOut} onClick={onChurn}>
              Cancelar matrícula
            </Button>
          </>
        )}
      </div>

      {churn && student.status === "inativo" && (
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-100">
          Saiu em {formatDate(churn.date)} — <strong>{CHURN_REASONS[churn.reason]}</strong>
          {churn.details && <span className="block text-rose-700/80">“{churn.details}”</span>}
        </div>
      )}

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Plano atual</h4>
        {current && plan ? (
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">{plan.name}</p>
              <CreditBadge balance={remainingCredits(current)} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {formatDate(current.startDate)} até {formatDate(current.endDate)} · {current.creditsUsed}/{current.creditsTotal} aulas usadas
              {current.autoRenew && " · renovação automática"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhum plano ativo.</p>
        )}
        {subs.length > 1 && (
          <details className="mt-2 text-xs text-slate-500">
            <summary className="cursor-pointer font-medium text-ocean-700">Histórico de planos ({subs.length})</summary>
            <ul className="mt-2 space-y-1">
              {subs.map((s) => (
                <li key={s.id} className="flex justify-between">
                  <span>{data.plans.find((p) => p.id === s.planId)?.name}</span>
                  <span>
                    {formatDate(s.startDate)} – {formatDate(s.endDate)} · {s.status}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Turmas</h4>
        {groups.length ? (
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{g.name}</span>
                <span className="text-xs text-slate-500">
                  {g.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")} · {g.startTime}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Não está matriculado em nenhuma turma.</p>
        )}
      </section>

      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <CalendarCheck className="size-3.5" /> Últimas aulas
        </h4>
        {history.length ? (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {history.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-slate-700">
                  {formatDate(a.date)} · {data.groups.find((g) => g.id === a.classGroupId)?.name ?? "Turma removida"}
                  {a.isMakeup && <Badge className="ml-1.5">Reposição</Badge>}
                </span>
                <StatusBadge {...ATTENDANCE_STATUS[a.status]} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Sem registros de presença.</p>
        )}
      </section>

      {student.notes && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Observações</h4>
          <p className="text-sm text-slate-700">{student.notes}</p>
        </section>
      )}

      <button onClick={onDelete} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-rose-600">
        <Trash2 className="size-3.5" /> Excluir cadastro
      </button>
    </div>
  );
}

function MiniStat({ label, value, sub, tone = "slate" }: { label: string; value: ReactNode; sub: string; tone?: "slate" | "rose" | "amber" | "emerald" }) {
  const tones = { slate: "text-slate-900", rose: "text-rose-600", amber: "text-amber-600", emerald: "text-emerald-600" };
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("font-display text-xl font-bold", tones[tone])}>{value}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}

function ChurnModal({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const { run } = useFeedback();
  const [reason, setReason] = useState<ChurnReason>("horario");
  const [details, setDetails] = useState("");
  const [wouldReturn, setWouldReturn] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!student) return;
    setSaving(true);
    const ok = await run(
      () => studentService.cancelEnrollment({ studentId: student.id, reason, details: details.trim() || undefined, wouldReturn }),
      "Matrícula cancelada e motivo registrado",
    );
    setSaving(false);
    if (ok) {
      setDetails("");
      onClose();
    }
  };

  return (
    <Modal
      open={!!student}
      onClose={onClose}
      title="Cancelar matrícula"
      description={student ? `${student.name} será removido(a) das turmas e os planos ativos serão encerrados.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="danger" onClick={submit} loading={saving}>
            Confirmar cancelamento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Motivo principal da saída" required>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.entries(CHURN_REASONS) as [ChurnReason, string][]).map(([k, label]) => (
              <button
                type="button"
                key={k}
                onClick={() => setReason(k)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left text-sm transition",
                  reason === k ? "border-rose-400 bg-rose-50 font-semibold text-rose-800" : "border-slate-200 text-slate-600 hover:border-slate-300",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Detalhes (opcional)">
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="O que o aluno relatou? O que poderia ter sido diferente?" />
        </Field>
        <Switch checked={wouldReturn} onChange={setWouldReturn} label="Aluno demonstrou interesse em voltar" description="Ajuda a priorizar campanhas de reativação" />
      </div>
    </Modal>
  );
}
