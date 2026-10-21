import type { ID, ISODate, PaymentMethod, Plan, RevenueCategory, Subscription } from "@/types";
import { addDays, today } from "@/lib/date";
import { db } from "./repositories";

// ---------------------------------------------------------------------------
// Funções puras (usadas também nas telas para cálculo em memória)
// ---------------------------------------------------------------------------

export function remainingCredits(sub: Subscription) {
  return Math.max(0, sub.creditsTotal - sub.creditsUsed);
}

export function isValidOn(sub: Subscription, date: ISODate) {
  return sub.status === "ativa" && sub.startDate <= date && sub.endDate >= date;
}

/** Assinatura que deve ser debitada em uma presença: válida na data e com saldo (vence antes primeiro) */
export function subscriptionToDebit(subs: Subscription[], studentId: ID, date: ISODate) {
  return subs
    .filter((s) => s.studentId === studentId && isValidOn(s, date) && remainingCredits(s) > 0)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))[0];
}

/** Assinatura "principal" para exibição: a ativa mais recente */
export function currentSubscription(subs: Subscription[], studentId: ID) {
  return subs
    .filter((s) => s.studentId === studentId && s.status === "ativa")
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
}

export function creditBalance(subs: Subscription[], studentId: ID, date: ISODate = today()) {
  return subs
    .filter((s) => s.studentId === studentId && isValidOn(s, date))
    .reduce((acc, s) => acc + remainingCredits(s), 0);
}

export function planEndDate(plan: Plan, start: ISODate) {
  return addDays(start, Math.max(1, plan.validityDays) - 1);
}

export function revenueCategoryFor(plan: Plan): RevenueCategory {
  return plan.type === "mensal" ? "mensalidade" : plan.type === "pacote" ? "pacote" : "avulso";
}

// ---------------------------------------------------------------------------
// Operações
// ---------------------------------------------------------------------------

export interface SellPlanInput {
  studentId: ID;
  planId: ID;
  startDate?: ISODate;
  paid: boolean;
  method?: PaymentMethod;
  autoRenew?: boolean;
  renewedFromId?: ID;
}

export const subscriptionService = {
  async sell(input: SellPlanInput) {
    const plan = await db.plans.get(input.planId);
    if (!plan) throw new Error("Plano não encontrado");
    const student = await db.students.get(input.studentId);
    if (!student) throw new Error("Aluno não encontrado");

    const startDate = input.startDate ?? today();
    const subscription = await db.subscriptions.create({
      studentId: input.studentId,
      planId: plan.id,
      startDate,
      endDate: planEndDate(plan, startDate),
      creditsTotal: plan.credits,
      creditsUsed: 0,
      status: "ativa",
      autoRenew: input.autoRenew ?? plan.type === "mensal",
      renewedFromId: input.renewedFromId,
    });

    await db.transactions.create({
      type: "receita",
      category: revenueCategoryFor(plan),
      description: `${plan.name} — ${student.name}`,
      amount: plan.price,
      dueDate: startDate,
      paidDate: input.paid ? today() : undefined,
      status: input.paid ? "pago" : "pendente",
      method: input.paid ? (input.method ?? "pix") : input.method,
      studentId: student.id,
      subscriptionId: subscription.id,
    });

    return subscription;
  },

  /** Renova a assinatura gerando um novo ciclo a partir do fim do atual (ou de hoje, se já venceu). */
  async renew(subscriptionId: ID, opts: { paid: boolean; method?: PaymentMethod }) {
    const old = await db.subscriptions.get(subscriptionId);
    if (!old) throw new Error("Assinatura não encontrada");
    const nextDay = addDays(old.endDate, 1);
    const start = nextDay < today() ? today() : nextDay;
    if (old.status === "ativa" && old.endDate < today()) {
      await db.subscriptions.update(old.id, { status: "expirada" });
    }
    return this.sell({
      studentId: old.studentId,
      planId: old.planId,
      startDate: start,
      paid: opts.paid,
      method: opts.method,
      autoRenew: old.autoRenew,
      renewedFromId: old.id,
    });
  },

  async cancel(subscriptionId: ID) {
    return db.subscriptions.update(subscriptionId, { status: "cancelada", autoRenew: false });
  },

  async toggleAutoRenew(subscriptionId: ID) {
    const sub = await db.subscriptions.get(subscriptionId);
    if (!sub) return;
    return db.subscriptions.update(subscriptionId, { autoRenew: !sub.autoRenew });
  },

  async adjustCredits(subscriptionId: ID, delta: number) {
    const sub = await db.subscriptions.get(subscriptionId);
    if (!sub) return;
    return db.subscriptions.update(subscriptionId, { creditsTotal: Math.max(sub.creditsUsed, sub.creditsTotal + delta) });
  },

  /**
   * Rotina de manutenção (rodada ao abrir o app):
   * - expira assinaturas vencidas;
   * - renova automaticamente planos mensais com renovação automática (cobrança pendente).
   */
  async runMaintenance() {
    const subs = await db.subscriptions.list({ status: "ativa" });
    const t = today();
    let renewed = 0;
    for (const sub of subs) {
      if (sub.endDate >= t) continue;
      await db.subscriptions.update(sub.id, { status: "expirada" });
      const plan = await db.plans.get(sub.planId);
      const student = await db.students.get(sub.studentId);
      if (sub.autoRenew && plan?.type === "mensal" && plan.active && student?.status === "ativo") {
        await this.renew(sub.id, { paid: false });
        renewed++;
      }
    }
    return { renewed };
  },
};
