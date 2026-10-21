"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Lock, Send, Sun } from "lucide-react";
import type { SportType } from "@/types";
import { useLiveQuery } from "@/hooks/use-live-query";
import { db } from "@/services/repositories";
import { tenantService } from "@/services/core/tenant";
import { SPORTS } from "@/lib/constants";
import { getQueryParam } from "@/lib/url";
import { cn } from "@/lib/utils";
import { Button, Textarea } from "@/components/ui/primitives";
import { useFeedback } from "@/components/ui/feedback-provider";

/**
 * Formulário PÚBLICO e ANÔNIMO. Nenhum dado do aluno é coletado.
 * Use ?arena=<id> para direcionar a avaliação a uma arena específica.
 */
export default function PublicFeedbackPage() {
  const { run } = useFeedback();
  const [arenaReady, setArenaReady] = useState(false);

  useEffect(() => {
    const arena = getQueryParam("arena");
    (async () => {
      if (arena && (await tenantService.list()).some((t) => t.id === arena) && tenantService.currentId() !== arena) {
        await tenantService.switchTo(arena);
      }
      setArenaReady(true);
    })();
  }, []);

  const data = useLiveQuery(async () => ({ tenant: await tenantService.current(), teachers: (await db.teachers.list()).filter((t) => t.active) }));
  const [sport, setSport] = useState<SportType | "">("");
  const [teacherId, setTeacherId] = useState("");
  const [classRating, setClassRating] = useState(0);
  const [teacherRating, setTeacherRating] = useState(0);
  const [structureRating, setStructureRating] = useState(0);
  const [nps, setNps] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const valid = classRating > 0 && teacherRating > 0 && structureRating > 0 && nps !== null;

  const submit = async () => {
    if (!valid) return;
    setSending(true);
    const ok = await run(() =>
      db.feedbacks.create({
        classRating,
        teacherRating,
        structureRating,
        nps: nps!,
        sport_type: sport || undefined,
        teacherId: teacherId || undefined,
        comment: comment.trim() || undefined,
      }),
    );
    setSending(false);
    if (ok) setSent(true);
  };

  const reset = () => {
    setSport("");
    setTeacherId("");
    setClassRating(0);
    setTeacherRating(0);
    setStructureRating(0);
    setNps(null);
    setComment("");
    setSent(false);
  };

  const sports = (data?.tenant?.sports ?? (Object.keys(SPORTS) as SportType[])) as SportType[];

  return (
    <div className="bg-court min-h-dvh px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sun-400 to-sun-600 shadow-2xl">
            <Sun className="size-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold">Como foi sua experiência?</h1>
          <p className="mt-1 text-ocean-100/80">{data?.tenant?.name ?? "Arena"} quer ouvir você</p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-ocean-100 ring-1 ring-white/15">
            <Lock className="size-3.5" /> 100% anônimo — não pedimos nome nem contato
          </p>
        </div>

        <div className="animate-slide-up rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
          {!arenaReady || !data ? (
            <p className="py-10 text-center text-sm text-slate-500">Carregando…</p>
          ) : sent ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
              <h2 className="mt-4 text-2xl font-bold text-slate-900">Obrigado! 🙌</h2>
              <p className="mt-1 text-sm text-slate-500">Sua avaliação foi registrada de forma anônima e nos ajuda a melhorar.</p>
              <Button variant="outline" className="mt-6" onClick={reset}>
                Enviar outra avaliação
              </Button>
            </div>
          ) : (
            <div className="space-y-7">
              <section>
                <Label>Qual modalidade você pratica?</Label>
                <div className="flex flex-wrap gap-2">
                  {sports.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSport(sport === s ? "" : s)}
                      className={cn("rounded-xl border px-4 py-2 text-sm font-medium transition", sport === s ? "border-ocean-600 bg-ocean-600 text-white" : "border-slate-200 text-slate-600")}
                    >
                      {SPORTS[s].emoji} {SPORTS[s].label}
                    </button>
                  ))}
                </div>
              </section>

              {data.teachers.length > 0 && (
                <section>
                  <Label>Professor(a) <span className="font-normal text-slate-400">(opcional)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {data.teachers.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTeacherId(teacherId === t.id ? "" : t.id)}
                        className={cn("rounded-xl border px-3 py-2 text-sm transition", teacherId === t.id ? "border-ocean-600 bg-ocean-50 font-semibold text-ocean-800" : "border-slate-200 text-slate-600")}
                      >
                        {t.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <RatingRow label="Qualidade das aulas" value={classRating} onChange={setClassRating} />
              <RatingRow label="Didática do professor" value={teacherRating} onChange={setTeacherRating} />
              <RatingRow label="Estrutura (quadras, areia, vestiário)" value={structureRating} onChange={setStructureRating} />

              <section>
                <Label>De 0 a 10, quanto você indicaria a arena para um amigo?</Label>
                <div className="grid grid-cols-11 gap-1">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setNps(i)}
                      className={cn(
                        "aspect-square rounded-lg text-sm font-bold transition",
                        nps === i
                          ? i >= 9
                            ? "bg-emerald-500 text-white"
                            : i >= 7
                              ? "bg-amber-400 text-white"
                              : "bg-rose-500 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                  <span>Nada provável</span>
                  <span>Muito provável</span>
                </div>
              </section>

              <section>
                <Label>Quer deixar um comentário?</Label>
                <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Elogios, sugestões, o que podemos melhorar…" maxLength={600} />
              </section>

              <Button size="lg" variant="secondary" className="w-full" icon={Send} disabled={!valid} loading={sending} onClick={submit}>
                Enviar avaliação anônima
              </Button>
              {!valid && <p className="-mt-4 text-center text-xs text-slate-400">Avalie os 3 itens e a nota de 0 a 10 para enviar</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-2.5 text-sm font-semibold text-slate-800">{children}</p>;
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const labels = ["", "Ruim", "Regular", "Bom", "Muito bom", "Excelente"];
  return (
    <section>
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn("text-4xl leading-none transition active:scale-90", n <= value ? "text-sun-500" : "text-slate-200 hover:text-sun-200")}
            aria-label={`${n} estrelas`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm font-medium text-slate-500">{labels[value]}</span>
      </div>
    </section>
  );
}
