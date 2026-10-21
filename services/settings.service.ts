import type { ArenaSettings, NewEntity } from "@/types";
import { db } from "./repositories";

export const DEFAULT_SETTINGS: NewEntity<ArenaSettings> = {
  cancellationMinHours: 4,
  makeupValidityDays: 30,
  debitOnAbsence: true,
  openingTime: "06:00",
  closingTime: "22:00",
  openDays: [1, 2, 3, 4, 5, 6],
  renewalWarningDays: 7,
};

let creating: Promise<ArenaSettings> | null = null;

export const settingsService = {
  async get(): Promise<ArenaSettings> {
    const [current] = await db.settings.list();
    if (current) return current;
    creating ??= db.settings.create(DEFAULT_SETTINGS).finally(() => {
      creating = null;
    });
    return creating;
  },
  async update(patch: Partial<NewEntity<ArenaSettings>>) {
    const current = await this.get();
    return db.settings.update(current.id, patch);
  },
};
