<?php

namespace App\Entity;

use App\Repository\ScheduleChangeRequestRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ScheduleChangeRequestRepository::class)]
#[ORM\Table(name: 'schedule_change_requests')]
#[ORM\Index(columns: ['status'], name: 'idx_scr_status')]
#[ORM\Index(columns: ['requester_id', 'submitted_at'], name: 'idx_scr_requester_submitted')]
#[ORM\Index(columns: ['admin_status'], name: 'idx_scr_admin_status')]
#[ORM\Index(columns: ['department_head_status'], name: 'idx_scr_department_head_status')]
#[ORM\Index(columns: ['department_head_approver_id'], name: 'idx_scr_department_head_approver')]
#[ORM\HasLifecycleCallbacks]
class ScheduleChangeRequest
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';

    public const APPROVAL_PENDING = 'pending';
    public const APPROVAL_APPROVED = 'approved';
    public const APPROVAL_REJECTED = 'rejected';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::BIGINT)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Schedule::class)]
    #[ORM\JoinColumn(name: 'schedule_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?Schedule $schedule = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'requester_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?User $requester = null;

    #[ORM\ManyToOne(targetEntity: Department::class)]
    #[ORM\JoinColumn(name: 'subject_department_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Department $subjectDepartment = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'admin_approver_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $adminApprover = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'department_head_approver_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $departmentHeadApprover = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'admin_reviewer_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $adminReviewer = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'department_head_reviewer_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $departmentHeadReviewer = null;

    #[ORM\ManyToOne(targetEntity: Room::class)]
    #[ORM\JoinColumn(name: 'proposed_room_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?Room $proposedRoom = null;

    #[ORM\Column(name: 'proposed_day_pattern', type: Types::STRING, length: 255)]
    private ?string $proposedDayPattern = null;

    #[ORM\Column(name: 'proposed_start_time', type: Types::TIME_MUTABLE)]
    private ?\DateTimeInterface $proposedStartTime = null;

    #[ORM\Column(name: 'proposed_end_time', type: Types::TIME_MUTABLE)]
    private ?\DateTimeInterface $proposedEndTime = null;

    #[ORM\Column(name: 'proposed_section', type: Types::STRING, length: 255, nullable: true)]
    private ?string $proposedSection = null;

    #[ORM\Column(name: 'request_reason', type: Types::TEXT, nullable: true)]
    private ?string $requestReason = null;

    #[ORM\Column(name: 'requested_changes', type: Types::JSON)]
    private array $requestedChanges = [];

    #[ORM\Column(name: 'conflict_snapshot', type: Types::JSON, nullable: true)]
    private ?array $conflictSnapshot = null;

    #[ORM\Column(type: Types::STRING, length: 20, options: ['default' => self::STATUS_PENDING])]
    private string $status = self::STATUS_PENDING;

    #[ORM\Column(name: 'admin_status', type: Types::STRING, length: 20, options: ['default' => self::APPROVAL_PENDING])]
    private string $adminStatus = self::APPROVAL_PENDING;

    #[ORM\Column(name: 'department_head_status', type: Types::STRING, length: 20, options: ['default' => self::APPROVAL_PENDING])]
    private string $departmentHeadStatus = self::APPROVAL_PENDING;

    #[ORM\Column(name: 'admin_comment', type: Types::TEXT, nullable: true)]
    private ?string $adminComment = null;

    #[ORM\Column(name: 'department_head_comment', type: Types::TEXT, nullable: true)]
    private ?string $departmentHeadComment = null;

    #[ORM\Column(name: 'submitted_at', type: Types::DATETIME_MUTABLE)]
    private ?\DateTimeInterface $submittedAt = null;

    #[ORM\Column(name: 'admin_reviewed_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $adminReviewedAt = null;

    #[ORM\Column(name: 'department_head_reviewed_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $departmentHeadReviewedAt = null;

    #[ORM\Column(name: 'cancelled_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $cancelledAt = null;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_MUTABLE)]
    private ?\DateTimeInterface $createdAt = null;

    #[ORM\Column(name: 'updated_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $updatedAt = null;

    public function __construct()
    {
        $now = new \DateTime();
        $this->submittedAt = $now;
        $this->createdAt = $now;
        $this->status = self::STATUS_PENDING;
        $this->adminStatus = self::APPROVAL_PENDING;
        $this->departmentHeadStatus = self::APPROVAL_PENDING;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getSchedule(): ?Schedule
    {
        return $this->schedule;
    }

    public function setSchedule(?Schedule $schedule): static
    {
        $this->schedule = $schedule;

        return $this;
    }

    public function getRequester(): ?User
    {
        return $this->requester;
    }

    public function setRequester(?User $requester): static
    {
        $this->requester = $requester;

        return $this;
    }

    public function getSubjectDepartment(): ?Department
    {
        return $this->subjectDepartment;
    }

    public function setSubjectDepartment(?Department $subjectDepartment): static
    {
        $this->subjectDepartment = $subjectDepartment;

        return $this;
    }

    public function getAdminApprover(): ?User
    {
        return $this->adminApprover;
    }

    public function setAdminApprover(?User $adminApprover): static
    {
        $this->adminApprover = $adminApprover;

        return $this;
    }

    public function getDepartmentHeadApprover(): ?User
    {
        return $this->departmentHeadApprover;
    }

    public function setDepartmentHeadApprover(?User $departmentHeadApprover): static
    {
        $this->departmentHeadApprover = $departmentHeadApprover;

        return $this;
    }

    public function getAdminReviewer(): ?User
    {
        return $this->adminReviewer;
    }

    public function setAdminReviewer(?User $adminReviewer): static
    {
        $this->adminReviewer = $adminReviewer;

        return $this;
    }

    public function getDepartmentHeadReviewer(): ?User
    {
        return $this->departmentHeadReviewer;
    }

    public function setDepartmentHeadReviewer(?User $departmentHeadReviewer): static
    {
        $this->departmentHeadReviewer = $departmentHeadReviewer;

        return $this;
    }

    public function getProposedRoom(): ?Room
    {
        return $this->proposedRoom;
    }

    public function setProposedRoom(?Room $proposedRoom): static
    {
        $this->proposedRoom = $proposedRoom;

        return $this;
    }

    public function getProposedDayPattern(): ?string
    {
        return $this->proposedDayPattern;
    }

    public function setProposedDayPattern(string $proposedDayPattern): static
    {
        $this->proposedDayPattern = $proposedDayPattern;

        return $this;
    }

    public function getProposedStartTime(): ?\DateTimeInterface
    {
        return $this->proposedStartTime;
    }

    public function setProposedStartTime(?\DateTimeInterface $proposedStartTime): static
    {
        $this->proposedStartTime = $proposedStartTime;

        return $this;
    }

    public function getProposedEndTime(): ?\DateTimeInterface
    {
        return $this->proposedEndTime;
    }

    public function setProposedEndTime(?\DateTimeInterface $proposedEndTime): static
    {
        $this->proposedEndTime = $proposedEndTime;

        return $this;
    }

    public function getProposedSection(): ?string
    {
        return $this->proposedSection;
    }

    public function setProposedSection(?string $proposedSection): static
    {
        $this->proposedSection = $proposedSection;

        return $this;
    }

    public function getRequestReason(): ?string
    {
        return $this->requestReason;
    }

    public function setRequestReason(?string $requestReason): static
    {
        $this->requestReason = $requestReason;

        return $this;
    }

    public function getRequestedChanges(): array
    {
        return $this->requestedChanges;
    }

    public function setRequestedChanges(array $requestedChanges): static
    {
        $this->requestedChanges = $requestedChanges;

        return $this;
    }

    public function getConflictSnapshot(): ?array
    {
        return $this->conflictSnapshot;
    }

    public function setConflictSnapshot(?array $conflictSnapshot): static
    {
        $this->conflictSnapshot = $conflictSnapshot;

        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): static
    {
        $this->status = $status;

        return $this;
    }

    public function getAdminStatus(): string
    {
        return $this->adminStatus;
    }

    public function setAdminStatus(string $adminStatus): static
    {
        $this->adminStatus = $adminStatus;

        return $this;
    }

    public function getDepartmentHeadStatus(): string
    {
        return $this->departmentHeadStatus;
    }

    public function setDepartmentHeadStatus(string $departmentHeadStatus): static
    {
        $this->departmentHeadStatus = $departmentHeadStatus;

        return $this;
    }

    public function getAdminComment(): ?string
    {
        return $this->adminComment;
    }

    public function setAdminComment(?string $adminComment): static
    {
        $this->adminComment = $adminComment;

        return $this;
    }

    public function getDepartmentHeadComment(): ?string
    {
        return $this->departmentHeadComment;
    }

    public function setDepartmentHeadComment(?string $departmentHeadComment): static
    {
        $this->departmentHeadComment = $departmentHeadComment;

        return $this;
    }

    public function getSubmittedAt(): ?\DateTimeInterface
    {
        return $this->submittedAt;
    }

    public function setSubmittedAt(?\DateTimeInterface $submittedAt): static
    {
        $this->submittedAt = $submittedAt;

        return $this;
    }

    public function getAdminReviewedAt(): ?\DateTimeInterface
    {
        return $this->adminReviewedAt;
    }

    public function setAdminReviewedAt(?\DateTimeInterface $adminReviewedAt): static
    {
        $this->adminReviewedAt = $adminReviewedAt;

        return $this;
    }

    public function getDepartmentHeadReviewedAt(): ?\DateTimeInterface
    {
        return $this->departmentHeadReviewedAt;
    }

    public function setDepartmentHeadReviewedAt(?\DateTimeInterface $departmentHeadReviewedAt): static
    {
        $this->departmentHeadReviewedAt = $departmentHeadReviewedAt;

        return $this;
    }

    public function getCancelledAt(): ?\DateTimeInterface
    {
        return $this->cancelledAt;
    }

    public function setCancelledAt(?\DateTimeInterface $cancelledAt): static
    {
        $this->cancelledAt = $cancelledAt;

        return $this;
    }

    public function getCreatedAt(): ?\DateTimeInterface
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?\DateTimeInterface $createdAt): static
    {
        $this->createdAt = $createdAt;

        return $this;
    }

    public function getUpdatedAt(): ?\DateTimeInterface
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?\DateTimeInterface $updatedAt): static
    {
        $this->updatedAt = $updatedAt;

        return $this;
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function canBeCancelled(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $now = new \DateTime();

        if ($this->submittedAt === null) {
            $this->submittedAt = $now;
        }

        if ($this->createdAt === null) {
            $this->createdAt = $now;
        }

        if ($this->status === '') {
            $this->status = self::STATUS_PENDING;
        }

        if ($this->adminStatus === '') {
            $this->adminStatus = self::APPROVAL_PENDING;
        }

        if ($this->departmentHeadStatus === '') {
            $this->departmentHeadStatus = self::APPROVAL_PENDING;
        }
    }

    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->updatedAt = new \DateTime();
    }
}