"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "./modal";
import { Button } from "./primitives";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
}

interface FeedbackContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Executa uma ação assíncrona exibindo erro amigável se falhar */
  run: <T>(fn: () => Promise<T>, success?: string) => Promise<T | undefined>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const counter = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
    [],
  );

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string) => {
      try {
        const result = await fn();
        if (success) toast(success);
        return result;
      } catch (err) {
        toast(err instanceof Error ? err.message : "Algo deu errado", "error");
        return undefined;
      }
    },
    [toast],
  );

  const close = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  const icons = { success: CheckCircle2, error: XCircle, info: Info };

  return (
    <FeedbackContext.Provider value={{ toast, confirm, run }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              className={cn(
                "animate-slide-up pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl",
                t.tone === "success" && "bg-slate-900 text-white",
                t.tone === "error" && "bg-rose-600 text-white",
                t.tone === "info" && "bg-ocean-700 text-white",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t.message}
            </div>
          );
        })}
      </div>
      <Modal
        open={!!confirmState}
        onClose={() => close(false)}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className={cn("size-5", confirmState?.tone === "primary" ? "text-ocean-600" : "text-rose-500")} />
            {confirmState?.title}
          </span>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button variant={confirmState?.tone === "primary" ? "primary" : "danger"} onClick={() => close(true)}>
              {confirmState?.confirmLabel ?? "Confirmar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{confirmState?.description ?? "Tem certeza que deseja continuar?"}</p>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback precisa estar dentro de <FeedbackProvider>");
  return ctx;
}
