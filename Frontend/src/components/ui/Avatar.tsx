import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  name: string
  size?: AvatarSize
  className?: string
}

const sizeStyles: Record<AvatarSize, { container: string; text: string }> = {
  sm: { container: 'h-8 w-8', text: 'text-xs' },
  md: { container: 'h-10 w-10', text: 'text-sm' },
  lg: { container: 'h-14 w-14', text: 'text-lg' },
  xl: { container: 'h-20 w-20', text: 'text-2xl' },
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const styles = sizeStyles[size]

  return (
    <div
      className={cn(
        'rounded-full bg-primary-700 dark:bg-primary-600 flex items-center justify-center',
        styles.container,
        className,
      )}
    >
      <span className={cn('font-medium text-white', styles.text)}>
        {getInitials(name)}
      </span>
    </div>
  )
}

export type { AvatarProps, AvatarSize }
