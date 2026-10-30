'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  deleteAdminProductImage,
  reorderAdminProductImages,
  setAdminProductPrimaryImage,
  uploadAdminProductImages,
} from '@/lib/api/admin-products';
import { ApiError } from '@/lib/api/client';
import type { AdminProduct, AdminProductImage } from '@/lib/api/types';

// Same limits as backend/src/uploads/image-upload.config.ts.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 5;
const MAX_IMAGES = 10;

interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (err.status === 0) return 'Unable to reach the server. Please try again.';
  if (err.status === 413) return 'An image is too large. Each image must be 5 MB or smaller.';
  if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  return err.message;
}

function checkFiles(files: File[], existing: number): string | null {
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return `Choose up to ${MAX_FILES_PER_UPLOAD} images at a time.`;
  }
  if (existing + files.length > MAX_IMAGES) {
    return `A product can have at most ${MAX_IMAGES} images (it has ${existing}).`;
  }
  if (files.some((file) => !ALLOWED_TYPES.includes(file.type))) {
    return 'Only JPEG, PNG and WebP images are allowed.';
  }
  if (files.some((file) => file.size > MAX_SIZE_BYTES)) {
    return 'Each image must be 5 MB or smaller.';
  }
  return null;
}

/**
 * Upload, delete, choose the primary image and reorder. The primary image is always shown
 * first (as on the storefront); the others can be moved.
 */
export function ProductImagesManager({
  product,
  onChange,
}: {
  product: AdminProduct;
  onChange: (product: AdminProduct) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const images = product.images;
  const primary = images.find((image) => image.isPrimary) ?? null;
  const others = images.filter((image) => image !== primary);
  const full = images.length >= MAX_IMAGES;

  async function run(key: string, action: () => Promise<AdminProduct>, successText: string) {
    setBusy(key);
    setNotice(null);
    try {
      onChange(await action());
      setNotice({ kind: 'ok', text: successText });
    } catch (err) {
      setNotice({ kind: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
      setConfirmId(null);
    }
  }

  function onFilesChosen(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    const problem = checkFiles(files, images.length);
    if (problem) {
      setNotice({ kind: 'error', text: problem });
      return;
    }
    void run(
      'upload',
      () => uploadAdminProductImages(product.id, files),
      files.length === 1 ? 'Image uploaded.' : `${files.length} images uploaded.`,
    );
  }

  function move(image: AdminProductImage, offset: -1 | 1) {
    const order = [...others];
    const from = order.indexOf(image);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    const ids = [...(primary ? [primary.id] : []), ...order.map((entry) => entry.id)];
    void run(image.id, () => reorderAdminProductImages(product.id, ids), 'Image order saved.');
  }

  const buttonClass =
    'rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50';

  return (
    <section
      aria-labelledby="imagesHeading"
      className="max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="imagesHeading" className="text-base font-semibold text-slate-900">
            Images
          </h2>
          <p className="text-sm text-slate-500">
            {images.length} of {MAX_IMAGES}. JPEG, PNG or WebP, up to 5 MB each. The primary image
            is shown on product cards.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            id="productImages"
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            multiple
            className="sr-only"
            onChange={onFilesChosen}
            disabled={busy !== null || full}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null || full}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'upload' ? 'Uploading...' : 'Upload images'}
          </button>
        </div>
      </div>

      {notice ? (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-3 py-2 text-sm ${
            notice.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          No images yet. Products without images show a plain placeholder in the store.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {[...(primary ? [primary] : []), ...others].map((image) => {
            const position = others.indexOf(image);
            const disabled = busy !== null;
            return (
              <li key={image.id} className="overflow-hidden rounded-lg border border-slate-200">
                <div className="relative aspect-square bg-slate-100">
                  <Image
                    src={image.url}
                    alt={image.isPrimary ? 'Primary image' : 'Product image'}
                    fill
                    sizes="(min-width: 768px) 180px, 45vw"
                    className="object-cover"
                  />
                  {image.isPrimary ? (
                    <span className="absolute left-2 top-2 bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                      Primary
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1 p-2">
                  {confirmId === image.id ? (
                    <>
                      <span className="text-xs text-slate-700">Delete?</span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          void run(
                            image.id,
                            () => deleteAdminProductImage(product.id, image.id),
                            'Image deleted.',
                          )
                        }
                        className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setConfirmId(null)}
                        className={buttonClass}
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      {!image.isPrimary ? (
                        <>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              void run(
                                image.id,
                                () => setAdminProductPrimaryImage(product.id, image.id),
                                'Primary image updated.',
                              )
                            }
                            className={buttonClass}
                          >
                            Make primary
                          </button>
                          <button
                            type="button"
                            aria-label="Move image earlier"
                            disabled={disabled || position <= 0}
                            onClick={() => move(image, -1)}
                            className={buttonClass}
                          >
                            {'←'}
                          </button>
                          <button
                            type="button"
                            aria-label="Move image later"
                            disabled={disabled || position >= others.length - 1}
                            onClick={() => move(image, 1)}
                            className={buttonClass}
                          >
                            {'→'}
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setConfirmId(image.id)}
                        className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
