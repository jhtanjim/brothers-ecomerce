import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailerService } from './mailer.service';

const RESET_URL = 'http://localhost:3000/reset-password?token=secret-token-value';

function mailerFor(nodeEnv: string) {
  const config = { get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined) };
  return new MailerService(config as unknown as ConfigService);
}

function loggedText(...spies: ReturnType<typeof vi.spyOn>[]): string {
  return spies.flatMap((spy) => spy.mock.calls.flat()).join(' ');
}

describe('MailerService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never logs the reset link, token or address in production', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await mailerFor('production').sendPasswordResetEmail('jane@example.com', RESET_URL);

    const text = loggedText(log, warn);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(text).not.toContain('secret-token-value');
    expect(text).not.toContain('reset-password');
    expect(text).not.toContain('jane@example.com');
  });

  it('logs the link outside production so the flow can be used locally', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await mailerFor('development').sendPasswordResetEmail('jane@example.com', RESET_URL);

    expect(loggedText(log)).toContain(RESET_URL);
  });
});
