import { apiFetch } from './client';
import type { PaymentSubmissionResult } from './types';

export interface CreatePaymentInput {
  orderId: string;
  transactionId: string;
  senderPhone: string;
  screenshot?: File | null;
}

/**
 * Submits payment proof for an order (first submission or a resubmission after a rejection).
 * Sent as multipart/form-data; the browser sets the Content-Type and boundary itself.
 */
export function createPayment(input: CreatePaymentInput): Promise<PaymentSubmissionResult> {
  const body = new FormData();
  body.append('orderId', input.orderId);
  body.append('transactionId', input.transactionId);
  body.append('senderPhone', input.senderPhone);
  if (input.screenshot) body.append('screenshot', input.screenshot);
  return apiFetch<PaymentSubmissionResult>('/payments', { method: 'POST', body });
}