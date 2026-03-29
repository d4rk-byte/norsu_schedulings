<?php

namespace App\Service;

use App\Entity\CurriculumTerm;
use App\Entity\CurriculumSubject;
use App\Entity\Subject;
use App\Repository\CurriculumSubjectRepository;
use Doctrine\ORM\EntityManagerInterface;

class CurriculumSubjectService
{
    private EntityManagerInterface $entityManager;
    private CurriculumSubjectRepository $curriculumSubjectRepository;

    public function __construct(
        EntityManagerInterface $entityManager,
        CurriculumSubjectRepository $curriculumSubjectRepository
    ) {
        $this->entityManager = $entityManager;
        $this->curriculumSubjectRepository = $curriculumSubjectRepository;
    }

    /**
     * Add a subject to a curriculum term
     */
    public function addSubjectToTerm(CurriculumTerm $term, Subject $subject, ?array $sectionsMapping = null): CurriculumSubject
    {
        // Check if subject already exists in this term
        if ($this->curriculumSubjectRepository->isSubjectInTerm($term->getId(), $subject->getId())) {
            throw new \Exception('This subject is already in this term.');
        }

        $curriculumSubject = new CurriculumSubject();
        $curriculumSubject->setCurriculumTerm($term);
        $curriculumSubject->setSubject($subject);
        $curriculumSubject->setSectionsMapping($sectionsMapping);

        $this->entityManager->persist($curriculumSubject);
        $this->entityManager->flush();

        return $curriculumSubject;
    }

    /**
     * Remove a subject from a term
     */
    public function removeSubjectFromTerm(CurriculumSubject $curriculumSubject): void
    {
        $this->entityManager->remove($curriculumSubject);
        $this->entityManager->flush();
    }

    /**
     * Update sections mapping for a curriculum subject
     */
    public function updateSectionsMapping(CurriculumSubject $curriculumSubject, array $sectionsMapping): CurriculumSubject
    {
        $curriculumSubject->setSectionsMapping($sectionsMapping);
        $this->entityManager->flush();

        return $curriculumSubject;
    }

    /**
     * Move a subject to a different term
     */
    public function moveSubjectToTerm(CurriculumSubject $curriculumSubject, CurriculumTerm $newTerm): CurriculumSubject
    {
        // Check if subject already exists in the new term
        if ($this->curriculumSubjectRepository->isSubjectInTerm($newTerm->getId(), $curriculumSubject->getSubject()->getId())) {
            throw new \Exception('This subject is already in the target term.');
        }

        $curriculumSubject->setCurriculumTerm($newTerm);
        $this->entityManager->flush();

        return $curriculumSubject;
    }
}
