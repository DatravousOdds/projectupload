type ErrorStateProps = { message: string; onRetry: () => void }

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-lg border border-gray-200 p-6 text-center">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded border border-gray-300 px-4 py-2 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Try again
      </button>
    </div>
  )
}
