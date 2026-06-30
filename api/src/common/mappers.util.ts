import { parseJsonArray } from './json-array.util';

export function mapTestSuite<T extends { tags: string }>(suite: T) {
  return { ...suite, tags: parseJsonArray(suite.tags) };
}

export function mapTestCase<T extends { tags: string }>(testCase: T) {
  return { ...testCase, tags: parseJsonArray(testCase.tags) };
}
