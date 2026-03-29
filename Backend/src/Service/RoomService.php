<?php

namespace App\Service;

use App\Entity\Room;
use App\Repository\RoomRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\String\Slugger\SluggerInterface;

class RoomService
{
    public function __construct(
        private RoomRepository $roomRepository,
        private EntityManagerInterface $entityManager,
        private SluggerInterface $slugger
    ) {
    }

    /**
     * Get all rooms with optional filters
     */
    public function getRooms(array $filters = []): array
    {
        $queryBuilder = $this->roomRepository->createQueryBuilder('r')
            ->leftJoin('r.department', 'd')
            ->leftJoin('r.departmentGroup', 'dg')
            ->leftJoin('d.departmentGroup', 'dept_group');

        // Department filter - filter by department and its group
        if (!empty($filters['department'])) {
            $department = $filters['department'];
            $departmentGroup = $department->getDepartmentGroup();
            
            if ($departmentGroup) {
                // Room is accessible if:
                // 1. Room belongs directly to this department, OR
                // 2. Room is assigned to the department group, OR
                // 3. Room's department is in the same group
                $queryBuilder->andWhere(
                    $queryBuilder->expr()->orX(
                        $queryBuilder->expr()->eq('r.department', ':department'),
                        $queryBuilder->expr()->eq('r.departmentGroup', ':departmentGroup'),
                        $queryBuilder->expr()->eq('dept_group.id', ':groupId')
                    )
                )
                ->setParameter('department', $department)
                ->setParameter('departmentGroup', $departmentGroup)
                ->setParameter('groupId', $departmentGroup->getId());
            } else {
                // No group, only show rooms owned by this department
                $queryBuilder->andWhere('r.department = :department')
                    ->setParameter('department', $department);
            }
        }

        // Search filter
        if (!empty($filters['search'])) {
            $queryBuilder->andWhere('r.name LIKE :search OR r.code LIKE :search OR r.building LIKE :search')
                ->setParameter('search', '%' . $filters['search'] . '%');
        }

        // Active/Inactive filter
        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $queryBuilder->andWhere('r.isActive = :isActive')
                ->setParameter('isActive', (bool) $filters['is_active']);
        }

        // Type filter
        if (!empty($filters['type'])) {
            $queryBuilder->andWhere('r.type = :type')
                ->setParameter('type', $filters['type']);
        }

        // Building filter
        if (!empty($filters['building'])) {
            $queryBuilder->andWhere('r.building = :building')
                ->setParameter('building', $filters['building']);
        }

        // Sorting (allow-list for safety)
        $allowedSortFields = [
            'id' => 'r.id',
            'code' => 'r.code',
            'name' => 'r.name',
            'type' => 'r.type',
            'capacity' => 'r.capacity',
            'building' => 'r.building',
            'floor' => 'r.floor',
            'isActive' => 'r.isActive',
            'createdAt' => 'r.createdAt',
            'updatedAt' => 'r.updatedAt',
        ];
        $sortField = (string) ($filters['sort'] ?? 'name');
        $orderBy = $allowedSortFields[$sortField] ?? 'r.name';
        $sortOrder = strtoupper((string) ($filters['order'] ?? 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $queryBuilder->orderBy($orderBy, $sortOrder);

        return $queryBuilder->getQuery()->getResult();
    }

    /**
     * Get paginated rooms
     */
    public function getPaginatedRooms(array $filters = []): array
    {
        $page = max(1, $filters['page'] ?? 1);
        $limit = $filters['limit'] ?? 10;
        $offset = ($page - 1) * $limit;

        $rooms = $this->getRooms($filters);
        $total = count($rooms);
        $pages = ceil($total / $limit);

        $paginatedRooms = array_slice($rooms, $offset, $limit);

        return [
            'rooms' => $paginatedRooms,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'pages' => $pages,
                'limit' => $limit,
                'has_previous' => $page > 1,
                'has_next' => $page < $pages,
            ]
        ];
    }

    /**
     * Get room by ID
     */
    public function getRoomById(int $id): ?Room
    {
        return $this->roomRepository->find($id);
    }

    /**
     * Create a new room
     */
    public function createRoom(Room $room): Room
    {
        $room->setCreatedAt(new \DateTime());
        $room->setUpdatedAt(new \DateTime());
        
        $this->entityManager->persist($room);
        $this->entityManager->flush();

        return $room;
    }

    /**
     * Update an existing room
     */
    public function updateRoom(Room $room): Room
    {
        $room->setUpdatedAt(new \DateTime());
        
        $this->entityManager->flush();

        return $room;
    }

    /**
     * Delete a room (soft delete)
     */
    public function deleteRoom(Room $room): void
    {
        $room->setDeletedAt(new \DateTime());
        $room->setIsActive(false);
        $this->entityManager->flush();
    }

    /**
     * Toggle room status
     */
    public function toggleRoomStatus(Room $room): Room
    {
        $room->setIsActive(!$room->isActive());
        $room->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        return $room;
    }

