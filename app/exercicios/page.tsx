"use client";

import { useMemo, useState } from "react";
import { BookOpenText, Clock, Pencil, PlayCircle, Plus, Trash2, Wrench } from "lucide-react";
import type { Exercise, Fundamental, ID, Level, NewEntity, SportType } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { FUNDAMENTAL_OPTIONS, FUNDAMENTALS, LEVEL_OPTIONS, SPORT_OPTIONS } from "@/lib/constants";
import { cn, normalize } from "@/lib/utils";
import { Button, Card, EmptyState, Field, Input, PageHeader, PageLoading, SearchInput, Select, Textarea } from "@/components/ui/primitives";
import { LevelBadge, SportBadge } from "@/components/ui/badges";
import { Modal } from "@/components/ui/modal";
import { useFeedback } from "@/components/ui/feedback-provider";
import { VideoEmbed } from "@/components/exercises/video-embed";

type Form = NewEntity<Exercise> & { coachingText: string };

const emptyForm = (): Form => ({
  name: "",
  fundamental: "saque",
  sport_type: "beach_tennis",
  level: "iniciante",
  description: "",
  coachingPoints: [],
  coachingText: "",
  durationMin: 10,
  equipment: "",
  videoUrl: "",
});

export default function ExercisesPage() {
  const { run, confirm } = useFeedback();
  const data = useLiveQuery(async () => ({ exercises: await db.exercises.list(), trainings: await db.trainings.list() }));
  const [fundamental, setFundamental] = useState<Fundamental | "">("");
  const [sport, setSport] = useState<SportType | "">("");
  const [level, setLevel] = useState<Level | "">("");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<Exercise | null>(null);
  const [editing, setEditing] = useState<{ id: ID | null; form: Form } | null>(null);

  const list = useMemo(() => {
    if (!data) return [];
    const q = normalize(search);
    return data.exercises
      .filter((e) => (!fundamental || e.fundamental === fundamental) && (!sport || e.sport_type === sport) && (!level || e.level === level))
      .filter((e) => !q || normalize(`${e.name} ${e.description}`).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, fundamental, sport, level, search]);

  if (!data) return <PageLoading />;

  const save = async () => {
    if (!editing) return;
    const { coachingText, ...rest } = editing.form;
    if (rest.name.trim().length < 3) return run(async () => Promise.reject(new Error("Informe o nome do exercício")));
    const payload: NewEntity<Exercise> = {
      ...rest,
      name: rest.name.trim(),
      coachingPoints: coachingText
        .split("\n")
        .map((l) => l.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean),
      videoUrl: rest.videoUrl?.trim() || undefined,
      equipment: rest.equipment?.trim() || undefined,
    };
    const ok = await run(() => (editing.id ? db.exercises.update(editing.id, payload) : db.exercises.create(payload)), "Exercício salvo");
    if (ok) setEditing(null);
  };

  const remove = async (e: Exercise) => {
    const used = data.trainings.filter((t) => t.exerciseIds.includes(e.id)).length;
    if (
      await confirm({
        title: `Excluir “${e.name}”?`,
        description: used ? `Está em ${used} treino(s) — será removido deles.` : undefined,
        confirmLabel: "Excluir",
      })
    ) {
      await run(async () => {
        for (const t of data.trainings.filter((t) => t.exerciseIds.includes(e.id))) {
          await db.trainings.update(t.id, { exerciseIds: t.exerciseIds.filter((id) => id !== e.id) });
        }
        await db.exercises.remove(e.id);
      }, "Exercício excluído");
      setViewing(null);
    }
  };

  const counts = Object.fromEntries(FUNDAMENTAL_OPTIONS.map((f) => [f.value, data.exercises.filter((e) => e.fundamental === f.value).length]));

  return (
    <div>
      <PageHeader
        title="Biblioteca de exercícios"
        description="Drills organizados por fundamento, com descrição técnica e vídeo"
        icon={BookOpenText}
        actions={
          <Button variant="secondary" icon={Plus} onClick={() => setEditing({ id: null, form: emptyForm() })}>
            Novo exercício
          </Button>
        }
      />

      {/* Fundamentos */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <FundamentalTile active={!fundamental} onClick={() => setFundamental("")} label="Todos" count={data.exercises.length} color="bg-slate-800" />
        {FUNDAMENTAL_OPTIONS.map((f) => (
          <FundamentalTile key={f.value} active={fundamental === f.value} onClick={() => setFundamental(f.value)} label={f.label} count={counts[f.value]} color={FUNDAMENTALS[f.value].color} />
        ))}
      </div>

      <Card className="mb-4 grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto]">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar exercício" />
        <Select value={sport} onChange={(e) => setSport(e.target.value as SportType | "")}>
          <option value="">Todos esportes</option>
          {SPORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select value={level} onChange={(e) => setLevel(e.target.value as Level | "")}>
          <option value="">Todos níveis</option>
          {LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Card>

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpenText} title="Nenhum exercício encontrado" />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <Card key={e.id} className="group flex cursor-pointer flex-col overflow-hidden transition hover:shadow-md" onClick={() => setViewing(e)}>
              <div className={cn("h-1.5", FUNDAMENTALS[e.fundamental].color)} />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{FUNDAMENTALS[e.fundamental].label}</p>
                  {e.videoUrl && <PlayCircle className="size-4 text-sun-500" />}
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-900 group-hover:text-ocean-700">{e.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{e.description}</p>
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
                  <SportBadge sport={e.sport_type} short />
                  <LevelBadge level={e.level} />
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="size-3.5" /> {e.durationMin} min
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detalhe */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        size="lg"
        title={viewing?.name}
        description={viewing ? `${FUNDAMENTALS[viewing.fundamental].label} · ${viewing.durationMin} min` : undefined}
        footer={
          viewing && (
            <>
              <Button variant="ghost" icon={Trash2} onClick={() => remove(viewing)}>
                Excluir
              </Button>
              <Button
                variant="outline"
                icon={Pencil}
                onClick={() => {
                  setEditing({ id: viewing.id, form: { ...viewing, coachingText: viewing.coachingPoints.join("\n") } });
                  setViewing(null);
                }}
              >
                Editar
              </Button>
            </>
          )
        }
      >
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-1">
              <SportBadge sport={viewing.sport_type} />
              <LevelBadge level={viewing.level} />
            </div>
            <VideoEmbed url={viewing.videoUrl} title={viewing.name} />
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Descrição técnica</h4>
              <p className="text-sm leading-relaxed text-slate-700">{viewing.description}</p>
            </section>
            {viewing.coachingPoints.length > 0 && (
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pontos de correção</h4>
                <ul className="space-y-1.5">
                  {viewing.coachingPoints.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sun-100 text-[11px] font-bold text-sun-700">{i + 1}</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {viewing.equipment && (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Wrench className="size-4 text-slate-400" /> {viewing.equipment}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Formulário */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? "Editar exercício" : "Novo exercício"}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Nome" required>
              <Input value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} autoFocus />
            </Field>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Fundamento">
                <Select value={editing.form.fundamental} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, fundamental: e.target.value as Fundamental } })}>
                  {FUNDAMENTAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Esporte">
                <Select value={editing.form.sport_type} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, sport_type: e.target.value as SportType } })}>
                  {SPORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nível">
                <Select value={editing.form.level} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, level: e.target.value as Level } })}>
                  {LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Duração (min)">
                <Input type="number" min={1} value={editing.form.durationMin} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, durationMin: Number(e.target.value) } })} />
              </Field>
            </div>
            <Field label="Descrição técnica" required>
              <Textarea rows={4} value={editing.form.description} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })} placeholder="Como executar, organização dos alunos, regras do drill..." />
            </Field>
            <Field label="Pontos de correção" hint="Um por linha">
              <Textarea rows={4} value={editing.form.coachingText} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, coachingText: e.target.value } })} placeholder={"Pés paralelos\nContato à frente do corpo"} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Materiais">
                <Input value={editing.form.equipment ?? ""} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, equipment: e.target.value } })} placeholder="Cones, cesto de bolas" />
              </Field>
              <Field label="Vídeo (YouTube, Vimeo ou link)" hint="Links do YouTube/Vimeo são incorporados automaticamente">
                <Input type="url" value={editing.form.videoUrl ?? ""} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, videoUrl: e.target.value } })} placeholder="https://youtube.com/watch?v=..." />
              </Field>
            </div>
            {editing.form.videoUrl && <VideoEmbed url={editing.form.videoUrl} title="Prévia" />}
          </div>
        )}
      </Modal>
    </div>
  );
}

function FundamentalTile({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-3 text-left transition",
        active ? "border-slate-900 bg-slate-900 text-white shadow-lg" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
      )}
    >
      <span className={cn("absolute right-3 top-3 size-2.5 rounded-full", color)} />
      <p className="font-display text-2xl font-bold">{count}</p>
      <p className={cn("text-xs font-medium", active ? "text-slate-300" : "text-slate-500")}>{label}</p>
    </button>
  );
}
