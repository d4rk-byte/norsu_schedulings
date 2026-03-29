<?php

namespace App\Repository;

use App\Entity\Room;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Room>
 *
 * @method Room|null find($id, $lockMode = null, $lockVersion = null)
 * @method Room|null findOneBy(array $criteria, array $orderBy = null)
 * @method Room[]    findAll()
 * @method Room[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class RoomRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Room::class);
    }

    public function getStatistics(): array
    {
        $total = $this->count(['deletedAt' => null]);
        $active = $this->count(['isActive' => true, 'deletedAt' => null]);
        
        $byType = $this->createQueryBuilder('r')
            ->select('r.type, COUNT(r.id) as count')
            ->where('r.deletedAt IS NULL')
            ->groupBy('r.type')
            ->getQuery()
            ->getResult();

        $capacityStats = $this->createQueryBuilder('r')
            ->select('
                AVG(r.capacity) as average_capacity,
                MAX(r.capacity) as max_capacity,
                MIN(r.capacity) as min_capacity
            ')
            ->where('r.deletedAt IS NULL AND r.capacity IS NOT NULL')
            ->getQuery()
            ->getOneOrNullResult();

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $total - $active,
            'by_type' => $byType,
            'capacity_stats' => $capacityStats,
            'available' => $active // Simplified - in real system you'd check schedules
        ];
    }

    public function findByType(string $type): array
    {
        return $this->createQueryBuilder('r')
            ->where('r.type = :type')
            ->andWhere('r.deletedAt IS NULL')
            ->setParameter('type', $type)
            ->orderBy('r.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findByCapacityRange(int $min, int $max): array
    {
        return $this->createQueryBuilder('r')
            ->where('r.capacity BETWEEN :min AND :max')
            ->andWhere('r.deletedAt IS NULL')
            ->setParameter('min', $min)
            ->setParameter('max', $max)
            ->orderBy('r.capacity', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findByBuilding(string $building): array
    {
        return $this->createQueryBuilder('r')
            ->where('r.building = :building')
            ->andWhere('r.deletedAt IS NULL')
            ->setParameter('building', $building)
            ->orderBy('r.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findActive(): array
    {
        return $this->createQueryBuilder('r')
            ->where('r.isActive = true')
            ->andWhere('r.deletedAt IS NULL')
            ->orderBy('r.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findAvailable(): array
    {
        return $this->findActive(); // Simplified for now
    }

    public function searchRooms(string $search): array
    {
        return $this->createQueryBuilder('r')
            ->where('r.name LIKE :search OR r.code LIKE :search OR r.building LIKE :search')
            ->andWhere('r.deletedAt IS NULL')
            ->setParameter('search', '%' . $search . '%')
            ->orderBy('r.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function getRoomTypes(): array
    {
        $result = $this->createQueryBuilder('r')
            ->select('DISTINCT r.type')
            ->where('r.deletedAt IS NULL AND r.type IS NOT NULL')
            ->orderBy('r.type', 'ASC')
            ->getQuery()
            ->getResult();

        return array_column($result, 'type');
    }

    public function getBuildings(): array
    {
        $result = $this->createQueryBuilder('r')
            ->select('DISTINCT r.building')
            ->where('r.deletedAt IS NULL AND r.building IS NOT NULL')
            ->orderBy('r.building', 'ASC')
            ->getQuery()
            ->getResult();

        return array_column($result, 'building');
    }

    /**
     * Find rooms accessible by a specific department
     * A room is accessible if:
     * 1. It belongs directly to the department
     * 2. It belongs to the same department group as the department
     * 3. It belongs to another department that is in the same group
     */
    public function findAccessibleByDepartment(\App\Entity\Department $department): array
    {
        $qb = $this->createQueryBuilder('r')
            ->leftJoin('r.department', 'd')
            ->leftJoin('r.departmentGroup', 'dg')
            ->leftJoin('d.departmentGroup', 'dept_group')
            ->where('r.deletedAt IS NULL')
            ->andWhere('r.isActive = true');

        // Get department's group if it has one
        $departmentGroup = $department->getDepartmentGroup();

        if ($departmentGroup) {
            // Room is accessible if:
            // 1. Room belongs directly to this department, OR
            // 2. Room is assigned to the department group, OR
            // 3. Room's department is in the same group as this department
            $qb->andWhere(
                $qb->expr()->orX(
                    $qb->expr()->eq('r.department', ':department'),
                    $qb->expr()->eq('r.departmentGroup', ':departmentGroup'),
                    $qb->expr()->eq('dept_group.id', ':groupId')
                )
            )
            ->setParameter('department', $department)
            ->setParameter('departmentGroup', $departmentGroup)
            ->setParameter('groupId', $departmentGroup->getId());
        } else {
            // Department has no group, only show rooms that belong to this department
            $qb->andWhere('r.department = :department')
                ->setParameter('department', $department);
        }

        return $qb->orderBy('r.name', 'ASC')
            ->getQuery()
            ->getResult();
    }
}