<?php

namespace App\Repository;

use App\Entity\College;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<College>
 *
 * @method College|null find($id, $lockMode = null, $lockVersion = null)
 * @method College|null findOneBy(array $criteria, array $orderBy = null)
 * @method College[]    findAll()
 * @method College[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class CollegeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, College::class);
    }

    /**
     * Find all active colleges
     */
    public function findActive(): array
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.isActive = :active')
            ->andWhere('c.deletedAt IS NULL')
            ->setParameter('active', true)
            ->orderBy('c.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find college by code
     */
    public function findByCode(string $code): ?College
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.code = :code')
            ->andWhere('c.deletedAt IS NULL')
            ->setParameter('code', $code)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Get college choices for forms
     */
    public function getCollegeChoices(): array
    {
        $colleges = $this->findActive();
        $choices = [];
        
        foreach ($colleges as $college) {
            $choices[$college->getName()] = $college->getId();
        }
        
        return $choices;
    }
}