export function validateSafeUsername(value: string): string | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (trimmed.length < 3 || trimmed.length > 30) {
    return 'Username must be between 3 and 30 characters.'
  }

  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, dots, underscores, and hyphens.'
  }

  return null
}

export function validateSafeEmployeeId(value: string): string | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (trimmed.length > 20) {
    return 'Employee ID must be 20 characters or fewer.'
  }

  if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
    return 'Employee ID can only contain letters, numbers, and hyphens.'
  }

  return null
}
