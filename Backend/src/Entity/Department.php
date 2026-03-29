<?php

namespace App\Entity;

use App\Repository\DepartmentRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: DepartmentRepository::class)]
#[ORM\Table(name: 'departments')]
#[ORM\Index(name: 'idx_department_college', columns: ['college_id'])]
#[ORM\Index(name: 'idx_department_active', columns: ['is_active'])]
#[ORM\Index(name: 'idx_department_deleted', columns: ['deleted_at'])]
class Department
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 10, unique: true)]
    private ?string $code = null;

    #[ORM\Column(length: 255)]
    private ?string $name = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $description = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'head_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $head = null;

    #[ORM\Column(name: 'contact_email', length: 255, nullable: true)]
    private ?string $contactEmail = null;

    #[ORM\ManyToOne(targetEntity: College::class, inversedBy: 'departments')]
    #[ORM\JoinColumn(name: 'college_id', referencedColumnName: 'id', onDelete: 'SET NULL')]
    private ?College $college = null;

    #[ORM\OneToMany(mappedBy: 'department', targetEntity: User::class)]
    private Collection $users;

    #[ORM\ManyToOne(targetEntity: DepartmentGroup::class, inversedBy: 'departments')]
    #[ORM\JoinColumn(name: 'department_group_id', referencedColumnName: 'id', onDelete: 'SET NULL')]
    private ?DepartmentGroup $departmentGroup = null;

    #[ORM\Column(name: 'is_active', type: Types::BOOLEAN, options: ['default' => true])]
    private ?bool $isActive = true;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_MUTABLE)]
    private ?\DateTimeInterface $createdAt = null;

    #[ORM\Column(name: 'updated_at', type: Types::DATETIME_MUTABLE)]
    private ?\DateTimeInterface $updatedAt = null;

    #[ORM\Column(name: 'deleted_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $deletedAt = null;

    public function __construct()
    {
        $this->users = new ArrayCollection();
        $this->createdAt = new \DateTime();
        $this->updatedAt = new \DateTime();
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

    public function setName(string $name): static
    {
        $this->name = $name;
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

    public function getHead(): ?User
    {
        return $this->head;
    }

    public function setHead(?User $head): static
    {
        $this->head = $head;
        return $this;
    }

    /**
     * Backward-compatible getter — returns the head's full name or null.
     */
    public function getHeadName(): ?string
    {
        if ($this->head === null) {
            return null;
        }

        return trim(($this->head->getFirstname() ?? '') . ' ' . ($this->head->getLastname() ?? '')) ?: $this->head->getUsername();
    }

    public function getContactEmail(): ?string
    {
        return $this->contactEmail;
    }

    public function setContactEmail(?string $contactEmail): static
    {
        $this->contactEmail = $contactEmail;
        return $this;
    }

    public function getCollegeId(): ?int
    {
        return $this->college?->getId();
    }

    public function getCollege(): ?College
    {
        return $this->college;
    }

    public function setCollege(?College $college): static
    {
        $this->college = $college;
        return $this;
    }

    /**
     * @return Collection<int, User>
     */
    public function getUsers(): Collection
    {
        return $this->users;
    }

    public function addUser(User $user): static
    {
        if (!$this->users->contains($user)) {
            $this->users->add($user);
            $user->setDepartment($this);
        }

        return $this;
    }

    public function removeUser(User $user): static
    {
        if ($this->users->removeElement($user)) {
            // set the owning side to null (unless already changed)
            if ($user->getDepartment() === $this) {
                $user->setDepartment(null);
            }
        }

        return $this;
    }

    public function getIsActive(): ?bool
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

    public function getDepartmentGroup(): ?DepartmentGroup
    {
        return $this->departmentGroup;
    }

    public function setDepartmentGroup(?DepartmentGroup $departmentGroup): static
    {
        $this->departmentGroup = $departmentGroup;
        return $this;
    }

    public function __toString(): string
    {
        return $this->name ?? '';
    }
}