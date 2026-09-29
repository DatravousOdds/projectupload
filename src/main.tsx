import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { routes } from './App.tsx'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router'

const router = createBrowserRouter(routes)


const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router}>
      </RouterProvider>
    </QueryClientProvider>
    
  </StrictMode>,
)
