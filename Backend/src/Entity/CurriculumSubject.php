<?php

namespace App\Entity;

use App\Repository\CurriculumSubjectRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CurriculumSubjectRepository::class)]
#[ORM\Table(name: 'curriculum_subjects')]
#[ORM\UniqueConstraint(name: 'unique_term_subject', columns: ['curriculum_term_id', 'subject_id'])]
#[ORM\HasLifecycleCallbacks]
class CurriculumSubject
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: CurriculumTerm::class, inversedBy: 'curriculumSubjects')]
    #[ORM\JoinColumn(name: 'curriculum_term_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?CurriculumTerm $curriculumTerm = null;

    #[ORM\ManyToOne(targetEntity: Subject::class)]
    #[ORM\JoinColumn(name: 'subject_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?Subject $subject = null;

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $sections_mapping = null;

    #[ORM\Column(type: 'datetime')]
    private \DateTimeInterface $created_at;

    #[ORM\Column(type: 'datetime')]
    private \DateTimeInterface $updated_at;

    public function __construct()
    {
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

    /**
     * Get curriculum through the term (no longer stored directly)
     */
    public function getCurriculum(): ?Curriculum
    {
        return $this->curriculumTerm?->getCurriculum();
    }

    public function getCurriculumTerm(): ?CurriculumTerm
    {
        return $this->curriculumTerm;
    }

    public function setCurriculumTerm(?CurriculumTerm $curriculumTerm): self
    {
        $this->curriculumTerm = $curriculumTerm;
        return $this;
    }

    public function getSubject(): ?Subject
    {
        return $this->subject;
    }

    public function setSubject(?Subject $subject): self
    {
        $this->subject = $subject;
        return $this;
    }

    public function getSectionsMapping(): ?array
    {
        return $this->sections_mapping;
    }

    public function setSectionsMapping(?array $sections_mapping): self
    {
        $this->sections_mapping = $sections_mapping;
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
}
