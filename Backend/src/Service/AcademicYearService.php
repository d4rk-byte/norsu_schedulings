<?php

namespace App\Service;

use App\Entity\AcademicYear;
use App\Repository\AcademicYearRepository;
use Doctrine\ORM\EntityManagerInterface;

class AcademicYearService
{
    public function __construct(
        private AcademicYearRepository $academicYearRepository,
        private EntityManagerInterface $entityManager
    ) {
    }

    /**
     * Get all academic years with optional filtering
     */
    public function getAcademicYears(array $filters = []): array
    {
        return $this->academicYearRepository->findWithFilters($filters);
    }

    /**
     * Get academic year by ID
     */
    public function getAcademicYearById(int $id): ?AcademicYear
    {
        return $this->academicYearRepository->find($id);
    }

    /**
     * Get the current academic year
     */
    public function getCurrentAcademicYear(): ?AcademicYear
    {
        return $this->academicYearRepository->findCurrent();
    }

    /**
     * Create a new academic year
     */
    public function createAcademicYear(AcademicYear $academicYear): AcademicYear
    {
        // Validate dates
        if ($academicYear->getStartDate() && $academicYear->getEndDate()) {
            if ($academicYear->getStartDate() >= $academicYear->getEndDate()) {
                throw new \Exception('Start date must be before end date.');
            }
        }

        // Check if year already exists
        $existing = $this->academicYearRepository->findByYear($academicYear->getYear());
        if ($existing) {
            throw new \Exception('An academic year with this year already exists.');
        }

        $academicYear->setCreatedAt(new \DateTime());
        $academicYear->setUpdatedAt(new \DateTime());

        // If this is set as current, unset other current years
        if ($academicYear->isCurrent()) {
            $this->unsetCurrentYear();
        }

        $this->entityManager->persist($academicYear);
        $this->entityManager->flush();

        return $academicYear;
    }

    /**
     * Update an existing academic year
     */
    public function updateAcademicYear(AcademicYear $academicYear): AcademicYear
    {
        // Validate dates
        if ($academicYear->getStartDate() && $academicYear->getEndDate()) {
            if ($academicYear->getStartDate() >= $academicYear->getEndDate()) {
                throw new \Exception('Start date must be before end date.');
            }
        }

        $academicYear->setUpdatedAt(new \DateTime());

        // If this is set as current, unset other current years
        if ($academicYear->isCurrent()) {
            $this->unsetCurrentYear($academicYear->getId());
        }

        $this->entityManager->flush();

        return $academicYear;
    }

    /**
     * Soft delete an academic year
     */
    public function deleteAcademicYear(AcademicYear $academicYear): void
    {
        // Check if it's the current year
        if ($academicYear->isCurrent()) {
            throw new \Exception('Cannot delete the current academic year. Please set another year as current first.');
        }

        $academicYear->setDeletedAt(new \DateTime());
        $this->entityManager->flush();
    }

    /**
     * Set an academic year as current
     */
    public function setCurrentYear(AcademicYear $academicYear): AcademicYear
    {
        // Unset current flag from all other years
        $this->unsetCurrentYear($academicYear->getId());

        // Set this as current
        $academicYear->setIsCurrent(true);
        $academicYear->setIsActive(true); // Current year must be active
        $academicYear->setUpdatedAt(new \DateTime());

        $this->entityManager->flush();

        return $academicYear;
    }

    /**
     * Unset current flag from all academic years except the specified one
     */
    private function unsetCurrentYear(?int $exceptId = null): void
    {
        $qb = $this->entityManager->createQueryBuilder();
        $qb->update(AcademicYear::class, 'ay')
           ->set('ay.isCurrent', ':false')
           ->setParameter('false', false)
           ->where('ay.deletedAt IS NULL');

        if ($exceptId !== null) {
            $qb->andWhere('ay.id != :exceptId')
               ->setParameter('exceptId', $exceptId);
        }

        $qb->getQuery()->execute();
    }

    /**
     * Toggle active status
     */
    public function toggleActiveStatus(AcademicYear $academicYear): AcademicYear
    {
        // Cannot deactivate current year
        if ($academicYear->isCurrent() && $academicYear->isActive()) {
            throw new \Exception('Cannot deactivate the current academic year.');
        }

        $academicYear->setIsActive(!$academicYear->isActive());
        $academicYear->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        return $academicYear;
    }

    /**
     * Get academic year statistics
     */
    public function getStatistics(): array
    {
        return $this->academicYearRepository->getStatistics();
    }

    /**
     * Get active academic years
     */
    public function getActiveAcademicYears(): array
    {
        return $this->academicYearRepository->findActive();
    }

    /**
     * Get upcoming academic years
     */
    public function getUpcomingAcademicYears(): array
    {
        return $this->academicYearRepository->findUpcoming();
    }

    /**
     * Get past academic years
     */
    public function getPastAcademicYears(): array
    {
        return $this->academicYearRepository->findPast();
    }

    /**
     * Generate next academic year suggestion
     */
    public function generateNextYear(): string
    {
        $currentYear = $this->getCurrentAcademicYear();
        
        if ($currentYear) {
            // Extract years from format YYYY-YYYY
            $years = explode('-', $currentYear->getYear());
            if (count($years) === 2) {
                $startYear = (int)$years[0] + 1;
                $endYear = (int)$years[1] + 1;
                return $startYear . '-' . $endYear;
            }
        }

        // Default to current calendar year
        $now = new \DateTime();
        $currentCalendarYear = (int)$now->format('Y');
        return $currentCalendarYear . '-' . ($currentCalendarYear + 1);
    }
}
