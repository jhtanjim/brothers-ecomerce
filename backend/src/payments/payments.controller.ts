import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  PAYMENT_SCREENSHOT_FIELD,
  paymentScreenshotUploadOptions,
} from '../uploads/payment-screenshot-upload.config';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

/** Authenticated customers only: no @Public(), so the global JwtAuthGuard applies. */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** multipart/form-data: orderId, transactionId, senderPhone, and an optional "screenshot" file. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @UseInterceptors(FileInterceptor(PAYMENT_SCREENSHOT_FIELD, paymentScreenshotUploadOptions))
  submit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePaymentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.payments.submit(user.sub, dto, file);
  }
}
