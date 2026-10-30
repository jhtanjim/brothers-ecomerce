import Link from 'next/link';

interface SectionHeadingProps {
  title: string;
  href?: string;
  linkLabel?: string;
}

export function SectionHeading({ title, href, linkLabel = 'View all' }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-6">
      <h2 className="text-4xl font-semibold uppercase leading-none text-brand-950 sm:text-5xl">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold uppercase tracking-wider text-brand-950 underline-offset-4 hover:underline"
        >
          {linkLabel} &rarr;
        </Link>
      )}
    </div>
  );
}
