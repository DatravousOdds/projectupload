type EmptyStateProps = { title: string; message: string }

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{message}</p>
    </div>
  )
}
