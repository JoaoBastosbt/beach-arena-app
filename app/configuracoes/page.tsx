"use client";

import { useRef, useState } from "react";
import { Building2, Database, Download, RefreshCcw, Save, Settings, Trash2, Upload } from "lucide-react";
import type { ArenaSettings, NewEntity, SportType, Weekday } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { settingsService } from "@/services/settings.service";
import { tenantService, wipeAllLocalData } from "@/services/core/tenant";
import { createEmptyTenant, resetCurrentTenant } from "@/services/seed";
import { SPORT_OPTIONS } from "@/lib/constants";
import { WEEKDAY_SHORT, today } from "@/lib/date";
import { stripBase } from "@/lib/utils";
import { Button, Card, CardHeader, ChipGroup, Field, Input, PageHeader, PageLoading, Switch } from "@/components/ui/primitives";
import { useFeedback } from "@/components/ui/feedback-provider";

const WEEKDAYS = ([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((d) => ({ value: d, label: WEEKDAY_SHORT[d] }));
type Collections = keyof typeof db;

export default function SettingsPage() {
  const { run, confirm, toast } = useFeedback();
  const data = useLiveQuery(async () => ({ settings: await settingsService.get(), tenant: await tenantService.current(), tenants: await tenantService.list() }));
  const [draft, setDraft] = useState<NewEntity<ArenaSettings> | null>(null);
  const [tenantDraft, setTenantDraft] = useState<{ name: string; city: string; sports: SportType[] } | null>(null);
  const [newArena, setNewArena] = useState({ name: "", city: "", sports: ["beach_tennis"] as SportType[] });
  const fileRef = useRef<HTMLInputElement>(null);

  if (!data) return <PageLoading />;

  const s = draft ?? stripBase(data.settings);
  const t = tenantDraft ?? { name: data.tenant?.name ?? "", city: data.tenant?.city ?? "", sports: data.tenant?.sports ?? [] };
  const setS = (patch: Partial<NewEntity<ArenaSettings>>) => setDraft({ ...s, ...patch });

  const saveSettings = async () => {
    if (s.cancellationMinHours < 0 || s.makeupValidityDays < 1) return run(async () => Promise.reject(new Error("Valores inválidos")));
    const ok = await run(() => settingsService.update(s), "Regras atualizadas");
    if (ok) setDraft(null);
  };

  const saveTenant = async () => {
    if (!data.tenant) return;
    if (t.name.trim().length < 3) return run(async () => Promise.reject(new Error("Informe o nome da arena")));
    const ok = await run(() => tenantService.update(data.tenant!.id, { name: t.name.trim(), city: t.city.trim(), sports: t.sports }), "Dados da arena salvos");
    if (ok) setTenantDraft(null);
  };

  const exportData = async () => {
    const payload: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString(), tenant: data.tenant };
    for (const key of Object.keys(db) as Collections[]) payload[key] = await db[key].list();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beach-arena-${data.tenant?.slug ?? "backup"}-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup exportado");
  };

  const importData = async (file: File) => {
    const ok = await confirm({
      title: "Importar backup?",
      description: `Os dados atuais de “${data.tenant?.name}” serão substituídos pelo conteúdo do arquivo.`,
      confirmLabel: "Importar",
    });
    if (!ok) return;
    await run(async () => {
      const json = JSON.parse(await file.text()) as Record<string, unknown>;
      if (json.version !== 1) throw new Error("Arquivo de backup inválido");
      const tenantId = tenantService.currentId();
      for (const key of Object.keys(db) as Collections[]) {
        const items = Array.isArray(json[key]) ? (json[key] as { tenantId: string }[]) : [];
        // reatribui ao tenant atual
        await (db[key] as { replaceAll: (i: unknown[]) => Promise<void> }).replaceAll(items.map((i) => ({ ...i, tenantId })));
      }
    }, "Backup importado");
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Configurações" description="Regras operacionais, dados da arena e multiempresa" icon={Settings} />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Regras de cancelamento e reposição" description="Aplicadas automaticamente nas solicitações e na chamada" />
          <div className="grid gap-5 p-5 sm:grid-cols-3">
            <Field label="Antecedência mínima (horas)" hint="Para ter direito a reposição">
              <Input type="number" min={0} value={s.cancellationMinHours} onChange={(e) => setS({ cancellationMinHours: Number(e.target.value) })} />
            </Field>
            <Field label="Prazo para repor (dias)" hint="Contados da aula cancelada">
              <Input type="number" min={1} value={s.makeupValidityDays} onChange={(e) => setS({ makeupValidityDays: Number(e.target.value) })} />
            </Field>
            <Field label="Aviso de renovação (dias)" hint="Antes do vencimento do plano">
              <Input type="number" min={1} value={s.renewalWarningDays} onChange={(e) => setS({ renewalWarningDays: Number(e.target.value) })} />
            </Field>
            <div className="sm:col-span-3">
              <Switch checked={s.debitOnAbsence} onChange={(v) => setS({ debitOnAbsence: v })} label="Falta sem aviso debita crédito" description="Também vale para cancelamentos fora do prazo" />
            </div>
          </div>
          <div className="border-t border-slate-100 p-5">
            <p className="mb-3 text-sm font-semibold text-slate-800">Funcionamento (usado no cálculo de ocupação das quadras)</p>
            <div className="grid gap-5 sm:grid-cols-[auto_auto_1fr]">
              <Field label="Abre">
                <Input type="time" value={s.openingTime} onChange={(e) => setS({ openingTime: e.target.value })} />
              </Field>
              <Field label="Fecha">
                <Input type="time" value={s.closingTime} onChange={(e) => setS({ closingTime: e.target.value })} />
              </Field>
              <Field label="Dias de funcionamento">
                <ChipGroup options={WEEKDAYS} value={s.openDays} onChange={(v) => setS({ openDays: v })} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
            {draft && (
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Descartar
              </Button>
            )}
            <Button icon={Save} onClick={saveSettings} disabled={!draft}>
              Salvar regras
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Dados da arena" description="Arena atualmente selecionada" icon={Building2} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nome">
              <Input value={t.name} onChange={(e) => setTenantDraft({ ...t, name: e.target.value })} />
            </Field>
            <Field label="Cidade">
              <Input value={t.city} onChange={(e) => setTenantDraft({ ...t, city: e.target.value })} />
            </Field>
            <Field label="Modalidades oferecidas" className="sm:col-span-2">
              <ChipGroup options={SPORT_OPTIONS} value={t.sports} onChange={(v) => setTenantDraft({ ...t, sports: v })} />
            </Field>
          </div>
          <div className="flex justify-end border-t border-slate-100 px-5 py-3">
            <Button icon={Save} onClick={saveTenant} disabled={!tenantDraft}>
              Salvar
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Multiempresa" description={`${data.tenants.length} arena(s) neste dispositivo. Cada arena tem dados totalmente isolados.`} />
          <div className="p-5">
            <ul className="mb-5 space-y-2">
              {data.tenants.map((x) => (
                <li key={x.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{x.name}</p>
                    <p className="text-xs text-slate-500">
                      {x.city || "—"} · id: <code>{x.id}</code>
                    </p>
                  </div>
                  {x.id === data.tenant?.id ? (
                    <span className="text-xs font-semibold text-ocean-700">Selecionada</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => tenantService.switchTo(x.id)}>
                      Alternar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <p className="mb-3 text-sm font-semibold text-slate-800">Nova arena (vazia)</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input placeholder="Nome da arena" value={newArena.name} onChange={(e) => setNewArena({ ...newArena, name: e.target.value })} />
              <Input placeholder="Cidade - UF" value={newArena.city} onChange={(e) => setNewArena({ ...newArena, city: e.target.value })} />
              <Button
                variant="secondary"
                onClick={async () => {
                  if (newArena.name.trim().length < 3) return run(async () => Promise.reject(new Error("Informe o nome da nova arena")));
                  const ok = await run(() => createEmptyTenant({ ...newArena, name: newArena.name.trim() }), "Arena criada e selecionada");
                  if (ok) setNewArena({ name: "", city: "", sports: ["beach_tennis"] });
                }}
              >
                Criar arena
              </Button>
            </div>
            <div className="mt-3">
              <ChipGroup options={SPORT_OPTIONS} value={newArena.sports} onChange={(v) => setNewArena({ ...newArena, sports: v })} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Dados locais" description="Hoje os dados ficam no LocalStorage deste navegador" icon={Database} />
          <div className="flex flex-wrap gap-2 p-5">
            <Button variant="outline" icon={Download} onClick={exportData}>
              Exportar backup (JSON)
            </Button>
            <Button variant="outline" icon={Upload} onClick={() => fileRef.current?.click()}>
              Importar backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importData(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              icon={RefreshCcw}
              onClick={async () => {
                if (await confirm({ title: "Restaurar dados de demonstração?", description: "Todos os dados da arena atual serão substituídos por dados de exemplo.", confirmLabel: "Restaurar" }))
                  await run(() => resetCurrentTenant(), "Dados de demonstração restaurados");
              }}
            >
              Restaurar demonstração
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                if (
                  await confirm({
                    title: "Apagar TODOS os dados?",
                    description: "Remove todas as arenas deste navegador. Os dados de demonstração serão recriados ao recarregar a página.",
                    confirmLabel: "Apagar tudo",
                  })
                ) {
                  wipeAllLocalData();
                  window.location.replace(window.location.origin);
                }
              }}
            >
              Apagar tudo
            </Button>
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            A camada <code>services/</code> usa repositórios com interface assíncrona. Para migrar para Supabase/PostgreSQL, implemente <code>Repository&lt;T&gt;</code> e troque as instâncias em <code>services/repositories.ts</code> — as telas não mudam.
          </p>
        </Card>
      </div>
    </div>
  );
}
