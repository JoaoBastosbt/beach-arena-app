import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatCurrency = (value: number) => brl.format(value || 0);

export const formatPercent = (value: number, digits = 0) =>
  `${(Number.isFinite(value) ? value * 100 : 0).toFixed(digits).replace(".", ",")}%`;

export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${rand}` : rand;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function sum<T>(items: T[], fn: (item: T) => number) {
  return items.reduce((acc, item) => acc + fn(item), 0);
}

export function groupBy<T, K extends string>(items: T[], fn: (item: T) => K): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = fn(item);
      (acc[key] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

/** Converte links do YouTube/Vimeo em URL de embed. Retorna null se não reconhecer. */
export function toEmbedUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

/** Remove os campos de sistema (id, tenantId, datas) — útil para duplicar registros */
export function stripBase<T extends { id: string; tenantId: string; createdAt: string; updatedAt: string }>(
  entity: T,
): Omit<T, "id" | "tenantId" | "createdAt" | "updatedAt"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, tenantId, createdAt, updatedAt, ...rest } = entity;
  return rest;
}
