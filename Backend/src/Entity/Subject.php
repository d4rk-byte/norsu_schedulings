<?php

namespace App\Entity;

use App\Repository\SubjectRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: SubjectRepository::class)]
#[ORM\Table(name: 'subjects')]
class Subject
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::BIGINT)]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank(message: 'Subject code is required')]
    private ?string $code = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank(message: 'Subject title is required')]
    private ?string $title = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $description = null;

    #[ORM\Column(type: Types::INTEGER)]
    #[Assert\NotBlank(message: 'Units are required')]
    #[Assert\Range(min: 1, max: 12, notInRangeMessage: 'Units must be between {{ min }} and {{ max }}')]
    private ?int $units = null;

    #[ORM\Column(name: 'lecture_hours', type: Types::INTEGER, nullable: true)]
    private ?int $lectureHours = 0;

    #[ORM\Column(name: 'lab_hours', type: Types::INTEGER, nullable: true)]
    private ?int $labHours = 0;

    #[ORM\ManyToOne(targetEntity: Department::class)]
    #[ORM\JoinColumn(name: 'department_id', referencedColumnName: 'id', nullable: false, onDelete: 'RESTRICT')]
    #[Assert\NotBlank(message: 'Department is required')]
    private ?Department $department = null;

    #[ORM\Column(length: 50)]
    private ?string $type = 'lecture';

    #[ORM\Column(name: 'is_active', type: Types::BOOLEAN)]
    private ?bool $isActive = true;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_MUTABLE)]
    private ?\DateTimeInterface $createdAt = null;

    #[ORM\Column(name: 'updated_at', type: Types::DATETIME_MUTABLE)]
    private ?\DateTimeInterface $updatedAt = null;

    #[ORM\Column(name: 'deleted_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $deletedAt = null;

    #[ORM\Column(name: 'year_level', type: Types::INTEGER, nullable: true)]
    private ?int $yearLevel = null;

    #[ORM\Column(name: 'semester', type: Types::STRING, length: 20, nullable: true)]
    private ?string $semester = null;

    public function __construct()
    {
        $this->createdAt = new \DateTime();
        $this->updatedAt = new \DateTime();
        $this->isActive = true;
        $this->lectureHours = 0;
        $this->labHours = 0;
    }

    // Getters and Setters
    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(string $code): static
    {
        $this->code = $code;
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

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;
        return $this;
    }

    public function getUnits(): ?int
    {
        return $this->units;
    }

    public function setUnits(int $units): static
    {
        $this->units = $units;
        return $this;
    }

    public function getLectureHours(): ?int
    {
        return $this->lectureHours;
    }

    public function setLectureHours(?int $lectureHours): static
    {
        $this->lectureHours = $lectureHours ?? 0;
        return $this;
    }

    public function getLabHours(): ?int
    {
        return $this->labHours;
    }

    public function setLabHours(?int $labHours): static
    {
        $this->labHours = $labHours ?? 0;
        return $this;
    }

    public function getDepartment(): ?Department
    {
        return $this->department;
    }

    public function setDepartment(?Department $department): static
    {
        $this->department = $department;
        return $this;
    }

    // For backward compatibility - returns department ID
    public function getDepartmentId(): ?int
    {
        return $this->department?->getId();
    }

    // For backward compatibility - sets department by ID
    public function setDepartmentId(int $departmentId): static
    {
        // This method is kept for backward compatibility but should not be used
        // Use setDepartment() instead
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

    public function isActive(): ?bool
    {
        return $this->isActive;
    }

    public function setIsActive(bool $isActive): static
    {
        $this->isActive = $isActive;
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeInterface
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeInterface $createdAt): static
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?\DateTimeInterface
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(\DateTimeInterface $updatedAt): static
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?\DateTimeInterface
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?\DateTimeInterface $deletedAt): static
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    public function getYearLevel(): ?int
    {
        return $this->yearLevel;
    }

    public function setYearLevel(?int $yearLevel): static
    {
        $this->yearLevel = $yearLevel;
        return $this;
    }

    public function getSemester(): ?string
    {
        return $this->semester;
    }

    public function setSemester(?string $semester): static
    {
        $this->semester = $semester;
        return $this;
    }

    // Helper methods
    public function getTotalHours(): int
    {
        return ($this->lectureHours ?? 0) + ($this->labHours ?? 0);
    }

    public function getTypeBadge(): string
    {
        $badges = [
            'lecture' => '<span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Lecture</span>',
            'laboratory' => '<span class="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">Laboratory</span>',
            'lecture_lab' => '<span class="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">Lecture & Lab</span>',
        ];
        
        return $badges[$this->type] ?? '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">' . ucfirst($this->type) . '</span>';
    }

    public function getStatusBadge(): string
    {
        if ($this->isActive) {
            return '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Active</span>';
        }
        return '<span class="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Inactive</span>';
    }

    public function __toString(): string
    {
        return $this->code . ' - ' . $this->title;
    }
}
