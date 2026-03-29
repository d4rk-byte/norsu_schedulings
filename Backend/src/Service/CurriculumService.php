<?php

namespace App\Service;

use App\Entity\Curriculum;
use App\Repository\CurriculumRepository;
use Doctrine\ORM\EntityManagerInterface;

class CurriculumService
{
    public function __construct(
        private CurriculumRepository $curriculumRepository,
        private EntityManagerInterface $entityManager
    ) {
    }

    /**
     * Get all curricula with optional filtering
     */
    public function getCurricula(array $filters = []): array
    {
        $qb = $this->curriculumRepository->createQueryBuilder('c')
            ->leftJoin('c.department', 'd')
            ->addSelect('d')
            ->where('c.deletedAt IS NULL');

        // Apply filters
        if (!empty($filters['search'])) {
            $qb->andWhere('c.name LIKE :search')
               ->setParameter('search', '%' . $filters['search'] . '%');
        }

        if (isset($filters['is_published']) && $filters['is_published'] !== '') {
            $qb->andWhere('c.isPublished = :isPublished')
               ->setParameter('isPublished', (bool)$filters['is_published']);
        }

        if (!empty($filters['department_id'])) {
            $qb->andWhere('c.department = :departmentId')
               ->setParameter('departmentId', $filters['department_id']);
        }

        // Sorting (allow-list for safety)
        $allowedSortFields = [
            'id' => 'c.id',
            'name' => 'c.name',
            'version' => 'c.version',
            'isPublished' => 'c.isPublished',
            'effectiveYearId' => 'c.effectiveYearId',
            'createdAt' => 'c.createdAt',
            'updatedAt' => 'c.updatedAt',
        ];
        $sortField = (string) ($filters['sort'] ?? 'createdAt');
        $orderBy = $allowedSortFields[$sortField] ?? 'c.createdAt';
        $sortDir = strtoupper((string) ($filters['dir'] ?? 'DESC')) === 'ASC' ? 'ASC' : 'DESC';
        $qb->orderBy($orderBy, $sortDir);

        return $qb->getQuery()->getResult();
    }

    /**
     * Get curriculum by ID
     */
    public function getCurriculumById(int $id): ?Curriculum
    {
        return $this->curriculumRepository->find($id);
    }

    /**
     * Create a new curriculum
     */
    public function createCurriculum(Curriculum $curriculum): Curriculum
    {
        $curriculum->setCreatedAt(new \DateTime());
        $curriculum->setUpdatedAt(new \DateTime());

        $this->entityManager->persist($curriculum);
        $this->entityManager->flush();

        return $curriculum;
    }

    /**
     * Update an existing curriculum
     */
    public function updateCurriculum(Curriculum $curriculum): Curriculum
    {
        $curriculum->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        return $curriculum;
    }

    /**
     * Soft delete a curriculum
     */
    public function deleteCurriculum(Curriculum $curriculum): void
    {
        $curriculum->setDeletedAt(new \DateTime());
        $this->entityManager->flush();
    }

    /**
     * Toggle curriculum publish status
     */
    public function togglePublishStatus(Curriculum $curriculum): Curriculum
    {
        $curriculum->setIsPublished(!$curriculum->isPublished());
        $curriculum->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        return $curriculum;
    }

    /**
     * Get curriculum statistics
     */
    public function getCurriculumStatistics(): array
    {
        // Total curricula
        $total = $this->curriculumRepository->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.deletedAt IS NULL')
            ->getQuery()
            ->getSingleScalarResult();

        // Published curricula
        $published = $this->curriculumRepository->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.deletedAt IS NULL')
            ->andWhere('c.isPublished = :published')
            ->setParameter('published', true)
            ->getQuery()
            ->getSingleScalarResult();

        // Draft curricula
        $draft = $total - $published;

        // Recently added (last 7 days)
        $recent = $this->curriculumRepository->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.deletedAt IS NULL')
            ->andWhere('c.createdAt >= :sevenDaysAgo')
            ->setParameter('sevenDaysAgo', new \DateTime('-7 days'))
            ->getQuery()
            ->getSingleScalarResult();

        return [
            'total' => $total,
            'published' => $published,
            'draft' => $draft,
            'recent' => $recent,
        ];
    }
}
