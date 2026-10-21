import type { ChurnReason, ID, NewEntity, PaymentMethod, Student } from "@/types";
import { today } from "@/lib/date";
import { db } from "./repositories";
import { classGroupService } from "./class-group.service";
import { subscriptionService } from "./subscription.service";

export type StudentInput = Omit<NewEntity<Student>, "status" | "joinedAt"> & {
  status?: Student["status"];
  joinedAt?: string;
};

export const studentService = {
  /** Nova matrícula: cadastra aluno, aloca em turmas e (opcionalmente) vende um plano */
  async enroll(input: {
    student: StudentInput;
    classGroupIds: ID[];
    planId?: ID;
    paid?: boolean;
    method?: PaymentMethod;
  }) {
    const groups = await db.classGroups.list();
    for (const id of input.classGroupIds) {
      const g = groups.find((x) => x.id === id);
      if (g && g.studentIds.length >= g.capacity) throw new Error(`A turma ${g.name} está lotada`);
    }
    const student = await db.students.create({
      ...input.student,
      status: input.student.status ?? "ativo",
      joinedAt: input.student.joinedAt ?? today(),
    });
    for (const id of input.classGroupIds) await classGroupService.addStudent(id, student.id);
    if (input.planId) {
      await subscriptionService.sell({
        studentId: student.id,
        planId: input.planId,
        paid: !!input.paid,
        method: input.method,
      });
    }
    return student;
  },

  async update(id: ID, patch: Partial<NewEntity<Student>>) {
    return db.students.update(id, patch);
  },

  /** Cancelamento de matrícula com registro de motivo (churn) */
  async cancelEnrollment(input: { studentId: ID; reason: ChurnReason; details?: string; wouldReturn: boolean }) {
    const student = await db.students.get(input.studentId);
    if (!student) throw new Error("Aluno não encontrado");

    await classGroupService.setStudentGroups(student.id, []);

    const subs = await db.subscriptions.list({ studentId: student.id, status: "ativa" });
    for (const s of subs) await subscriptionService.cancel(s.id);

    const pending = await db.transactions.list({ studentId: student.id, status: "pendente" });
    for (const t of pending) if (t.dueDate > today()) await db.transactions.update(t.id, { status: "cancelado" });

    await db.churn.create({
      studentId: student.id,
      date: today(),
      reason: input.reason,
      details: input.details,
      wouldReturn: input.wouldReturn,
    });
    return db.students.update(student.id, { status: "inativo" });
  },

  async reactivate(studentId: ID) {
    return db.students.update(studentId, { status: "ativo" });
  },

  /** Exclusão definitiva (cadastro errado). Remove vínculos com turmas. */
  async remove(studentId: ID) {
    await classGroupService.setStudentGroups(studentId, []);
    await db.students.remove(studentId);
  },
};
