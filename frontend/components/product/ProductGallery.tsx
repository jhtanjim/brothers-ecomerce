'use client';

import Image from 'next/image';
import { useState } from 'react';

interface GalleryImage {
  id: string;
  url: string;
}

interface ProductGalleryProps {
  images: GalleryImage[];
  name: string;
}

export function ProductGallery({ images, name }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  if (!active) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-16 w-16"
          aria-hidden="true"
        >
          <path d="M6 7h12l-1 13H7L6 7z" />
          <path d="M9 7a3 3 0 0 1 6 0" />
        </svg>
        <span className="text-sm text-slate-500">Photo coming soon</span>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100">
        <Image
          src={active.url}
          alt={name}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Product images">
          {images.map((image, index) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-current={index === activeIndex}
                className={`relative block h-16 w-16 overflow-hidden rounded-lg border-2 bg-slate-100 sm:h-20 sm:w-20 ${
                  index === activeIndex
                    ? 'border-brand-600'
                    : 'border-transparent hover:border-slate-300'
                }`}
              >
                <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
