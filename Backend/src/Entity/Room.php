<?php

namespace App\Entity;

use App\Repository\RoomRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: RoomRepository::class)]
#[ORM\Table(name: 'rooms')]
class Room
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::BIGINT)]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    private ?string $code = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $name = null;

    #[ORM\Column(length: 50, nullable: true)]
    private ?string $type = null;

    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    private ?int $capacity = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $building = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $floor = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $equipment = null;

    #[ORM\Column(name: 'is_active', type: Types::BOOLEAN, nullable: true)]
    private ?bool $isActive = true;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $createdAt = null;

    #[ORM\Column(name: 'updated_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $updatedAt = null;

    #[ORM\Column(name: 'deleted_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $deletedAt = null;

    #[ORM\ManyToOne(targetEntity: Department::class)]
    #[ORM\JoinColumn(name: 'department_id', referencedColumnName: 'id', nullable: false)]
    private ?Department $department = null;

    #[ORM\ManyToOne(targetEntity: DepartmentGroup::class)]
    #[ORM\JoinColumn(name: 'department_group_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?DepartmentGroup $departmentGroup = null;

    public function __construct()
    {
        $this->createdAt = new \DateTime();
        $this->isActive = true;
    }

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

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): static
    {
        $this->name = $name;
        return $this;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(?string $type): static
    {
        $validTypes = ['classroom', 'laboratory', 'auditorium', 'office'];
        if ($type !== null && !in_array($type, $validTypes)) {
            throw new \InvalidArgumentException('Invalid room type');
        }
        $this->type = $type;
        return $this;
    }

    public function getCapacity(): ?int
    {
        return $this->capacity;
    }

    public function setCapacity(?int $capacity): static
    {
        $this->capacity = $capacity;
        return $this;
    }

    public function getBuilding(): ?string
    {
        return $this->building;
    }

    public function setBuilding(?string $building): static
    {
        $this->building = $building;
        return $this;
    }

    public function getFloor(): ?string
    {
        return $this->floor;
    }

    public function setFloor(?string $floor): static
    {
        $this->floor = $floor;
        return $this;
    }

    public function getEquipment(): ?string
    {
        return $this->equipment;
    }

    public function setEquipment(?string $equipment): static
    {
        $this->equipment = $equipment;
        return $this;
    }

    public function isActive(): ?bool
    {
        return $this->isActive;
    }

    public function setIsActive(?bool $isActive): static
    {
        $this->isActive = $isActive;
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

    public function getDeletedAt(): ?\DateTimeInterface
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?\DateTimeInterface $deletedAt): static
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    // Helper methods
    public function getTypeIcon(): string
    {
        return match($this->type) {
            'classroom' => '🏫',
            'laboratory' => '🔬',
            'auditorium' => '🎭',
            'office' => '🏢',
            default => '📍'
        };
    }

    public function getTypeBadgeClass(): string
    {
        return match($this->type) {
            'classroom' => 'bg-blue-100 text-blue-800',
            'laboratory' => 'bg-green-100 text-green-800',
            'auditorium' => 'bg-purple-100 text-purple-800',
            'office' => 'bg-gray-100 text-gray-800',
            default => 'bg-gray-100 text-gray-800'
        };
    }

    public function getFullName(): string
    {
        return $this->building ? "{$this->building} - {$this->name}" : $this->name;
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

    public function getDepartmentId(): ?int
    {
        return $this->department?->getId();
    }

    public function getDepartmentGroup(): ?DepartmentGroup
    {
        return $this->departmentGroup;
    }

    public function setDepartmentGroup(?DepartmentGroup $departmentGroup): static
    {
        $this->departmentGroup = $departmentGroup;
        return $this;
    }

    /**
     * Check if this room is accessible by a given department
     * A room is accessible if:
     * 1. It belongs to the department directly, OR
     * 2. It belongs to a department group that includes this department
     */
    public function isAccessibleByDepartment(Department $department): bool
    {
        // Check if the room belongs to this department
        if ($this->department && $this->department->getId() === $department->getId()) {
            return true;
        }

        // Check if the room belongs to a department group that includes this department
        if ($this->departmentGroup && $department->getDepartmentGroup()) {
            return $this->departmentGroup->getId() === $department->getDepartmentGroup()->getId();
        }

        return false;
    }

    public function __toString(): string
    {
        return $this->name . ' (' . $this->code . ')';
    }
}