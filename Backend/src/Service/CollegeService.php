<?php

namespace App\Service;

use App\Entity\College;
use App\Repository\CollegeRepository;
use App\Repository\DepartmentRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\String\Slugger\SluggerInterface;

class CollegeService
{
    private CollegeRepository $collegeRepository;
    private DepartmentRepository $departmentRepository;
    private UserRepository $userRepository;
    private EntityManagerInterface $entityManager;
    private SluggerInterface $slugger;

    public function __construct(
        CollegeRepository $collegeRepository,
        DepartmentRepository $departmentRepository,
        UserRepository $userRepository,
        EntityManagerInterface $entityManager,
        SluggerInterface $slugger
    ) {
        $this->collegeRepository = $collegeRepository;
        $this->departmentRepository = $departmentRepository;
        $this->userRepository = $userRepository;
        $this->entityManager = $entityManager;
        $this->slugger = $slugger;
    }

    /**
     * Get a college by ID
     */
    public function getCollegeById(int $id): College
    {
        $college = $this->collegeRepository->find($id);
        
        if (!$college) {
            throw new \InvalidArgumentException('College not found.');
        }
        
        return $college;
    }

    /**
     * Get colleges with filters and pagination
     */
    public function getCollegesWithFilters(array $filters = []): array
    {
        $qb = $this->collegeRepository->createQueryBuilder('c');

        // Apply search filter
        if (!empty($filters['search'])) {
            $qb->andWhere(
                $qb->expr()->orX(
                    $qb->expr()->like('c.name', ':search'),
                    $qb->expr()->like('c.code', ':search'),
                    $qb->expr()->like('c.description', ':search'),
                    $qb->expr()->like('c.dean', ':search')
                )
            );
            $qb->setParameter('search', '%' . $filters['search'] . '%');
        }

        // Apply active filter
        if (isset($filters['is_active']) && $filters['is_active'] !== null) {
            $qb->andWhere('c.isActive = :isActive')
               ->setParameter('isActive', $filters['is_active']);
        }

        // Apply sorting (allow-list for safety)
        $allowedSortFields = [
            'id' => 'c.id',
            'code' => 'c.code',
            'name' => 'c.name',
            'dean' => 'c.dean',
            'isActive' => 'c.isActive',
            'createdAt' => 'c.createdAt',
            'updatedAt' => 'c.updatedAt',
        ];
        $sortField = (string) ($filters['sort_field'] ?? 'createdAt');
        $orderBy = $allowedSortFields[$sortField] ?? 'c.createdAt';
        $sortDirection = strtoupper((string) ($filters['sort_direction'] ?? 'DESC')) === 'ASC' ? 'ASC' : 'DESC';
        $qb->orderBy($orderBy, $sortDirection);

        // Get total count
        $totalQuery = clone $qb;
        $totalCount = (int) $totalQuery->select('COUNT(c.id)')->getQuery()->getSingleScalarResult();

        // Apply pagination
        $page = $filters['page'] ?? 1;
        $limit = $filters['limit'] ?? 20;
        $offset = ($page - 1) * $limit;

        $qb->setFirstResult($offset)
           ->setMaxResults($limit);

        $colleges = $qb->getQuery()->getResult();

        return [
            'colleges' => $colleges,
            'total' => $totalCount,
            'page' => $page,
            'limit' => $limit,
            'pages' => ceil($totalCount / $limit),
            'has_previous' => $page > 1,
            'has_next' => $page < ceil($totalCount / $limit),
        ];
    }

    /**
     * Create a new college
     */
    public function createCollege(array $data): College
    {
        $college = new College();
        $this->updateCollegeFromData($college, $data);

        $this->entityManager->persist($college);
        $this->entityManager->flush();

        return $college;
    }

    /**
     * Update an existing college
     */
    public function updateCollege(College $college, array $data): College
    {
        $this->updateCollegeFromData($college, $data);
        
        $college->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        return $college;
    }

    /**
     * Delete a college (soft delete)
     */
    public function deleteCollege(College $college): void
    {
        // Check if college has departments
        $departmentCount = $this->departmentRepository->count(['college' => $college]);
        
        if ($departmentCount > 0) {
            throw new \RuntimeException(
                "Cannot delete college '{$college->getName()}' because it has {$departmentCount} department(s). " .
                "Please reassign or delete the departments first."
            );
        }

        $college->setDeletedAt(new \DateTime());
        $college->setIsActive(false);
        $this->entityManager->flush();
    }

