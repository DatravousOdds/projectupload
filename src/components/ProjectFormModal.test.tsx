import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useCreateProject } from '../hooks/useProjects'
import { ProjectFormModal } from './ProjectFormModal'

// The form is tested against a fake hook; the real hook and api have their own coverage.
vi.mock('../hooks/useProjects', () => ({ useCreateProject: vi.fn() }))

const navigate = vi.fn()
vi.mock('react-router', () => ({ useNavigate: () => navigate }))

const mutate = vi.fn()
const onClose = vi.fn()

type CreateProjectResult = ReturnType<typeof useCreateProject>

function mockCreateProject(state: { isPending?: boolean; isError?: boolean } = {}) {
  vi.mocked(useCreateProject).mockReturnValue({
    mutate,
    isPending: state.isPending ?? false,
    isError: state.isError ?? false,
  } as unknown as CreateProjectResult)
}

function fillName(value: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value } })
}

function clickSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateProject()
})

describe('ProjectFormModal', () => {
  test('shows an inline error and does not save when the name is blank', () => {
    render(<ProjectFormModal onClose={onClose} />)

    fillName('   ')
    clickSave()

    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(mutate).not.toHaveBeenCalled()
  })

  test('saves the trimmed values', () => {
    render(<ProjectFormModal onClose={onClose} />)

    fillName('  Garden  ')
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: '  Spring beds  ' } })
    clickSave()

    expect(mutate).toHaveBeenCalledWith({ name: 'Garden', description: 'Spring beds' }, expect.any(Object))
  })

  test('goes to the new project after it saves', () => {
    render(<ProjectFormModal onClose={onClose} />)

    fillName('Garden')
    clickSave()

    const { onSuccess } = mutate.mock.calls[0][1]
    onSuccess({ id: 'new-project-id' })

    expect(navigate).toHaveBeenCalledWith('/projects/new-project-id')
  })

  test('disables both buttons while saving', () => {
    mockCreateProject({ isPending: true })

    render(<ProjectFormModal onClose={onClose} />)

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  test('shows a message when saving fails', () => {
    mockCreateProject({ isError: true })

    render(<ProjectFormModal onClose={onClose} />)

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't create the project.")
  })

  test('calls onClose when Cancel is clicked', () => {
    render(<ProjectFormModal onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
