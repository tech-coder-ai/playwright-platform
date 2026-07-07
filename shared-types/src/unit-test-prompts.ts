export type UnitTestLanguage = 'angular' | 'java' | 'python';

export interface UnitTestPromptTemplate {
  id: string;
  language: UnitTestLanguage;
  name: string;
  description: string;
  bestFor: string[];
  framework: string;
  coverageTarget: string;
  promptTemplate: string;
  runCommand: string;
  coverageCommand: string;
}

export const UNIT_TEST_PROMPT_PLACEHOLDERS = {
  target: '{{TARGET}}',
  context: '{{ADDITIONAL_CONTEXT}}',
  source: '{{SOURCE_CODE}}',
} as const;

/** Research-backed rules prepended to every template (LLM studies + 2025/2026 reviews). */
export const SHARED_PROMPT_RULES = `
SHARED RULES (apply to every generation — based on LLM unit-test research and practitioner reviews):

OUTPUT:
- Deliver runnable test code first; analysis tables after the code (not instead of it).
- Do NOT invent imports, packages, methods, or config that are not in the source or stated stack.
- Do NOT mock pure functions or same-package utilities — use real implementations.
- Do NOT write tests that only call a method without asserting behaviour.
- Do NOT test trivial getters/setters, empty record/DTO classes, or framework boilerplate unless they contain logic.

MANDATORY EDGE VALUES (LLMs systematically omit these without explicit prompting):
- null / undefined / None, empty string, empty array/collection, whitespace-only input
- boundary min/max, off-by-one, zero, negative numbers (where applicable)
- NaN and Infinity for floating-point paths
- invalid types and malformed input that should throw or return errors

MOCKING:
- Mock ONLY external I/O: HTTP, DB, filesystem, clock, env, third-party SDKs.
- Never mock the unit under test or in-package pure helpers.

QUALITY:
- One regression-style test when comments or names suggest a prior bug or edge case.
- Name tests so failure messages identify the scenario (should X when Y).
- After the test code, list: (a) coverage risks you could not test, (b) exact command to run coverage, (c) what to inspect in the coverage report for missed branches.

TWO-PASS TIP: For large classes, run the "boundary & error only" prompt first, then the comprehensive prompt for happy paths — deeper coverage than a single pass.
`;

export function buildUnitTestPrompt(
  template: UnitTestPromptTemplate,
  target: string,
  options: { sourceCode?: string; additionalContext?: string } = {},
): string {
  const sourceBlock = options.sourceCode?.trim()
    ? `\n\n--- SOURCE CODE ---\n${options.sourceCode.trim()}\n--- END SOURCE CODE ---`
    : '\n\n(Paste the full source code for the target file/module after this prompt.)';

  const contextBlock = options.additionalContext?.trim()
    ? `\n\nAdditional context from the developer:\n${options.additionalContext.trim()}`
    : '';

  const body = template.promptTemplate
    .replaceAll(UNIT_TEST_PROMPT_PLACEHOLDERS.target, target.trim() || '[file-or-module-name]')
    .replaceAll(UNIT_TEST_PROMPT_PLACEHOLDERS.source, sourceBlock)
    .replaceAll(UNIT_TEST_PROMPT_PLACEHOLDERS.context, contextBlock);

  return `${SHARED_PROMPT_RULES}\n\n---\n\n${body}`;
}

