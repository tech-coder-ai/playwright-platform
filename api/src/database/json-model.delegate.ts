import type { JsonStoreSnapshot } from './database.types';
import type { SnapshotStore } from './snapshot-store';
import {
  MODEL_DEFAULTS,
  MODEL_RELATIONS,
  MODEL_STORE_KEYS,
  MODEL_TIMESTAMP_FIELDS,
  type RelationDef,
} from './model-relations';
import { newId } from './id.util';
import { applySelect, matchesWhere, sortRecords, type RelationLookup } from './query.util';
import type { CreateArgs, ModelDelegate, QueryArgs, UpdateArgs } from './database.types';

export class JsonModelDelegate implements ModelDelegate {
  constructor(
    private readonly store: SnapshotStore,
    private readonly modelName: string,
  ) {}

  async findMany(args: QueryArgs = {}): Promise<Record<string, unknown>[]> {
    const records = this.allRecords();
    const lookup = this.createLookup();
    const filtered = records.filter((record) => matchesWhere(record, args.where, lookup));
    const sorted = sortRecords(filtered, args.orderBy);
    const limited = args.take != null ? sorted.slice(0, args.take) : sorted;
    return limited.map((record) => this.shapeRecord(record, args));
  }

  async findUnique(args: QueryArgs): Promise<Record<string, unknown> | null> {
    const record = this.findMatchingRecord(args.where ?? {});
    return record ? this.shapeRecord(record, args) : null;
  }

  async findFirst(args: QueryArgs = {}): Promise<Record<string, unknown> | null> {
    const rows = await this.findMany(args);
    return rows[0] ?? null;
  }

  async create(args: CreateArgs): Promise<Record<string, unknown>> {
    const timestamps = MODEL_TIMESTAMP_FIELDS[this.modelName];
    const now = new Date();
    const record: Record<string, unknown> = {
      id: args.data['id'] ?? newId(),
      ...MODEL_DEFAULTS[this.modelName],
      ...args.data,
    };
    if (timestamps) {
      record[timestamps.created] = record[timestamps.created] ?? now;
      if (timestamps.updated) {
        record[timestamps.updated] = record[timestamps.updated] ?? now;
      }
    }
    await this.store.mutate((snapshot) => {
      this.collection(snapshot).push(record);
    });
    return this.shapeRecord(record, args);
  }

