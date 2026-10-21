"use client";

import { useState, type ReactNode } from "react";
import { GraduationCap, Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import type { ID, SportType, Teacher } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { durationMinutes } from "@/services/class-group.service";
import { SPORT_OPTIONS, TEACHER_COLORS } from "@/lib/constants";
import { WEEKDAY_SHORT } from "@/lib/date";
import { cn, sum } from "@/lib/utils";
import { Avatar, Badge, Button, Card, ChipGroup, EmptyState, Field, Input, PageHeader, PageLoading, Switch, Textarea } from "@/components/ui/primitives";
import { SportBadge } from "@/components/ui/badges";
import { Modal } from "@/components/ui/modal";
import { useFeedback } from "@/components/ui/feedback-provider";
import { maskPhone } from "@/components/students/student-form";

interface FormState {
  name: string;
  phone: string;
  email: string;
  sports: SportType[];
  color: string;
  bio: string;
  active: boolean;
}
const empty: FormState = { name: "", phone: "", email: "", sports: ["beach_tennis"], color: TEACHER_COLORS[0], bio: "", active: true };

export default function TeachersPage() {
  const { run, confirm } = useFeedback();
  const data = useLiveQuery(async () => ({ teachers: await db.teachers.list(), groups: await db.classGroups.list() }));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ID | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState("");

  if (!data) return <PageLoading />;

  const openForm = (t?: Teacher) => {
    setEditing(t?.id ?? null);
    setForm(t ? { name: t.name, phone: t.phone, email: t.email, sports: t.sports, color: t.color, bio: t.bio ?? "", active: t.active } : { ...empty, color: TEACHER_COLORS[data.teachers.length % TEACHER_COLORS.length] });
    setError("");
    setOpen(true);
  };

  const save = async () => {
    if (form.name.trim().length < 3) return setError("Informe o nome do professor");
    if (!form.sports.length) return setError("Selecione ao menos um esporte");
    const payload = { ...form, name: form.name.trim(), bio: form.bio.trim() || undefined };
    const ok = await run(
      () => (editing ? db.teachers.update(editing, payload) : db.teachers.create(payload)),
      editing ? "Professor atualizado" : "Professor cadastrado",
    );
    if (ok) setOpen(false);
  };

  const remove = async (t: Teacher) => {
    const linked = data.groups.filter((g) => g.teacherId === t.id);
    if (linked.length) {
      const ok = await confirm({
        title: "Professor com turmas",
        description: `${t.name} é responsável por ${linked.length} turma(s). Ele será desativado em vez de excluído — reatribua as turmas em Turmas & Quadras.`,
        confirmLabel: "Desativar",
        tone: "primary",
      });
      if (ok) await run(() => db.teachers.update(t.id, { active: false }), "Professor desativado");
      return;
    }
    const ok = await confirm({ title: "Excluir professor?", description: `${t.name} será removido definitivamente.`, confirmLabel: "Excluir" });
    if (ok) await run(() => db.teachers.remove(t.id), "Professor excluído");
  };

  const sorted = [...data.teachers].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        title="Professores"
        description="Equipe técnica, especialidades e carga horária"
        icon={GraduationCap}
        actions={
          <Button icon={Plus} variant="secondary" onClick={() => openForm()}>
            Novo professor
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <Card>
          <EmptyState icon={GraduationCap} title="Nenhum professor cadastrado" action={<Button onClick={() => openForm()}>Cadastrar</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((t) => {
            const groups = data.groups.filter((g) => g.teacherId === t.id && g.active);
            const weeklyHours = sum(groups, (g) => durationMinutes(g) * g.weekdays.length) / 60;
            const students = new Set(groups.flatMap((g) => g.studentIds)).size;
            return (
              <Card key={t.id} className={cn("overflow-hidden", !t.active && "opacity-60")}>
                <div className="h-1.5" style={{ backgroundColor: t.color }} />
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={t.name} color={t.color} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-lg font-bold text-slate-900">{t.name}</h3>
                        {!t.active && <Badge>Inativo</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.sports.map((s) => (
                          <SportBadge key={s} sport={s} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Metric label="Turmas" value={groups.length} />
                    <Metric label="Alunos" value={students} />
                    <Metric label="h/semana" value={weeklyHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} />
                  </div>
                  {groups.length > 0 && (
                    <ul className="mt-4 space-y-1">
                      {groups.slice(0, 4).map((g) => (
                        <li key={g.id} className="flex justify-between text-xs text-slate-600">
                          <span className="truncate">{g.name}</span>
                          <span className="shrink-0 text-slate-400">
                            {g.weekdays.map((d) => WEEKDAY_SHORT[d]).join("/")} {g.startTime}
                          </span>
                        </li>
                      ))}
                      {groups.length > 4 && <li className="text-xs text-slate-400">+{groups.length - 4} turmas</li>}
                    </ul>
                  )}
                  <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <p className="flex items-center gap-1.5">
                      <Phone className="size-3.5" /> {t.phone || "—"}
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="size-3.5" /> {t.email || "—"}
                    </p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" icon={Pencil} onClick={() => openForm(t)} className="flex-1">
                      Editar
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(t)} aria-label="Excluir">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar professor" : "Novo professor"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Field label="Nome" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} inputMode="tel" />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Esportes que leciona" required>
            <ChipGroup options={SPORT_OPTIONS} value={form.sports} onChange={(v) => setForm({ ...form, sports: v })} />
          </Field>
          <Field label="Cor na agenda">
            <div className="flex flex-wrap gap-2">
              {TEACHER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn("size-8 rounded-full ring-offset-2 transition", form.color === c && "ring-2 ring-slate-900")}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </Field>
          <Field label="Mini bio">
            <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </Field>
          <Switch checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Professor ativo" />
        </div>
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 py-2">
      <p className="font-display text-xl font-bold text-slate-900">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
