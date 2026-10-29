import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  /**
   * V1: logs the reset link instead of sending an email.
   * Swap this method's body for Resend/SMTP later; call sites never change.
   */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    this.logger.log(`[DEV] Password reset link for ${to}: ${resetUrl}`);
    return Promise.resolve();
  }
}
