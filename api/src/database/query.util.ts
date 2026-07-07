type OrderBy = Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];

/** Dates compare/match as ISO strings, so Date values and stored strings mix safely. */
function comparable(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

export function compareValues(rawA: unknown, rawB: unknown): number {
  const a = comparable(rawA);
  const b = comparable(rawB);
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

export function sortRecords<T extends Record<string, unknown>>(
  records: T[],
  orderBy?: OrderBy,
): T[] {
  if (!orderBy) return records;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...records].sort((left, right) => {
    for (const clause of clauses) {
      for (const [field, direction] of Object.entries(clause)) {
        const cmp = compareValues(left[field], right[field]);
        if (cmp !== 0) return direction === 'desc' ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function matchScalar(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
    const filter = expected as Record<string, unknown>;
    if ('in' in filter) {
      return (filter['in'] as unknown[]).map(comparable).includes(comparable(actual));
    }
    if ('equals' in filter) {
      return comparable(actual) === comparable(filter['equals']);
    }
  }
  return comparable(actual) === comparable(expected);
}

export type RelationLookup = (
  record: Record<string, unknown>,
  relation: string,
) => Record<string, unknown> | Record<string, unknown>[] | null | undefined;

export function matchesWhere(
  record: Record<string, unknown>,
  where: Record<string, unknown> | undefined,
  lookup?: RelationLookup,
): boolean {
  if (!where) return true;
  if (where['NOT']) {
    return !matchesWhere(record, where['NOT'] as Record<string, unknown>, lookup);
  }

  for (const [key, expected] of Object.entries(where)) {
    if (key === 'AND') {
      const clauses = expected as Record<string, unknown>[];
      if (!clauses.every((clause) => matchesWhere(record, clause, lookup))) return false;
      continue;
    }
    if (key === 'OR') {
      const clauses = expected as Record<string, unknown>[];
      if (!clauses.some((clause) => matchesWhere(record, clause, lookup))) return false;
      continue;
    }

    const actual = record[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
      const nested = expected as Record<string, unknown>;
      if ('in' in nested || 'equals' in nested) {
        if (!matchScalar(actual, expected)) return false;
        continue;
      }
      if (lookup) {
        const related = lookup(record, key);
        if (Array.isArray(related)) {
          if (!related.some((item) => matchesWhere(item, nested, lookup))) return false;
        } else if (related) {
          if (!matchesWhere(related, nested, lookup)) return false;
        } else {
          return false;
        }
        continue;
      }
    }

    if (!matchScalar(actual, expected)) return false;
  }

  return true;
}

export function applySelect(
  record: Record<string, unknown>,
  select?: Record<string, unknown>,
): Record<string, unknown> {
  if (!select) return { ...record };
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(select)) {
    if (value === true) {
      result[key] = record[key];
    } else if (value && typeof value === 'object') {
      const nested = record[key];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        result[key] = applySelect(nested as Record<string, unknown>, value as Record<string, unknown>);
      } else if (Array.isArray(nested)) {
        result[key] = nested.map((item) =>
          applySelect(item as Record<string, unknown>, value as Record<string, unknown>),
        );
      }
    }
  }
  return result;
}
