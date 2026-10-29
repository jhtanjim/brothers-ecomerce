import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

export interface UploadedImage {
  url: string;
  publicId: string;
}

/**
 * Talks to Cloudinary. Knows nothing about products.
 * If we switch to S3 later, only this file changes.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  /** Uploads one image buffer into the given Cloudinary folder. */
  uploadImage(buffer: Buffer, folder: string): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            this.logger.error(`Cloudinary upload failed: ${error?.message ?? 'no result'}`);
            return reject(new InternalServerErrorException('Image upload failed'));
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      Readable.from(buffer).pipe(stream);
    });
  }

  /** Deletes one image. Never throws: a failed cleanup must not break the request. */
  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err) {
      this.logger.warn(`Could not delete Cloudinary image ${publicId}: ${(err as Error).message}`);
    }
  }

  /**
   * Uploads one image as a PRIVATE ("authenticated") asset: it cannot be opened without a signed URL.
   * Used for payment screenshots, which contain personal details. Returns the public id to store.
   */
  uploadPrivateImage(buffer: Buffer, folder: string): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', type: 'authenticated' },
        (error, result) => {
          if (error || !result) {
            this.logger.error(`Cloudinary private upload failed: ${error?.message ?? 'no result'}`);
            return reject(new InternalServerErrorException('Image upload failed'));
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      Readable.from(buffer).pipe(stream);
    });
  }

  /** Signed delivery URL for a private asset. Only hand it to the order's owner or an admin. */
  signedPrivateImageUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'image',
      type: 'authenticated',
      sign_url: true,
      secure: true,
    });
  }

  /** Deletes one private image. Never throws: a failed cleanup must not break the request. */
  async deletePrivateImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        type: 'authenticated',
      });
    } catch (err) {
      this.logger.warn(
        `Could not delete private Cloudinary image ${publicId}: ${(err as Error).message}`,
      );
    }
  }
}
