"use client";

import { useState } from "react";
import type { ClassGroup, Level, PaymentMethod, Plan, SportType, Student, Teacher } from "@/types";
import { LEVEL_OPTIONS, PAYMENT_METHODS, PLAN_TYPES, SPORT_OPTIONS } from "@/lib/constants";
import { WEEKDAY_SHORT } from "@/lib/date";
import { cn, formatCurrency } from "@/lib/utils";
import { ChipGroup, Field, Input, Select, Switch, Textarea } from "@/components/ui/primitives";
import { LevelBadge, SportBadge } from "@/components/ui/badges";

export interface StudentFormValues {
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  level: Level;
  sports: SportType[];
  notes: string;
  classGroupIds: string[];
  planId: string;
  paid: boolean;
  method: PaymentMethod;
}

export function emptyStudentForm(): StudentFormValues {
  return {
    name: "",
    phone: "",
    email: "",
    birthDate: "",
    level: "iniciante",
    sports: ["beach_tennis"],
    notes: "",
    classGroupIds: [],
    planId: "",
    paid: true,
    method: "pix",
  };
}

export function studentToForm(s: Student, groups: ClassGroup[]): StudentFormValues {
  return {
    ...emptyStudentForm(),
    name: s.name,
    phone: s.phone,
    email: s.email,
    birthDate: s.birthDate ?? "",
    level: s.level,
    sports: s.sports,
    notes: s.notes ?? "",
    classGroupIds: groups.filter((g) => g.studentIds.includes(s.id)).map((g) => g.id),
  };
}

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function StudentForm({
  value,
  onChange,
  groups,
  teachers,
  plans,
  mode,
  studentId,
  errors,
}: {
  value: StudentFormValues;
  onChange: (v: StudentFormValues) => void;
  groups: ClassGroup[];
  teachers: Teacher[];
  plans: Plan[];
  mode: "create" | "edit";
  studentId?: string;
  errors: Partial<Record<keyof StudentFormValues, string>>;
}) {
  const [showAllGroups, setShowAllGroups] = useState(false);
  const set = <K extends keyof StudentFormValues>(k: K, v: StudentFormValues[K]) => onChange({ ...value, [k]: v });

  const relevant = groups
    .filter((g) => g.active)
    .filter((g) => showAllGroups || (value.sports.includes(g.sport_type) && g.level === value.level) || value.classGroupIds.includes(g.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedPlan = plans.find((p) => p.id === value.planId);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" required error={errors.name} className="sm:col-span-2">
          <Input value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Ana Souza" autoFocus />
        </Field>
        <Field label="WhatsApp" required error={errors.phone}>
          <Input value={value.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(47) 99999-9999" inputMode="tel" />
        </Field>
        <Field label="E-mail" error={errors.email}>
          <Input type="email" value={value.email} onChange={(e) => set("email", e.target.value)} placeholder="aluno@email.com" />
        </Field>
        <Field label="Data de nascimento">
          <Input type="date" value={value.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        </Field>
        <Field label="Nível">
          <Select value={value.level} onChange={(e) => set("level", e.target.value as Level)}>
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Esportes" error={errors.sports} className="sm:col-span-2">
          <ChipGroup options={SPORT_OPTIONS} value={value.sports} onChange={(v) => set("sports", v)} />
        </Field>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Turmas / horários</p>
          <button type="button" onClick={() => setShowAllGroups((v) => !v)} className="text-xs font-medium text-ocean-700 hover:underline">
            {showAllGroups ? "Mostrar só compatíveis" : "Mostrar todas"}
          </button>
        </div>
        {relevant.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
            Nenhuma turma compatível com esporte e nível. Clique em “Mostrar todas”.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {relevant.map((g) => {
              const selected = value.classGroupIds.includes(g.id);
              const occupied = g.studentIds.filter((id) => id !== studentId).length;
              const full = occupied >= g.capacity && !selected;
              const teacher = teachers.find((t) => t.id === g.teacherId);
              return (
                <button
                  type="button"
                  key={g.id}
                  disabled={full}
                  onClick={() =>
                    set("classGroupIds", selected ? value.classGroupIds.filter((id) => id !== g.id) : [...value.classGroupIds, g.id])
                  }
                  className={cn(
                    "rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                    selected ? "border-ocean-500 bg-ocean-50 ring-2 ring-ocean-200" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{g.name}</p>
                    <span className={cn("text-xs font-semibold tabular-nums", full ? "text-rose-600" : "text-slate-500")}>
                      {occupied + (selected ? 1 : 0)}/{g.capacity}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {g.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")} · {g.startTime}–{g.endTime} · {teacher?.name.split(" ")[0]}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <SportBadge sport={g.sport_type} short />
                    <LevelBadge level={g.level} />
                    {full && <span className="text-[11px] font-medium text-rose-600">Lotada</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {mode === "create" && (
        <section className="space-y-4 rounded-2xl bg-sand-50 p-4 ring-1 ring-sand-200">
          <Field label="Plano / pacote" hint="Opcional — pode ser vendido depois em Planos & Pacotes">
            <Select value={value.planId} onChange={(e) => set("planId", e.target.value)}>
              <option value="">Sem plano por enquanto</option>
              {plans
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {PLAN_TYPES[p.type].label} · {p.name} — {formatCurrency(p.price)} ({p.credits} aulas)
                  </option>
                ))}
            </Select>
          </Field>
          {selectedPlan && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Switch checked={value.paid} onChange={(v) => set("paid", v)} label="Pagamento recebido" description="Se desligado, gera conta a receber" />
              <Field label="Forma de pagamento">
                <Select value={value.method} onChange={(e) => set("method", e.target.value as PaymentMethod)}>
                  {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </section>
      )}

      <Field label="Observações">
        <Textarea value={value.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Lesões, preferências de horário, objetivos..." />
      </Field>
    </div>
  );
}

export function validateStudentForm(v: StudentFormValues) {
  const errors: Partial<Record<keyof StudentFormValues, string>> = {};
  if (v.name.trim().length < 3) errors.name = "Informe o nome completo";
  if (v.phone.replace(/\D/g, "").length < 10) errors.phone = "Telefone inválido";
  if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) errors.email = "E-mail inválido";
  if (v.sports.length === 0) errors.sports = "Selecione ao menos um esporte";
  return errors;
}
