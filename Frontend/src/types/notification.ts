export interface Notification {
  id: number
  type: string
  title: string
  message: string
  isRead: boolean
  readAt: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}
