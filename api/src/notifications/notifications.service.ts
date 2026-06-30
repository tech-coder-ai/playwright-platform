import { Injectable, Logger } from '@nestjs/common';
import type { ScheduleNotificationConfig } from '@playwright-platform/shared-types';

export interface ScheduleFailureContext {
  scheduleName: string;
  projectName: string;
  suiteName?: string;
  runId: string;
  projectId: string;
  failedTests: Array<{ name: string; errorMessage?: string }>;
  runUrl?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async notifyScheduleFailure(
    config: ScheduleNotificationConfig,
    context: ScheduleFailureContext,
  ): Promise<void> {
    if (config.notifyOnFailure === false) return;

    const tasks: Promise<void>[] = [];

    if (config.slackWebhookUrl?.trim()) {
      tasks.push(this.sendSlack(config.slackWebhookUrl.trim(), context));
    }

    const recipients = (config.emailRecipients ?? []).map((e) => e.trim()).filter(Boolean);
    if (recipients.length > 0) {
      tasks.push(this.sendEmail(recipients, context));
    }

    if (tasks.length === 0) return;

    const results = await Promise.allSettled(tasks);
    for (const result of results) {
      if (result.status === 'rejected') {
        const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        this.logger.error(`Notification delivery failed: ${message}`);
      }
    }
  }

  private async sendSlack(webhookUrl: string, context: ScheduleFailureContext): Promise<void> {
    const failedList = context.failedTests
      .slice(0, 10)
      .map((t) => `• ${t.name}${t.errorMessage ? `: ${t.errorMessage.slice(0, 120)}` : ''}`)
      .join('\n');

    const text = [
      `:x: Scheduled test run failed — *${context.scheduleName}*`,
      `Project: ${context.projectName}`,
      context.suiteName ? `Suite: ${context.suiteName}` : undefined,
      `Failed tests (${context.failedTests.length}):`,
      failedList || '• (no test details)',
      context.runUrl ? `<${context.runUrl}|View run>` : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}`);
    }
  }

  private async sendEmail(recipients: string[], context: ScheduleFailureContext): Promise<void> {
    const host = process.env['SMTP_HOST'];
    const port = Number(process.env['SMTP_PORT'] ?? 587);
    const user = process.env['SMTP_USER'];
    const pass = process.env['SMTP_PASS'];
    const from = process.env['SMTP_FROM'] ?? user;

    if (!host || !from) {
      this.logger.warn('Email notification skipped: SMTP_HOST and SMTP_FROM are required');
      return;
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    const failedLines = context.failedTests
      .map((t) => `- ${t.name}${t.errorMessage ? `: ${t.errorMessage}` : ''}`)
      .join('\n');

    const body = [
      `Scheduled test run failed: ${context.scheduleName}`,
      '',
      `Project: ${context.projectName}`,
      context.suiteName ? `Suite: ${context.suiteName}` : undefined,
      `Run ID: ${context.runId}`,
      '',
      'Failed tests:',
      failedLines || '(none)',
      '',
      context.runUrl ? `View run: ${context.runUrl}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');

    await transporter.sendMail({
      from,
      to: recipients.join(', '),
      subject: `[Playwright Platform] Schedule failed: ${context.scheduleName}`,
      text: body,
    });
  }
}
