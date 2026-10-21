import type { ISODate, TimeHHMM, Weekday } from "@/types";

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function addMonths(date: ISODate, months: number): ISODate {
  const d = parseISODate(date);
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000);
}

export function weekdayOf(date: ISODate): Weekday {
  return parseISODate(date).getDay() as Weekday;
}

/** Segunda-feira da semana da data informada */
export function startOfWeek(date: ISODate): ISODate {
  const wd = weekdayOf(date);
  const offset = wd === 0 ? -6 : 1 - wd;
  return addDays(date, offset);
}

export function weekDates(date: ISODate): ISODate[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  return addDays(addMonths(startOfMonth(date), 1), -1);
}

export function monthKey(date: ISODate) {
  return date.slice(0, 7);
}

export function isBetween(date: ISODate, start: ISODate, end: ISODate) {
  return date >= start && date <= end;
}

export function timeToMinutes(t: TimeHHMM): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): TimeHHMM {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** Combina data + horário em Date local */
export function toDateTime(date: ISODate, time: TimeHHMM): Date {
  const d = parseISODate(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const WEEKDAY_LONG = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** 15/10/2026 */
export function formatDate(date?: ISODate) {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** 15 out */
export function formatShortDate(date: ISODate) {
  const d = parseISODate(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Quinta-feira, 15 de outubro */
export function formatLongDate(date: ISODate) {
  const d = parseISODate(date);
  return `${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

/** outubro de 2026 */
export function formatMonth(date: ISODate) {
  const d = parseISODate(date);
  const m = MONTHS_LONG[d.getMonth()];
  return `${m[0].toUpperCase()}${m.slice(1)} de ${d.getFullYear()}`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
