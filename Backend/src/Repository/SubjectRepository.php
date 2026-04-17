<?php

namespace App\Repository;

use App\Entity\Subject;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Subject>
 *
 * @method Subject|null find($id, $lockMode = null, $lockVersion = null)
 * @method Subject|null findOneBy(array $criteria, array $orderBy = null)
 * @method Subject[]    findAll()
 * @method Subject[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class SubjectRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Subject::class);
    }

    /**
     * Find all active subjects
     */
    public function findActive(): array
    {
        return $this->createQueryBuilder('s')
            ->where('s.isActive = :active')
            ->andWhere('s.deletedAt IS NULL')
            ->setParameter('active', true)
            ->orderBy('s.code', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find subjects by department
     */
    public function findByDepartment(int $departmentId): array
    {
        return $this->createQueryBuilder('s')
            ->where('s.department = :departmentId')
            ->andWhere('s.deletedAt IS NULL')
            ->setParameter('departmentId', $departmentId)
            ->orderBy('s.code', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find subjects by department from published curricula only
     */
    public function findByDepartmentFromPublishedCurricula(int $departmentId): array
    {
        return $this->createQueryBuilder('s')
            ->innerJoin('App\Entity\CurriculumSubject', 'cs', 'WITH', 'cs.subject = s.id')
            ->innerJoin('cs.curriculumTerm', 'ct')
            ->innerJoin('ct.curriculum', 'c')
            ->where('s.department = :departmentId')
            ->andWhere('s.deletedAt IS NULL')
            ->andWhere('c.isPublished = :published')
            ->setParameter('departmentId', $departmentId)
            ->setParameter('published', true)
            ->groupBy('s.id')
            ->orderBy('s.code', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find subjects by department from published curricula, optionally filtered by semester.
     */
    public function findByDepartmentFromPublishedCurriculaBySemester(int $departmentId, ?string $semester = null): array
    {
        $qb = $this->createQueryBuilder('s')
            ->innerJoin('App\Entity\CurriculumSubject', 'cs', 'WITH', 'cs.subject = s.id')
            ->innerJoin('cs.curriculumTerm', 'ct')
            ->innerJoin('ct.curriculum', 'c')
            ->where('s.department = :departmentId')
            ->andWhere('s.deletedAt IS NULL')
            ->andWhere('c.isPublished = :published')
            ->setParameter('departmentId', $departmentId)
            ->setParameter('published', true)
            ->groupBy('s.id')
            ->orderBy('s.code', 'ASC');

        if ($semester) {
            $semesterVariants = $this->getSemesterVariants($semester);
            if (!empty($semesterVariants)) {
                $qb->andWhere('(ct.semester IN (:semesters) OR s.semester IN (:semesters))')
                   ->setParameter('semesters', $semesterVariants);
            }
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Build equivalent semester labels used across legacy and new records.
     */
    private function getSemesterVariants(?string $semester): array
    {
        $raw = trim((string) $semester);
        if ($raw === '' || strtolower($raw) === 'all') {
            return [];
        }

        $normalized = strtolower($raw);

        if (str_contains($normalized, '1') || str_contains($normalized, 'first')) {
            return ['1st', '1st Semester', 'First', 'First Semester'];
        }

        if (str_contains($normalized, '2') || str_contains($normalized, 'second')) {
            return ['2nd', '2nd Semester', 'Second', 'Second Semester'];
        }

        if (str_contains($normalized, 'summer')) {
            return ['Summer', 'summer'];
        }

        return [$raw];
    }

    /**
     * Find all active subjects from published curricula only
     */
    public function findActiveFromPublishedCurricula(): array
    {
        return $this->createQueryBuilder('s')
            ->innerJoin('App\Entity\CurriculumSubject', 'cs', 'WITH', 'cs.subject = s.id')
            ->innerJoin('cs.curriculumTerm', 'ct')
            ->innerJoin('ct.curriculum', 'c')
            ->where('s.isActive = :active')
            ->andWhere('s.deletedAt IS NULL')
            ->andWhere('c.isPublished = :published')
            ->setParameter('active', true)
            ->setParameter('published', true)
            ->groupBy('s.id')
            ->orderBy('s.code', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find subject by code
     */
    public function findByCode(string $code): ?Subject
    {
        return $this->createQueryBuilder('s')
            ->where('s.code = :code')
            ->andWhere('s.deletedAt IS NULL')
            ->setParameter('code', $code)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Get subject statistics
     */
    public function getStatistics(): array
    {
        $total = $this->count(['deletedAt' => null]);
        $active = $this->count(['isActive' => true, 'deletedAt' => null]);
        
        $byType = $this->createQueryBuilder('s')
            ->select('s.type, COUNT(s.id) as count')
            ->where('s.deletedAt IS NULL')
            ->groupBy('s.type')
            ->getQuery()
            ->getResult();

        $byDepartment = $this->createQueryBuilder('s')
            ->select('IDENTITY(s.department) as departmentId, COUNT(s.id) as count')
            ->where('s.deletedAt IS NULL')
            ->groupBy('s.department')
            ->getQuery()
            ->getResult();

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $total - $active,
            'by_type' => $byType,
            'by_department' => $byDepartment
        ];
    }

    /**
     * Search subjects
     */
    public function search(string $query): array
    {
        return $this->createQueryBuilder('s')
            ->where('s.code LIKE :query OR s.title LIKE :query')
            ->andWhere('s.deletedAt IS NULL')
            ->setParameter('query', '%' . $query . '%')
            ->orderBy('s.code', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Check if a subject is in any published curriculum
     */
    public function isInPublishedCurriculum(int $subjectId): bool
    {
        $result = $this->createQueryBuilder('s')
            ->select('COUNT(s.id)')
            ->innerJoin('App\Entity\CurriculumSubject', 'cs', 'WITH', 'cs.subject = s.id')
            ->innerJoin('cs.curriculumTerm', 'ct')
            ->innerJoin('ct.curriculum', 'c')
            ->where('s.id = :subjectId')
            ->andWhere('c.isPublished = :published')
            ->setParameter('subjectId', $subjectId)
            ->setParameter('published', true)
            ->getQuery()
            ->getSingleScalarResult();

        return $result > 0;
    }
}
