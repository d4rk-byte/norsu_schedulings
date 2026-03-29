<?php

namespace App\Service;

use App\Entity\Department;
use App\Repository\DepartmentRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\String\Slugger\SluggerInterface;

class DepartmentService
{
    public function __construct(
        private DepartmentRepository $departmentRepository,
        private UserRepository $userRepository,
        private EntityManagerInterface $entityManager,
        private SluggerInterface $slugger
    ) {
    }

    /**
     * Get all departments with optional filtering
     */
    public function getDepartments(array $filters = []): array
    {
        $qb = $this->departmentRepository->createQueryBuilder('d')
            ->leftJoin('d.college', 'c')
            ->addSelect('c')
            ->where('d.deletedAt IS NULL');

        // Apply filters
        if (!empty($filters['search'])) {
            $qb->andWhere('d.name LIKE :search OR d.code LIKE :search OR c.name LIKE :search')
               ->setParameter('search', '%' . $filters['search'] . '%');
        }

        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $qb->andWhere('d.isActive = :isActive')
               ->setParameter('isActive', (bool)$filters['is_active']);
        }

        if (!empty($filters['college_id'])) {
            $qb->andWhere('d.college = :collegeId')
               ->setParameter('collegeId', $filters['college_id']);
        }

        // Sorting (allow-list for safety)
        $allowedSortFields = [
            'id' => 'd.id',
            'code' => 'd.code',
            'name' => 'd.name',
            'isActive' => 'd.isActive',
            'createdAt' => 'd.createdAt',
            'updatedAt' => 'd.updatedAt',
            'college' => 'c.name',
        ];
        $sortField = (string) ($filters['sort'] ?? 'name');
        $orderBy = $allowedSortFields[$sortField] ?? 'd.name';
        $sortDir = strtoupper((string) ($filters['dir'] ?? 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $qb->orderBy($orderBy, $sortDir);

        return $qb->getQuery()->getResult();
    }

    /**
     * Get paginated departments
     */
    public function getPaginatedDepartments(array $filters = []): array
    {
        $page = $filters['page'] ?? 1;
        $limit = $filters['limit'] ?? 10;
        $offset = ($page - 1) * $limit;

        $departments = $this->getDepartments($filters);
        $total = count($departments);
        $paginatedDepartments = array_slice($departments, $offset, $limit);

        return [
            'departments' => $paginatedDepartments,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'pages' => ceil($total / $limit),
                'limit' => $limit,
                'has_previous' => $page > 1,
                'has_next' => $page < ceil($total / $limit),
            ],
        ];
    }

    /**
     * Get department by ID
     */
    public function getDepartmentById(int $id): ?Department
    {
        return $this->departmentRepository->createQueryBuilder('d')
            ->leftJoin('d.college', 'c')
            ->addSelect('c')
            ->where('d.id = :id')
            ->andWhere('d.deletedAt IS NULL')
            ->setParameter('id', $id)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Create a new department
     */
    public function createDepartment(Department $department): Department
    {
        $department->setCreatedAt(new \DateTimeImmutable());
        $department->setUpdatedAt(new \DateTimeImmutable());

        $this->entityManager->persist($department);
        $this->entityManager->flush();

        return $department;
    }

    /**
     * Update an existing department
     */
    public function updateDepartment(Department $department): Department
    {
        $department->setUpdatedAt(new \DateTimeImmutable());
        $this->entityManager->flush();

        return $department;
    }

    /**
     * Soft delete a department
     */
    public function deleteDepartment(Department $department): void
    {
        $department->setDeletedAt(new \DateTimeImmutable());
        $department->setIsActive(false);
        $this->entityManager->flush();
    }

    /**
     * Toggle department active status
     */
    public function toggleDepartmentStatus(Department $department): Department
    {
        $department->setIsActive(!$department->getIsActive());
        $department->setUpdatedAt(new \DateTimeImmutable());
        $this->entityManager->flush();

        return $department;
    }

    /**
     * Get department statistics
     */
    public function getDepartmentStatistics(): array
    {
        // Total departments
        $total = $this->departmentRepository->createQueryBuilder('d')
            ->select('COUNT(d.id)')
            ->where('d.deletedAt IS NULL')
            ->getQuery()
            ->getSingleScalarResult();

        // Active departments
        $active = $this->departmentRepository->createQueryBuilder('d')
            ->select('COUNT(d.id)')
            ->where('d.deletedAt IS NULL')
            ->andWhere('d.isActive = :active')
            ->setParameter('active', true)
            ->getQuery()
            ->getSingleScalarResult();

        // Inactive departments
        $inactive = $total - $active;

        // Recently added (last 7 days)
        $recent = $this->departmentRepository->createQueryBuilder('d')
            ->select('COUNT(d.id)')
            ->where('d.deletedAt IS NULL')
            ->andWhere('d.createdAt >= :sevenDaysAgo')
            ->setParameter('sevenDaysAgo', new \DateTimeImmutable('-7 days'))
            ->getQuery()
            ->getSingleScalarResult();

        // Departments with head
        $withHead = $this->departmentRepository->createQueryBuilder('d')
            ->select('COUNT(d.id)')
            ->where('d.deletedAt IS NULL')
            ->andWhere('d.head IS NOT NULL')
            ->getQuery()
            ->getSingleScalarResult();

        // Departments without head
        $withoutHead = $total - $withHead;

        // Total faculty across all departments
        $totalFaculty = $this->userRepository->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->where('u.deletedAt IS NULL')
            ->andWhere('u.role = :role')
            ->setParameter('role', 3) // Faculty role
            ->getQuery()
            ->getSingleScalarResult();

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $inactive,
            'recent' => $recent,
            'with_head' => $withHead,
            'without_head' => $withoutHead,
            'total_faculty' => $totalFaculty,
        ];
    }

    /**
     * Check if department code is unique
     */
    public function isCodeUnique(string $code, ?int $excludeId = null): bool
    {
        $qb = $this->departmentRepository->createQueryBuilder('d')
            ->select('COUNT(d.id)')
            ->where('d.code = :code')
            ->andWhere('d.deletedAt IS NULL')
            ->setParameter('code', $code);

        if ($excludeId) {
            $qb->andWhere('d.id != :id')
               ->setParameter('id', $excludeId);
        }

        return $qb->getQuery()->getSingleScalarResult() == 0;
    }
}
