type ClassValue = string | number | boolean | undefined | null | Record<string, boolean | undefined | null> | ClassValue[]

/**
 * Merge class names conditionally.
 */
export function cn(...args: ClassValue[]): string {
  const classes: string[] = []
  for (const arg of args) {
    if (!arg) continue
    if (typeof arg === 'string') {
      classes.push(arg)
    } else if (typeof arg === 'number') {
      classes.push(String(arg))
    } else if (Array.isArray(arg)) {
      const inner = cn(...arg)
      if (inner) classes.push(inner)
    } else if (typeof arg === 'object') {
      for (const [key, value] of Object.entries(arg)) {
        if (value) classes.push(key)
      }
    }
  }
  return classes.join(' ')
}

/**
 * Format a date string to a readable format.
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', options ?? {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format time string (HH:MM:SS) to 12-hour format.
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${String(minutes).padStart(2, '0')} ${period}`
}

/**
 * Get initials from a full name.
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
