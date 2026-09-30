import { Link } from 'react-router'

type NotFoundPageProps = { title?: string }

export function NotFoundPage({ title = 'Page not found' }: NotFoundPageProps) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-gray-600">It may have been removed, or the link may be wrong.</p>
      <Link
        to="/"
        className="mt-4 inline-block underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Back to projects
      </Link>
    </main>
  )
}
