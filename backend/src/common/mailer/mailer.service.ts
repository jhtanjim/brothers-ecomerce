import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * V1: no email provider yet. Outside production the reset link is logged so the flow can be
   * used locally. In production the link (a live credential) and the address are never logged.
   * Swap this method's body for Resend/SMTP later; call sites never change.
   */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      this.logger.warn('Password reset requested, but no email provider is configured: not sent.');
    } else {
      this.logger.log(`[DEV] Password reset link for ${to}: ${resetUrl}`);
    }
    return Promise.resolve();
  }
}
