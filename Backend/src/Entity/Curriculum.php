<?php

namespace App\Entity;

use App\Repository\CurriculumRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: CurriculumRepository::class)]
#[ORM\Table(name: 'curricula')]
class Curriculum
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::BIGINT)]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Department::class)]
    #[ORM\JoinColumn(name: 'department_id', referencedColumnName: 'id', nullable: false)]
    #[Assert\NotBlank]
    private ?Department $department = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    private ?string $name = null;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $version = null;

    #[ORM\Column(name: 'is_published', type: Types::BOOLEAN, nullable: true)]
    private ?bool $isPublished = false;

    #[ORM\Column(name: 'effective_year_id', type: Types::BIGINT, nullable: true)]
    private ?int $effectiveYearId = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $notes = null;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $createdAt = null;

    #[ORM\Column(name: 'updated_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $updatedAt = null;

    #[ORM\Column(name: 'deleted_at', type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $deletedAt = null;

    #[ORM\OneToMany(mappedBy: 'curriculum', targetEntity: CurriculumTerm::class, cascade: ['remove'], orphanRemoval: true)]
    private Collection $curriculumTerms;

    public function __construct()
    {
        $this->createdAt = new \DateTime();
        $this->isPublished = false;
        $this->version = 1;
        $this->curriculumTerms = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
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

    /**
     * Helper method to get department ID
     */
    public function getDepartmentId(): ?int
    {
        return $this->department?->getId();
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

    public function getVersion(): ?int
    {
        return $this->version;
    }

    public function setVersion(?int $version): static
    {
        $this->version = $version;
        return $this;
    }

    public function isPublished(): ?bool
    {
        return $this->isPublished;
    }

    public function setIsPublished(?bool $isPublished): static
    {
        $this->isPublished = $isPublished;
        return $this;
    }

    public function getEffectiveYearId(): ?int
    {
        return $this->effectiveYearId;
    }

    public function setEffectiveYearId(?int $effectiveYearId): static
    {
        $this->effectiveYearId = $effectiveYearId;
        return $this;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): static
    {
        $this->notes = $notes;
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

    /**
     * @return Collection<int, CurriculumTerm>
     */
    public function getCurriculumTerms(): Collection
    {
        return $this->curriculumTerms;
    }

    public function addCurriculumTerm(CurriculumTerm $curriculumTerm): self
    {
        if (!$this->curriculumTerms->contains($curriculumTerm)) {
            $this->curriculumTerms[] = $curriculumTerm;
            $curriculumTerm->setCurriculum($this);
        }

        return $this;
    }

    public function removeCurriculumTerm(CurriculumTerm $curriculumTerm): self
    {
        if ($this->curriculumTerms->removeElement($curriculumTerm)) {
            if ($curriculumTerm->getCurriculum() === $this) {
                $curriculumTerm->setCurriculum(null);
            }
        }

        return $this;
    }

    /**
     * Get total number of subjects across all terms
     */
    public function getTotalSubjects(): int
    {
        $total = 0;
        foreach ($this->curriculumTerms as $term) {
            $total += $term->getCurriculumSubjects()->count();
        }
        return $total;
    }

    /**
     * Get total units across all terms
     */
    public function getTotalUnits(): float
    {
        $total = 0;
        foreach ($this->curriculumTerms as $term) {
            $total += $term->getTotalUnits();
        }
        return $total;
    }

    /**
     * Check if curriculum can be published (has at least one subject)
     */
    public function canBePublished(): bool
    {
        return $this->getTotalSubjects() > 0;
    }

    // Helper methods
    public function getStatusBadge(): string
    {
        if ($this->isPublished) {
            return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Published</span>';
        }
        return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Draft</span>';
    }

    public function getDisplayName(): string
    {
        return $this->name . ($this->version > 1 ? " (v{$this->version})" : '');
    }

    public function __toString(): string
    {
        return $this->name;
    }
}