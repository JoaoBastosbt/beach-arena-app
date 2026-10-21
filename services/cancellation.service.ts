import type { CancellationRequest, ClassGroup, ID, ISODate, Level, SportType } from "@/types";
import { addDays, toDateTime, today, weekdayOf } from "@/lib/date";
import { db } from "./repositories";
import { settingsService } from "./settings.service";
import { attendanceService } from "./attendance.service";

export interface MakeupSlot {
  group: ClassGroup;
  date: ISODate;
  spotsLeft: number;
}

/** Vagas livres de uma turma numa data específica (considera cancelamentos e reposições) */
export function spotsLeftOn(group: ClassGroup, date: ISODate, cancellations: CancellationRequest[]) {
  const freedByCancel = cancellations.filter(
    (c) =>
      c.classGroupId === group.id &&
      c.classDate === date &&
      c.status !== "recusada" &&
      group.studentIds.includes(c.studentId),
  ).length;
  const takenByMakeup = cancellations.filter(
    (c) =>
      c.makeupClassGroupId === group.id &&
      c.makeupDate === date &&
      (c.status === "reposicao_agendada" || c.status === "reposta"),
  ).length;
  return group.capacity - group.studentIds.length + freedByCancel - takenByMakeup;
}

export function hoursUntilClass(group: ClassGroup, classDate: ISODate, now = new Date()) {
  return (toDateTime(classDate, group.startTime).getTime() - now.getTime()) / 3_600_000;
}

export const cancellationService = {
  /** Aluno solicita cancelamento de uma aula. Regra de antecedência define direito à reposição. */
  async request(input: { studentId: ID; classGroupId: ID; classDate: ISODate; reason: string; now?: Date }) {
    const group = await db.classGroups.get(input.classGroupId);
    if (!group) throw new Error("Turma não encontrada");
    if (!group.weekdays.includes(weekdayOf(input.classDate))) throw new Error("A turma não tem aula nesta data");
    if (!group.studentIds.includes(input.studentId)) throw new Error("O aluno não está matriculado nesta turma");

    const existing = await db.cancellations.list({
      studentId: input.studentId,
      classGroupId: input.classGroupId,
      classDate: input.classDate,
    });
    if (existing.some((c) => c.status !== "recusada")) throw new Error("Já existe um cancelamento para esta aula");

    const settings = await settingsService.get();
    const now = input.now ?? new Date();
    const hours = hoursUntilClass(group, input.classDate, now);
    if (hours <= 0) throw new Error("Esta aula já começou ou já aconteceu");

    const eligible = hours >= settings.cancellationMinHours;
    const request = await db.cancellations.create({
      studentId: input.studentId,
      classGroupId: input.classGroupId,
      classDate: input.classDate,
      reason: input.reason,
      requestedAt: now.toISOString(),
      hoursInAdvance: Math.round(hours * 10) / 10,
      eligibleForMakeup: eligible,
      status: eligible ? "pendente" : "sem_reposicao",
      makeupDeadline: eligible ? addDays(input.classDate, settings.makeupValidityDays) : undefined,
    });

    // Dentro do prazo: falta justificada (não debita). Fora do prazo: conta como falta.
    await attendanceService.mark({
      classGroupId: input.classGroupId,
      studentId: input.studentId,
      date: input.classDate,
      status: eligible ? "justificada" : "falta",
    });
    return request;
  },

  /** Turmas com vaga para reposição (mesmo esporte, opcionalmente mesmo nível) */
  async availableSlots(input: {
    studentId: ID;
    sport: SportType;
    level?: Level;
    from?: ISODate;
    to?: ISODate;
  }): Promise<MakeupSlot[]> {
    const [groups, cancellations] = await Promise.all([db.classGroups.list({ active: true }), db.cancellations.list()]);
    const from = input.from && input.from > today() ? input.from : today();
    const to = input.to ?? addDays(from, 14);
    const now = new Date();
    const slots: MakeupSlot[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const wd = weekdayOf(d);
      for (const g of groups) {
        if (g.sport_type !== input.sport) continue;
        if (input.level && g.level !== input.level) continue;
        if (!g.weekdays.includes(wd)) continue;
        if (g.studentIds.includes(input.studentId)) continue;
        if (hoursUntilClass(g, d, now) <= 0) continue;
        const already = cancellations.some(
          (c) =>
            c.studentId === input.studentId &&
            c.makeupClassGroupId === g.id &&
            c.makeupDate === d &&
            c.status === "reposicao_agendada",
        );
        if (already) continue;
        const spotsLeft = spotsLeftOn(g, d, cancellations);
        if (spotsLeft > 0) slots.push({ group: g, date: d, spotsLeft });
      }
    }
    return slots.sort((a, b) => (a.date + a.group.startTime).localeCompare(b.date + b.group.startTime));
  },

  async schedule(cancellationId: ID, makeupClassGroupId: ID, makeupDate: ISODate, decidedBy = "Gestor") {
    const [request, group, cancellations] = await Promise.all([
      db.cancellations.get(cancellationId),
      db.classGroups.get(makeupClassGroupId),
      db.cancellations.list(),
    ]);
    if (!request) throw new Error("Solicitação não encontrada");
    if (!group) throw new Error("Turma não encontrada");
    if (!request.eligibleForMakeup) throw new Error("Cancelamento fora do prazo não dá direito a reposição");
    if (spotsLeftOn(group, makeupDate, cancellations) <= 0) throw new Error("A turma não tem vagas nesta data");
    return db.cancellations.update(cancellationId, {
      status: "reposicao_agendada",
      makeupClassGroupId,
      makeupDate,
      decidedBy,
    });
  },

  async unschedule(cancellationId: ID) {
    return db.cancellations.update(cancellationId, {
      status: "pendente",
      makeupClassGroupId: undefined,
      makeupDate: undefined,
    });
  },

  async reject(cancellationId: ID, note: string, decidedBy = "Gestor") {
    return db.cancellations.update(cancellationId, { status: "recusada", decisionNote: note, decidedBy });
  },

  /** Desfaz o cancelamento (o aluno vai à aula) */
  async revoke(cancellationId: ID) {
    const request = await db.cancellations.get(cancellationId);
    if (!request) return;
    const [att] = await db.attendances.list({
      classGroupId: request.classGroupId,
      studentId: request.studentId,
      date: request.classDate,
    });
    if (att) await attendanceService.clear(att.id);
    await db.cancellations.remove(cancellationId);
  },

  /** Expira reposições não utilizadas após o prazo */
  async runMaintenance() {
    const t = today();
    const pending = await db.cancellations.list({ status: "pendente" });
    for (const c of pending) {
      if (c.makeupDeadline && c.makeupDeadline < t) await db.cancellations.update(c.id, { status: "expirada" });
    }
  },
};
