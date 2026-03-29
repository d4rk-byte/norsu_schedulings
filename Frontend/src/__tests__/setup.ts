import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import React from 'react'

// ─── Mock next/link ──────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}))

// ─── Mock next/navigation ────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// ─── Mock next/image ─────────────────────────────────────
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement('img', props),
}))
