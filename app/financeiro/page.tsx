"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Pencil,
  Plus,
  Scale,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import type { ExpenseCategory, ID, NewEntity, PaymentMethod, RevenueCategory, Transaction, TransactionType } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { financeService, isOverdue, monthSummary } from "@/services/finance.service";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, PLAN_TYPES, REVENUE_CATEGORIES } from "@/lib/constants";
import { addMonths, diffDays, endOfMonth, formatDate, formatMonth, startOfMonth, today } from "@/lib/date";
import { getQueryParam, setQueryParams } from "@/lib/url";
import { cn, formatCurrency, normalize, sum } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, PageLoading, SearchInput, Select, StatCard, Switch, Tabs } from "@/components/ui/primitives";
import { HorizontalBars } from "@/components/charts/bar-chart";
import { Modal } from "@/components/ui/modal";
import { useFeedback } from "@/components/ui/feedback-provider";

type Tab = "receber" | "lancamentos" | "despesas" | "mensalidades";

async function load() {
  const [transactions, students, subs, plans] = await Promise.all([db.transactions.list(), db.students.list(), db.subscriptions.list(), db.plans.list()]);
  return { transactions, students, subs, plans };
}

const categoryLabel = (t: Transaction) =>
  t.type === "receita" ? REVENUE_CATEGORIES[t.category as RevenueCategory] : EXPENSE_CATEGORIES[t.category as ExpenseCategory];

const emptyTx = (type: TransactionType): NewEntity<Transaction> => ({
  type,
  category: type === "receita" ? "avulso" : "outros",
  description: "",
  amount: 0,
  dueDate: today(),
  paidDate: today(),
  status: "pago",
  method: "pix",
});

