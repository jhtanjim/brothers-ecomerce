import Link from 'next/link';

interface SectionHeadingProps {
  title: string;
  href?: string;
  linkLabel?: string;
}

export function SectionHeading({ title, href, linkLabel = 'View all' }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-6">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          {linkLabel} &rarr;
        </Link>
      )}
    </div>
  );
}
