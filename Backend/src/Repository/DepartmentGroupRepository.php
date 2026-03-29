<?php

namespace App\Repository;

use App\Entity\DepartmentGroup;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DepartmentGroup>
 */
class DepartmentGroupRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DepartmentGroup::class);
    }

    /**
     * Find all department groups with their departments
     */
    public function findAllWithDepartments(): array
    {
        return $this->createQueryBuilder('dg')
            ->leftJoin('dg.departments', 'd')
            ->addSelect('d')
            ->orderBy('dg.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find a department group by ID with its departments
     */
    public function findOneWithDepartments(int $id): ?DepartmentGroup
    {
        return $this->createQueryBuilder('dg')
            ->leftJoin('dg.departments', 'd')
            ->addSelect('d')
            ->where('dg.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
