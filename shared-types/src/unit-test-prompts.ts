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

  return template.promptTemplate
    .replaceAll(UNIT_TEST_PROMPT_PLACEHOLDERS.target, target.trim() || '[file-or-module-name]')
    .replaceAll(UNIT_TEST_PROMPT_PLACEHOLDERS.source, sourceBlock)
    .replaceAll(UNIT_TEST_PROMPT_PLACEHOLDERS.context, contextBlock);
}

export const UNIT_TEST_PROMPTS: UnitTestPromptTemplate[] = [
  // ── Angular ──────────────────────────────────────────────────────────────
  {
    id: 'angular-comprehensive',
    language: 'angular',
    name: 'Comprehensive Jasmine/Karma suite',
    description:
      'Full branch and template coverage with TestBed, spies, async handling, and enforced 80%+ Karma thresholds. Best all-round prompt for components and services.',
    bestFor: ['Components', 'Services', 'Pipes', 'Directives'],
    framework: 'Jasmine + Karma + Angular TestBed',
    coverageTarget: '≥ 80% statements, branches, functions, lines',
    runCommand: 'ng test --no-watch --code-coverage',
    coverageCommand:
      'ng test --no-watch --code-coverage --browsers=ChromeHeadless (enforce thresholds in karma.conf.js coverageReporter.check.global)',
    promptTemplate: `You are a senior Angular test engineer specializing in Jasmine, Karma, and Angular TestBed.

Generate a production-ready unit test suite for: {{TARGET}}

Requirements — treat these as mandatory:
1. Coverage: achieve at least 80% on statements, branches, functions, and lines. Map every public method, @Input/@Output, lifecycle hook, template binding, and conditional branch to at least one test.
2. Positive scenarios: happy-path behaviour with typical valid inputs, successful HTTP responses, emitted events, and expected DOM state after detectChanges().
3. Negative scenarios: invalid inputs, empty/null/undefined values, rejected promises, HTTP 4xx/5xx errors, guard failures, and user actions that should NOT trigger side effects.
4. Edge cases: boundary values, empty collections, duplicate clicks, rapid successive calls, and off-by-one conditions.
5. Async: use fakeAsync/tick, waitForAsync, or async/await correctly. Never leave outstanding timers or subscriptions.
6. Mocking: mock all injected services with jasmine.createSpyObj or provide useValue/useClass stubs. Use HttpClientTestingModule for HTTP. Verify spy call counts and arguments with toHaveBeenCalledWith.
7. Template/DOM: use fixture.debugElement.query(By.css(...)) for critical UI interactions; assert text content, disabled state, and class bindings.
8. Structure: one describe per class under test; nested describe per method or behaviour group; descriptive it('should ... when ...') names.
9. Output: a single complete .spec.ts file with all imports. No placeholders or TODO tests. Include karma coverageReporter.check snippet if thresholds are missing from karma.conf.js.

After the test file, provide:
- A coverage checklist table: Branch/Method | Positive test | Negative test | Edge case
- Commands to run: ng test --no-watch --code-coverage

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
    runCommand: 'ng test --include=**/{{TARGET}}.spec.ts --no-watch --code-coverage',
    coverageCommand: 'ng test --no-watch --code-coverage',
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
    runCommand: 'ng test --no-watch --code-coverage',
    coverageCommand: 'ng test --no-watch --code-coverage',
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
    runCommand: 'ng test --no-watch --code-coverage',
    coverageCommand: 'ng test --no-watch --code-coverage',
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
    coverageCommand: './gradlew test jacocoTestReport && open build/reports/jacoco/test/html/index.html',
    promptTemplate: `You are a senior Java engineer writing unit tests with JUnit 5 and Mockito.

Generate comprehensive tests for: {{TARGET}}

Mandatory coverage goals (JaCoCo):
- ≥ 80% line coverage and ≥ 80% branch coverage.
- Every public method: at least one positive, one negative, and one edge-case test.
- Every if/else, switch branch, and exception throw path must be exercised.

Test design:
1. Positive (happy path): valid inputs, expected return values, verify mock interactions with Mockito.verify().
2. Negative: invalid arguments → assert throws correct exception type and message; verify no further interactions.
3. Edge: null, empty collections, boundary integers, max/min strings, duplicate calls, optional empty.
4. Use @ExtendWith(MockitoExtension.class), @Mock, @InjectMocks.
5. Use @ParameterizedTest + @CsvSource or @MethodSource for input combinations.
6. Naming: given<Precondition>_when<Action>_then<ExpectedResult>.
7. Use ArgumentMatchers (eq, any, anyString) correctly; avoid unnecessary stubbing.
8. For static methods use mockStatic in @BeforeEach or try-with-resources per test.
9. Do NOT test private methods directly — test through public API.
10. Output complete test class(es) with package declaration and imports. No // TODO tests.

After code, include:
| Method | Positive | Negative | Edge |
and Gradle JaCoCo minimum threshold snippet for 80% verification.

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
    coverageCommand: 'pytest tests/test_{{TARGET}}.py --cov={{TARGET}} --cov-report=term-missing --cov-fail-under=80',
    promptTemplate: `You are a senior Python test engineer expert in pytest, unittest.mock, and coverage analysis.

Generate a comprehensive unit test suite for: {{TARGET}}

Follow this exact workflow:

STEP 1 — ANALYSE (output briefly before tests):
- List every function/class, inputs, outputs, branches, external dependencies, and risks.

STEP 2 — COVERAGE MAP (table required):
| Unit | Happy path | Edge case | Exception | Mock/patch | Negative input | Priority |
Categories: ✅ Happy Path | ❌ Edge (empty/None/boundary) | 💥 Exception | 🔁 Mock external deps | 🧪 Negative/invalid input
Priorities: 🔴 Must Have | 🟡 Should Have | 🔵 Nice to Have
Target: ≥ 80% line and branch coverage (≥ 90% for critical paths).

STEP 3 — GENERATE TESTS:
- Framework: pytest only (unittest.mock for mocking).
- Strict AAA pattern with comments: # Arrange / # Act / # Assert
- Naming: test_<function>_<scenario>_<expected_outcome>
- One test file sectioned by function/class.
- Mock ONLY external I/O (DB, HTTP, filesystem, env vars, clock). Never mock pure logic.
- Use @pytest.fixture for shared setup and @pytest.mark.parametrize for input variants.
- Positive: normal inputs return expected values.
- Negative: invalid types, out-of-range values, permission errors — use pytest.raises with match=.
- Edge: None, [], {}, 0, "", max size, unicode, concurrent calls.

STEP 4 — SUMMARY CARD:
Total tests | Estimated line % | Estimated branch % | Gaps remaining

Output runnable pytest code only in the test file section (no placeholders). Include pyproject.toml or pytest.ini cov-fail-under=80 snippet if missing.

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
    coverageCommand: 'pytest --cov={{TARGET}} --cov-report=term-missing --cov-fail-under=85',
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
    coverageCommand: 'pytest tests/test_{{TARGET}}.py --cov=app --cov-report=term-missing --cov-fail-under=80',
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
