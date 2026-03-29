<?php

namespace App\Repository;

use App\Entity\AcademicYear;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AcademicYear>
 */
class AcademicYearRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AcademicYear::class);
    }

    public function save(AcademicYear $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(AcademicYear $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Find all active academic years (not soft deleted)
     */
    public function findActive(): array
    {
        return $this->createQueryBuilder('ay')
            ->where('ay.deletedAt IS NULL')
            ->andWhere('ay.isActive = :active')
            ->setParameter('active', true)
            ->orderBy('ay.startDate', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find the current academic year
     */
    public function findCurrent(): ?AcademicYear
    {
        return $this->createQueryBuilder('ay')
            ->where('ay.deletedAt IS NULL')
            ->andWhere('ay.isCurrent = :current')
            ->setParameter('current', true)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Find academic year by year string
     */
    public function findByYear(string $year): ?AcademicYear
    {
        return $this->createQueryBuilder('ay')
            ->where('ay.year = :year')
            ->andWhere('ay.deletedAt IS NULL')
            ->setParameter('year', $year)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Find all academic years (including deleted) with filters
     */
    public function findWithFilters(array $filters = []): array
    {
        $qb = $this->createQueryBuilder('ay')
            ->where('ay.deletedAt IS NULL');

        // Filter by active status
        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $qb->andWhere('ay.isActive = :isActive')
               ->setParameter('isActive', (bool)$filters['is_active']);
        }

        // Filter by current status
        if (isset($filters['is_current']) && $filters['is_current'] !== '') {
            $qb->andWhere('ay.isCurrent = :isCurrent')
               ->setParameter('isCurrent', (bool)$filters['is_current']);
        }

        // Search by year
        if (!empty($filters['search'])) {
            $qb->andWhere('ay.year LIKE :search')
               ->setParameter('search', '%' . $filters['search'] . '%');
        }

        // Sorting (allow-list to avoid injecting column fragments)
        $allowedSortFields = [
            'id' => 'ay.id',
            'year' => 'ay.year',
            'startDate' => 'ay.startDate',
            'endDate' => 'ay.endDate',
            'isActive' => 'ay.isActive',
            'isCurrent' => 'ay.isCurrent',
            'createdAt' => 'ay.createdAt',
            'updatedAt' => 'ay.updatedAt',
        ];
        $sortField = (string) ($filters['sort_field'] ?? 'startDate');
        $orderBy = $allowedSortFields[$sortField] ?? 'ay.startDate';
        $sortDir = strtoupper((string) ($filters['sort_direction'] ?? 'DESC')) === 'ASC' ? 'ASC' : 'DESC';
        $qb->orderBy($orderBy, $sortDir);

        return $qb->getQuery()->getResult();
    }

    /**
     * Count active academic years
     */
    public function countActive(): int
    {
        return $this->createQueryBuilder('ay')
            ->select('COUNT(ay.id)')
            ->where('ay.deletedAt IS NULL')
            ->andWhere('ay.isActive = :active')
            ->setParameter('active', true)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Get statistics
     */
    public function getStatistics(): array
    {
        $qb = $this->createQueryBuilder('ay')
            ->where('ay.deletedAt IS NULL');

        $all = $qb->getQuery()->getResult();

        $active = count(array_filter($all, fn($ay) => $ay->isActive()));
        $current = count(array_filter($all, fn($ay) => $ay->isCurrent()));

        return [
            'total' => count($all),
            'active' => $active,
            'inactive' => count($all) - $active,
            'current' => $current,
        ];
    }

    /**
     * Find upcoming academic years
     */
    public function findUpcoming(): array
    {
        $now = new \DateTime();
        
        return $this->createQueryBuilder('ay')
            ->where('ay.deletedAt IS NULL')
            ->andWhere('ay.isActive = :active')
            ->andWhere('ay.startDate > :now')
            ->setParameter('active', true)
            ->setParameter('now', $now)
            ->orderBy('ay.startDate', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find past academic years
     */
    public function findPast(): array
    {
        $now = new \DateTime();
        
        return $this->createQueryBuilder('ay')
            ->where('ay.deletedAt IS NULL')
            ->andWhere('ay.endDate < :now')
            ->setParameter('now', $now)
            ->orderBy('ay.endDate', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
