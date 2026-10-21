import type { ClassGroup, ISODate, Student } from "@/types";
import { addDays, addMonths, monthKey, startOfMonth, timeToMinutes, today } from "@/lib/date";
import { sum } from "@/lib/utils";
import { db } from "./repositories";
import { settingsService } from "./settings.service";
import { durationMinutes, sessionsOn } from "./class-group.service";
import { monthSummary } from "./finance.service";
import { currentSubscription, remainingCredits } from "./subscription.service";

export interface DashboardData {
  activeStudents: number;
  newStudentsMonth: number;
  seatOccupancy: number;
  courtOccupancy: number;
  revenueMonth: number;
  revenueLastMonth: number;
  pendingMonth: number;
  overdue: number;
  churnRateMonth: number;
  retentionRate: number;
  churnedMonth: number;
  attendanceRate30d: number;
  todaySessions: { group: ClassGroup; enrolled: number }[];
  pendingMakeups: number;
  expiringSoon: { student: Student; endDate: ISODate; remaining: number; planName: string }[];
  lowBalance: { student: Student; remaining: number }[];
  revenueSeries: { month: string; revenue: number; expenses: number }[];
  npsScore: number | null;
  feedbackCount: number;
}

export async function getDashboard(ref: ISODate = today()): Promise<DashboardData> {
  const [students, groups, courts, subs, transactions, churn, attendances, cancellations, plans, feedbacks, settings] =
    await Promise.all([
      db.students.list(),
      db.classGroups.list(),
      db.courts.list({ active: true }),
      db.subscriptions.list(),
      db.transactions.list(),
      db.churn.list(),
      db.attendances.list(),
      db.cancellations.list(),
      db.plans.list(),
      db.feedbacks.list(),
      settingsService.get(),
    ]);

  const active = students.filter((s) => s.status === "ativo");
  const monthStart = startOfMonth(ref);
  const newStudentsMonth = active.filter((s) => s.joinedAt >= monthStart).length;

  // Ocupação de vagas nas turmas
  const activeGroups = groups.filter((g) => g.active);
  const capacity = sum(activeGroups, (g) => g.capacity);
  const enrolled = sum(activeGroups, (g) => g.studentIds.length);
  const seatOccupancy = capacity ? enrolled / capacity : 0;

  // Ocupação das quadras (horas com turma / horas disponíveis na semana)
  const openMinutesPerDay = Math.max(0, timeToMinutes(settings.closingTime) - timeToMinutes(settings.openingTime));
  const availableMinutes = courts.length * settings.openDays.length * openMinutesPerDay;
  const usedMinutes = sum(
    activeGroups.filter((g) => courts.some((c) => c.id === g.courtId)),
    (g) => durationMinutes(g) * g.weekdays.filter((d) => settings.openDays.includes(d)).length,
  );
  const courtOccupancy = availableMinutes ? Math.min(1, usedMinutes / availableMinutes) : 0;

  // Financeiro
  const fin = monthSummary(transactions, ref);
  const last = monthSummary(transactions, addMonths(monthStart, -1));

  // Churn / retenção no mês
  const churnedMonth = churn.filter((c) => c.date >= monthStart && c.date <= ref).length;
  const base = active.length + churnedMonth;
  const churnRateMonth = base ? churnedMonth / base : 0;

  // Frequência 30 dias
  const since = addDays(ref, -30);
  const recent = attendances.filter((a) => a.date >= since && a.date <= ref && !a.isMakeup);
  const presentCount = recent.filter((a) => a.status === "presente").length;
  const attendanceRate30d = recent.length ? presentCount / recent.length : 0;

  // Renovações próximas e saldo baixo
  const limit = addDays(ref, settings.renewalWarningDays);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const expiringSoon: DashboardData["expiringSoon"] = [];
  const lowBalance: DashboardData["lowBalance"] = [];
  for (const s of active) {
    const sub = currentSubscription(subs, s.id);
    if (!sub) continue;
    const hasNext = subs.some((x) => x.studentId === s.id && x.status === "ativa" && x.startDate > sub.startDate);
    if (!hasNext && sub.endDate <= limit) {
      expiringSoon.push({
        student: s,
        endDate: sub.endDate,
        remaining: remainingCredits(sub),
        planName: planById.get(sub.planId)?.name ?? "Plano",
      });
    }
    const plan = planById.get(sub.planId);
    if (plan && plan.type !== "avulso" && remainingCredits(sub) <= 1) lowBalance.push({ student: s, remaining: remainingCredits(sub) });
  }
  expiringSoon.sort((a, b) => a.endDate.localeCompare(b.endDate));

  // Série de 6 meses
  const revenueSeries = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(monthStart, i - 5);
    const s = monthSummary(transactions, m);
    return { month: monthKey(m), revenue: s.revenuePaid, expenses: s.expensesPaid };
  });

  // NPS
  const npsScore = feedbacks.length
    ? Math.round(
        ((feedbacks.filter((f) => f.nps >= 9).length - feedbacks.filter((f) => f.nps <= 6).length) / feedbacks.length) *
          100,
      )
    : null;

  return {
    activeStudents: active.length,
    newStudentsMonth,
    seatOccupancy,
    courtOccupancy,
    revenueMonth: fin.revenuePaid,
    revenueLastMonth: last.revenuePaid,
    pendingMonth: fin.revenuePending,
    overdue: fin.revenueOverdue,
    churnRateMonth,
    retentionRate: 1 - churnRateMonth,
    churnedMonth,
    attendanceRate30d,
    todaySessions: sessionsOn(groups, ref).map((group) => ({ group, enrolled: group.studentIds.length })),
    pendingMakeups: cancellations.filter((c) => c.status === "pendente").length,
    expiringSoon: expiringSoon.slice(0, 6),
    lowBalance: lowBalance.slice(0, 6),
    revenueSeries,
    npsScore,
    feedbackCount: feedbacks.length,
  };
}

