import type { RouteObject } from 'react-router'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectListPage } from './pages/ProjectListPage'

export const routes: RouteObject[] = [
  { path: '/', element: <ProjectListPage /> },
  { path: '/projects/:id', element: <ProjectDetailPage /> },
  { path: '*', element: <NotFoundPage /> },
]
