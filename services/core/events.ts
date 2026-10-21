/**
 * Barramento simples de eventos de mudança. Toda escrita nos repositórios
 * emite um evento; os hooks de consulta (useLiveQuery) escutam e recarregam.
 * Com Supabase, basta emitir os mesmos eventos a partir do Realtime.
 */
type Listener = (topic: string) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let pending = new Set<string>();
let scheduled = false;

/** Agrupa várias escritas no mesmo tick em uma única notificação */
export function emitChange(topic: string) {
  pending.add(topic);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    const topics = pending;
    pending = new Set();
    scheduled = false;
    topics.forEach((t) => listeners.forEach((l) => l(t)));
  });
}

// Sincroniza entre abas do navegador
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith("beach-arena")) emitChange("external");
  });
}