  async createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }> {
    const timestamps = MODEL_TIMESTAMP_FIELDS[this.modelName];
    const now = new Date();
    const records = args.data.map((item) => {
      const record: Record<string, unknown> = {
        id: item['id'] ?? newId(),
        ...MODEL_DEFAULTS[this.modelName],
        ...item,
      };
      if (timestamps) {
        record[timestamps.created] = record[timestamps.created] ?? now;
        if (timestamps.updated) {
          record[timestamps.updated] = record[timestamps.updated] ?? now;
        }
      }
      return record;
    });
    await this.store.mutate((snapshot) => {
      this.collection(snapshot).push(...records);
    });
    return { count: records.length };
  }

  async update(args: UpdateArgs): Promise<Record<string, unknown>> {
    let updated: Record<string, unknown> | null = null;
    await this.store.mutate((snapshot) => {
      const collection = this.collection(snapshot);
      const index = collection.findIndex((record) => matchesWhere(record, args.where));
      if (index === -1) {
        throw new Error(`${this.modelName} record not found`);
      }
      const timestamps = MODEL_TIMESTAMP_FIELDS[this.modelName];
      const next = {
        ...collection[index],
        ...args.data,
      };
      if (timestamps?.updated) {
        next[timestamps.updated] = new Date();
      }
      collection[index] = next;
      updated = structuredClone(next);
    });
    return this.shapeRecord(updated!, args);
  }

  async delete(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>> {
    let removed: Record<string, unknown> | null = null;
    await this.store.mutate((snapshot) => {
      const collection = this.collection(snapshot);
      const index = collection.findIndex((record) => matchesWhere(record, args.where));
      if (index === -1) {
        throw new Error(`${this.modelName} record not found`);
      }
      removed = structuredClone(collection[index]);
      collection.splice(index, 1);
      this.cascadeDelete(snapshot, this.modelName, removed!);
    });
    return removed!;
  }

  async count(args: { where?: Record<string, unknown> } = {}): Promise<number> {
    const lookup = this.createLookup();
    return this.allRecords().filter((record) => matchesWhere(record, args.where, lookup)).length;
  }

  private shapeRecord(record: Record<string, unknown>, args: QueryArgs): Record<string, unknown> {
    let shaped = structuredClone(record);
    if (args.include) {
      shaped = this.applyInclude(shaped, args.include);
    }
    if (args.select) {
      shaped = applySelect(shaped, args.select);
    }
    return this.hydrateDates(shaped);
  }

  private applyInclude(
    record: Record<string, unknown>,
    include: Record<string, unknown>,
  ): Record<string, unknown> {
    const relations = MODEL_RELATIONS[this.modelName] ?? {};
    const result = { ...record };

    for (const [key, spec] of Object.entries(include)) {
      if (key === '_count') {
        result['_count'] = this.applyCount(record, spec as Record<string, unknown>);
        continue;
      }

      const relation = relations[key];
      if (!relation) continue;
      const related = this.resolveRelation(record, relation);
      if (relation.many) {
        const rows = (related as Record<string, unknown>[]).map((item) =>
          spec && typeof spec === 'object'
            ? this.applyInclude(item, spec as Record<string, unknown>)
            : item,
        );
        result[key] = rows.map((item) => this.hydrateDates(item));
      } else if (related) {
        result[key] =
          spec && typeof spec === 'object'
            ? this.applyInclude(related as Record<string, unknown>, spec as Record<string, unknown>)
            : related;
        if (result[key] && typeof result[key] === 'object') {
          result[key] = this.hydrateDates(result[key] as Record<string, unknown>);
        }
      } else {
        result[key] = null;
      }
    }

    return result;
  }

  private applyCount(record: Record<string, unknown>, spec: Record<string, unknown>): Record<string, number> {
    const counts: Record<string, number> = {};
    const relations = MODEL_RELATIONS[this.modelName] ?? {};
    for (const relationName of Object.keys(spec)) {
      const relation = relations[relationName];
      if (!relation?.many) continue;
      const related = this.resolveRelation(record, relation) as Record<string, unknown>[];
      counts[relationName] = related.length;
    }
    return counts;
  }

  private resolveRelation(
    record: Record<string, unknown>,
    relation: RelationDef,
  ): Record<string, unknown> | Record<string, unknown>[] | null {
    const localKey = relation.localKey ?? 'id';
    const localValue = record[localKey];
    const target = this.allRecordsForModel(relation.model);
    if (relation.many) {
      return target.filter((item) => item[relation.foreignKey] === localValue);
    }
    return target.find((item) => item[relation.foreignKey] === localValue) ?? null;
  }

  private createLookup(): RelationLookup {
    return (record, relationName) => {
      const relation = MODEL_RELATIONS[this.modelName]?.[relationName];
      if (!relation) return null;
      return this.resolveRelation(record, relation);
    };
  }

  private findMatchingRecord(where: Record<string, unknown>): Record<string, unknown> | null {
    const lookup = this.createLookup();
    return this.allRecords().find((record) => matchesWhere(record, where, lookup)) ?? null;
  }

  private allRecords(): Record<string, unknown>[] {
    return this.store.getCollection(MODEL_STORE_KEYS[this.modelName]);
  }

  private allRecordsForModel(modelName: string): Record<string, unknown>[] {
    const key = MODEL_STORE_KEYS[modelName];
    return this.store.getCollection(key);
  }

  private collection(snapshot: JsonStoreSnapshot): Record<string, unknown>[] {
    return snapshot[MODEL_STORE_KEYS[this.modelName]];
  }

  private cascadeDelete(
    snapshot: JsonStoreSnapshot,
    modelName: string,
    record: Record<string, unknown>,
  ): void {
    const relations = MODEL_RELATIONS[modelName] ?? {};
    for (const relation of Object.values(relations)) {
      if (!relation.many) continue;
      const key = MODEL_STORE_KEYS[relation.model];
      const localKey = relation.localKey ?? 'id';
      const localValue = record[localKey];
      const children = snapshot[key].filter((item) => item[relation.foreignKey] === localValue);
      snapshot[key] = snapshot[key].filter((item) => item[relation.foreignKey] !== localValue);
      for (const child of children) {
        this.cascadeDelete(snapshot, relation.model, child);
      }
    }
  }

  private hydrateDates(record: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.hydrateDates(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          item && typeof item === 'object'
            ? this.hydrateDates(item as Record<string, unknown>)
            : item,
        );
      } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        result[key] = new Date(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
