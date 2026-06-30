import type { Page } from '@playwright/test';

export class MSNPage {
  constructor(private readonly page: Page) {}

  async clickLinkByText(linkName: string): Promise<void> {
    await this.page.getByRole('link', { name: linkName }).click();
  }
}
