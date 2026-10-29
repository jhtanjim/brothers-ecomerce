import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_FILES_PER_REQUEST = 5;
export const MAX_IMAGES_PER_PRODUCT = 10;

/** Multer settings for product image uploads. Files are kept in memory, then sent to Cloudinary. */
export const productImageUploadOptions: MulterOptions = {
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_FILES_PER_REQUEST,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return callback(new BadRequestException('Only JPEG, PNG and WebP images are allowed'), false);
    }
    callback(null, true);
  },
};
