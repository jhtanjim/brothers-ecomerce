import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from './image-upload.config';

/** Name of the multipart field that carries the payment screenshot. */
export const PAYMENT_SCREENSHOT_FIELD = 'screenshot';

/** Multer settings for one payment screenshot, kept in memory and then sent to private storage. */
export const paymentScreenshotUploadOptions: MulterOptions = {
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return callback(new BadRequestException('Only JPEG, PNG and WebP images are allowed'), false);
    }
    callback(null, true);
  },
};
