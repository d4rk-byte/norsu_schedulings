<?php

namespace App\Service;

use App\Entity\Notification;
use App\Entity\Schedule;
use App\Entity\User;
use App\Repository\NotificationRepository;
use Doctrine\ORM\EntityManagerInterface;

class NotificationService
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private NotificationRepository $notificationRepository,
    ) {
    }

    // ══════════════════════════════════════════════
    //  GENERIC HELPERS
    // ══════════════════════════════════════════════

    /**
     * Create and persist a notification for a single user.
     */
    public function create(
        User   $user,
        string $type,
        string $title,
        string $message,
        ?array $metadata = null,
    ): Notification {
        $notification = new Notification();
        $notification->setUser($user);
        $notification->setType($type);
        $notification->setTitle($title);
        $notification->setMessage($message);
        $notification->setMetadata($metadata);

        $this->entityManager->persist($notification);
        $this->entityManager->flush();

        return $notification;
    }

    /**
     * Create notifications for multiple users at once.
     */
    public function createForMultipleUsers(
        array  $users,
        string $type,
        string $title,
        string $message,
        ?array $metadata = null,
    ): array {
        $notifications = [];

        foreach ($users as $user) {
            $notification = new Notification();
            $notification->setUser($user);
            $notification->setType($type);
            $notification->setTitle($title);
            $notification->setMessage($message);
            $notification->setMetadata($metadata);

            $this->entityManager->persist($notification);
            $notifications[] = $notification;
        }

        $this->entityManager->flush();

        return $notifications;
    }

    /**
     * Get notifications for a user.
     */
    public function getForUser(User $user, int $limit = 50, int $offset = 0): array
    {
        return $this->notificationRepository->findByUser($user, $limit, $offset);
    }

    /**
     * Get unread notifications for a user.
     */
    public function getUnreadForUser(User $user, int $limit = 20): array
    {
        return $this->notificationRepository->findUnreadByUser($user, $limit);
    }

    /**
     * Count unread notifications.
     */
    public function getUnreadCount(User $user): int
    {
        return $this->notificationRepository->countUnreadByUser($user);
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(Notification $notification): void
    {
        $notification->markAsRead();
        $this->entityManager->flush();
    }

    /**
     * Mark all notifications as read for a user.
     */
    public function markAllAsRead(User $user): int
    {
        return $this->notificationRepository->markAllReadForUser($user);
    }

    /**
     * Delete a single notification (only if it belongs to the given user).
     */
    public function delete(Notification $notification, User $user): bool
    {
        if ($notification->getUser()?->getId() !== $user->getId()) {
            return false;
        }

        $this->entityManager->remove($notification);
        $this->entityManager->flush();

        return true;
    }

    // ══════════════════════════════════════════════
    //  SCHEDULE-SPECIFIC NOTIFICATION FACTORIES
    // ══════════════════════════════════════════════

    /**
     * Notify faculty that a new schedule was assigned to them.
     */
    public function notifyScheduleAssigned(Schedule $schedule): ?Notification
    {
        $faculty = $schedule->getFaculty();
        if (!$faculty) {
            return null;
        }

        $subject = $schedule->getSubject();
        $room    = $schedule->getRoom();

        return $this->create(
            user:     $faculty,
            type:     Notification::TYPE_SCHEDULE_ASSIGNED,
            title:    'New Schedule Assigned',
            message:  sprintf(
                'You have been assigned to teach %s (%s) in %s — %s, %s–%s.',
                $subject?->getTitle() ?? 'N/A',
                $subject?->getCode() ?? '',
                $room?->getName() ?: ($room?->getCode() ?? 'TBA'),
                $schedule->getDayPatternLabel() ?? '',
                $schedule->getStartTime()?->format('g:i A') ?? '',
                $schedule->getEndTime()?->format('g:i A') ?? '',
            ),
            metadata: $this->buildScheduleMeta($schedule),
        );
    }

    /**
     * Notify faculty that an existing schedule was updated.
     */
    public function notifyScheduleUpdated(Schedule $schedule, ?string $changesSummary = null): ?Notification
    {
        $faculty = $schedule->getFaculty();
        if (!$faculty) {
            return null;
        }

        $subject = $schedule->getSubject();

        $message = sprintf(
            'Your schedule for %s (%s) has been updated.',
            $subject?->getTitle() ?? 'N/A',
            $subject?->getCode() ?? '',
        );

        if ($changesSummary) {
            $message .= ' Changes: ' . $changesSummary;
        }

        return $this->create(
            user:     $faculty,
            type:     Notification::TYPE_SCHEDULE_UPDATED,
            title:    'Schedule Updated',
            message:  $message,
            metadata: $this->buildScheduleMeta($schedule),
        );
    }

    /**
     * Notify faculty that a schedule has been removed / deleted.
     */
    public function notifyScheduleRemoved(User $faculty, string $subjectTitle, string $subjectCode): ?Notification
    {
        return $this->create(
            user:     $faculty,
            type:     Notification::TYPE_SCHEDULE_REMOVED,
            title:    'Schedule Removed',
            message:  sprintf('Your schedule for %s (%s) has been removed.', $subjectTitle, $subjectCode),
        );
    }

    /**
     * Notify faculty that a schedule was activated.
     */
    public function notifyScheduleActivated(Schedule $schedule): ?Notification
    {
        $faculty = $schedule->getFaculty();
        if (!$faculty) {
            return null;
        }

        $subject = $schedule->getSubject();

        return $this->create(
            user:     $faculty,
            type:     Notification::TYPE_SCHEDULE_ACTIVATED,
            title:    'Schedule Activated',
            message:  sprintf(
                'Your schedule for %s (%s) has been activated.',
                $subject?->getTitle() ?? 'N/A',
                $subject?->getCode() ?? '',
            ),
            metadata: $this->buildScheduleMeta($schedule),
        );
    }

    /**
     * Notify faculty that a schedule was deactivated.
     */
    public function notifyScheduleDeactivated(Schedule $schedule): ?Notification
    {
        $faculty = $schedule->getFaculty();
        if (!$faculty) {
            return null;
        }

        $subject = $schedule->getSubject();

        return $this->create(
            user:     $faculty,
            type:     Notification::TYPE_SCHEDULE_DEACTIVATED,
            title:    'Schedule Deactivated',
            message:  sprintf(
                'Your schedule for %s (%s) has been deactivated.',
                $subject?->getTitle() ?? 'N/A',
                $subject?->getCode() ?? '',
            ),
            metadata: $this->buildScheduleMeta($schedule),
        );
    }

    // ══════════════════════════════════════════════
    //  SERIALISATION
    // ══════════════════════════════════════════════

    /**
     * Serialize a notification for JSON responses.
     */
    public function serialize(Notification $notification): array
    {
        return [
            'id'         => $notification->getId(),
            'type'       => $notification->getType(),
            'title'      => $notification->getTitle(),
            'message'    => $notification->getMessage(),
            'is_read'    => $notification->isRead(),
            'icon'       => $notification->getIcon(),
            'metadata'   => $notification->getMetadata(),
            'created_at' => $notification->getCreatedAt()?->format('c'),
            'read_at'    => $notification->getReadAt()?->format('c'),
            'time_ago'   => $this->timeAgo($notification->getCreatedAt()),
        ];
    }

    // ── private helpers ──────────────────────────

    private function buildScheduleMeta(Schedule $schedule): array
    {
        return [
            'schedule_id' => $schedule->getId(),
            'subject_code' => $schedule->getSubject()?->getCode(),
            'room_name'    => $schedule->getRoom()?->getName(),
            'day_pattern'  => $schedule->getDayPatternLabel(),
            'time'         => sprintf(
                '%s–%s',
                $schedule->getStartTime()?->format('g:i A') ?? '',
                $schedule->getEndTime()?->format('g:i A') ?? '',
            ),
        ];
    }

    private function timeAgo(?\DateTimeImmutable $date): string
    {
        if (!$date) {
            return '';
        }

        $now  = new \DateTimeImmutable();
        $diff = $now->diff($date);

        if ($diff->y > 0) {
            return $diff->y . ' year' . ($diff->y > 1 ? 's' : '') . ' ago';
        }
        if ($diff->m > 0) {
            return $diff->m . ' month' . ($diff->m > 1 ? 's' : '') . ' ago';
        }
        if ($diff->d > 0) {
            return $diff->d . ' day' . ($diff->d > 1 ? 's' : '') . ' ago';
        }
        if ($diff->h > 0) {
            return $diff->h . ' hour' . ($diff->h > 1 ? 's' : '') . ' ago';
        }
        if ($diff->i > 0) {
            return $diff->i . ' minute' . ($diff->i > 1 ? 's' : '') . ' ago';
        }

        return 'just now';
    }
}