    /**
     * Activate a college
     */
    public function activateCollege(College $college): void
    {
        $college->setIsActive(true);
        $college->setDeletedAt(null);
        $this->entityManager->flush();
    }

    /**
     * Deactivate a college
     */
    public function deactivateCollege(College $college): void
    {
        $college->setIsActive(false);
        $this->entityManager->flush();
    }

    /**
     * Get college statistics
     */
    public function getCollegeStatistics(): array
    {
        $total = $this->collegeRepository->count([]);
        $active = $this->collegeRepository->count(['isActive' => true]);
        $inactive = $total - $active;

        // Get recent colleges (last 30 days)
        $thirtyDaysAgo = new \DateTime('-30 days');
        $recent = $this->collegeRepository->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.createdAt >= :date')
            ->setParameter('date', $thirtyDaysAgo)
            ->getQuery()
            ->getSingleScalarResult();

        // Get total faculty count (role = 3 is Faculty)
        $totalFaculty = $this->userRepository->count(['role' => 3]);
        
        // Get active faculty count (role = 3 and isActive = true)
        $activeFaculty = $this->userRepository->count(['role' => 3, 'isActive' => true]);
        
        // Get total departments count
        $totalDepartments = $this->departmentRepository->count([]);
        
        // Get active departments count
        $activeDepartments = $this->departmentRepository->count(['isActive' => true]);

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $inactive,
            'recent' => $recent,
            'total_faculty' => $totalFaculty,
            'active_faculty' => $activeFaculty,
            'total_departments' => $totalDepartments,
            'active_departments' => $activeDepartments,
        ];
    }

    /**
     * Check if college code is available
     */
    public function isCodeAvailable(string $code, ?int $excludeId = null): bool
    {
        $qb = $this->collegeRepository->createQueryBuilder('c')
            ->where('c.code = :code')
            ->setParameter('code', $code);

        if ($excludeId) {
            $qb->andWhere('c.id != :id')
               ->setParameter('id', $excludeId);
        }

        return $qb->getQuery()->getOneOrNullResult() === null;
    }

    /**
     * Bulk activate colleges
     */
    public function bulkActivateColleges(array $collegeIds): int
    {
        $count = 0;
        foreach ($collegeIds as $id) {
            try {
                $college = $this->getCollegeById($id);
                $this->activateCollege($college);
                $count++;
            } catch (\Exception $e) {
                // Skip invalid IDs
                continue;
            }
        }
        return $count;
    }

    /**
     * Bulk deactivate colleges
     */
    public function bulkDeactivateColleges(array $collegeIds): int
    {
        $count = 0;
        foreach ($collegeIds as $id) {
            try {
                $college = $this->getCollegeById($id);
                $this->deactivateCollege($college);
                $count++;
            } catch (\Exception $e) {
                // Skip invalid IDs
                continue;
            }
        }
        return $count;
    }

    /**
     * Bulk delete colleges
     */
    public function bulkDeleteColleges(array $collegeIds): int
    {
        $count = 0;
        foreach ($collegeIds as $id) {
            try {
                $college = $this->getCollegeById($id);
                $this->deleteCollege($college);
                $count++;
            } catch (\Exception $e) {
                // Skip colleges with departments or invalid IDs
                continue;
            }
        }
        return $count;
    }

    /**
     * Get departments by college
     */
    public function getDepartmentsByCollege(College $college): array
    {
        return $this->departmentRepository->findBy(
            ['college' => $college, 'isActive' => true],
            ['name' => 'ASC']
        );
    }

    /**
     * Update college from data array
     */
    private function updateCollegeFromData(College $college, array $data): void
    {
        if (isset($data['code'])) {
            $college->setCode($data['code']);
        }

        if (isset($data['name'])) {
            $college->setName($data['name']);
        }

        if (isset($data['description'])) {
            $college->setDescription($data['description']);
        }

        if (array_key_exists('dean', $data)) {
            $college->setDean($data['dean']);
        }

        if (isset($data['logo'])) {
            $college->setLogo($data['logo']);
        }

        if (isset($data['isActive'])) {
            $college->setIsActive($data['isActive']);
        }
    }
}
