import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner, PageLoader } from '@/components/ui/Spinner'

describe('Alert', () => {
  it('renders children text', () => {
    render(<Alert>Test alert message</Alert>)
    expect(screen.getByText('Test alert message')).toBeInTheDocument()
  })

  it('renders with title', () => {
    render(<Alert title="Heading">Body text</Alert>)
    expect(screen.getByText('Heading')).toBeInTheDocument()
    expect(screen.getByText('Body text')).toBeInTheDocument()
  })

  it('has role="alert"', () => {
    render(<Alert>Alert content</Alert>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders different variants without crashing', () => {
    const variants = ['success', 'error', 'warning', 'info'] as const
    variants.forEach((variant) => {
      const { unmount } = render(<Alert variant={variant}>Message</Alert>)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      unmount()
    })
  })
})

describe('Badge', () => {
  it('renders text content', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders with different variants', () => {
    const variants = ['primary', 'success', 'danger', 'warning', 'default', 'info'] as const
    variants.forEach((variant) => {
      const { unmount } = render(<Badge variant={variant}>Label</Badge>)
      expect(screen.getByText('Label')).toBeInTheDocument()
      unmount()
    })
  })
})

describe('Button', () => {
  it('renders button text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('is disabled when loading', () => {
    render(<Button loading>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders with different variants without crashing', () => {
    const variants = ['primary', 'secondary', 'danger', 'ghost', 'outline'] as const
    variants.forEach((variant) => {
      const { unmount } = render(<Button variant={variant}>Btn</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
      unmount()
    })
  })

  it('renders with different sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    sizes.forEach((size) => {
      const { unmount } = render(<Button size={size}>Btn</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
      unmount()
    })
  })
})

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No data" />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('renders description', () => {
    render(<EmptyState title="Empty" description="Nothing here yet" />)
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
  })

  it('renders action', () => {
    render(<EmptyState title="Empty" action={<button>Add item</button>} />)
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument()
  })
})

describe('Spinner', () => {
  it('renders with role="status"', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has a sr-only loading text', () => {
    render(<Spinner />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})

describe('PageLoader', () => {
  it('renders default message', () => {
    render(<PageLoader />)
    const elements = screen.getAllByText('Loading...')
    expect(elements.length).toBe(2) // sr-only in Spinner + message paragraph
  })

  it('renders custom message', () => {
    render(<PageLoader message="Fetching data..." />)
    expect(screen.getByText('Fetching data...')).toBeInTheDocument()
  })
})
