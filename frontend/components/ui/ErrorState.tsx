interface ErrorStateProps {
  title?: string;
  message?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this section. Please try again in a moment.',
}: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center">
      <p className="font-medium text-rose-800">{title}</p>
      <p className="mt-1 text-sm text-rose-700">{message}</p>
    </div>
  );
}