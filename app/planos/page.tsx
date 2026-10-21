"use client";

import { useMemo, useState } from "react";
import { Minus, Pencil, Plus, RefreshCcw, ShoppingCart, Ticket, Trash2, XCircle } from "lucide-react";
import type { ID, NewEntity, PaymentMethod, Plan, PlanType, SportType, Subscription } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { settingsService } from "@/services/settings.service";
import { planEndDate, remainingCredits, subscriptionService } from "@/services/subscription.service";
import { PAYMENT_METHODS, PLAN_TYPES, SPORT_OPTIONS, SPORTS, SUBSCRIPTION_STATUS } from "@/lib/constants";
import { addDays, diffDays, formatDate, today } from "@/lib/date";
import { getQueryParam, setQueryParams } from "@/lib/url";
import { cn, formatCurrency, normalize } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageLoading,
  ProgressBar,
  SearchInput,
  Select,
  Switch,
  Tabs,
  Textarea,
} from "@/components/ui/primitives";
import { CreditBadge, StatusBadge } from "@/components/ui/badges";
import { Modal } from "@/components/ui/modal";
import { useFeedback } from "@/components/ui/feedback-provider";

type Tab = "planos" | "assinaturas";
type SubFilter = "ativas" | "vencendo" | "expiradas" | "todas";

async function load() {
  const [plans, subs, students, settings] = await Promise.all([db.plans.list(), db.subscriptions.list(), db.students.list(), settingsService.get()]);
  return { plans, subs, students, settings };
}

const emptyPlan: NewEntity<Plan> = { name: "", type: "mensal", price: 0, credits: 8, validityDays: 30, description: "", active: true, sport_type: undefined };

