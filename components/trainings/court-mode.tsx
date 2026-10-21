"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Pause, Play, RotateCcw, Shrink, X } from "lucide-react";
import type { ClassGroup, Exercise, TrainingPlan } from "@/types";
import { FUNDAMENTALS, LEVELS, SPORTS } from "@/lib/constants";
import { formatLongDate } from "@/lib/date";
import { cn } from "@/lib/utils";

interface Block {
  key: string;
  label: string;
  title: string;
  body?: string;
  points?: string[];
  minutes?: number;
}

function buildBlocks(training: TrainingPlan, exercises: Exercise[]): Block[] {
  const blocks: Block[] = [
    { key: "obj", label: "Objetivo técnico", title: training.objective },
    { key: "warm", label: "Aquecimento", title: "Aquecimento", body: training.warmup },
    { key: "main", label: "Drill principal", title: "Drill principal", body: training.mainDrill },
  ];
  exercises.forEach((e, i) =>
    blocks.push({
      key: e.id,
      label: `Exercício ${i + 1} · ${FUNDAMENTALS[e.fundamental].label}`,
      title: e.name,
      body: e.description,
      points: e.coachingPoints,
      minutes: e.durationMin,
    }),
  );
  if (training.cooldown) blocks.push({ key: "cool", label: "Finalização", title: "Volta à calma / jogo", body: training.cooldown });
  if (training.notes) blocks.push({ key: "notes", label: "Observações do professor", title: "Atenção", body: training.notes });
  return blocks;
}

export function CourtMode({
  training,
  exercises,
  groups,
  onClose,
}: {
  training: TrainingPlan;
  exercises: Exercise[];
  groups: ClassGroup[];
  onClose: () => void;
}) {
  const blocks = buildBlocks(
    training,
    training.exerciseIds.map((id) => exercises.find((e) => e.id === id)).filter((e): e is Exercise => !!e),
  );
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const go = useCallback((delta: number) => setIndex((i) => Math.max(0, Math.min(blocks.length - 1, i + delta))), [blocks.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  // Mantém a tela acesa durante a aula (quando suportado)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* navegador sem suporte */
    }
  };

  const close = async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    onClose();
  };

  const block = blocks[index];
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const groupNames = groups.filter((g) => training.classGroupIds.includes(g.id)).map((g) => g.name);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ocean-950 text-white">
      {/* Topo */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-widest text-sun-400">
            {SPORTS[training.sport_type].label} · {LEVELS[training.level].label} · {training.durationMin} min
          </p>
          <h1 className="truncate text-lg font-bold sm:text-2xl">{training.title}</h1>
          <p className="truncate text-xs text-ocean-200/70">
            {formatLongDate(training.date)}
            {groupNames.length > 0 && ` · ${groupNames.join(", ")}`}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-2xl bg-white/10 px-2 py-1.5">
          <span className="font-display w-16 text-center text-2xl font-bold tabular-nums sm:text-3xl">
            {mm}:{ss}
          </span>
          <button onClick={() => setRunning((r) => !r)} className="rounded-xl p-2 hover:bg-white/10" aria-label={running ? "Pausar" : "Iniciar"}>
            {running ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button
            onClick={() => {
              setRunning(false);
              setElapsed(0);
            }}
            className="rounded-xl p-2 hover:bg-white/10"
            aria-label="Zerar"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
        <button onClick={toggleFullscreen} className="hidden rounded-xl p-2.5 hover:bg-white/10 sm:block" aria-label="Tela cheia">
          {isFullscreen ? <Shrink className="size-5" /> : <Expand className="size-5" />}
        </button>
        <button onClick={close} className="rounded-xl p-2.5 hover:bg-white/10" aria-label="Fechar">
          <X className="size-6" />
        </button>
      </div>

      {/* Progresso */}
      <div className="flex gap-1 px-4 pt-3 sm:px-6">
        {blocks.map((b, i) => (
          <button key={b.key} onClick={() => setIndex(i)} className={cn("h-1.5 flex-1 rounded-full transition", i <= index ? "bg-sun-500" : "bg-white/15")} aria-label={b.label} />
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-1 items-center overflow-y-auto px-5 py-6 sm:px-12">
        <div key={block.key} className="animate-slide-up mx-auto w-full max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sun-400 sm:text-base">
            {index + 1}/{blocks.length} · {block.label}
            {block.minutes && ` · ${block.minutes} min`}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl lg:text-6xl">{block.title}</h2>
          {block.body && <p className="mt-6 text-xl leading-relaxed text-ocean-50/90 sm:text-3xl sm:leading-relaxed">{block.body}</p>}
          {block.points && block.points.length > 0 && (
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {block.points.map((p, i) => (
                <li key={i} className="flex items-start gap-3 rounded-2xl bg-white/5 p-4 text-lg ring-1 ring-white/10 sm:text-2xl">
                  <span className="font-display flex size-9 shrink-0 items-center justify-center rounded-full bg-sun-500 text-lg font-bold">{i + 1}</span>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Navegação */}
      <div className="grid grid-cols-2 gap-3 border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-white/10 text-lg font-semibold transition active:scale-[0.98] disabled:opacity-30"
        >
          <ChevronLeft className="size-6" /> Anterior
        </button>
        <button
          onClick={() => (index === blocks.length - 1 ? close() : go(1))}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-sun-500 text-lg font-semibold transition active:scale-[0.98]"
        >
          {index === blocks.length - 1 ? "Encerrar aula" : "Próximo"} <ChevronRight className="size-6" />
        </button>
      </div>
    </div>
  );
}