export default function FinancePage() {
  const { run, confirm } = useFeedback();
  const data = useLiveQuery(load);
  const [month, setMonth] = useState(() => startOfMonth(today()));
  const [tab, setTab] = useState<Tab>(() => (["receber", "lancamentos", "despesas", "mensalidades"].includes(getQueryParam("aba") ?? "") ? (getQueryParam("aba") as Tab) : "receber"));
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: ID | null; form: NewEntity<Transaction> } | null>(null);
  const [paying, setPaying] = useState<{ tx: Transaction; method: PaymentMethod; date: string } | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const start = month;
    const end = endOfMonth(month);
    const q = normalize(search);
    const studentName = (id?: ID) => data.students.find((s) => s.id === id)?.name ?? "";
    const matches = (t: Transaction) => !q || normalize(`${t.description} ${studentName(t.studentId)}`).includes(q);
    const inMonth = (t: Transaction) => {
      const ref = t.status === "pago" ? (t.paidDate ?? t.dueDate) : t.dueDate;
      return ref >= start && ref <= end;
    };
    const receivables = data.transactions
      .filter((t) => t.type === "receita" && t.status === "pendente" && (t.dueDate <= end))
      .filter(matches)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const entries = data.transactions.filter((t) => inMonth(t) && t.status !== "cancelado").filter(matches).sort((a, b) => (b.paidDate ?? b.dueDate).localeCompare(a.paidDate ?? a.dueDate));
    const expenses = data.transactions.filter((t) => t.type === "despesa" && t.dueDate >= start && t.dueDate <= end && t.status !== "cancelado").filter(matches).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const expenseByCat = Object.entries(EXPENSE_CATEGORIES)
      .map(([k, label]) => ({ label, value: sum(expenses.filter((e) => e.category === k), (e) => e.amount) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
    const revenueByCat = Object.entries(REVENUE_CATEGORIES)
      .map(([k, label]) => ({ label, value: sum(entries.filter((e) => e.type === "receita" && e.status === "pago" && e.category === k), (e) => e.amount) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);

    // Mensalidades: assinaturas mensais com cobrança no mês
    const tuition = data.transactions
      .filter((t) => t.type === "receita" && t.category === "mensalidade" && t.dueDate >= start && t.dueDate <= end && t.status !== "cancelado")
      .filter(matches)
      .sort((a, b) => studentName(a.studentId).localeCompare(studentName(b.studentId)));
    return { summary: monthSummary(data.transactions, month), receivables, entries, expenses, expenseByCat, revenueByCat, tuition, studentName };
  }, [data, month, search]);

  if (!data || !view) return <PageLoading />;

  const changeTab = (t: Tab) => {
    setTab(t);
    setQueryParams({ aba: t });
  };

  const save = async () => {
    if (!editing) return;
    const f = editing.form;
    if (f.description.trim().length < 2) return run(async () => Promise.reject(new Error("Informe a descrição")));
    if (!(f.amount > 0)) return run(async () => Promise.reject(new Error("Informe um valor maior que zero")));
    const payload: NewEntity<Transaction> = {
      ...f,
      description: f.description.trim(),
      paidDate: f.status === "pago" ? (f.paidDate ?? today()) : undefined,
      method: f.method,
      studentId: f.studentId || undefined,
    };
    const ok = await run(() => (editing.id ? db.transactions.update(editing.id, payload) : db.transactions.create(payload)), "Lançamento salvo");
    if (ok) setEditing(null);
  };

  const remove = async (t: Transaction) => {
    if (await confirm({ title: "Excluir lançamento?", description: `${t.description} — ${formatCurrency(t.amount)}`, confirmLabel: "Excluir" }))
      await run(() => db.transactions.remove(t.id), "Lançamento excluído");
  };

  const s = view.summary;
  const tuitionPaid = view.tuition.filter((t) => t.status === "pago").length;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Contas a receber, mensalidades, entradas e despesas da arena"
        icon={Wallet}
        actions={
          <>
            <Button variant="outline" icon={ArrowDownCircle} onClick={() => setEditing({ id: null, form: emptyTx("despesa") })}>
              Nova despesa
            </Button>
            <Button variant="secondary" icon={ArrowUpCircle} onClick={() => setEditing({ id: null, form: emptyTx("receita") })}>
              Nova entrada
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <p className="font-display min-w-44 text-center text-lg font-semibold text-slate-800">{formatMonth(month)}</p>
        <Button size="icon" variant="outline" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
          <ChevronRight className="size-4" />
        </Button>
        {month !== startOfMonth(today()) && (
          <Button size="sm" variant="ghost" onClick={() => setMonth(startOfMonth(today()))}>
            Mês atual
          </Button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Recebido" value={<span className="text-2xl">{formatCurrency(s.revenuePaid)}</span>} icon={CheckCircle2} tone="emerald" />
        <StatCard label="A receber" value={<span className="text-2xl">{formatCurrency(s.revenuePending)}</span>} icon={Clock} tone="ocean" hint="Vencimento no mês" />
        <StatCard label="Em atraso" value={<span className="text-2xl">{formatCurrency(s.revenueOverdue)}</span>} icon={AlertTriangle} tone="rose" hint="Total acumulado" />
        <StatCard label="Despesas pagas" value={<span className="text-2xl">{formatCurrency(s.expensesPaid)}</span>} icon={ArrowDownCircle} tone="sun" hint={`${formatCurrency(s.expensesPending)} a pagar`} />
        <StatCard
          label="Saldo do mês"
          value={<span className={cn("text-2xl", s.balance < 0 && "text-rose-600")}>{formatCurrency(s.balance)}</span>}
          icon={Scale}
          tone="violet"
          hint={`Previsão: ${formatCurrency(s.forecast)}`}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={tab}
          onChange={changeTab}
          tabs={[
            { value: "receber", label: "Contas a receber", count: view.receivables.length },
            { value: "mensalidades", label: "Mensalidades", count: view.tuition.length },
            { value: "lancamentos", label: "Lançamentos", count: view.entries.length },
            { value: "despesas", label: "Despesas", count: view.expenses.length },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar descrição ou aluno" className="md:w-72" />
      </div>

      {tab === "receber" && (
        <Card className="overflow-hidden">
          {view.receivables.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nada a receber" description="Todas as cobranças até este mês estão quitadas." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {view.receivables.map((t) => {
                const overdue = isOverdue(t);
                const late = overdue ? diffDays(today(), t.dueDate) : 0;
                return (
                  <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{t.description}</p>
                      <p className="text-xs text-slate-500">
                        {categoryLabel(t)} · vence {formatDate(t.dueDate)}
                        {overdue && <span className="ml-1 font-semibold text-rose-600">· {late} dia(s) em atraso</span>}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <p className="font-display text-lg font-bold tabular-nums text-slate-900">{formatCurrency(t.amount)}</p>
                      <div className="flex gap-1">
                        {t.studentId && (
                          <a
                            href={`https://wa.me/55${(data.students.find((x) => x.id === t.studentId)?.phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Olá! Passando para lembrar do pagamento de ${t.description} (${formatCurrency(t.amount)}), vencimento ${formatDate(t.dueDate)}. Obrigado!`,
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="sm" variant="ghost">
                              Cobrar
                            </Button>
                          </a>
                        )}
                        <Button size="sm" variant="success" icon={CircleDollarSign} onClick={() => setPaying({ tx: t, method: "pix", date: today() })}>
                          Receber
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === "mensalidades" && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Mensalidades do mês"
            description={`${tuitionPaid} de ${view.tuition.length} pagas`}
            action={<Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">{view.tuition.length ? Math.round((tuitionPaid / view.tuition.length) * 100) : 0}% adimplência</Badge>}
          />
          {view.tuition.length === 0 ? (
            <EmptyState icon={Wallet} title="Nenhuma mensalidade neste mês" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {view.tuition.map((t) => {
                const overdue = isOverdue(t);
                const sub = data.subs.find((x) => x.id === t.subscriptionId);
                const plan = data.plans.find((p) => p.id === sub?.planId);
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className={cn("size-2.5 shrink-0 rounded-full", t.status === "pago" ? "bg-emerald-500" : overdue ? "bg-rose-500" : "bg-amber-400")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{view.studentName(t.studentId) || t.description}</p>
                      <p className="text-xs text-slate-500">
                        {plan ? `${PLAN_TYPES[plan.type].label} · ${plan.name}` : t.description} · venc. {formatDate(t.dueDate)}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums text-slate-800">{formatCurrency(t.amount)}</p>
                    {t.status === "pago" ? (
                      <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Pago {t.paidDate && formatDate(t.paidDate).slice(0, 5)}</Badge>
                    ) : (
                      <Button size="sm" variant={overdue ? "danger" : "outline"} onClick={() => setPaying({ tx: t, method: "pix", date: today() })}>
                        {overdue ? "Atrasada · receber" : "Receber"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {(tab === "lancamentos" || tab === "despesas") && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            {(tab === "lancamentos" ? view.entries : view.expenses).length === 0 ? (
              <EmptyState icon={Wallet} title="Nenhum lançamento" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {(tab === "lancamentos" ? view.entries : view.expenses).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", t.type === "receita" ? "bg-emerald-50 text-emerald-600" : "bg-sun-50 text-sun-600")}>
                      {t.type === "receita" ? <ArrowUpCircle className="size-4" /> : <ArrowDownCircle className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{t.description}</p>
                      <p className="text-xs text-slate-500">
                        {categoryLabel(t)} · {t.status === "pago" ? `pago ${formatDate(t.paidDate)}` : `vence ${formatDate(t.dueDate)}`}
                        {t.method && t.status === "pago" && ` · ${PAYMENT_METHODS[t.method]}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-semibold tabular-nums", t.type === "receita" ? "text-emerald-700" : "text-slate-800")}>
                        {t.type === "receita" ? "+" : "−"} {formatCurrency(t.amount)}
                      </p>
                      {t.status === "pendente" && <p className={cn("text-[11px] font-medium", isOverdue(t) ? "text-rose-600" : "text-amber-600")}>{isOverdue(t) ? "Atrasado" : "Pendente"}</p>}
                    </div>
                    <div className="flex">
                      {t.status === "pendente" ? (
                        <Button size="icon" variant="ghost" aria-label="Marcar pago" title="Marcar como pago" onClick={() => setPaying({ tx: t, method: t.method ?? "pix", date: today() })}>
                          <CheckCircle2 className="size-4" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" aria-label="Voltar para pendente" title="Estornar para pendente" onClick={() => run(() => financeService.markPending(t.id), "Lançamento voltou para pendente")}>
                          <Undo2 className="size-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditing({ id: t.id, form: { ...t } })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => remove(t)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Despesas por categoria" />
              <div className="p-5">
                {view.expenseByCat.length ? <HorizontalBars items={view.expenseByCat} format={formatCurrency} color="bg-sun-400" /> : <p className="text-sm text-slate-500">Sem despesas no mês.</p>}
              </div>
            </Card>
            <Card>
              <CardHeader title="Receitas por categoria" />
              <div className="p-5">
                {view.revenueByCat.length ? <HorizontalBars items={view.revenueByCat} format={formatCurrency} color="bg-ocean-500" /> : <p className="text-sm text-slate-500">Sem receitas pagas no mês.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Receber */}
      <Modal
        open={!!paying}
        onClose={() => setPaying(null)}
        size="sm"
        title={paying?.tx.type === "despesa" ? "Registrar pagamento" : "Registrar recebimento"}
        description={paying ? `${paying.tx.description} — ${formatCurrency(paying.tx.amount)}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setPaying(null)}>
              Cancelar
            </Button>
            <Button
              variant="success"
              onClick={async () => {
                if (!paying) return;
                const ok = await run(() => financeService.markPaid(paying.tx.id, { method: paying.method, paidDate: paying.date }), "Pagamento registrado");
                if (ok) setPaying(null);
              }}
            >
              Confirmar
            </Button>
          </>
        }
      >
        {paying && (
          <div className="space-y-4">
            <Field label="Forma de pagamento">
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPaying({ ...paying, method: k })}
                    className={cn("rounded-xl border py-2 text-sm font-medium", paying.method === k ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600")}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Data do pagamento">
              <Input type="date" value={paying.date} onChange={(e) => setPaying({ ...paying, date: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      {/* Lançamento */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Editar lançamento" : editing?.form.type === "despesa" ? "Nova despesa" : "Nova entrada avulsa"}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save} icon={Plus}>
              Salvar
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["receita", "despesa"] as TransactionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEditing({ ...editing, form: { ...editing.form, type, category: type === "receita" ? "avulso" : "outros" } })}
                  className={cn(
                    "rounded-xl border py-2.5 text-sm font-semibold",
                    editing.form.type === type ? (type === "receita" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-sun-500 bg-sun-50 text-sun-800") : "border-slate-200 text-slate-500",
                  )}
                >
                  {type === "receita" ? "Entrada" : "Despesa"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria">
                <Select value={editing.form.category} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, category: e.target.value as Transaction["category"] } })}>
                  {Object.entries(editing.form.type === "receita" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Valor (R$)" required>
                <Input type="number" min={0} step="0.01" value={editing.form.amount || ""} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, amount: Number(e.target.value) } })} />
              </Field>
            </div>
            <Field label="Descrição" required>
              <Input value={editing.form.description} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })} placeholder={editing.form.type === "receita" ? "Ex.: Locação quadra 2 — sábado" : "Ex.: Conta de luz"} />
            </Field>
            {editing.form.type === "receita" && (
              <Field label="Aluno (opcional)">
                <Select value={editing.form.studentId ?? ""} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, studentId: e.target.value || undefined } })}>
                  <option value="">—</option>
                  {data.students
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </Select>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vencimento">
                <Input type="date" value={editing.form.dueDate} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, dueDate: e.target.value } })} />
              </Field>
              <Field label="Forma de pagamento">
                <Select value={editing.form.method ?? "pix"} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, method: e.target.value as PaymentMethod } })}>
                  {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Switch
              checked={editing.form.status === "pago"}
              onChange={(v) => setEditing({ ...editing, form: { ...editing.form, status: v ? "pago" : "pendente", paidDate: v ? (editing.form.paidDate ?? today()) : undefined } })}
              label="Já foi pago"
            />
            {editing.form.status === "pago" && (
              <Field label="Data do pagamento">
                <Input type="date" value={editing.form.paidDate ?? today()} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, paidDate: e.target.value } })} />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
