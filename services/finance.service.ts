import type { ID, ISODate, PaymentMethod, Transaction } from "@/types";
import { endOfMonth, startOfMonth, today } from "@/lib/date";
import { sum } from "@/lib/utils";
import { db } from "./repositories";

export function isOverdue(t: Transaction, ref: ISODate = today()) {
  return t.status === "pendente" && t.dueDate < ref;
}

export interface FinanceSummary {
  revenuePaid: number;
  revenuePending: number;
  revenueOverdue: number;
  expensesPaid: number;
  expensesPending: number;
  balance: number;
  forecast: number;
}

/** Resumo financeiro do mês (regime de caixa para pagos, competência para pendentes) */
export function monthSummary(transactions: Transaction[], monthDate: ISODate = today()): FinanceSummary {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const inMonthPaid = (t: Transaction) => t.status === "pago" && !!t.paidDate && t.paidDate >= start && t.paidDate <= end;
  const inMonthDue = (t: Transaction) => t.status === "pendente" && t.dueDate >= start && t.dueDate <= end;

  const revenuePaid = sum(transactions.filter((t) => t.type === "receita" && inMonthPaid(t)), (t) => t.amount);
  const revenuePending = sum(transactions.filter((t) => t.type === "receita" && inMonthDue(t)), (t) => t.amount);
  const revenueOverdue = sum(transactions.filter((t) => t.type === "receita" && isOverdue(t)), (t) => t.amount);
  const expensesPaid = sum(transactions.filter((t) => t.type === "despesa" && inMonthPaid(t)), (t) => t.amount);
  const expensesPending = sum(transactions.filter((t) => t.type === "despesa" && inMonthDue(t)), (t) => t.amount);
  return {
    revenuePaid,
    revenuePending,
    revenueOverdue,
    expensesPaid,
    expensesPending,
    balance: revenuePaid - expensesPaid,
    forecast: revenuePaid + revenuePending - expensesPaid - expensesPending,
  };
}

export const financeService = {
  async markPaid(id: ID, opts: { method: PaymentMethod; paidDate?: ISODate }) {
    return db.transactions.update(id, { status: "pago", method: opts.method, paidDate: opts.paidDate ?? today() });
  },
  async markPending(id: ID) {
    return db.transactions.update(id, { status: "pendente", paidDate: undefined });
  },
  async cancel(id: ID) {
    return db.transactions.update(id, { status: "cancelado" });
  },
};
