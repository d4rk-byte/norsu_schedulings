<?php

namespace App\Repository;

use App\Entity\Curriculum;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Curriculum>
 *
 * @method Curriculum|null find($id, $lockMode = null, $lockVersion = null)
 * @method Curriculum|null findOneBy(array $criteria, array $orderBy = null)
 * @method Curriculum[]    findAll()
 * @method Curriculum[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class CurriculumRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Curriculum::class);
    }

    public function getStatistics(): array
    {
        $total = $this->count(['deletedAt' => null]);
        $published = $this->count(['isPublished' => true, 'deletedAt' => null]);
        $draft = $total - $published;
        
        $byDepartment = $this->createQueryBuilder('c')
            ->select('IDENTITY(c.department) as departmentId, COUNT(c.id) as count')
            ->where('c.deletedAt IS NULL')
            ->groupBy('c.department')
            ->getQuery()
            ->getResult();

        return [
            'total' => $total,
            'published' => $published,
            'draft' => $draft,
            'active' => $published, // Published curricula are considered active
            'by_department' => $byDepartment
        ];
    }

    public function findPublished(): array
    {
        return $this->createQueryBuilder('c')
            ->where('c.isPublished = true')
            ->andWhere('c.deletedAt IS NULL')
            ->orderBy('c.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findByDepartment(int $departmentId): array
    {
        return $this->createQueryBuilder('c')
            ->where('c.department = :departmentId')
            ->andWhere('c.deletedAt IS NULL')
            ->setParameter('departmentId', $departmentId)
            ->orderBy('c.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findDrafts(): array
    {
        return $this->createQueryBuilder('c')
            ->where('c.isPublished = false OR c.isPublished IS NULL')
            ->andWhere('c.deletedAt IS NULL')
            ->orderBy('c.updatedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    public function findByEffectiveYear(int $yearId): array
    {
        return $this->createQueryBuilder('c')
            ->where('c.effectiveYearId = :yearId')
            ->andWhere('c.deletedAt IS NULL')
            ->setParameter('yearId', $yearId)
            ->orderBy('c.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function searchCurricula(string $search): array
    {
        return $this->createQueryBuilder('c')
            ->where('c.name LIKE :search OR c.notes LIKE :search')
            ->andWhere('c.deletedAt IS NULL')
            ->setParameter('search', '%' . $search . '%')
            ->orderBy('c.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findLatestVersionByName(string $name): ?Curriculum
    {
        return $this->createQueryBuilder('c')
            ->where('c.name = :name')
            ->andWhere('c.deletedAt IS NULL')
            ->setParameter('name', $name)
            ->orderBy('c.version', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function getVersionHistory(string $name): array
    {
        return $this->createQueryBuilder('c')
            ->where('c.name = :name')
            ->andWhere('c.deletedAt IS NULL')
            ->setParameter('name', $name)
            ->orderBy('c.version', 'DESC')
            ->getQuery()
            ->getResult();
    }
}