export const UNIT_TEST_PROMPTS: UnitTestPromptTemplate[] = [
  // ── Angular ──────────────────────────────────────────────────────────────
  {
    id: 'angular-comprehensive',
    language: 'angular',
    name: 'Comprehensive Jasmine/Karma suite',
    description:
      'Full branch and template coverage with TestBed, spies, async handling, and 80%+ thresholds. Use for Karma-based projects; pair with Vitest prompt for new Angular CLI apps.',
    bestFor: ['Components', 'Services', 'Pipes', 'Directives', 'Karma legacy projects'],
    framework: 'Jasmine + Karma + Angular TestBed',
    coverageTarget: '≥ 80% statements, branches, functions, lines',
    runCommand: 'ng test --no-watch --coverage',
    coverageCommand:
      'ng test --no-watch --coverage (add coverage thresholds in angular.json test.options.coverage or karma.conf.js)',
    promptTemplate: `You are a senior Angular test engineer specializing in Jasmine, Karma, and Angular TestBed.

Generate a production-ready unit test suite for: {{TARGET}}

Requirements — treat these as mandatory:
1. Coverage: achieve at least 80% on statements, branches, functions, and lines. Map every public method, @Input/@Output (or input()/output() signals), lifecycle hook, template binding, and conditional branch to at least one test.
2. Positive scenarios: happy-path behaviour with typical valid inputs, successful HTTP responses, emitted events, and expected DOM state after detectChanges().
3. Negative scenarios: invalid inputs, empty/null/undefined values, rejected promises, HTTP 4xx/5xx errors, guard failures, and user actions that should NOT trigger side effects.
4. Edge cases: boundary values, empty collections, duplicate clicks, rapid successive calls, off-by-one, NaN where numeric.
5. Async: use fakeAsync/tick, waitForAsync, or async/await correctly. Never leave outstanding timers or subscriptions.
6. Mocking: mock injected services with jasmine.createSpyObj or useValue/useClass. Use HttpClientTestingModule for HTTP. Do NOT mock in-package pure helpers.
7. Template/DOM: use fixture.debugElement.query(By.css(...)); assert text, disabled state, class bindings.
8. Signals (Angular 17+): test signal() reads, computed(), and effects where present.
9. Structure: describe per class; nested describe per method; it('should ... when ...') names; @DisplayName-style readable descriptions in comments.
10. Output: one complete .spec.ts. No placeholders. Include coverage threshold config snippet if missing.

After the test file:
- Coverage checklist table: Branch/Method | Positive | Negative | Edge
- Command: ng test --no-watch --coverage

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'angular-vitest',
    language: 'angular',
    name: 'Vitest + TestBed (Angular 17+ default)',
    description:
      'Recommended for new Angular CLI projects. Vitest in Node/jsdom, TestBed, vi.fn() mocks, signal/input() testing, and ng test --coverage per angular.dev.',
    bestFor: ['New Angular projects', 'Signals & standalone components', 'Fast CI unit tests'],
    framework: 'Vitest + Angular TestBed + jsdom',
    coverageTarget: '≥ 80% with ng test --coverage',
    runCommand: 'ng test --no-watch --coverage',
    coverageCommand: 'ng test --no-watch --coverage (reports in coverage/ directory)',
    promptTemplate: `You are a senior Angular v17+ test engineer using Vitest (default in modern Angular CLI) and TestBed.

Generate unit tests for: {{TARGET}}

Stack: Vitest + @angular/build:unit-test + TestBed + jsdom (NOT Karma unless stated in additional context).

Requirements:
1. Use import { describe, it, expect, beforeEach, vi } from 'vitest' where needed; Angular TestBed for components/services.
2. Mock dependencies with vi.fn() / vi.mock() for external modules only — not same-package pure functions.
3. Test signals: signal(), computed(), input(), output(), effect() — set inputs via fixture.componentRef.setInput() where applicable.
4. Test OnPush components: verify detectChanges() after state updates.
5. HTTP: use HttpClientTestingModule + HttpTestingController (flush, expectOne, verify).
6. Coverage ≥ 80% branches: every if/else, ternary, optional chaining path, and @if/@for template branches.
7. Explicit edge tests: null, undefined, empty string, empty array, boundary values.
8. No test without assertions. No testing trivial getters.

Output one complete .spec.ts. After code, list missed-branch risks and run: ng test --no-watch --coverage

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'angular-boundary',
    language: 'angular',
    name: 'Boundary & error pass (2nd pass)',
    description:
      'Research-backed second pass: ONLY null, empty, invalid, HTTP error, and async failure tests — no happy paths. Run after comprehensive or Vitest prompt.',
    bestFor: ['Gap-filling after first generation', 'Legacy code with weak error coverage'],
    framework: 'Vitest or Jasmine — match your project',
    coverageTarget: 'Close branch gaps in error paths',
    runCommand: 'ng test --no-watch --coverage',
    coverageCommand: 'ng test --no-watch --coverage — inspect coverage/ for red branches',
    promptTemplate: `You are a senior Angular test engineer. SECOND PASS ONLY — do NOT write happy-path tests.

Target: {{TARGET}}

Write ONLY tests for boundary and error inputs:
- null, undefined, empty string, empty array, whitespace-only
- invalid @Input / form values, validation failures
- HTTP 400/401/404/500 via HttpTestingController error responses
- rejected Promises, thrown errors in services, guard returning false
- duplicate submit, rapid double-click, expired session scenarios
- NaN / Infinity on numeric bindings if applicable

Use TestBed + Vitest (vi.fn) or Jasmine (createSpyObj) matching the existing test style in additional context.
Each test: Given / When / Then comment. Assert error UI, thrown errors, or fallback behaviour — not just "does not throw".

Output only the additional test cases (new it() blocks or a supplemental describe). State which branches these target.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'angular-component',
    language: 'angular',
    name: 'Component & template focus',
    description:
      'Deep DOM, event, and @Input/@Output testing with fixture detection. Ideal for standalone or NgModule components with templates.',
    bestFor: ['UI components', 'Forms', 'Event handlers'],
    framework: 'Jasmine + TestBed + ComponentFixture',
    coverageTarget: '≥ 85% on component class + template branches',
    runCommand: 'ng test --no-watch --coverage',
    coverageCommand: 'ng test --no-watch --coverage',
    promptTemplate: `You are an expert Angular component tester. Write Jasmine/Karma tests for the component: {{TARGET}}

Focus on component-specific quality:
- Configure TestBed with declarations/imports for standalone or module components.
- Test EVERY @Input variation (valid, empty, null, boundary) and EVERY @Output emission (verify EventEmitter.emit payloads).
- Simulate user interactions: click, input, blur, keydown — then call fixture.detectChanges() and assert DOM updates.
- Test *ngIf, *ngFor, [class], [disabled], routerLink, and reactive form validation states.
- Positive: user completes the primary flow successfully.
- Negative: validation errors shown, buttons disabled, error messages rendered, failed service calls show fallback UI.
- Edge: double-submit prevention, whitespace-only input, max-length input, loading/disabled flags during async operations.
- Mock child components and services; never hit real HTTP.
- Use ComponentFixtureAutoDetect only if justified; otherwise explicit detectChanges().

Deliver one complete .spec.ts file. No skipped tests. Target ≥ 85% branch coverage on the component TypeScript and template branches.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'angular-service',
    language: 'angular',
    name: 'Service & HTTP focus',
    description:
      'HttpClientTestingModule, Observable contracts, error operators, and RxJS marble-style scenarios for injectable services.',
    bestFor: ['Services', 'Interceptors', 'Resolvers', 'State services'],
    framework: 'Jasmine + HttpClientTestingModule',
    coverageTarget: '≥ 90% on service methods and error paths',
    runCommand: 'ng test --no-watch --coverage',
    coverageCommand: 'ng test --no-watch --coverage',
    promptTemplate: `You are a senior Angular engineer writing service unit tests for: {{TARGET}}

Use Jasmine + TestBed + HttpClientTestingModule (or HttpTestingController).

For each public method:
1. Positive: successful response, correct mapping/transform, subscribers receive expected value, side effects occur once.
2. Negative: HTTP error (404, 500), network failure, invalid payload, thrown exceptions — assert error handlers and fallback values.
3. Edge: empty response body, pagination boundaries, concurrent calls, cache hit vs miss, unsubscribe before emit.

Rules:
- Use HttpTestingController.expectOne / expectNone; flush mock responses.
- Test RxJS operators: map, catchError, switchMap, tap — verify behaviour with cold observables.
- Spy on dependencies; never use real HttpClient.
- Test retry/backoff only if present in source.
- Each test must assert something meaningful (not just "does not throw").

Output one complete .spec.ts. Include a brief table mapping each service method → test cases (positive / negative / edge). Target ≥ 90% line coverage.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'angular-ts-mocking-bird',
    language: 'angular',
    name: 'ts-mocking-bird (no TestBed)',
    description:
      'Type-safe unit tests with @morgan-stanley/ts-mocking-bird — direct SUT instantiation, no Angular TestBed. Best for services, facades, guards, pipes, and pure TypeScript classes.',
    bestFor: [
      'Services & facades',
      'Guards & interceptors',
      'Pipes & utilities',
      'Classes with constructor DI',
    ],
    framework: 'Jasmine + @morgan-stanley/ts-mocking-bird',
    coverageTarget: '≥ 80% line and branch (no TestBed overhead)',
    runCommand: 'ng test --no-watch --coverage',
    coverageCommand: 'ng test --no-watch --coverage',
    promptTemplate: `You are a senior Angular/TypeScript test engineer. Write unit tests for: {{TARGET}}

IMPORTANT — do NOT use Angular TestBed, ComponentFixture, configureTestingModule, or HttpClientTestingModule.
Use Jasmine as the test runner and @morgan-stanley/ts-mocking-bird for all mocking and call verification.

Install: npm install @morgan-stanley/ts-mocking-bird --save-dev

Core pattern — instantiate the system under test directly:
\`\`\`typescript
import { Mock, setupFunction, setupProperty, IMocked, addMatchers } from '@morgan-stanley/ts-mocking-bird';

describe('MyService', () => {
  let mockDep: IMocked<IDependency>;
  let sut: MyService;

  beforeEach(() => {
    addMatchers();
    mockDep = Mock.create<IDependency>().setup(
      setupFunction('fetch', () => of(mockData)),       // positive return
      setupFunction('save', () => throwError(() => err)), // negative path
    );
    sut = new MyService(mockDep.mock);  // direct construction — NO TestBed
  });
});
\`\`\`

Mocking rules:
1. Use Mock.create<T>() for interfaces and instance dependencies; pass mockDep.mock to the SUT constructor.
2. Use Mock.create<Class, typeof Class>() with setupConstructor() / setupStaticFunction() when the SUT needs a mocked class constructor or static members.
3. Use setupFunction('method', impl) for positive returns; alternate impls or throwError for negative/exception paths.
4. Use setupProperty / defineProperty for getters and setters; verify with withGetter / withSetter matchers.
5. For module-level imports, use replacePropertiesBeforeEach(() => [...]) or proxyModule + registerMock + reset — never TestBed providers.
6. Recreate mocks in beforeEach (via replacePropertiesBeforeEach) so call counts reset between tests.

Verification — use ts-mocking-bird matchers (not jasmine.createSpyObj):
- expect(mock.withFunction('method')).wasCalledOnce()
- expect(mock.withFunction('method').withParameters('x').strict()).wasCalledOnce()
- expect(mock.withFunction('method').withParametersEqualTo(obj)).wasCalledOnce()
- expect(mock.withGetter('prop')).wasCalledOnce()
- Use toBeDefined(), any() from '@morgan-stanley/ts-mocking-bird' for flexible parameter matching.

Coverage requirements (≥ 80% statements, branches, functions, lines):
- Positive: each public method happy path with valid inputs; verify return value AND mock interactions.
- Negative: invalid inputs, rejected Observables, thrown errors, guard returns false — use setupFunction impl that throws or returns error Observables.
- Edge: null/undefined args, empty arrays, boundary values, consecutive calls, verify wasNotCalled when action should not trigger deps.

What to skip:
- No TestBed.configureTestingModule, no ComponentFixture, no detectChanges(), no DOM/template tests (use the Component & template prompt for those).
- For HTTP-dependent services: mock the HttpClient interface (or wrapper service) via Mock.create — do not use HttpTestingController.

Output:
1. One complete .spec.ts with all imports.
2. Brief table: Method | Positive | Negative | Edge | Mock setup used.
3. Note any interfaces the SUT depends on that must be mocked.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },

  // ── Java ─────────────────────────────────────────────────────────────────
  {
    id: 'java-comprehensive',
    language: 'java',
    name: 'JUnit 5 + Mockito comprehensive',
    description:
      'Coverage-driven suite with @ParameterizedTest, static mocks, and given/when/then naming. Industry-standard 80%+ JaCoCo target.',
    bestFor: ['Services', 'Controllers', 'Utilities', 'Domain logic'],
    framework: 'JUnit 5 + Mockito + JaCoCo',
    coverageTarget: '≥ 80% line and branch (JaCoCo)',
    runCommand: './gradlew test jacocoTestReport',
    coverageCommand: './gradlew test jacocoTestReport  # Maven: mvn clean test jacoco:report',
    promptTemplate: `You are a senior Java engineer writing unit tests with JUnit 5 and Mockito.

Generate comprehensive tests for: {{TARGET}}

Mandatory coverage goals (JaCoCo):
- ≥ 80% line coverage and ≥ 80% branch coverage.
- Every public method: at least one positive, one negative, and one edge-case test.
- Every if/else, switch branch, and exception throw path must be exercised.

Test design:
1. Positive (happy path): valid inputs, expected return values, verify mock interactions with Mockito.verify().
2. Negative: invalid arguments → assertThrows with type AND message fragment; verify no further interactions.
3. Edge: null, empty collections, boundary integers, max/min strings, duplicate calls, Optional.empty().
4. Use @ExtendWith(MockitoExtension.class), @Mock, @InjectMocks.
5. Use @DisplayName("full English sentence") on every @Test and @ParameterizedTest.
6. Use @ParameterizedTest + @CsvSource or @MethodSource for input combinations.
7. Use assertAll() when verifying multiple properties on one object.
8. Naming: given<Precondition>_when<Action>_then<ExpectedResult>.
9. Use ArgumentMatchers correctly; avoid unnecessary stubbing.
10. For static methods use mockStatic in try-with-resources per test.
11. Do NOT test private methods, records without logic, main(), or trivial getters/setters.
12. Do NOT use PowerMock or reflection hacks.
13. Output complete test class(es) with package and imports. No // TODO tests.

After code, include:
| Method | Positive | Negative | Edge |
Gradle: ./gradlew test jacocoTestReport | Maven: mvn clean test jacoco:report
JaCoCo fail-under 80% snippet for build.gradle or pom.xml.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'java-maven-spring',
    language: 'java',
    name: 'Maven + Spring Boot slice tests',
    description:
      'Mark Pollack-style hardened prompt: read pom.xml first, prefer @WebMvcTest/@DataJpaTest slices, Maven JaCoCo, iterate until 80%.',
    bestFor: ['Maven Spring Boot', 'REST controllers', 'JPA repositories', 'Services'],
    framework: 'JUnit 5 + Mockito + Spring slice tests + Maven',
    coverageTarget: '≥ 80% line (JaCoCo HTML report)',
    runCommand: 'mvn clean test jacoco:report',
    coverageCommand: 'mvn clean test jacoco:report && open target/site/jacoco/index.html',
    promptTemplate: `You are a senior Spring Boot engineer writing Maven-based tests for: {{TARGET}}

WORKFLOW:
1. Infer Spring Boot version from pom.xml (affects MockMvc vs RestTestClient, JUnit version).
2. Classify target: REST controller → @WebMvcTest; JPA repo → @DataJpaTest; service logic → plain JUnit + Mockito (no full @SpringBootTest).
3. Write meaningful behaviour tests — not line-padding tests.
4. After generating, state: mvn compile && mvn test && mvn jacoco:report

Rules:
- @WebMvcTest for controllers (MockMvc on Boot 3.x); mock services with @MockBean.
- @DataJpaTest + TestEntityManager for repositories.
- @ExtendWith(MockitoExtension.class) + @InjectMocks for pure services.
- assertThrows for validation and not-found paths.
- Do NOT use @SpringBootTest when a slice test suffices.
- Do NOT test records, main(), auto-config internals, or trivial getters.
- Target ≥ 80% line coverage; list gaps to fill from target/site/jacoco/index.html.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'java-boundary',
    language: 'java',
    name: 'Boundary & exception pass (2nd pass)',
    description:
      'Second pass: ONLY null, empty, boundary, and exception tests — no happy paths. Fills gaps LLMs typically miss.',
    bestFor: ['Validators', 'Services', 'After comprehensive prompt'],
    framework: 'JUnit 5 + @ParameterizedTest + AssertJ',
    coverageTarget: 'Branch gaps in error paths',
    runCommand: './gradlew test --tests "*{{TARGET}}*"  # Maven: mvn test -Dtest={{TARGET}}Test',
    coverageCommand: './gradlew test jacocoTestReport',
    promptTemplate: `You are a Java test engineer. SECOND PASS ONLY — write NO happy-path tests.

Target: {{TARGET}}

Use @ParameterizedTest with @CsvSource or @MethodSource for:
- null, empty string, blank/whitespace, empty List/Optional
- Integer.MIN_VALUE, MAX_VALUE, zero, negative (where applicable)
- invalid enum values, malformed IDs, duplicate keys

For each exception path use assertThrows with:
- exact exception type
- message fragment match

Use @DisplayName on every test. AssertJ preferred. verify(mock, never()) when invalid input should short-circuit.

Output supplemental test methods only. List which branches each test covers.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'java-spring-service',
    language: 'java',
    name: 'Spring service / repository',
    description:
      'Layered tests for @Service classes with mocked repositories, transaction boundaries, and DTO mapping validation.',
    bestFor: ['Spring @Service', 'Repository layers', 'DTO mappers'],
    framework: 'JUnit 5 + Mockito + Spring Test',
    coverageTarget: '≥ 85% on business logic methods',
    runCommand: './gradlew test --tests "*{{TARGET}}*"',
    coverageCommand: './gradlew test jacocoTestReport',
    promptTemplate: `You are a Spring Boot test specialist. Write JUnit 5 + Mockito unit tests for: {{TARGET}}

Assume a typical Spring @Service or repository-delegate class (no full @SpringBootTest unless integration is required).

Per method coverage:
- Positive: valid entity found, DTO correctly mapped, repository save/delete called with expected entity, Optional present.
- Negative: entity not found → throw NotFoundException or return empty; validation failure; repository throws DataAccessException.
- Edge: null optional fields, empty Page, duplicate key, concurrent modification, blank strings.

Practices:
- @Mock for repositories, clients, and external gateways; @InjectMocks for class under test.
- Verify interaction order when business rules depend on call sequence.
- Use assertThrows for expected exceptions with message assertions.
- Test mapping logic for null-safe field handling.
- No @SpringBootTest — pure unit tests only.

Deliver complete Java test source. Target ≥ 85% coverage on business methods. Add JaCoCo run instructions.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'java-parameterized',
    language: 'java',
    name: 'Parameterized boundary & exception sweep',
    description:
      'Efficient high-coverage tests using @ParameterizedTest for combinatorial inputs and exhaustive exception paths.',
    bestFor: ['Validators', 'Calculators', 'Parsers', 'Pure functions'],
    framework: 'JUnit 5 @ParameterizedTest + AssertJ',
    coverageTarget: '≥ 95% branch coverage on pure logic',
    runCommand: './gradlew test --tests "*{{TARGET}}Test"',
    coverageCommand: './gradlew test jacocoTestReport',
    promptTemplate: `You are a Java testing expert focused on boundary-value analysis and exception coverage.

Write JUnit 5 tests for: {{TARGET}}

Strategy:
1. Identify all public methods and enumerate input domains (valid range, below min, above max, null, empty, whitespace, special chars).
2. Use @ParameterizedTest with @CsvSource, @ValueSource, or @MethodSource to cover input combinations efficiently.
3. For each exception documented or implied in code, use assertThrows with exact type and message fragment.
4. Positive cases: typical and representative inputs with AssertJ fluent assertions (assertThat(...).isEqualTo(...)).
5. Negative cases: illegal state, illegal argument, unsupported operation.
6. Edge: Integer.MAX_VALUE, empty Optional, singleton collections, Unicode strings.

Prefer AssertJ over raw JUnit assertions. Minimize test duplication via parameterized tests while keeping each scenario readable.

Output: complete test class, no main method, no placeholders. Include a branch coverage matrix before the code. Target ≥ 95% branch coverage on logic classes.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },

  // ── Python ───────────────────────────────────────────────────────────────
  {
    id: 'python-comprehensive',
    language: 'python',
    name: 'Pytest coverage-mapped suite',
    description:
      'Analyse → plan → generate flow with AAA pattern, coverage map, and ≥ 80% line/branch target. Best all-round Python prompt.',
    bestFor: ['Modules', 'Packages', 'Classes', 'API clients'],
    framework: 'pytest + unittest.mock + pytest-cov',
    coverageTarget: '≥ 80% line and branch',
    runCommand: 'pytest tests/test_{{TARGET}}.py -v',
    coverageCommand: 'pytest tests/test_{{TARGET}}.py --cov={{TARGET}} --cov-branch --cov-report=term-missing --cov-fail-under=80',
    promptTemplate: `You are a senior Python test engineer expert in pytest, unittest.mock, and coverage analysis.

Generate a comprehensive unit test suite for: {{TARGET}}

Follow this exact workflow:

STEP 1 — ANALYSE (output briefly before tests):
- List every function/class, inputs, outputs, branches, external dependencies, and risks.

STEP 2 — COVERAGE MAP (table required):
| Unit | Happy path | Edge case | Exception | Mock/patch | Negative input | Priority |
Categories: ✅ Happy Path | ❌ Edge (empty/None/boundary) | 💥 Exception | 🔁 Mock external deps | 🧪 Negative/invalid input
Priorities: 🔴 Must Have | 🟡 Should Have | 🔵 Nice to Have
Target: ≥ 80% line AND branch coverage (enable branch=true in pyproject.toml).

STEP 3 — GENERATE TESTS:
- Framework: pytest only (unittest.mock for mocking).
- Strict AAA pattern with comments: # Arrange / # Act / # Assert
- Naming: test_<function>_<scenario>_<expected_outcome>
- Mock ONLY external I/O (DB, HTTP, filesystem, env vars, clock). Never mock in-package pure logic.
- Use @pytest.fixture and @pytest.mark.parametrize.
- Explicit tests for: None, [], {}, 0, "", max size, unicode, NaN, invalid types.
- pytest.raises(..., match=...) for exceptions with message fragments.

STEP 4 — CONFIG SNIPPET (include if project lacks it):
[tool.coverage.run]
branch = true
source = ["src/your_package"]
[tool.coverage.report]
fail_under = 80
show_missing = true

STEP 5 — SUMMARY: Total tests | line % estimate | branch % estimate | gaps remaining
Run: pytest --cov --cov-branch --cov-report=term-missing --cov-fail-under=80

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'python-boundary',
    language: 'python',
    name: 'Boundary & exception pass (2nd pass)',
    description:
      'Second pass: ONLY None, empty, invalid, permission, and pytest.raises tests. Research shows LLMs skip these without a dedicated pass.',
    bestFor: ['Gap-filling', 'Validators', 'Data transforms', 'After comprehensive prompt'],
    framework: 'pytest + @pytest.mark.parametrize',
    coverageTarget: 'Uncovered error branches',
    runCommand: 'pytest tests/test_{{TARGET}}.py -v --tb=short',
    coverageCommand: 'pytest --cov={{TARGET}} --cov-branch --cov-report=term-missing',
    promptTemplate: `You are a Python test engineer. SECOND PASS ONLY — do NOT write happy-path tests.

Target: {{TARGET}}

Write ONLY boundary and error tests using pytest:
- None, "", [], {}, 0, negative, max int, very long string, unicode edge cases
- NaN / inf for floats where applicable
- invalid types → TypeError/ValueError with match=
- permission / IOError paths with unittest.mock.patch on external I/O
- @pytest.mark.parametrize tables for input combinations

Each test must use pytest.raises or assert on error return values — not bare execution.
Comment each test: # given / # when / # then

Output supplemental test functions only. Map each test to the branch it covers.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'python-class',
    language: 'python',
    name: 'Class & method isolation',
    description:
      'Focused pytest suite for a single class with fixture-based setup, patch decorators, and exception contract tests.',
    bestFor: ['Classes', 'Dataclasses', 'Pydantic models', 'Handlers'],
    framework: 'pytest + pytest-mock',
    coverageTarget: '≥ 85% per public method',
    runCommand: 'pytest tests/test_{{TARGET}}.py -v --tb=short',
    coverageCommand: 'pytest --cov={{TARGET}} --cov-branch --cov-report=term-missing --cov-fail-under=85',
    promptTemplate: `You are a Python TDD practitioner. Write pytest tests for the class/module: {{TARGET}}

For EACH public method:
1. test_<method>_returns_expected_on_valid_input (positive)
2. test_<method>_raises_on_invalid_input (negative — pytest.raises)
3. test_<method>_handles_empty_or_none_<field> (edge)
4. test_<method>_calls_<dependency>_with_expected_args (mock verify) — only if external dep exists

Rules:
- Use pytest fixtures for instance construction; avoid repetition.
- @pytest.mark.parametrize for multiple input tuples.
- patch / mocker.patch for module-level imports (patch where used, not where defined).
- Assert mock.call_count and call_args for interactions.
- Do not test private _methods unless via public API.
- Type hints in tests where helpful.

Deliver one complete test file. Every test must have at least one meaningful assert. Target ≥ 85% coverage on public API.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
  {
    id: 'python-fastapi',
    language: 'python',
    name: 'FastAPI / async endpoint tests',
    description:
      'httpx AsyncClient tests with dependency overrides, status code matrix, and schema validation for API routes.',
    bestFor: ['FastAPI routes', 'Async handlers', 'Dependency injection'],
    framework: 'pytest + httpx + pytest-asyncio',
    coverageTarget: '≥ 80% on route handlers and error paths',
    runCommand: 'pytest tests/test_{{TARGET}}.py -v',
    coverageCommand: 'pytest tests/test_{{TARGET}}.py --cov=app --cov-branch --cov-report=term-missing --cov-fail-under=80',
    promptTemplate: `You are a FastAPI testing specialist. Write pytest tests for the endpoint/module: {{TARGET}}

Use httpx.AsyncClient with app=fastapi_app and pytest.mark.asyncio.

Per endpoint test matrix:
| Scenario | Method | Path | Body/Query | Expected status | Expected body key |
Include:
- 200/201 positive responses with valid payload
- 400 validation errors (missing fields, wrong types)
- 401/403 auth failures (mock auth dependency)
- 404 not found
- 422 unprocessable entity
- 500 handled exceptions (mock service raising)

Practices:
- Override FastAPI dependencies with app.dependency_overrides for DB/auth mocks.
- Use pytest fixtures for client and authenticated headers.
- Assert response.json() structure, not full payloads (focus on contract).
- Test both query params and request body edge cases (empty, extra fields).
- Reset dependency_overrides in fixture teardown.

Output complete async test module. No live HTTP. Target ≥ 80% handler coverage including error branches.

{{SOURCE_CODE}}{{ADDITIONAL_CONTEXT}}`,
  },
];

export function getUnitTestPromptsForLanguage(language: UnitTestLanguage): UnitTestPromptTemplate[] {
  return UNIT_TEST_PROMPTS.filter((prompt) => prompt.language === language);
}

export const UNIT_TEST_LANGUAGE_LABELS: Record<UnitTestLanguage, string> = {
  angular: 'Angular',
  java: 'Java',
  python: 'Python',
};
