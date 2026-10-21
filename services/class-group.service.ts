import type { ClassGroup, Court, ID, ISODate, NewEntity, Teacher } from "@/types";
import { timeToMinutes, weekdayOf } from "@/lib/date";
import { db } from "./repositories";

export interface Session {
  group: ClassGroup;
  date: ISODate;
  court?: Court;
  teacher?: Teacher;
}

/** Aulas (sessões) que acontecem em uma data */
export function sessionsOn(groups: ClassGroup[], date: ISODate): ClassGroup[] {
  const wd = weekdayOf(date);
  return groups
    .filter((g) => g.active && g.weekdays.includes(wd))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function durationMinutes(g: Pick<ClassGroup, "startTime" | "endTime">) {
  return Math.max(0, timeToMinutes(g.endTime) - timeToMinutes(g.startTime));
}

function overlaps(a: ClassGroup | NewEntity<ClassGroup>, b: ClassGroup) {
  const sameDay = a.weekdays.some((d) => b.weekdays.includes(d));
  if (!sameDay) return false;
  return timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime);
}

export interface Conflict {
  type: "quadra" | "professor";
  group: ClassGroup;
}

export function findConflicts(candidate: NewEntity<ClassGroup>, all: ClassGroup[], ignoreId?: ID): Conflict[] {
  if (!candidate.active) return [];
  return all
    .filter((g) => g.active && g.id !== ignoreId && overlaps(candidate, g))
    .flatMap<Conflict>((g) => {
      const out: Conflict[] = [];
      if (g.courtId === candidate.courtId) out.push({ type: "quadra", group: g });
      if (g.teacherId === candidate.teacherId) out.push({ type: "professor", group: g });
      return out;
    });
}

export const classGroupService = {
  async addStudent(groupId: ID, studentId: ID) {
    const group = await db.classGroups.get(groupId);
    if (!group) throw new Error("Turma não encontrada");
    if (group.studentIds.includes(studentId)) return group;
    if (group.studentIds.length >= group.capacity) throw new Error(`A turma ${group.name} está lotada`);
    return db.classGroups.update(groupId, { studentIds: [...group.studentIds, studentId] });
  },

  async removeStudent(groupId: ID, studentId: ID) {
    const group = await db.classGroups.get(groupId);
    if (!group) return;
    return db.classGroups.update(groupId, { studentIds: group.studentIds.filter((s) => s !== studentId) });
  },

  /** Define exatamente em quais turmas o aluno está matriculado */
  async setStudentGroups(studentId: ID, groupIds: ID[]) {
    const groups = await db.classGroups.list();
    for (const g of groups) {
      const has = g.studentIds.includes(studentId);
      const wants = groupIds.includes(g.id);
      if (wants && !has) await this.addStudent(g.id, studentId);
      if (!wants && has) await this.removeStudent(g.id, studentId);
    }
  },
};