export default function PlansPage() {
  const { run, confirm } = useFeedback();
  const data = useLiveQuery(load);
  const [tab, setTab] = useState<Tab>(() => (getQueryParam("aba") === "assinaturas" ? "assinaturas" : "planos"));
  const [filter, setFilter] = useState<SubFilter>("ativas");
  const [search, setSearch] = useState("");
  const [planForm, setPlanForm] = useState<{ id: ID | null; form: NewEntity<Plan> } | null>(null);
  const [sell, setSell] = useState<{ studentId: ID; planId: ID; startDate: string; paid: boolean; method: PaymentMethod } | null>(() => {
    const aluno = getQueryParam("aluno");
    return aluno ? { studentId: aluno, planId: "", startDate: today(), paid: true, method: "pix" } : null;
  });
  const [renewing, setRenewing] = useState<{ sub: Subscription; paid: boolean; method: PaymentMethod } | null>(null);

  const subsView = useMemo(() => {
    if (!data) return [];
    const t = today();
    const warn = addDays(t, data.settings.renewalWarningDays);
    const q = normalize(search);
    const studentName = (id: ID) => data.students.find((s) => s.id === id)?.name ?? "";
    // Ignora assinaturas futuras (renovações já pagas) na detecção de "vencendo"
    const hasNext = (s: Subscription) => data.subs.some((x) => x.studentId === s.studentId && x.status === "ativa" && x.startDate > s.startDate);
    return data.subs
      .filter((s) => {
        if (filter === "ativas") return s.status === "ativa";
        if (filter === "vencendo") return s.status === "ativa" && s.endDate <= warn && !hasNext(s);
        if (filter === "expiradas") return s.status !== "ativa";
        return true;
      })
      .filter((s) => !q || normalize(studentName(s.studentId)).includes(q))
      .sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [data, filter, search]);

  if (!data) return <PageLoading />;

  const changeTab = (t: Tab) => {
    setTab(t);
    setQueryParams({ aba: t });
  };

  const savePlan = async () => {
    if (!planForm) return;
    const f = planForm.form;
    if (f.name.trim().length < 3) return run(async () => Promise.reject(new Error("Informe o nome do plano")));
    if (f.price < 0 || f.credits < 1 || f.validityDays < 1) return run(async () => Promise.reject(new Error("Preço, créditos e validade devem ser positivos")));
    const ok = await run(
      () => (planForm.id ? db.plans.update(planForm.id, { ...f, name: f.name.trim() }) : db.plans.create({ ...f, name: f.name.trim() })),
      "Plano salvo",
    );
    if (ok) setPlanForm(null);
  };

  const removePlan = async (p: Plan) => {
    const used = data.subs.some((s) => s.planId === p.id);
    if (used) {
      const ok = await confirm({ title: "Plano em uso", description: "Este plano possui assinaturas. Ele será desativado para novas vendas.", confirmLabel: "Desativar", tone: "primary" });
      if (ok) await run(() => db.plans.update(p.id, { active: false }), "Plano desativado");
      return;
    }
    if (await confirm({ title: `Excluir “${p.name}”?`, confirmLabel: "Excluir" })) await run(() => db.plans.remove(p.id), "Plano excluído");
  };

  const doSell = async () => {
    if (!sell) return;
    if (!sell.studentId || !sell.planId) return run(async () => Promise.reject(new Error("Selecione aluno e plano")));
    const ok = await run(() => subscriptionService.sell(sell), "Plano vendido e lançado no financeiro");
    if (ok) {
      setSell(null);
      setQueryParams({ aluno: null });
      changeTab("assinaturas");
    }
  };

  const doRenew = async () => {
    if (!renewing) return;
    const ok = await run(() => subscriptionService.renew(renewing.sub.id, { paid: renewing.paid, method: renewing.method }), "Renovação registrada");
    if (ok) setRenewing(null);
  };

  const sellPlan = data.plans.find((p) => p.id === sell?.planId);
  const grouped: Record<PlanType, Plan[]> = { mensal: [], pacote: [], avulso: [] };
  data.plans.forEach((p) => grouped[p.type].push(p));

  return (
    <div>
      <PageHeader
        title="Planos & Pacotes"
        description="Mensalidades, pacotes de créditos, aulas avulsas e renovações"
        icon={Ticket}
        actions={
          <>
            <Button variant="outline" icon={Plus} onClick={() => setPlanForm({ id: null, form: { ...emptyPlan } })}>
              Novo plano
            </Button>
            <Button variant="secondary" icon={ShoppingCart} onClick={() => setSell({ studentId: "", planId: "", startDate: today(), paid: true, method: "pix" })}>
              Vender plano
            </Button>
          </>
        }
      />

      <Tabs
        className="mb-4 w-fit"
        value={tab}
        onChange={changeTab}
        tabs={[
          { value: "planos", label: "Planos", count: data.plans.filter((p) => p.active).length },
          { value: "assinaturas", label: "Assinaturas", count: data.subs.filter((s) => s.status === "ativa").length },
        ]}
      />

      {tab === "planos" && (
        <div className="space-y-6">
          {(Object.keys(grouped) as PlanType[]).map((type) => (
            <section key={type}>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="text-lg font-bold text-slate-900">{PLAN_TYPES[type].label}</h2>
                <p className="text-xs text-slate-500">{PLAN_TYPES[type].description}</p>
              </div>
              {grouped[type].length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Nenhum plano deste tipo.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {grouped[type].map((p) => {
                    const activeSubs = data.subs.filter((s) => s.planId === p.id && s.status === "ativa").length;
                    return (
                      <Card key={p.id} className={cn("relative flex flex-col overflow-hidden p-5", !p.active && "opacity-60")}>
                        <div className="absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-sun-100" />
                        <div className="relative flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <StatusBadge {...PLAN_TYPES[p.type]} />
                              {p.sport_type && <Badge>{SPORTS[p.sport_type].label}</Badge>}
                              {!p.active && <Badge>Inativo</Badge>}
                            </div>
                          </div>
                        </div>
                        <p className="font-display relative mt-4 text-3xl font-bold text-ocean-800">{formatCurrency(p.price)}</p>
                        <p className="text-xs text-slate-500">
                          {p.credits} {p.credits === 1 ? "aula" : "aulas"} · validade {p.validityDays} dias · {formatCurrency(p.price / p.credits)}/aula
                        </p>
                        {p.description && <p className="mt-3 text-sm text-slate-600">{p.description}</p>}
                        <div className="mt-auto flex items-center justify-between pt-4">
                          <span className="text-xs text-slate-500">{activeSubs} assinatura(s) ativa(s)</span>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setPlanForm({ id: p.id, form: { ...p } })}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => removePlan(p)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {tab === "assinaturas" && (
        <>
          <Card className="mb-4 flex flex-col gap-3 p-3 md:flex-row md:items-center">
            <Tabs
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: "ativas", label: "Ativas" },
                { value: "vencendo", label: "Vencendo" },
                { value: "expiradas", label: "Encerradas" },
                { value: "todas", label: "Todas" },
              ]}
            />
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar aluno" className="flex-1" />
          </Card>
          <Card className="overflow-hidden">
            {subsView.length === 0 ? (
              <EmptyState icon={Ticket} title="Nenhuma assinatura neste filtro" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {subsView.map((s) => {
                  const student = data.students.find((x) => x.id === s.studentId);
                  const plan = data.plans.find((p) => p.id === s.planId);
                  const days = diffDays(s.endDate, today());
                  const future = s.startDate > today();
                  return (
                    <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:px-5 md:flex-row md:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar name={student?.name ?? "?"} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{student?.name ?? "Aluno removido"}</p>
                          <p className="truncate text-xs text-slate-500">
                            {plan?.name} · {formatDate(s.startDate)} a {formatDate(s.endDate)}
                          </p>
                        </div>
                      </div>
                      <div className="w-full md:w-48">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-500">
                            {s.creditsUsed}/{s.creditsTotal} usadas
                          </span>
                          <CreditBadge balance={remainingCredits(s)} />
                        </div>
                        <ProgressBar value={s.creditsUsed / s.creditsTotal} tone={remainingCredits(s) <= 1 ? "rose" : "ocean"} />
                      </div>
                      <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-end">
                        <div className="text-right text-xs md:w-24">
                          {s.status === "ativa" ? (
                            future ? (
                              <Badge className="bg-ocean-50 text-ocean-700 ring-ocean-200">Inicia {formatDate(s.startDate)}</Badge>
                            ) : (
                              <span className={cn("font-semibold", days <= 3 ? "text-rose-600" : days <= 7 ? "text-amber-600" : "text-slate-600")}>
                                {days < 0 ? "Vencida" : days === 0 ? "Vence hoje" : `${days} dia(s)`}
                              </span>
                            )
                          ) : (
                            <StatusBadge {...SUBSCRIPTION_STATUS[s.status]} />
                          )}
                          {s.autoRenew && s.status === "ativa" && <p className="text-[10px] text-slate-400">renova auto.</p>}
                        </div>
                        <div className="flex gap-1">
                          {s.status === "ativa" && (
                            <>
                              <Button size="icon" variant="ghost" title="Remover 1 crédito" aria-label="Remover crédito" onClick={() => run(() => subscriptionService.adjustCredits(s.id, -1), "Crédito removido")}>
                                <Minus className="size-4" />
                              </Button>
                              <Button size="icon" variant="ghost" title="Adicionar 1 crédito (cortesia)" aria-label="Adicionar crédito" onClick={() => run(() => subscriptionService.adjustCredits(s.id, 1), "Crédito adicionado")}>
                                <Plus className="size-4" />
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline" icon={RefreshCcw} onClick={() => setRenewing({ sub: s, paid: true, method: "pix" })}>
                            Renovar
                          </Button>
                          {s.status === "ativa" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Encerrar"
                              title="Encerrar assinatura"
                              onClick={async () => {
                                if (await confirm({ title: "Encerrar assinatura?", description: "Os créditos restantes deixam de valer.", confirmLabel: "Encerrar" }))
                                  await run(() => subscriptionService.cancel(s.id), "Assinatura encerrada");
                              }}
                            >
                              <XCircle className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      {/* Plano */}
      <Modal
        open={!!planForm}
        onClose={() => setPlanForm(null)}
        title={planForm?.id ? "Editar plano" : "Novo plano"}
        footer={
          <>
            <Button variant="outline" onClick={() => setPlanForm(null)}>
              Cancelar
            </Button>
            <Button onClick={savePlan}>Salvar</Button>
          </>
        }
      >
        {planForm && (
          <div className="space-y-4">
            <Field label="Nome" required>
              <Input value={planForm.form.name} onChange={(e) => setPlanForm({ ...planForm, form: { ...planForm.form, name: e.target.value } })} autoFocus />
            </Field>
            <Field label="Tipo">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PLAN_TYPES) as PlanType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setPlanForm({
                        ...planForm,
                        form: { ...planForm.form, type: t, credits: t === "avulso" ? 1 : planForm.form.credits, validityDays: t === "mensal" ? 30 : planForm.form.validityDays },
                      })
                    }
                    className={cn("rounded-xl border p-3 text-left", planForm.form.type === t ? "border-ocean-500 bg-ocean-50 ring-2 ring-ocean-200" : "border-slate-200")}
                  >
                    <p className="text-sm font-semibold text-slate-900">{PLAN_TYPES[t].label}</p>
                    <p className="text-[11px] text-slate-500">{PLAN_TYPES[t].description}</p>
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Preço (R$)">
                <Input type="number" min={0} step="0.01" value={planForm.form.price} onChange={(e) => setPlanForm({ ...planForm, form: { ...planForm.form, price: Number(e.target.value) } })} />
              </Field>
              <Field label="Créditos">
                <Input type="number" min={1} value={planForm.form.credits} onChange={(e) => setPlanForm({ ...planForm, form: { ...planForm.form, credits: Number(e.target.value) } })} />
              </Field>
              <Field label="Validade (dias)">
                <Input type="number" min={1} value={planForm.form.validityDays} onChange={(e) => setPlanForm({ ...planForm, form: { ...planForm.form, validityDays: Number(e.target.value) } })} />
              </Field>
            </div>
            <Field label="Esporte (opcional)">
              <Select
                value={planForm.form.sport_type ?? ""}
                onChange={(e) => setPlanForm({ ...planForm, form: { ...planForm.form, sport_type: (e.target.value || undefined) as SportType | undefined } })}
              >
                <option value="">Todos os esportes</option>
                {SPORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Descrição / regras">
              <Textarea value={planForm.form.description ?? ""} onChange={(e) => setPlanForm({ ...planForm, form: { ...planForm.form, description: e.target.value } })} />
            </Field>
            <Switch checked={planForm.form.active} onChange={(v) => setPlanForm({ ...planForm, form: { ...planForm.form, active: v } })} label="Disponível para venda" />
          </div>
        )}
      </Modal>

      {/* Venda */}
      <Modal
        open={!!sell}
        onClose={() => {
          setSell(null);
          setQueryParams({ aluno: null });
        }}
        title="Vender plano / pacote"
        description="Gera a assinatura com créditos e o lançamento no financeiro"
        footer={
          <>
            <Button variant="outline" onClick={() => setSell(null)}>
              Cancelar
            </Button>
            <Button onClick={doSell} icon={ShoppingCart}>
              Confirmar venda
            </Button>
          </>
        }
      >
        {sell && (
          <div className="space-y-4">
            <Field label="Aluno" required>
              <Select value={sell.studentId} onChange={(e) => setSell({ ...sell, studentId: e.target.value })}>
                <option value="">Selecione o aluno</option>
                {data.students
                  .filter((s) => s.status !== "inativo")
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Plano" required>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.plans
                  .filter((p) => p.active)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSell({ ...sell, planId: p.id })}
                      className={cn("rounded-xl border p-3 text-left transition", sell.planId === p.id ? "border-ocean-500 bg-ocean-50 ring-2 ring-ocean-200" : "border-slate-200 hover:border-slate-300")}
                    >
                      <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(p.price)} · {p.credits} aula(s)
                      </p>
                    </button>
                  ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Início" hint={sellPlan ? `Válido até ${formatDate(planEndDate(sellPlan, sell.startDate))}` : undefined}>
                <Input type="date" value={sell.startDate} onChange={(e) => setSell({ ...sell, startDate: e.target.value })} />
              </Field>
              <Field label="Forma de pagamento">
                <Select value={sell.method} onChange={(e) => setSell({ ...sell, method: e.target.value as PaymentMethod })}>
                  {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Switch checked={sell.paid} onChange={(v) => setSell({ ...sell, paid: v })} label="Pagamento recebido agora" description="Desligado: fica em contas a receber" />
          </div>
        )}
      </Modal>

      {/* Renovação */}
      <Modal
        open={!!renewing}
        onClose={() => setRenewing(null)}
        size="sm"
        title="Renovar assinatura"
        footer={
          <>
            <Button variant="outline" onClick={() => setRenewing(null)}>
              Cancelar
            </Button>
            <Button onClick={doRenew} icon={RefreshCcw}>
              Renovar
            </Button>
          </>
        }
      >
        {renewing && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Novo ciclo de <strong>{data.plans.find((p) => p.id === renewing.sub.planId)?.name}</strong> para{" "}
              <strong>{data.students.find((s) => s.id === renewing.sub.studentId)?.name}</strong>, iniciando em{" "}
              <strong>{formatDate(addDays(renewing.sub.endDate, 1) < today() ? today() : addDays(renewing.sub.endDate, 1))}</strong>.
            </p>
            <Field label="Forma de pagamento">
              <Select value={renewing.method} onChange={(e) => setRenewing({ ...renewing, method: e.target.value as PaymentMethod })}>
                {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Switch checked={renewing.paid} onChange={(v) => setRenewing({ ...renewing, paid: v })} label="Pagamento recebido" />
          </div>
        )}
      </Modal>
    </div>
  );
}
