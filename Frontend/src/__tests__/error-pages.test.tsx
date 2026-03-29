import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// ─── Error page (500) ────────────────────────────────────
import ErrorPage from '@/app/error'

describe('Error page (500)', () => {
  it('renders 500 heading', () => {
    render(<ErrorPage error={new Error('test')} reset={() => {}} />)
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument()
  })

  it('has a Try Again button', () => {
    render(<ErrorPage error={new Error('test')} reset={() => {}} />)
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })

  it('has a Go Home link', () => {
    render(<ErrorPage error={new Error('test')} reset={() => {}} />)
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
  })
})

// ─── Not Found page (404) ────────────────────────────────
import NotFoundPage from '@/app/not-found'

describe('Not Found page (404)', () => {
  it('renders 404 heading', () => {
    render(<NotFoundPage />)
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('Page Not Found')).toBeInTheDocument()
  })

  it('has a Go Home link', () => {
    render(<NotFoundPage />)
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
  })
})

// ─── Forbidden page (403) ────────────────────────────────
import ForbiddenPage from '@/app/forbidden'

describe('Forbidden page (403)', () => {
  it('renders 403 heading', () => {
    render(<ForbiddenPage />)
    expect(screen.getByText('403')).toBeInTheDocument()
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  it('has a Go Home link', () => {
    render(<ForbiddenPage />)
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
  })
})
