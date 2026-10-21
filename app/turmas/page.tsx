"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, LandPlot, Pencil, Plus, Trash2, UserMinus, UserPlus, UsersRound } from "lucide-react";
import type { ClassGroup, Court, ID, Level, NewEntity, SportType, Weekday } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { classGroupService, findConflicts } from "@/services/class-group.service";
import { LEVEL_OPTIONS, LEVELS, SPORT_OPTIONS, SPORTS } from "@/lib/constants";
import { WEEKDAY_SHORT, timeToMinutes, today } from "@/lib/date";
import { cn, normalize } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageLoading,
  ProgressBar,
  SearchInput,
  Select,
  Switch,
  Tabs,
} from "@/components/ui/primitives";
import { LevelBadge, SportBadge } from "@/components/ui/badges";
import { Modal } from "@/components/ui/modal";
import { useFeedback } from "@/components/ui/feedback-provider";

type GroupForm = NewEntity<ClassGroup>;

async function load() {
  const [groups, teachers, courts, students] = await Promise.all([
    db.classGroups.list(),
    db.teachers.list(),
    db.courts.list(),
    db.students.list(),
  ]);
  return { groups, teachers, courts, students };
}

const WEEKDAY_OPTIONS = ([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((d) => ({ value: d, label: WEEKDAY_SHORT[d] }));

export default function GroupsPage() {
  const { run, confirm } = useFeedback();
  const data = useLiveQuery(load);
  const [tab, setTab] = useState<"turmas" | "quadras">("turmas");
  const [sport, setSport] = useState<SportType | "">("");
  const [editing, setEditing] = useState<{ id: ID | null; form: GroupForm } | null>(null);
  const [rosterId, setRosterId] = useState<ID | null>(null);
  const [courtEditing, setCourtEditing] = useState<{ id: ID | null; form: NewEntity<Court> } | null>(null);

  const conflicts = useMemo(() => {
    if (!editing || !data) return [];
    return findConflicts(editing.form, data.groups, editing.id ?? undefined);
  }, [editing, data]);

  if (!data) return <PageLoading />;

  const groups = data.groups
    .filter((g) => !sport || g.sport_type === sport)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.weekdays[0] - b.weekdays[0] || a.startTime.localeCompare(b.startTime));

  const newGroup = (): GroupForm => ({
    name: "",
    sport_type: "beach_tennis",
    level: "iniciante",
    teacherId: data.teachers.find((t) => t.active)?.id ?? "",
    courtId: data.courts.find((c) => c.active)?.id ?? "",
    weekdays: [1, 3],
    startTime: "19:00",
    endTime: "20:00",
    capacity: 4,
    studentIds: [],
    active: true,
  });

  const saveGroup = async () => {
    if (!editing) return;
    const f = editing.form;
    const name = f.name.trim() || `${SPORTS[f.sport_type].short} ${LEVELS[f.level].label} ${f.startTime.slice(0, 2)}h`;
    if (!f.teacherId || !f.courtId) return run(async () => Promise.reject(new Error("Selecione professor e quadra")));
    if (!f.weekdays.length) return run(async () => Promise.reject(new Error("Selecione ao menos um dia da semana")));
    if (timeToMinutes(f.endTime) <= timeToMinutes(f.startTime)) return run(async () => Promise.reject(new Error("Horário final deve ser após o inicial")));
    if (f.capacity < f.studentIds.length) return run(async () => Promise.reject(new Error(`Capacidade menor que os ${f.studentIds.length} alunos matriculados`)));
    if (conflicts.length) {
      const ok = await confirm({
        title: "Conflito de horário",
        description: `Existem ${conflicts.length} conflito(s) de quadra/professor neste horário. Deseja salvar mesmo assim?`,
        confirmLabel: "Salvar assim mesmo",
        tone: "primary",
      });
      if (!ok) return;
    }
    const ok = await run(
      () => (editing.id ? db.classGroups.update(editing.id, { ...f, name }) : db.classGroups.create({ ...f, name })),
      editing.id ? "Turma atualizada" : "Turma criada",
    );
    if (ok) setEditing(null);
  };

  const removeGroup = async (g: ClassGroup) => {
    const ok = await confirm({
      title: "Excluir turma?",
      description: g.studentIds.length
        ? `${g.studentIds.length} aluno(s) serão desvinculados. O histórico de presença é mantido. Prefira desativar a turma se for temporário.`
        : "A turma será removida.",
      confirmLabel: "Excluir",
    });
    if (ok) await run(() => db.classGroups.remove(g.id), "Turma excluída");
  };

  const saveCourt = async () => {
    if (!courtEditing) return;
    if (courtEditing.form.name.trim().length < 2) return run(async () => Promise.reject(new Error("Informe o nome da quadra")));
    const ok = await run(
      () => (courtEditing.id ? db.courts.update(courtEditing.id, courtEditing.form) : db.courts.create(courtEditing.form)),
      "Quadra salva",
    );
    if (ok) setCourtEditing(null);
  };

  const rosterGroup = rosterId ? data.groups.find((g) => g.id === rosterId) : undefined;

  return (
    <div>
      <PageHeader
        title="Turmas & Quadras"
        description="Horários, capacidade, professores e alocação de alunos"
        icon={UsersRound}
        actions={
          tab === "turmas" ? (
            <Button icon={Plus} variant="secondary" onClick={() => setEditing({ id: null, form: newGroup() })} disabled={!data.courts.length || !data.teachers.length}>
              Nova turma
            </Button>
          ) : (
            <Button icon={Plus} variant="secondary" onClick={() => setCourtEditing({ id: null, form: { name: "", sport_type: "beach_tennis", covered: false, active: true } })}>
              Nova quadra
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "turmas", label: "Turmas", count: data.groups.length, icon: UsersRound },
            { value: "quadras", label: "Quadras", count: data.courts.length, icon: LandPlot },
          ]}
        />
        {tab === "turmas" && (
          <ChipGroup
            multiple={false}
            options={[{ value: "" as SportType | "", label: "Todos" }, ...SPORT_OPTIONS]}
            value={[sport]}
            onChange={(v) => setSport(v[0] ?? "")}
          />
        )}
      </div>

      {tab === "turmas" ? (
        groups.length === 0 ? (
          <Card>
            <EmptyState
              icon={UsersRound}
              title="Nenhuma turma"
              description={!data.courts.length ? "Cadastre primeiro uma quadra." : "Crie a primeira turma e defina os horários."}
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => {
              const teacher = data.teachers.find((t) => t.id === g.teacherId);
              const court = data.courts.find((c) => c.id === g.courtId);
              const occ = g.studentIds.length / g.capacity;
              return (
                <Card key={g.id} className={cn("flex flex-col p-5", !g.active && "opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{g.name}</h3>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <SportBadge sport={g.sport_type} />
                        <LevelBadge level={g.level} />
                        {!g.active && <Badge>Inativa</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl font-bold text-slate-900">{g.startTime}</p>
                      <p className="text-xs text-slate-400">até {g.endTime}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-1">
                    {WEEKDAY_OPTIONS.map((d) => (
                      <span
                        key={d.value}
                        className={cn(
                          "flex-1 rounded-md py-1 text-center text-[11px] font-semibold",
                          g.weekdays.includes(d.value) ? "bg-ocean-700 text-white" : "bg-slate-100 text-slate-400",
                        )}
                      >
                        {d.label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                    {teacher && <Avatar name={teacher.name} color={teacher.color} size="sm" />}
                    <span className="truncate">{teacher?.name ?? "Sem professor"}</span>
                    <span className="text-slate-300">·</span>
                    <span className="truncate">{court?.name ?? "Sem quadra"}</span>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-500">Ocupação</span>
                      <span className="font-semibold tabular-nums text-slate-800">
                        {g.studentIds.length}/{g.capacity} · {g.capacity - g.studentIds.length} vaga(s)
                      </span>
                    </div>
                    <ProgressBar value={occ} tone={occ >= 1 ? "sun" : "ocean"} />
                  </div>
                  <div className="mt-auto flex gap-2 pt-5">
                    <Button size="sm" variant="outline" icon={UsersRound} onClick={() => setRosterId(g.id)} className="flex-1">
                      Alunos
                    </Button>
                    <Link href={`/chamada?turma=${g.id}&data=${today()}`}>
                      <Button size="icon" variant="ghost" aria-label="Chamada">
                        <ClipboardCheck className="size-4" />
                      </Button>
                    </Link>
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ id: g.id, form: { ...g } })} aria-label="Editar">
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeGroup(g)} aria-label="Excluir">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <Card className="overflow-hidden">
          {data.courts.length === 0 ? (
            <EmptyState icon={LandPlot} title="Nenhuma quadra cadastrada" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.courts.map((c) => {
                const count = data.groups.filter((g) => g.courtId === c.id && g.active).length;
                return (
                  <li key={c.id} className="flex items-center gap-4 px-5 py-4">
                    <div className={cn("flex size-11 items-center justify-center rounded-xl", c.active ? "bg-sand-100 text-sand-400" : "bg-slate-100 text-slate-300")}>
                      <LandPlot className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {c.name} {!c.active && <Badge className="ml-1">Inativa</Badge>}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <SportBadge sport={c.sport_type} />
                        <Badge>{c.covered ? "Coberta" : "Descoberta"}</Badge>
                        <Badge>{count} turma(s)</Badge>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setCourtEditing({ id: c.id, form: { ...c } })} aria-label="Editar">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir"
                      onClick={async () => {
                        if (count) return run(async () => Promise.reject(new Error("Remova ou mova as turmas desta quadra antes de excluí-la")));
                        if (await confirm({ title: "Excluir quadra?", confirmLabel: "Excluir" })) await run(() => db.courts.remove(c.id), "Quadra excluída");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {/* Formulário de turma */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? "Editar turma" : "Nova turma"}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveGroup}>Salvar turma</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Nome da turma" hint="Deixe em branco para gerar automaticamente (ex.: BT Iniciante 19h)">
              <Input value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Esporte">
                <Select
                  value={editing.form.sport_type}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, sport_type: e.target.value as SportType } })}
                >
                  {SPORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nível">
                <Select value={editing.form.level} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, level: e.target.value as Level } })}>
                  {LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Professor" required>
                <Select value={editing.form.teacherId} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, teacherId: e.target.value } })}>
                  <option value="">Selecione</option>
                  {data.teachers
                    .filter((t) => t.active || t.id === editing.form.teacherId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {!t.sports.includes(editing.form.sport_type) ? "(outro esporte)" : ""}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Quadra" required>
                <Select value={editing.form.courtId} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, courtId: e.target.value } })}>
                  <option value="">Selecione</option>
                  {data.courts
                    .filter((c) => c.active || c.id === editing.form.courtId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {SPORTS[c.sport_type].label}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            <Field label="Dias da semana" required>
              <ChipGroup options={WEEKDAY_OPTIONS} value={editing.form.weekdays} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, weekdays: v } })} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Início">
                <Input type="time" value={editing.form.startTime} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, startTime: e.target.value } })} />
              </Field>
              <Field label="Fim">
                <Input type="time" value={editing.form.endTime} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, endTime: e.target.value } })} />
              </Field>
              <Field label="Vagas">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={editing.form.capacity}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, capacity: Math.max(1, Number(e.target.value)) } })}
                />
              </Field>
            </div>
            <Switch checked={editing.form.active} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, active: v } })} label="Turma ativa" description="Turmas inativas não aparecem na agenda" />
            {conflicts.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="size-4" /> Conflitos de horário
                </p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      {c.type === "quadra" ? "Quadra ocupada" : "Professor ocupado"} por <strong>{c.group.name}</strong> ({c.group.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")} {c.group.startTime}–{c.group.endTime})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Alunos da turma */}
      <RosterModal group={rosterGroup} students={data.students} onClose={() => setRosterId(null)} />

      {/* Formulário de quadra */}
      <Modal
        open={!!courtEditing}
        onClose={() => setCourtEditing(null)}
        size="sm"
        title={courtEditing?.id ? "Editar quadra" : "Nova quadra"}
        footer={
          <>
            <Button variant="outline" onClick={() => setCourtEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveCourt}>Salvar</Button>
          </>
        }
      >
        {courtEditing && (
          <div className="space-y-4">
            <Field label="Nome" required>
              <Input value={courtEditing.form.name} onChange={(e) => setCourtEditing({ ...courtEditing, form: { ...courtEditing.form, name: e.target.value } })} autoFocus />
            </Field>
            <Field label="Esporte principal">
              <Select
                value={courtEditing.form.sport_type}
                onChange={(e) => setCourtEditing({ ...courtEditing, form: { ...courtEditing.form, sport_type: e.target.value as SportType } })}
              >
                {SPORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Switch checked={courtEditing.form.covered} onChange={(v) => setCourtEditing({ ...courtEditing, form: { ...courtEditing.form, covered: v } })} label="Quadra coberta" />
            <Switch checked={courtEditing.form.active} onChange={(v) => setCourtEditing({ ...courtEditing, form: { ...courtEditing.form, active: v } })} label="Quadra ativa" />
          </div>
        )}
      </Modal>
    </div>
  );
}

function RosterModal({ group, students, onClose }: { group?: ClassGroup; students: import("@/types").Student[]; onClose: () => void }) {
  const { run } = useFeedback();
  const [search, setSearch] = useState("");
  if (!group) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const enrolled = students.filter((s) => group.studentIds.includes(s.id));
  const q = normalize(search);
  const candidates = students
    .filter((s) => s.status === "ativo" && !group.studentIds.includes(s.id))
    .filter((s) => !q || normalize(s.name).includes(q))
    .sort((a, b) => Number(b.sports.includes(group.sport_type) && b.level === group.level) - Number(a.sports.includes(group.sport_type) && a.level === group.level) || a.name.localeCompare(b.name))
    .slice(0, 12);
  const full = enrolled.length >= group.capacity;

  return (
    <Modal open onClose={onClose} size="lg" title={`Alunos · ${group.name}`} description={`${enrolled.length} de ${group.capacity} vagas ocupadas`}>
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Matriculados</h4>
          {enrolled.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum aluno ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {enrolled.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Avatar name={s.name} size="sm" />
                  <span className="flex-1 truncate text-sm font-medium text-slate-800">{s.name}</span>
                  <LevelBadge level={s.level} />
                  <button onClick={() => run(() => classGroupService.removeStudent(group.id, s.id), "Aluno removido da turma")} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remover">
                    <UserMinus className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Adicionar aluno</h4>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar aluno ativo" />
          {full && <p className="mt-2 text-xs font-medium text-amber-700">Turma lotada — aumente as vagas para adicionar.</p>}
          <ul className="mt-2 space-y-1.5">
            {candidates.map((s) => {
              const match = s.sports.includes(group.sport_type) && s.level === group.level;
              return (
                <li key={s.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                  <span className="flex-1 truncate text-sm text-slate-700">
                    {s.name}
                    {match && <span className="ml-1.5 text-[10px] font-semibold uppercase text-emerald-600">compatível</span>}
                  </span>
                  <LevelBadge level={s.level} />
                  <button disabled={full} onClick={() => run(() => classGroupService.addStudent(group.id, s.id), "Aluno adicionado")} className="rounded-lg p-1.5 text-ocean-600 hover:bg-ocean-50 disabled:opacity-30" aria-label="Adicionar">
                    <UserPlus className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
