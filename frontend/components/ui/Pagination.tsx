import Link from 'next/link';

interface PaginationProps {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}

/** Page numbers to show: first, last, and the current page with its neighbours. */
function pageList(page: number, totalPages: number): Array<number | 'gap'> {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];
  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1] > 1) result.push('gap');
    result.push(value);
  });
  return result;
}

const itemClass =
  'flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-medium';

export function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-10">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {page > 1 ? (
            <Link
              href={hrefFor(page - 1)}
              rel="prev"
              className={`${itemClass} border-slate-300 text-slate-700 hover:bg-slate-50`}
            >
              Previous
            </Link>
          ) : (
            <span className={`${itemClass} border-slate-200 text-slate-300`}>Previous</span>
          )}
        </li>

        {pageList(page, totalPages).map((entry, index) =>
          entry === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-slate-400">
              &hellip;
            </li>
          ) : (
            <li key={entry}>
              {entry === page ? (
                <span
                  aria-current="page"
                  className={`${itemClass} border-brand-600 bg-brand-600 text-white`}
                >
                  {entry}
                </span>
              ) : (
                <Link
                  href={hrefFor(entry)}
                  className={`${itemClass} border-slate-300 text-slate-700 hover:bg-slate-50`}
                >
                  {entry}
                </Link>
              )}
            </li>
          ),
        )}

        <li>
          {page < totalPages ? (
            <Link
              href={hrefFor(page + 1)}
              rel="next"
              className={`${itemClass} border-slate-300 text-slate-700 hover:bg-slate-50`}
            >
              Next
            </Link>
          ) : (
            <span className={`${itemClass} border-slate-200 text-slate-300`}>Next</span>
          )}
        </li>
      </ul>
    </nav>
  );
}