    /**
     * Get room statistics
     */
    public function getRoomStatistics(array $filters = []): array
    {
        $queryBuilder = $this->roomRepository->createQueryBuilder('r')
            ->leftJoin('r.department', 'd')
            ->leftJoin('r.departmentGroup', 'dg')
            ->leftJoin('d.departmentGroup', 'dept_group');

        // Apply department filter if provided
        if (!empty($filters['department'])) {
            $department = $filters['department'];
            $departmentGroup = $department->getDepartmentGroup();
            
            if ($departmentGroup) {
                $queryBuilder->where(
                    $queryBuilder->expr()->orX(
                        $queryBuilder->expr()->eq('r.department', ':department'),
                        $queryBuilder->expr()->eq('r.departmentGroup', ':departmentGroup'),
                        $queryBuilder->expr()->eq('dept_group.id', ':groupId')
                    )
                )
                ->setParameter('department', $department)
                ->setParameter('departmentGroup', $departmentGroup)
                ->setParameter('groupId', $departmentGroup->getId());
            } else {
                $queryBuilder->where('r.department = :department')
                    ->setParameter('department', $department);
            }
        }

        $total = (clone $queryBuilder)->select('COUNT(r.id)')->getQuery()->getSingleScalarResult();
        
        $active = (clone $queryBuilder)
            ->select('COUNT(r.id)')
            ->andWhere('r.isActive = true')
            ->getQuery()
            ->getSingleScalarResult();
        
        $inactive = $total - $active;
        
        // Get rooms created in last 7 days
        $sevenDaysAgo = new \DateTime('-7 days');
        $recent = (clone $queryBuilder)
            ->select('COUNT(r.id)')
            ->andWhere('r.createdAt >= :date')
            ->setParameter('date', $sevenDaysAgo)
            ->getQuery()
            ->getSingleScalarResult();

        // Get room type counts
        $typeStatsQb = (clone $queryBuilder)
            ->select('r.type, COUNT(r.id) as count')
            ->andWhere('r.isActive = true')
            ->groupBy('r.type');
        $typeStats = $typeStatsQb->getQuery()->getResult();

        $typeCounts = [];
        foreach ($typeStats as $stat) {
            $typeCounts[$stat['type'] ?? 'unspecified'] = $stat['count'];
        }

        // Get building counts
        $buildingStatsQb = (clone $queryBuilder)
            ->select('r.building, COUNT(r.id) as count')
            ->andWhere('r.isActive = true')
            ->andWhere('r.building IS NOT NULL')
            ->groupBy('r.building');
        $buildingStats = $buildingStatsQb->getQuery()->getResult();

        $buildingCounts = [];
        foreach ($buildingStats as $stat) {
            $buildingCounts[$stat['building']] = $stat['count'];
        }

        // Total capacity
        $totalCapacity = (clone $queryBuilder)
            ->select('SUM(r.capacity)')
            ->andWhere('r.isActive = true')
            ->andWhere('r.capacity IS NOT NULL')
            ->getQuery()
            ->getSingleScalarResult() ?? 0;

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $inactive,
            'recent' => $recent,
            'type_counts' => $typeCounts,
            'building_counts' => $buildingCounts,
            'total_capacity' => $totalCapacity,
        ];
    }

    /**
     * Get all unique buildings
     */
    public function getAllBuildings(array $filters = []): array
    {
        $queryBuilder = $this->roomRepository->createQueryBuilder('r')
            ->leftJoin('r.department', 'd')
            ->leftJoin('r.departmentGroup', 'dg')
            ->leftJoin('d.departmentGroup', 'dept_group');

        // Apply department filter if provided
        if (!empty($filters['department'])) {
            $department = $filters['department'];
            $departmentGroup = $department->getDepartmentGroup();
            
            if ($departmentGroup) {
                $queryBuilder->where(
                    $queryBuilder->expr()->orX(
                        $queryBuilder->expr()->eq('r.department', ':department'),
                        $queryBuilder->expr()->eq('r.departmentGroup', ':departmentGroup'),
                        $queryBuilder->expr()->eq('dept_group.id', ':groupId')
                    )
                )
                ->setParameter('department', $department)
                ->setParameter('departmentGroup', $departmentGroup)
                ->setParameter('groupId', $departmentGroup->getId());
            } else {
                $queryBuilder->where('r.department = :department')
                    ->setParameter('department', $department);
            }
        }

        $buildings = $queryBuilder
            ->select('DISTINCT r.building')
            ->andWhere('r.building IS NOT NULL')
            ->orderBy('r.building', 'ASC')
            ->getQuery()
            ->getResult();

        return array_column($buildings, 'building');
    }

    /**
     * Check if room code exists
     */
    public function isCodeUnique(string $code, ?int $excludeId = null): bool
    {
        $queryBuilder = $this->roomRepository->createQueryBuilder('r');
        $queryBuilder->where('r.code = :code')
            ->setParameter('code', $code);

        if ($excludeId) {
            $queryBuilder->andWhere('r.id != :id')
                ->setParameter('id', $excludeId);
        }

        return $queryBuilder->getQuery()->getOneOrNullResult() === null;
    }
}
