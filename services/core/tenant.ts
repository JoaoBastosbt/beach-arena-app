import type { ID, Tenant } from "@/types";
import { emitChange } from "./events";
import { readJSON, storage, STORAGE_PREFIX, writeJSON } from "./storage";

const TENANTS_KEY = `${STORAGE_PREFIX}:tenants`;
const CURRENT_KEY = `${STORAGE_PREFIX}:current-tenant`;

export interface TenantService {
  list(): Promise<Tenant[]>;
  current(): Promise<Tenant | undefined>;
  currentId(): ID;
  switchTo(id: ID): Promise<void>;
  create(tenant: Tenant): Promise<Tenant>;
  update(id: ID, patch: Partial<Omit<Tenant, "id">>): Promise<Tenant>;
}

function readTenants(): Tenant[] {
  return readJSON<Tenant[]>(TENANTS_KEY, []);
}

export const tenantService: TenantService = {
  async list() {
    return readTenants();
  },
  async current() {
    const id = this.currentId();
    return readTenants().find((t) => t.id === id);
  },
  currentId() {
    const stored = storage.getItem(CURRENT_KEY);
    if (stored) return stored;
    return readTenants()[0]?.id ?? "default";
  },
  async switchTo(id) {
    storage.setItem(CURRENT_KEY, id);
    emitChange("tenant");
  },
  async create(tenant) {
    writeJSON(TENANTS_KEY, [...readTenants(), tenant]);
    emitChange("tenants");
    return tenant;
  },
  async update(id, patch) {
    const list = readTenants().map((t) => (t.id === id ? { ...t, ...patch } : t));
    writeJSON(TENANTS_KEY, list);
    emitChange("tenants");
    return list.find((t) => t.id === id)!;
  },
};

/** Remove todos os dados locais (todas as arenas). */
export function wipeAllLocalData() {
  storage
    .keys()
    .filter((k) => k.startsWith(STORAGE_PREFIX))
    .forEach((k) => storage.removeItem(k));
  emitChange("tenant");
}
