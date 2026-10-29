import type { InputHTMLAttributes } from 'react';

interface CheckoutFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
}

export function CheckoutField({ label, name, error, ...inputProps }: CheckoutFieldProps) {
  const errorId = `${name}-error`;
  const borderClass = error
    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
    : 'border-slate-300 focus:border-brand-600 focus:ring-brand-100';

  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-11 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 ${borderClass}`}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
