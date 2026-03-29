<?php

namespace App\Entity;

use App\Repository\NotificationRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: NotificationRepository::class)]
#[ORM\Table(name: 'notifications')]
#[ORM\Index(columns: ['user_id', 'is_read'], name: 'idx_notification_user_read')]
#[ORM\Index(columns: ['created_at'], name: 'idx_notification_created')]
#[ORM\Index(columns: ['type'], name: 'idx_notification_type')]
class Notification
{
    // ── Notification types ───────────────────────
    public const TYPE_SCHEDULE_ASSIGNED   = 'schedule_assigned';
    public const TYPE_SCHEDULE_UPDATED    = 'schedule_updated';
    public const TYPE_SCHEDULE_REMOVED    = 'schedule_removed';
    public const TYPE_SCHEDULE_ACTIVATED  = 'schedule_activated';
    public const TYPE_SCHEDULE_DEACTIVATED = 'schedule_deactivated';
    public const TYPE_ANNOUNCEMENT        = 'announcement';
    public const TYPE_SYSTEM              = 'system';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $user = null;

    #[ORM\Column(length: 50)]
    private ?string $type = null;

    #[ORM\Column(length: 255)]
    private ?string $title = null;

    #[ORM\Column(type: Types::TEXT)]
    private ?string $message = null;

    #[ORM\Column(name: 'is_read', type: Types::BOOLEAN, options: ['default' => false])]
    private bool $isRead = false;

    #[ORM\Column(name: 'read_at', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $readAt = null;

    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $metadata = null;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $createdAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->isRead = false;
    }

    // ── Getters / Setters ────────────────────────

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): static
    {
        $this->user = $user;
        return $this;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(string $type): static
    {
        $this->type = $type;
        return $this;
    }

    public function getTitle(): ?string
    {
        return $this->title;
    }

    public function setTitle(string $title): static
    {
        $this->title = $title;
        return $this;
    }

    public function getMessage(): ?string
    {
        return $this->message;
    }

    public function setMessage(string $message): static
    {
        $this->message = $message;
        return $this;
    }

    public function isRead(): bool
    {
        return $this->isRead;
    }

    public function setIsRead(bool $isRead): static
    {
        $this->isRead = $isRead;
        if ($isRead && $this->readAt === null) {
            $this->readAt = new \DateTimeImmutable();
        }
        return $this;
    }

    public function getReadAt(): ?\DateTimeImmutable
    {
        return $this->readAt;
    }

    public function setReadAt(?\DateTimeImmutable $readAt): static
    {
        $this->readAt = $readAt;
        return $this;
    }

    public function getMetadata(): ?array
    {
        return $this->metadata;
    }

    public function setMetadata(?array $metadata): static
    {
        $this->metadata = $metadata;
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeImmutable $createdAt): static
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    // ── Convenience ──────────────────────────────

    public function markAsRead(): static
    {
        $this->isRead = true;
        $this->readAt = new \DateTimeImmutable();
        return $this;
    }

    /**
     * Return a human-friendly icon name based on type (for frontend use).
     */
    public function getIcon(): string
    {
        return match ($this->type) {
            self::TYPE_SCHEDULE_ASSIGNED   => 'calendar-plus',
            self::TYPE_SCHEDULE_UPDATED    => 'calendar-edit',
            self::TYPE_SCHEDULE_REMOVED    => 'calendar-minus',
            self::TYPE_SCHEDULE_ACTIVATED  => 'calendar-check',
            self::TYPE_SCHEDULE_DEACTIVATED => 'calendar-x',
            self::TYPE_ANNOUNCEMENT        => 'megaphone',
            self::TYPE_SYSTEM              => 'info-circle',
            default                        => 'bell',
        };
    }
}
