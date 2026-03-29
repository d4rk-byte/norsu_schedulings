<?php

namespace App\Repository;

use App\Entity\CurriculumSubject;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CurriculumSubject>
 */
class CurriculumSubjectRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CurriculumSubject::class);
    }

    public function save(CurriculumSubject $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(CurriculumSubject $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Find all subjects for a specific curriculum term
     *
     * @param int $termId
     * @return CurriculumSubject[]
     */
    public function findByCurriculumTerm(int $termId): array
    {
        return $this->createQueryBuilder('cs')
            ->join('cs.subject', 's')
            ->where('cs.curriculumTerm = :termId')
            ->setParameter('termId', $termId)
            ->orderBy('s.code', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find all subjects for a curriculum
     *
     * @param int $curriculumId
     * @return CurriculumSubject[]
     */
    public function findByCurriculum(int $curriculumId): array
    {
        return $this->createQueryBuilder('cs')
            ->join('cs.subject', 's')
            ->join('cs.curriculumTerm', 'ct')
            ->where('ct.curriculum = :curriculumId')
            ->setParameter('curriculumId', $curriculumId)
            ->orderBy('s.code', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Check if a subject is already in a term
     *
     * @param int $termId
     * @param int $subjectId
     * @return bool
     */
    public function isSubjectInTerm(int $termId, int $subjectId): bool
    {
        $count = $this->createQueryBuilder('cs')
            ->select('COUNT(cs.id)')
            ->where('cs.curriculumTerm = :termId')
            ->andWhere('cs.subject = :subjectId')
            ->setParameter('termId', $termId)
            ->setParameter('subjectId', $subjectId)
            ->getQuery()
            ->getSingleScalarResult();

        return $count > 0;
    }

    /**
     * Get total units for a curriculum
     *
     * @param int $curriculumId
     * @return float
     */
    public function getTotalUnitsByCurriculum(int $curriculumId): float
    {
        $result = $this->createQueryBuilder('cs')
            ->select('SUM(s.units) as total_units')
            ->join('cs.subject', 's')
            ->join('cs.curriculumTerm', 'ct')
            ->where('ct.curriculum = :curriculumId')
            ->setParameter('curriculumId', $curriculumId)
            ->getQuery()
            ->getSingleScalarResult();

        return $result ? (float) $result : 0.0;
    }
}
