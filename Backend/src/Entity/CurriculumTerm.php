<?php

namespace App\Entity;

use App\Repository\CurriculumTermRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CurriculumTermRepository::class)]
#[ORM\Table(name: 'curriculum_terms')]
#[ORM\Index(name: 'idx_curriculum_term', columns: ['curriculum_id', 'year_level', 'semester'])]
#[ORM\HasLifecycleCallbacks]
class CurriculumTerm
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Curriculum::class, inversedBy: 'curriculumTerms')]
    #[ORM\JoinColumn(name: 'curriculum_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?Curriculum $curriculum = null;

    #[ORM\Column(type: 'integer')]
    private int $year_level;

    #[ORM\Column(type: 'string', length: 10)]
    private string $semester;

    #[ORM\Column(type: 'string', length: 100, nullable: true)]
    private ?string $term_name = null;

    #[ORM\OneToMany(mappedBy: 'curriculumTerm', targetEntity: CurriculumSubject::class, cascade: ['remove'], orphanRemoval: true)]
    private Collection $curriculumSubjects;

    #[ORM\Column(type: 'datetime')]
    private \DateTimeInterface $created_at;

    #[ORM\Column(type: 'datetime')]
    private \DateTimeInterface $updated_at;

    public function __construct()
    {
        $this->curriculumSubjects = new ArrayCollection();
        $this->created_at = new \DateTime();
        $this->updated_at = new \DateTime();
    }

    #[ORM\PreUpdate]
    public function setUpdatedAtValue(): void
    {
        $this->updated_at = new \DateTime();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCurriculum(): ?Curriculum
    {
        return $this->curriculum;
    }

    public function setCurriculum(?Curriculum $curriculum): self
    {
        $this->curriculum = $curriculum;
        return $this;
    }

    public function getYearLevel(): int
    {
        return $this->year_level;
    }

    public function setYearLevel(int $year_level): self
    {
        $this->year_level = $year_level;
        return $this;
    }

    public function getSemester(): string
    {
        return $this->semester;
    }

    public function setSemester(string $semester): self
    {
        $this->semester = $semester;
        return $this;
    }

    public function getTermName(): ?string
    {
        return $this->term_name;
    }

    public function setTermName(?string $term_name): self
    {
        $this->term_name = $term_name;
        return $this;
    }

    /**
     * @return Collection<int, CurriculumSubject>
     */
    public function getCurriculumSubjects(): Collection
    {
        return $this->curriculumSubjects;
    }

    public function addCurriculumSubject(CurriculumSubject $curriculumSubject): self
    {
        if (!$this->curriculumSubjects->contains($curriculumSubject)) {
            $this->curriculumSubjects[] = $curriculumSubject;
            $curriculumSubject->setCurriculumTerm($this);
        }

        return $this;
    }

    public function removeCurriculumSubject(CurriculumSubject $curriculumSubject): self
    {
        if ($this->curriculumSubjects->removeElement($curriculumSubject)) {
            if ($curriculumSubject->getCurriculumTerm() === $this) {
                $curriculumSubject->setCurriculumTerm(null);
            }
        }

        return $this;
    }

    public function getCreatedAt(): \DateTimeInterface
    {
        return $this->created_at;
    }

    public function setCreatedAt(\DateTimeInterface $created_at): self
    {
        $this->created_at = $created_at;
        return $this;
    }

    public function getUpdatedAt(): \DateTimeInterface
    {
        return $this->updated_at;
    }

    public function setUpdatedAt(\DateTimeInterface $updated_at): self
    {
        $this->updated_at = $updated_at;
        return $this;
    }

    public function getDisplayName(): string
    {
        if ($this->term_name) {
            return $this->term_name;
        }

        $year = match($this->year_level) {
            1 => '1st Year',
            2 => '2nd Year',
            3 => '3rd Year',
            default => $this->year_level . 'th Year'
        };

        $sem = match($this->semester) {
            '1st' => '1st Semester',
            '2nd' => '2nd Semester',
            'summer' => 'Summer',
            default => $this->semester
        };

        return "{$year} - {$sem}";
    }

    public function getTotalUnits(): float
    {
        $total = 0;
        foreach ($this->curriculumSubjects as $curriculumSubject) {
            if ($curriculumSubject->getSubject()) {
                $total += $curriculumSubject->getSubject()->getUnits();
            }
        }
        return $total;
    }
}
