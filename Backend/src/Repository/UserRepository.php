<?php

namespace App\Repository;

use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\PasswordUpgraderInterface;

/**
 * @extends ServiceEntityRepository<User>
 */
class UserRepository extends ServiceEntityRepository implements PasswordUpgraderInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }

    /**
     * Used to upgrade (rehash) the user's password automatically over time.
     */
    public function upgradePassword(PasswordAuthenticatedUserInterface $user, string $newHashedPassword): void
    {
        if (!$user instanceof User) {
            throw new UnsupportedUserException(sprintf('Instances of "%s" are not supported.', $user::class));
        }

        $user->setPassword($newHashedPassword);
        // Set updated timestamp
        $user->setUpdatedAt(new \DateTime());

        $this->getEntityManager()->persist($user);
        $this->getEntityManager()->flush();
    }

    /**
     * Find user by email or username (excluding soft-deleted)
     */
    public function findByEmailOrUsername(string $identifier): ?User
    {
        return $this->createQueryBuilder('u')
            ->andWhere('u.email = :identifier OR u.username = :identifier')
            ->andWhere('u.deletedAt IS NULL')
            ->setParameter('identifier', $identifier)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Find active users by role (integer value, excluding soft-deleted)
     */
    public function findActiveUsersByRole(int $role): array
    {
        return $this->createQueryBuilder('u')
            ->andWhere('u.role = :role')
            ->andWhere('u.isActive = :active')
            ->andWhere('u.deletedAt IS NULL')
            ->setParameter('role', $role)
            ->setParameter('active', true)
            ->orderBy('u.firstName', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find users by department (excluding soft-deleted)
     */
    public function findByDepartment(int $departmentId): array
    {
        return $this->createQueryBuilder('u')
            ->andWhere('u.departmentId = :departmentId')
            ->andWhere('u.isActive = :active')
            ->andWhere('u.deletedAt IS NULL')
            ->setParameter('departmentId', $departmentId)
            ->setParameter('active', true)
            ->orderBy('u.firstName', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Count users by role
     */
    public function countUsersByRole(): array
    {
        $result = $this->createQueryBuilder('u')
            ->select('u.role, COUNT(u.id) as count')
            ->andWhere('u.isActive = :active')
            ->andWhere('u.deletedAt IS NULL')
            ->setParameter('active', true)
            ->groupBy('u.role')
            ->getQuery()
            ->getResult();

        // Format result as associative array
        $counts = [];
        foreach ($result as $row) {
            $counts[$row['role']] = (int) $row['count'];
        }

        return $counts;
    }

    /**
     * Find users with pagination and filtering
     */
    public function findUsersWithFilters(
        int $page = 1,
        int $limit = 20,
        ?string $search = null,
        ?int $role = null,
        ?bool $isActive = null,
        ?int $collegeId = null,
        ?array $departmentIds = null,
        bool $includeDeleted = false,
        string $sortField = 'createdAt',
        string $sortDirection = 'DESC'
    ): array {
        $qb = $this->createQueryBuilder('u');

        // Join with department and college for filtering and sorting
        $qb->leftJoin('u.department', 'd')
           ->leftJoin('d.college', 'c');

        // Exclude soft-deleted users unless explicitly requested
        if (!$includeDeleted) {
            $qb->andWhere('u.deletedAt IS NULL');
        }

        // Apply search filter
        if ($search) {
            $qb->andWhere($qb->expr()->orX(
                $qb->expr()->like('u.username', ':search'),
                $qb->expr()->like('u.firstName', ':search'),
                $qb->expr()->like('u.lastName', ':search'),
                $qb->expr()->like('u.email', ':search'),
                $qb->expr()->like('u.employeeId', ':search'),
                $qb->expr()->like('u.position', ':search')
            ))->setParameter('search', '%' . $search . '%');
        }

        // Apply role filter
        if ($role !== null) {
            $qb->andWhere('u.role = :role')
               ->setParameter('role', $role);
        }

        // Apply active status filter
        if ($isActive !== null) {
            $qb->andWhere('u.isActive = :isActive')
               ->setParameter('isActive', $isActive);
        }

        // Apply college filter
        if ($collegeId !== null) {
            $qb->andWhere('c.id = :collegeId')
               ->setParameter('collegeId', $collegeId);
        }

        // Apply department filter (supports group-aware array of IDs)
        if ($departmentIds !== null && count($departmentIds) > 0) {
            $qb->andWhere('d.id IN (:departmentIds)')
               ->setParameter('departmentIds', $departmentIds);
        }

        // Apply sorting
        $allowedSortFields = ['id', 'username', 'firstName', 'lastName', 'email', 'role', 'createdAt', 'lastLogin', 'department'];
        if (in_array($sortField, $allowedSortFields)) {
            if ($sortField === 'department') {
                // Sort by department name
                $qb->orderBy('d.name', strtoupper($sortDirection) === 'DESC' ? 'DESC' : 'ASC');
            } else {
                $qb->orderBy('u.' . $sortField, strtoupper($sortDirection) === 'DESC' ? 'DESC' : 'ASC');
            }
        }

        // Add secondary sort by ID for consistency
        $qb->addOrderBy('u.id', 'DESC');

        // Calculate offset
        $offset = ($page - 1) * $limit;

        // Get total count
        $totalQuery = clone $qb;
        $total = $totalQuery->select('COUNT(u.id)')
                           ->getQuery()
                           ->getSingleScalarResult();

        // Apply pagination
        $users = $qb->setFirstResult($offset)
                   ->setMaxResults($limit)
                   ->getQuery()
                   ->getResult();

        return [
            'users' => $users,
            'total' => (int) $total,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => ceil($total / $limit),
            'hasNext' => $page < ceil($total / $limit),
            'hasPrev' => $page > 1
        ];
    }

    /**
     * Find user by employee ID (excluding soft-deleted)
     */
    public function findByEmployeeId(string $employeeId): ?User
    {
        return $this->createQueryBuilder('u')
            ->andWhere('u.employeeId = :employeeId')
            ->andWhere('u.deletedAt IS NULL')
            ->setParameter('employeeId', $employeeId)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Get users count statistics
     */
    public function getUserStatistics(): array
    {
        $qb = $this->createQueryBuilder('u');
        
        // Total users (excluding soft-deleted)
        $totalUsers = $qb->select('COUNT(u.id)')
                         ->andWhere('u.deletedAt IS NULL')
                         ->getQuery()
                         ->getSingleScalarResult();

        // Active users (excluding soft-deleted)
        $qb = $this->createQueryBuilder('u');
        $activeUsers = $qb->select('COUNT(u.id)')
                         ->andWhere('u.isActive = :active')
                         ->andWhere('u.deletedAt IS NULL')
                         ->setParameter('active', true)
                         ->getQuery()
                         ->getSingleScalarResult();

        // Users by role (excluding soft-deleted)
        $roleStats = $this->countUsersByRole();

        // Recent users (last 30 days, excluding soft-deleted)
        $qb = $this->createQueryBuilder('u');
        $recentUsers = $qb->select('COUNT(u.id)')
                         ->andWhere('u.createdAt >= :date')
                         ->andWhere('u.deletedAt IS NULL')
                         ->setParameter('date', new \DateTime('-30 days'))
                         ->getQuery()
                         ->getSingleScalarResult();

        return [
            'total' => (int) $totalUsers,
            'active' => (int) $activeUsers,
            'inactive' => (int) $totalUsers - (int) $activeUsers,
            'recent' => (int) $recentUsers,
            'by_role' => $roleStats,
            'admins' => $roleStats[1] ?? 0,
            'department_heads' => $roleStats[2] ?? 0,
            'faculty' => $roleStats[3] ?? 0,
        ];
    }

    /**
     * Soft delete user (set deleted_at timestamp)
     */
    public function softDelete(User $user): void
    {
        $user->setDeletedAt(new \DateTime());
        $user->setIsActive(false);
        $user->setUpdatedAt(new \DateTime());

        $this->getEntityManager()->persist($user);
        $this->getEntityManager()->flush();
    }

    /**
     * Hard delete user (permanently remove from database)
     */
    public function hardDelete(User $user): void
    {
        $this->getEntityManager()->remove($user);
        $this->getEntityManager()->flush();
    }

    /**
     * Restore soft deleted user
     */
    public function restore(User $user): void
    {
        $user->setDeletedAt(null);
        $user->setIsActive(true);
        $user->setUpdatedAt(new \DateTime());

        $this->getEntityManager()->persist($user);
        $this->getEntityManager()->flush();
    }

    /**
     * Update last login timestamp
     */
    public function updateLastLogin(User $user): void
    {
        $user->setLastLogin(new \DateTime());
        $this->getEntityManager()->persist($user);
        $this->getEntityManager()->flush();
    }

    /**
     * Find recently active users
     */
    public function findRecentlyActive(int $days = 30): array
    {
        return $this->createQueryBuilder('u')
            ->andWhere('u.lastLogin >= :date')
            ->andWhere('u.isActive = :active')
            ->setParameter('date', new \DateTime("-{$days} days"))
            ->setParameter('active', true)
            ->orderBy('u.lastLogin', 'DESC')
            ->getQuery()
            ->getResult();
    }
}