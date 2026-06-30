export const HELPER_CATALOG = `
Available test helper functions (import from '../helpers' in step definition files):

- login(page: Page, credentials: { username: string; password: string }): Promise<void>
- navigate(page: Page, path: string): Promise<void>
- waitForElement(page: Page, selector: string): Promise<void>
- fillForm(page: Page, fields: Record<string, string>): Promise<void>
- clickButton(page: Page, label: string): Promise<void>
- assertToast(page: Page, message: string): Promise<void>
- assertVisible(page: Page, selector: string): Promise<void>

Step definitions MUST call these helpers instead of inlining Playwright calls where a helper exists.
`;
