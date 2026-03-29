<?php

namespace App\Repository;

use App\Entity\ActivityLog;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ActivityLog>
 */
class ActivityLogRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ActivityLog::class);
    }

    /**
     * Find recent activities
     */
    public function findRecentActivities(int $limit = 20): array
    {
        return $this->createQueryBuilder('a')
            ->leftJoin('a.user', 'u')
            ->addSelect('u')
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find activities by user
     */
    public function findByUser(User $user, int $limit = 50): array
    {
        return $this->createQueryBuilder('a')
            ->where('a.user = :user')
            ->setParameter('user', $user)
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find activities by action type
     */
    public function findByAction(string $action, int $limit = 50): array
    {
        return $this->createQueryBuilder('a')
            ->leftJoin('a.user', 'u')
            ->addSelect('u')
            ->where('a.action = :action')
            ->setParameter('action', $action)
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find a very recent duplicate action for the same user.
     */
    public function findRecentDuplicateForUser(User $user, string $action, int $windowSeconds = 5, ?string $ipAddress = null): ?ActivityLog
    {
        $windowSeconds = max(1, $windowSeconds);
        $since = (new \DateTimeImmutable())->modify(sprintf('-%d seconds', $windowSeconds));

        $qb = $this->createQueryBuilder('a')
            ->where('a.user = :user')
            ->andWhere('a.action = :action')
            ->andWhere('a.createdAt >= :since')
            ->setParameter('user', $user)
            ->setParameter('action', $action)
            ->setParameter('since', $since)
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults(1);

        if ($ipAddress !== null && $ipAddress !== '') {
            $qb->andWhere('a.ipAddress = :ipAddress')
                ->setParameter('ipAddress', $ipAddress);
        }

        return $qb->getQuery()->getOneOrNullResult();
    }

    /**
     * Find activities by entity
     */
    public function findByEntity(string $entityType, int $entityId, int $limit = 50): array
    {
        return $this->createQueryBuilder('a')
            ->leftJoin('a.user', 'u')
            ->addSelect('u')
            ->where('a.entityType = :entityType')
            ->andWhere('a.entityId = :entityId')
            ->setParameter('entityType', $entityType)
            ->setParameter('entityId', $entityId)
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find activities within date range
     */
    public function findByDateRange(\DateTimeInterface $from, \DateTimeInterface $to, int $limit = 100): array
    {
        return $this->createQueryBuilder('a')
            ->leftJoin('a.user', 'u')
            ->addSelect('u')
            ->where('a.createdAt BETWEEN :from AND :to')
            ->setParameter('from', $from)
            ->setParameter('to', $to)
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Get activity statistics
     */
    public function getActivityStats(int $days = 30): array
    {
        $fromDate = new \DateTime("-{$days} days");
        
        // Total activities
        $totalActivities = $this->createQueryBuilder('a')
            ->select('COUNT(a.id)')
            ->where('a.createdAt >= :date')
            ->setParameter('date', $fromDate)
            ->getQuery()
            ->getSingleScalarResult();

        // Activities by type
        $activitiesByType = $this->createQueryBuilder('a')
            ->select('a.action, COUNT(a.id) as count')
            ->where('a.createdAt >= :date')
            ->setParameter('date', $fromDate)
            ->groupBy('a.action')
            ->orderBy('count', 'DESC')
            ->getQuery()
            ->getResult();

        // Most active users
        $mostActiveUsers = $this->createQueryBuilder('a')
            ->select('IDENTITY(a.user) as userId, COUNT(a.id) as activityCount')
            ->where('a.createdAt >= :date')
            ->andWhere('a.user IS NOT NULL')
            ->setParameter('date', $fromDate)
            ->groupBy('a.user')
            ->orderBy('activityCount', 'DESC')
            ->setMaxResults(10)
            ->getQuery()
            ->getResult();

        return [
            'total' => (int) $totalActivities,
            'by_type' => $activitiesByType,
            'most_active_users' => $mostActiveUsers,
        ];
    }

    /**
     * Clean old activities (for maintenance)
     */
    public function cleanOldActivities(int $daysToKeep = 365): int
    {
        $cutoffDate = new \DateTime("-{$daysToKeep} days");
        
        return $this->createQueryBuilder('a')
            ->delete()
            ->where('a.createdAt < :cutoffDate')
            ->setParameter('cutoffDate', $cutoffDate)
            ->getQuery()
            ->execute();
    }

    /**
     * Find activities by multiple departments (for department groups)
     */
    public function findByDepartments(array $departments, int $page = 1, int $limit = 20): array
    {
        $offset = ($page - 1) * $limit;

        // Get all schedule IDs for all departments
        $scheduleIds = $this->getEntityManager()->createQueryBuilder()
            ->select('s.id')
            ->from(\App\Entity\Schedule::class, 's')
            ->leftJoin('s.subject', 'sub')
            ->where('sub.department IN (:depts)')
            ->setParameter('depts', $departments)
            ->getQuery()
            ->getScalarResult();
        $scheduleIds = array_column($scheduleIds, 'id');

        // Get all user IDs in all departments (faculty + department heads)
        $userIds = $this->getEntityManager()->createQueryBuilder()
            ->select('u.id')
            ->from(\App\Entity\User::class, 'u')
            ->where('u.department IN (:depts)')
            ->setParameter('depts', $departments)
            ->getQuery()
            ->getScalarResult();
        $userIds = array_column($userIds, 'id');

        // Get all room IDs in all departments
        $roomIds = $this->getEntityManager()->createQueryBuilder()
            ->select('r.id')
            ->from(\App\Entity\Room::class, 'r')
            ->where('r.department IN (:depts)')
            ->setParameter('depts', $departments)
            ->getQuery()
            ->getScalarResult();
        $roomIds = array_column($roomIds, 'id');

        // Build query to find activities related to these entities
        $qb = $this->createQueryBuilder('a')
            ->leftJoin('a.user', 'u')
            ->addSelect('u')
            ->orderBy('a.createdAt', 'DESC');

        // Include if it matches any of our entities
        $whereClauses = [];

        if (!empty($scheduleIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('Schedule')),
                $qb->expr()->in('a.entityId', $scheduleIds)
            );
        }

        if (!empty($userIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('User')),
                $qb->expr()->in('a.entityId', $userIds)
            );
        }

        if (!empty($userIds)) {
            $whereClauses[] = $qb->expr()->in('IDENTITY(a.user)', $userIds);
        }

        if (!empty($roomIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('Room')),
                $qb->expr()->in('a.entityId', $roomIds)
            );
        }

        // If we have criteria, apply them
        if (!empty($whereClauses)) {
            $qb->where($qb->expr()->orX(...$whereClauses));
        } else {
            // If no entities in these departments, return empty
            $qb->where('1 = 0');
        }

        $qb->setFirstResult($offset)->setMaxResults($limit);

        return $qb->getQuery()->getResult();
    }

    /**
     * Count activities by multiple departments
     */
    public function countByDepartments(array $departments): int
    {
        // Get all schedule IDs for all departments
        $scheduleIds = $this->getEntityManager()->createQueryBuilder()
            ->select('s.id')
            ->from(\App\Entity\Schedule::class, 's')
            ->leftJoin('s.subject', 'sub')
            ->where('sub.department IN (:depts)')
            ->setParameter('depts', $departments)
            ->getQuery()
            ->getScalarResult();
        $scheduleIds = array_column($scheduleIds, 'id');

        // Get all user IDs in all departments (faculty + department heads)
        $userIds = $this->getEntityManager()->createQueryBuilder()
            ->select('u.id')
            ->from(\App\Entity\User::class, 'u')
            ->where('u.department IN (:depts)')
            ->setParameter('depts', $departments)
            ->getQuery()
            ->getScalarResult();
        $userIds = array_column($userIds, 'id');

        // Get all room IDs in all departments
        $roomIds = $this->getEntityManager()->createQueryBuilder()
            ->select('r.id')
            ->from(\App\Entity\Room::class, 'r')
            ->where('r.department IN (:depts)')
            ->setParameter('depts', $departments)
            ->getQuery()
            ->getScalarResult();
        $roomIds = array_column($roomIds, 'id');

        $qb = $this->createQueryBuilder('a')
            ->select('COUNT(a.id)');

        $whereClauses = [];

        if (!empty($scheduleIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('Schedule')),
                $qb->expr()->in('a.entityId', $scheduleIds)
            );
        }

        if (!empty($userIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('User')),
                $qb->expr()->in('a.entityId', $userIds)
            );
        }

        if (!empty($userIds)) {
            $whereClauses[] = $qb->expr()->in('IDENTITY(a.user)', $userIds);
        }

        if (!empty($roomIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('Room')),
                $qb->expr()->in('a.entityId', $roomIds)
            );
        }

        if (!empty($whereClauses)) {
            $qb->where($qb->expr()->orX(...$whereClauses));
        } else {
            $qb->where('1 = 0');
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Find activities by department (scoped activities for department heads)
     */
    public function findByDepartment(\App\Entity\Department $department, int $page = 1, int $limit = 20): array
    {
        $offset = ($page - 1) * $limit;

        // Get all schedule IDs for this department
        $scheduleIds = $this->getEntityManager()->createQueryBuilder()
            ->select('s.id')
            ->from(\App\Entity\Schedule::class, 's')
            ->leftJoin('s.subject', 'sub')
            ->where('sub.department = :dept')
            ->setParameter('dept', $department)
            ->getQuery()
            ->getScalarResult();
        $scheduleIds = array_column($scheduleIds, 'id');

        // Get all user IDs in this department (faculty + department head)
        $userIds = $this->getEntityManager()->createQueryBuilder()
            ->select('u.id')
            ->from(\App\Entity\User::class, 'u')
            ->where('u.department = :dept')
            ->setParameter('dept', $department)
            ->getQuery()
            ->getScalarResult();
        $userIds = array_column($userIds, 'id');

        // Get all room IDs in this department
        $roomIds = $this->getEntityManager()->createQueryBuilder()
            ->select('r.id')
            ->from(\App\Entity\Room::class, 'r')
            ->where('r.department = :dept')
            ->setParameter('dept', $department)
            ->getQuery()
            ->getScalarResult();
        $roomIds = array_column($roomIds, 'id');

        // Build query to find activities related to these entities
        $qb = $this->createQueryBuilder('a')
            ->leftJoin('a.user', 'u')
            ->addSelect('u')
            ->orderBy('a.createdAt', 'DESC');

        // Include if it matches any of our entities
        $whereClauses = [];

        if (!empty($scheduleIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('Schedule')),
                $qb->expr()->in('a.entityId', $scheduleIds)
            );
        }

        if (!empty($userIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('User')),
                $qb->expr()->in('a.entityId', $userIds)
            );
        }

        if (!empty($userIds)) {
            $whereClauses[] = $qb->expr()->in('IDENTITY(a.user)', $userIds);
        }

        if (!empty($roomIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('Room')),
                $qb->expr()->in('a.entityId', $roomIds)
            );
        }

        // If we have criteria, apply them
        if (!empty($whereClauses)) {
            $qb->where($qb->expr()->orX(...$whereClauses));
        } else {
            // If no entities in this department, return empty - but use a condition that's always false
            $qb->where('1 = 0');
        }

        $qb->setFirstResult($offset)->setMaxResults($limit);

        return $qb->getQuery()->getResult();
    }

    /**
     * Count activities by department
     */
    public function countByDepartment(\App\Entity\Department $department): int
    {
        // Get all schedule IDs for this department
        $scheduleIds = $this->getEntityManager()->createQueryBuilder()
            ->select('s.id')
            ->from(\App\Entity\Schedule::class, 's')
            ->leftJoin('s.subject', 'sub')
            ->where('sub.department = :dept')
            ->setParameter('dept', $department)
            ->getQuery()
            ->getScalarResult();
        $scheduleIds = array_column($scheduleIds, 'id');

        // Get all user IDs in this department (faculty + department head)
        $userIds = $this->getEntityManager()->createQueryBuilder()
            ->select('u.id')
            ->from(\App\Entity\User::class, 'u')
            ->where('u.department = :dept')
            ->setParameter('dept', $department)
            ->getQuery()
            ->getScalarResult();
        $userIds = array_column($userIds, 'id');

        // Get all room IDs in this department
        $roomIds = $this->getEntityManager()->createQueryBuilder()
            ->select('r.id')
            ->from(\App\Entity\Room::class, 'r')
            ->where('r.department = :dept')
            ->setParameter('dept', $department)
            ->getQuery()
            ->getScalarResult();
        $roomIds = array_column($roomIds, 'id');

        $qb = $this->createQueryBuilder('a')
            ->select('COUNT(a.id)');

        $whereClauses = [];

        if (!empty($scheduleIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('Schedule')),
                $qb->expr()->in('a.entityId', $scheduleIds)
            );
        }

        if (!empty($userIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('User')),
                $qb->expr()->in('a.entityId', $userIds)
            );
        }

        if (!empty($userIds)) {
            $whereClauses[] = $qb->expr()->in('IDENTITY(a.user)', $userIds);
        }

        if (!empty($roomIds)) {
            $whereClauses[] = $qb->expr()->andX(
                $qb->expr()->eq('a.entityType', $qb->expr()->literal('Room')),
                $qb->expr()->in('a.entityId', $roomIds)
            );
        }

        if (!empty($whereClauses)) {
            $qb->where($qb->expr()->orX(...$whereClauses));
        } else {
            $qb->where('1 = 0');
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Find activities by department
     */
    public function save(ActivityLog $activityLog): void
    {
        $this->getEntityManager()->persist($activityLog);
        $this->getEntityManager()->flush();
    }
}
