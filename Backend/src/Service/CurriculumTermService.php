<?php

namespace App\Service;

use App\Entity\Curriculum;
use App\Entity\CurriculumTerm;
use App\Repository\CurriculumTermRepository;
use Doctrine\ORM\EntityManagerInterface;

class CurriculumTermService
{
    private EntityManagerInterface $entityManager;
    private CurriculumTermRepository $curriculumTermRepository;

    public function __construct(
        EntityManagerInterface $entityManager,
        CurriculumTermRepository $curriculumTermRepository
    ) {
        $this->entityManager = $entityManager;
        $this->curriculumTermRepository = $curriculumTermRepository;
    }

    /**
     * Create a new curriculum term
     */
    public function createTerm(
        Curriculum $curriculum,
        int $yearLevel,
        string $semester,
        ?string $termName = null
    ): CurriculumTerm {
        // Check if term already exists
        $existing = $this->curriculumTermRepository->findByYearAndSemester(
            $curriculum->getId(),
            $yearLevel,
            $semester
        );

        if ($existing) {
            throw new \Exception('A term with this year and semester already exists for this curriculum.');
        }

        $term = new CurriculumTerm();
        $term->setCurriculum($curriculum);
        $term->setYearLevel($yearLevel);
        $term->setSemester($semester);
        $term->setTermName($termName);

        $this->entityManager->persist($term);
        $this->entityManager->flush();

        return $term;
    }

    /**
     * Update an existing term
     */
    public function updateTerm(
        CurriculumTerm $term,
        int $yearLevel,
        string $semester,
        ?string $termName = null
    ): CurriculumTerm {
        $term->setYearLevel($yearLevel);
        $term->setSemester($semester);
        $term->setTermName($termName);

        $this->entityManager->flush();

        return $term;
    }

    /**
     * Delete a term
     */
    public function deleteTerm(CurriculumTerm $term): void
    {
        $this->entityManager->remove($term);
        $this->entityManager->flush();
    }

    /**
     * Get or create a term
     */
    public function getOrCreateTerm(
        Curriculum $curriculum,
        int $yearLevel,
        string $semester,
        ?string $termName = null
    ): CurriculumTerm {
        $term = $this->curriculumTermRepository->findByYearAndSemester(
            $curriculum->getId(),
            $yearLevel,
            $semester
        );

        if ($term) {
            return $term;
        }

        return $this->createTerm($curriculum, $yearLevel, $semester, $termName);
    }

    /**
     * Generate default terms for a curriculum
     */
    public function generateDefaultTerms(Curriculum $curriculum, int $years = 4): array
    {
        $terms = [];
        $semesters = ['1st', '2nd'];

        for ($year = 1; $year <= $years; $year++) {
            foreach ($semesters as $semester) {
                try {
                    $terms[] = $this->getOrCreateTerm($curriculum, $year, $semester);
                } catch (\Exception $e) {
                    // Term already exists, skip
                }
            }

            // Add summer term
            try {
                $terms[] = $this->getOrCreateTerm($curriculum, $year, 'summer');
            } catch (\Exception $e) {
                // Term already exists, skip
            }
        }

        return $terms;
    }
}
