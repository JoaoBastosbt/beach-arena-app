import type { Attendance, AttendanceStatus, CancellationRequest, ClassGroup, ID, ISODate, Student, Subscription } from "@/types";
import { db } from "./repositories";
import { settingsService } from "./settings.service";
import { creditBalance, currentSubscription, subscriptionToDebit } from "./subscription.service";

export interface RosterEntry {
  student: Student;
  attendance?: Attendance;
  /** Cancelamento do aluno para esta aula (aluno da turma que avisou) */
  cancellation?: CancellationRequest;
  /** Reposição: aluno de outra turma alocado nesta aula */
  makeup?: CancellationRequest;
  balance: number;
  subscription?: Subscription;
}

export interface Roster {
  group: ClassGroup;
  date: ISODate;
  entries: RosterEntry[];
  stats: { expected: number; present: number; absent: number; cancelled: number; pending: number };
}

async function shouldDebit(status: AttendanceStatus) {
  if (status === "presente") return true;
  if (status === "falta") return (await settingsService.get()).debitOnAbsence;
  return false;
}

async function refund(att: Attendance) {
  if (!att.debitedSubscriptionId) return;
  const sub = await db.subscriptions.get(att.debitedSubscriptionId);
  if (sub) await db.subscriptions.update(sub.id, { creditsUsed: Math.max(0, sub.creditsUsed - 1) });
}

async function debit(studentId: ID, date: ISODate): Promise<ID | undefined> {
  const subs = await db.subscriptions.list({ studentId });
  const sub = subscriptionToDebit(subs, studentId, date);
  if (!sub) return undefined;
  await db.subscriptions.update(sub.id, { creditsUsed: sub.creditsUsed + 1 });
  return sub.id;
}

export const attendanceService = {
  /**
   * Registra presença/falta (upsert). Debita ou estorna crédito conforme a
   * mudança de status, mantendo o saldo sempre consistente.
   */
  async mark(input: { classGroupId: ID; studentId: ID; date: ISODate; status: AttendanceStatus; isMakeup?: boolean }) {
    const [existing] = await db.attendances.list({
      classGroupId: input.classGroupId,
      studentId: input.studentId,
      date: input.date,
    });
    const needsDebit = await shouldDebit(input.status);
    let debitedSubscriptionId = existing?.debitedSubscriptionId;

    if (existing?.debitedSubscriptionId && !needsDebit) {
      await refund(existing);
      debitedSubscriptionId = undefined;
    }
    if (needsDebit && !debitedSubscriptionId) {
      debitedSubscriptionId = await debit(input.studentId, input.date);
    }

    const isMakeup = input.isMakeup ?? existing?.isMakeup ?? false;
    const result = existing
      ? await db.attendances.update(existing.id, { status: input.status, debitedSubscriptionId, isMakeup })
      : await db.attendances.create({
          classGroupId: input.classGroupId,
          studentId: input.studentId,
          date: input.date,
          status: input.status,
          isMakeup,
          debitedSubscriptionId,
        });

    if (isMakeup) {
      const [makeup] = await db.cancellations.list({
        studentId: input.studentId,
        makeupClassGroupId: input.classGroupId,
        makeupDate: input.date,
      });
      if (makeup) {
        await db.cancellations.update(makeup.id, {
          status: input.status === "presente" ? "reposta" : "reposicao_agendada",
        });
      }
    }
    return result;
  },

  /** Desfaz o registro (volta para "não marcado") estornando o crédito */
  async clear(attendanceId: ID) {
    const att = await db.attendances.get(attendanceId);
    if (!att) return;
    await refund(att);
    await db.attendances.remove(att.id);
    if (att.isMakeup) {
      const [makeup] = await db.cancellations.list({
        studentId: att.studentId,
        makeupClassGroupId: att.classGroupId,
        makeupDate: att.date,
      });
      if (makeup?.status === "reposta") await db.cancellations.update(makeup.id, { status: "reposicao_agendada" });
    }
  },

  /** Marca todos os alunos ainda não registrados como presentes */
  async markAllPresent(roster: Roster) {
    for (const e of roster.entries) {
      if (e.attendance || e.cancellation) continue;
      await this.mark({
        classGroupId: roster.group.id,
        studentId: e.student.id,
        date: roster.date,
        status: "presente",
        isMakeup: !!e.makeup,
      });
    }
  },

  async getRoster(classGroupId: ID, date: ISODate): Promise<Roster | undefined> {
    const group = await db.classGroups.get(classGroupId);
    if (!group) return undefined;
    const [students, attendances, cancellations, subs] = await Promise.all([
      db.students.list(),
      db.attendances.list({ classGroupId, date }),
      db.cancellations.list(),
      db.subscriptions.list(),
    ]);
    const byId = new Map(students.map((s) => [s.id, s]));

    const own = group.studentIds.map((id) => byId.get(id)).filter((s): s is Student => !!s);
    const makeups = cancellations.filter(
      (c) =>
        c.makeupClassGroupId === classGroupId &&
        c.makeupDate === date &&
        (c.status === "reposicao_agendada" || c.status === "reposta"),
    );

    const entries: RosterEntry[] = [
      ...own.map((student) => ({
        student,
        attendance: attendances.find((a) => a.studentId === student.id),
        cancellation: cancellations.find(
          (c) => c.studentId === student.id && c.classGroupId === classGroupId && c.classDate === date,
        ),
        balance: creditBalance(subs, student.id, date),
        subscription: currentSubscription(subs, student.id),
      })),
      ...makeups
        .map((makeup) => {
          const student = byId.get(makeup.studentId);
          if (!student) return null;
          return {
            student,
            makeup,
            attendance: attendances.find((a) => a.studentId === student.id),
            balance: creditBalance(subs, student.id, date),
            subscription: currentSubscription(subs, student.id),
          } satisfies RosterEntry;
        })
        .filter((e): e is NonNullable<typeof e> => e !== null),
    ].sort((a, b) => a.student.name.localeCompare(b.student.name));

    const stats = {
      expected: entries.filter((e) => !e.cancellation).length,
      present: entries.filter((e) => e.attendance?.status === "presente").length,
      absent: entries.filter((e) => e.attendance?.status === "falta").length,
      cancelled: entries.filter((e) => e.cancellation).length,
      pending: entries.filter((e) => !e.attendance && !e.cancellation).length,
    };
    return { group, date, entries, stats };
  },
};
