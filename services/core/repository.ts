import type { BaseEntity, ID, NewEntity } from "@/types";
import { uid } from "@/lib/utils";
import { emitChange } from "./events";
import { readJSON, STORAGE_PREFIX, writeJSON } from "./storage";
import { tenantService } from "./tenant";

/**
 * Contrato genérico de persistência. As telas e serviços de domínio dependem
 * apenas desta interface — para migrar para Supabase/PostgreSQL basta criar
 * um `SupabaseRepository<T>` que implemente os mesmos métodos (todos async).
 *
 * `where` aceita igualdade por campo, o que mapeia direto para
 * `supabase.from(table).select().match(where)`.
 */
export interface Repository<T extends BaseEntity> {
  readonly collection: string;
  list(where?: Partial<T>): Promise<T[]>;
  get(id: ID): Promise<T | undefined>;
  create(data: NewEntity<T>): Promise<T>;
  createMany(data: NewEntity<T>[]): Promise<T[]>;
  update(id: ID, patch: Partial<NewEntity<T>>): Promise<T>;
  remove(id: ID): Promise<void>;
  /** Substitui toda a coleção do tenant atual (usado em seed/import) */
  replaceAll(items: T[]): Promise<void>;
}

function matches<T>(item: T, where?: Partial<T>) {
  if (!where) return true;
  return (Object.keys(where) as (keyof T)[]).every((k) => item[k] === where[k]);
}

export class LocalStorageRepository<T extends BaseEntity> implements Repository<T> {
  constructor(
    public readonly collection: string,
    private idPrefix: string,
    private tenantResolver: () => ID = () => tenantService.currentId(),
  ) {}

  private key(tenantId = this.tenantResolver()) {
    return `${STORAGE_PREFIX}:${tenantId}:${this.collection}`;
  }

  private read(): T[] {
    return readJSON<T[]>(this.key(), []);
  }

  private write(items: T[]) {
    writeJSON(this.key(), items);
    emitChange(this.collection);
  }

  async list(where?: Partial<T>) {
    return this.read().filter((i) => matches(i, where));
  }

  async get(id: ID) {
    return this.read().find((i) => i.id === id);
  }

  async create(data: NewEntity<T>) {
    const [created] = await this.createMany([data]);
    return created;
  }

  async createMany(data: NewEntity<T>[]) {
    const now = new Date().toISOString();
    const tenantId = this.tenantResolver();
    const created = data.map(
      (d) => ({ ...d, id: uid(this.idPrefix), tenantId, createdAt: now, updatedAt: now }) as unknown as T,
    );
    this.write([...this.read(), ...created]);
    return created;
  }

  async update(id: ID, patch: Partial<NewEntity<T>>) {
    const items = this.read();
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) throw new Error(`${this.collection}: registro ${id} não encontrado`);
    const updated = { ...items[index], ...patch, updatedAt: new Date().toISOString() } as T;
    items[index] = updated;
    this.write(items);
    return updated;
  }

  async remove(id: ID) {
    this.write(this.read().filter((i) => i.id !== id));
  }

  async replaceAll(items: T[]) {
    this.write(items);
  }
}
