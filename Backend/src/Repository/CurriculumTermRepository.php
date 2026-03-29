<?php

namespace App\Repository;

use App\Entity\CurriculumTerm;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CurriculumTerm>
 */
class CurriculumTermRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CurriculumTerm::class);
    }

    public function save(CurriculumTerm $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(CurriculumTerm $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Find all terms for a specific curriculum
     *
     * @param int $curriculumId
     * @return CurriculumTerm[]
     */
    public function findByCurriculum(int $curriculumId): array
    {
        return $this->createQueryBuilder('ct')
            ->where('ct.curriculum = :curriculumId')
            ->setParameter('curriculumId', $curriculumId)
            ->orderBy('ct.year_level', 'ASC')
            ->addOrderBy('ct.semester', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find term by year and semester
     *
     * @param int $curriculumId
     * @param int $yearLevel
     * @param string $semester
     * @return CurriculumTerm|null
     */
    public function findByYearAndSemester(int $curriculumId, int $yearLevel, string $semester): ?CurriculumTerm
    {
        return $this->createQueryBuilder('ct')
            ->where('ct.curriculum = :curriculumId')
            ->andWhere('ct.year_level = :yearLevel')
            ->andWhere('ct.semester = :semester')
            ->setParameter('curriculumId', $curriculumId)
            ->setParameter('yearLevel', $yearLevel)
            ->setParameter('semester', $semester)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Get terms with subject count
     *
     * @param int $curriculumId
     * @return array
     */
    public function getTermsWithSubjectCount(int $curriculumId): array
    {
        return $this->createQueryBuilder('ct')
            ->select('ct', 'COUNT(cs.id) as subject_count')
            ->leftJoin('ct.curriculumSubjects', 'cs')
            ->where('ct.curriculum = :curriculumId')
            ->setParameter('curriculumId', $curriculumId)
            ->groupBy('ct.id')
            ->orderBy('ct.year_level', 'ASC')
            ->addOrderBy('ct.semester', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
