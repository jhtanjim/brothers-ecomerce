'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { createMember, getMembers, memberCode, setMemberActive } from '@/lib/api/admin-members';
import type { MemberRow } from '@/lib/api/admin-members';
import { ApiError } from '@/lib/api/client';
import { formatPrice } from '@/lib/format';

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';
const SEARCH_DELAY_MS = 250;

function describeError(err: unknown): string {
  return err instanceof ApiError && err.status !== 0
    ? err.message
    : 'Something went wrong. Please try again.';
}

export function MembersContent() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { items, meta } = await getMembers(search.trim(), page);
    setRows(items);
    setPageCount(meta.totalPages);
    setFailed(false);
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch(() => setFailed(true));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [load]);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createMember({ name: name.trim(), phone: phone.trim() });
      setName('');
      setPhone('');
      await load();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(row: MemberRow) {
    setError(null);
    try {
      await setMemberActive(row.id, !row.active);
      await load();
    } catch (err) {
      setError(describeError(err));
    }
  }

  if (failed) return <ErrorState title="Could not load members" message="Please try again." />;

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => void onAdd(event)}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3 sm:items-end"
      >
        <div>
          <label htmlFor="memberName" className="mb-1 block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="memberName"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="memberPhone" className="mb-1 block text-sm font-medium text-slate-700">
            Phone
          </label>
          <input
            id="memberPhone"
            type="tel"
            required
            pattern="\+?[0-9]{7,15}"
            maxLength={16}
            value={phone}
            onChange={(e) => setPhone(e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Adding...' : 'Add member'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div>
        <label htmlFor="memberSearch" className="sr-only">
          Search members
        </label>
        <input
          id="memberSearch"
          type="search"
          value={search}
          maxLength={100}
          placeholder="Search by name or phone"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={INPUT_CLASS}
        />
      </div>

      {!rows ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          No members found.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">
                  {memberCode(row.number)}: {row.name}
                  {row.active ? null : <span className="ml-2 text-rose-600">Turned off</span>}
                </p>
                <p className="text-slate-600">
                  {row.phone}. {row.purchaseCount} purchase{row.purchaseCount === 1 ? '' : 's'},{' '}
                  {formatPrice(row.totalSpent)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onToggle(row)}
                className="min-h-11 border border-slate-300 px-3 font-medium text-slate-800 hover:border-brand-950"
              >
                {row.active ? 'Turn off' : 'Turn on'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="min-h-11 px-3 font-medium disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
            className="min-h-11 px-3 font-medium disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
