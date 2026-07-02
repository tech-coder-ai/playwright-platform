export type DbProvider = 'prisma' | 'json' | 'oracle';

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  readonly project: ModelDelegate;
  readonly environment: ModelDelegate;
  readonly testSuite: ModelDelegate;
  readonly testCase: ModelDelegate;
  readonly stepDefinition: ModelDelegate;
  readonly pageObject: ModelDelegate;
  readonly secret: ModelDelegate;
  readonly user: ModelDelegate;
  readonly schedule: ModelDelegate;
  readonly testRun: ModelDelegate;
  readonly testResult: ModelDelegate;
}

export type CreateArgs = {
  data: Record<string, unknown>;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
};

export type UpdateArgs = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
};

export type ModelDelegate = {
  findMany(args?: QueryArgs): Promise<any[]>;
  findUnique(args: QueryArgs): Promise<any | null>;
  findFirst(args?: QueryArgs): Promise<any | null>;
  create(args: CreateArgs): Promise<any>;
  createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }>;
  update(args: UpdateArgs): Promise<any>;
  delete(args: { where: Record<string, unknown> }): Promise<any>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
};

export type QueryArgs = {
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
  take?: number;
};

export interface JsonStoreSnapshot {
  projects: Record<string, unknown>[];
  environments: Record<string, unknown>[];
  testSuites: Record<string, unknown>[];
  testCases: Record<string, unknown>[];
  stepDefinitions: Record<string, unknown>[];
  pageObjects: Record<string, unknown>[];
  secrets: Record<string, unknown>[];
  users: Record<string, unknown>[];
  schedules: Record<string, unknown>[];
  testRuns: Record<string, unknown>[];
  testResults: Record<string, unknown>[];
}

export const EMPTY_JSON_STORE: JsonStoreSnapshot = {
  projects: [],
  environments: [],
  testSuites: [],
  testCases: [],
  stepDefinitions: [],
  pageObjects: [],
  secrets: [],
  users: [],
  schedules: [],
  testRuns: [],
  testResults: [],
};
