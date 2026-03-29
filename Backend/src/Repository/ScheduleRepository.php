<?php

namespace App\Repository;

use App\Entity\Schedule;
use App\Entity\AcademicYear;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Schedule>
 */
class ScheduleRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Schedule::class);
    }

    /**
     * Find all schedules with relations
     * If academicYear and semester are provided, filter by them
     * Otherwise, returns all schedules
     */
    public function findAllWithRelations(?AcademicYear $academicYear = null, ?string $semester = null): array
    {
        $qb = $this->createQueryBuilder('s')
            ->select('s', 'subj', 'r', 'ay')
            ->join('s.subject', 'subj')
            ->join('s.room', 'r')
            ->join('s.academicYear', 'ay');

        // Filter by academic year and semester if provided
        if ($academicYear !== null) {
            $qb->andWhere('s.academicYear = :academicYear')
               ->setParameter('academicYear', $academicYear);
        }

        if ($semester !== null) {
            $qb->andWhere('s.semester = :semester')
               ->setParameter('semester', $semester);
        }

        return $qb->orderBy('s.dayPattern', 'ASC')
            ->addOrderBy('s.startTime', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find schedules by department
     * If academicYear and semester are provided, filter by them
     */
    public function findByDepartment(int $departmentId, ?AcademicYear $academicYear = null, ?string $semester = null): array
    {
        $qb = $this->createQueryBuilder('s')
            ->select('s', 'subj', 'r', 'ay', 'f')
            ->leftJoin('s.subject', 'subj')
            ->leftJoin('s.room', 'r')
            ->leftJoin('s.academicYear', 'ay')
            ->leftJoin('s.faculty', 'f')
            ->where('subj.department = :deptId')
            ->setParameter('deptId', $departmentId);

        // Filter by academic year and semester if provided
        if ($academicYear !== null) {
            $qb->andWhere('s.academicYear = :academicYear')
               ->setParameter('academicYear', $academicYear);
        }

        if ($semester !== null) {
            $qb->andWhere('s.semester = :semester')
               ->setParameter('semester', $semester);
        }

        return $qb->orderBy('s.dayPattern', 'ASC')
            ->addOrderBy('s.startTime', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find schedules by room
     */
    public function findByRoom(int $roomId, ?AcademicYear $academicYear = null, ?string $semester = null): array
    {
        $qb = $this->createQueryBuilder('s')
            ->select('s', 'subj', 'r', 'ay')
            ->join('s.subject', 'subj')
            ->join('s.room', 'r')
            ->join('s.academicYear', 'ay')
            ->where('s.room = :roomId')
            ->setParameter('roomId', $roomId);

        // Filter by academic year and semester if provided
        if ($academicYear !== null) {
            $qb->andWhere('s.academicYear = :academicYear')
               ->setParameter('academicYear', $academicYear);
        }

        if ($semester !== null) {
            $qb->andWhere('s.semester = :semester')
               ->setParameter('semester', $semester);
        }

        return $qb->orderBy('s.dayPattern', 'ASC')
            ->addOrderBy('s.startTime', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find schedules by subject
     */
    public function findBySubject(int $subjectId, ?AcademicYear $academicYear = null, ?string $semester = null): array
    {
        $qb = $this->createQueryBuilder('s')
            ->select('s', 'subj', 'r', 'ay')
            ->join('s.subject', 'subj')
            ->join('s.room', 'r')
            ->join('s.academicYear', 'ay')
            ->where('s.subject = :subjectId')
            ->setParameter('subjectId', $subjectId);

        // Filter by academic year and semester if provided
        if ($academicYear !== null) {
            $qb->andWhere('s.academicYear = :academicYear')
               ->setParameter('academicYear', $academicYear);
        }

        if ($semester !== null) {
            $qb->andWhere('s.semester = :semester')
               ->setParameter('semester', $semester);
        }

        return $qb->orderBy('s.dayPattern', 'ASC')
            ->addOrderBy('s.startTime', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Count schedules for active semester
     */
    public function countByAcademicYearAndSemester(AcademicYear $academicYear, string $semester): int
    {
        return (int) $this->createQueryBuilder('s')
            ->select('COUNT(s.id)')
            ->where('s.academicYear = :academicYear')
            ->andWhere('s.semester = :semester')
            ->setParameter('academicYear', $academicYear)
            ->setParameter('semester', $semester)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function findByFaculty(int $facultyId): array
    {
        // Faculty field has been removed from schedules
        // This method is no longer applicable
        return [];
    }
}
