'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { guideFor, type GuideLanguage } from '@/lib/admin-guides';

const LANGUAGE_KEY = 'admin-guide-language';

const LABELS: Record<
  GuideLanguage,
  { open: string; close: string; steps: string; example: string; tip: string }
> = {
  en: {
    open: 'How this page works',
    close: 'Hide guide',
    steps: 'Steps',
    example: 'Example',
    tip: 'Good to know',
  },
  bn: {
    open: 'এই পেজ কীভাবে কাজ করে',
    close: 'গাইড বন্ধ করুন',
    steps: 'ধাপ',
    example: 'উদাহরণ',
    tip: 'মনে রাখবেন',
  },
};

/** A closed-by-default help panel at the top of every admin page, in Bangla or English. */
export function PageGuide() {
  const pathname = usePathname();
  const guide = guideFor(pathname);
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<GuideLanguage>('bn');

  useEffect(() => {
    try {
      if (localStorage.getItem(LANGUAGE_KEY) === 'en') setLanguage('en');
    } catch {
      // Storage can be blocked; the guide still works, it just will not remember.
    }
  }, []);

  // Each page starts with its guide closed, so it never gets in the way of work.
  useEffect(() => setOpen(false), [pathname]);

  if (!guide) return null;

  function choose(next: GuideLanguage) {
    setLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // See above.
    }
  }

  const text = guide[language];
  const labels = LABELS[language];

  return (
    <aside lang={language} aria-label={labels.open} className="mx-auto mb-5 max-w-6xl print:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:border-slate-500"
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-950 text-xs font-bold text-white"
        >
          ?
        </span>
        {open ? labels.close : labels.open}
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-sans text-lg font-semibold text-slate-900">{text.title}</h2>
            <div className="flex gap-1" role="group" aria-label="Language / ভাষা">
              {(
                [
                  ['bn', 'বাংলা'],
                  ['en', 'English'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  lang={value}
                  aria-pressed={language === value}
                  onClick={() => choose(value)}
                  className={`min-h-11 border px-3 font-medium ${
                    language === value
                      ? 'border-brand-950 bg-brand-950 text-white'
                      : 'border-slate-300 text-slate-800 hover:border-brand-950'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2">{text.summary}</p>

          <h3 className="mt-4 font-sans text-sm font-semibold text-slate-900">{labels.steps}</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {text.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <h3 className="mt-4 font-sans text-sm font-semibold text-slate-900">{labels.example}</h3>
          <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2">{text.example}</p>

          {text.tip ? (
            <>
              <h3 className="mt-4 font-sans text-sm font-semibold text-slate-900">{labels.tip}</h3>
              <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">{text.tip}</p>
            </>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
