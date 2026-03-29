<?php

namespace App\Repository;

use App\Entity\Department;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Department>
 */
class DepartmentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Department::class);
    }

    public function save(Department $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(Department $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Find all active departments (not soft deleted)
     */
    public function findActive(): array
    {
        return $this->createQueryBuilder('d')
            ->where('d.isActive = :active')
            ->andWhere('d.deletedAt IS NULL')
            ->setParameter('active', true)
            ->orderBy('d.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find departments by college
     */
    public function findByCollege(int $collegeId): array
    {
        return $this->createQueryBuilder('d')
            ->where('d.college = :collegeId')
            ->andWhere('d.isActive = :active')
            ->andWhere('d.deletedAt IS NULL')
            ->setParameter('collegeId', $collegeId)
            ->setParameter('active', true)
            ->orderBy('d.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find department by code
     */
    public function findByCode(string $code): ?Department
    {
        return $this->createQueryBuilder('d')
            ->where('d.code = :code')
            ->andWhere('d.deletedAt IS NULL')
            ->setParameter('code', $code)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Get departments for form choices
     */
    public function getDepartmentChoices(): array
    {
        $departments = $this->findActive();
        $choices = [];
        
        foreach ($departments as $department) {
            $choices[$department->getName()] = $department->getId();
        }
        
        return $choices;
    }

    /**
     * Get departments grouped by college for form choices
     */
    public function getDepartmentChoicesByCollege(): array
    {
        $departments = $this->createQueryBuilder('d')
            ->leftJoin('d.college', 'c')
            ->where('d.isActive = :active')
            ->andWhere('d.deletedAt IS NULL')
            ->andWhere('c.isActive = :active')
            ->andWhere('c.deletedAt IS NULL')
            ->setParameter('active', true)
            ->orderBy('c.name', 'ASC')
            ->addOrderBy('d.name', 'ASC')
            ->getQuery()
            ->getResult();

        $choices = [];
        
        foreach ($departments as $department) {
            $collegeName = $department->getCollege() ? $department->getCollege()->getName() : 'Other';
            $choices[$collegeName][$department->getName()] = $department->getId();
        }
        
        return $choices;
    }
}