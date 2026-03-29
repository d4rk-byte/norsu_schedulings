<?php

namespace App\Service;

use App\Entity\User;
use App\Entity\Room;
use App\Repository\UserRepository;
use App\Repository\CurriculumRepository;
use App\Repository\DepartmentRepository;
use App\Repository\RoomRepository;
use App\Repository\ScheduleRepository;
use App\Repository\ActivityLogRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Security\Core\Exception\AccessDeniedException;
use App\Service\SystemSettingsService;

class DepartmentHeadService
{
    private UserRepository $userRepository;
    private CurriculumRepository $curriculumRepository;
    private DepartmentRepository $departmentRepository;
    private RoomRepository $roomRepository;
    private ScheduleRepository $scheduleRepository;
    private ActivityLogRepository $activityLogRepository;
    private EntityManagerInterface $entityManager;
    private SystemSettingsService $systemSettingsService;
    private ScheduleConflictDetector $conflictDetector;

    public function __construct(
        UserRepository $userRepository,
        CurriculumRepository $curriculumRepository,
        DepartmentRepository $departmentRepository,
        RoomRepository $roomRepository,
        ScheduleRepository $scheduleRepository,
        ActivityLogRepository $activityLogRepository,
        EntityManagerInterface $entityManager,
        SystemSettingsService $systemSettingsService,
        ScheduleConflictDetector $conflictDetector
    ) {
        $this->userRepository = $userRepository;
        $this->curriculumRepository = $curriculumRepository;
        $this->departmentRepository = $departmentRepository;
        $this->roomRepository = $roomRepository;
        $this->scheduleRepository = $scheduleRepository;
        $this->activityLogRepository = $activityLogRepository;
        $this->entityManager = $entityManager;
        $this->systemSettingsService = $systemSettingsService;
        $this->conflictDetector = $conflictDetector;
    }

    /**
     * Get all managed departments (primary + grouped departments)
     */
    private function getManagedDepartments(int $departmentId): array
    {
        $department = $this->departmentRepository->find($departmentId);
        if (!$department) {
            return [];
        }

        $departments = [$department];

        // If department is part of a group, add all group departments
        if ($department->getDepartmentGroup()) {
            $groupDepartments = $department->getDepartmentGroup()->getDepartments();
            foreach ($groupDepartments as $groupDept) {
                if ($groupDept->getId() !== $departmentId) {
                    $departments[] = $groupDept;
                }
            }
        }

        return $departments;
    }

    /**
     * Get managed department IDs
     */
    private function getManagedDepartmentIds(int $departmentId): array
    {
        return array_map(fn($dept) => $dept->getId(), $this->getManagedDepartments($departmentId));
    }

    /**
     * Get department head's dashboard data
     */
    public function getDashboardData(User $departmentHead, ?\App\Entity\AcademicYear $academicYear = null, ?string $semester = null): array
    {
        $this->validateDepartmentHead($departmentHead);
        $departmentId = $departmentHead->getDepartmentId();

        if (!$departmentId) {
            throw new \RuntimeException('Department Head has no assigned department.');
        }

        $department = $this->departmentRepository->find($departmentId);
        $managedDepartments = $this->getManagedDepartments($departmentId);
        $managedDeptIds = $this->getManagedDepartmentIds($departmentId);

        // Use selected filter if provided; otherwise fallback to system-wide active period.
        $activeAcademicYear = $academicYear ?: $this->systemSettingsService->getActiveAcademicYear();
        $activeSemester = $semester ?: $this->systemSettingsService->getActiveSemester();

        // Scan and update conflict status for all schedules in managed departments
        foreach ($managedDeptIds as $deptId) {
            $this->conflictDetector->scanAndUpdateAllConflicts($deptId);
        }

        // Get faculty count across all managed departments
        $totalFaculty = $this->userRepository->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:deptIds)')
            ->setParameter('role', 3)
            ->setParameter('deptIds', $managedDeptIds)
            ->getQuery()
            ->getSingleScalarResult();

        // Get active faculty count
        $activeFaculty = $this->userRepository->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:deptIds)')
            ->andWhere('u.isActive = :active')
            ->setParameter('role', 3)
            ->setParameter('deptIds', $managedDeptIds)
            ->setParameter('active', true)
            ->getQuery()
            ->getSingleScalarResult();

        // Get recent faculty (last 30 days)
        $thirtyDaysAgo = new \DateTime('-30 days');
        $recentFacultyCount = $this->userRepository->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:deptIds)')
            ->andWhere('u.createdAt >= :date')
            ->setParameter('role', 3)
            ->setParameter('deptIds', $managedDeptIds)
            ->setParameter('date', $thirtyDaysAgo)
            ->getQuery()
            ->getSingleScalarResult();

        // Get faculty created this month
        $thisMonthStart = new \DateTime('first day of this month 00:00:00');
        $thisMonthFaculty = $this->userRepository->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:deptIds)')
            ->andWhere('u.createdAt >= :date')
            ->setParameter('role', 3)
            ->setParameter('deptIds', $managedDeptIds)
            ->setParameter('date', $thisMonthStart)
            ->getQuery()
            ->getSingleScalarResult();

        // Get recent faculty list
        $recentFaculty = $this->userRepository->createQueryBuilder('u')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:deptIds)')
            ->setParameter('role', 3)
            ->setParameter('deptIds', $managedDeptIds)
            ->orderBy('u.createdAt', 'DESC')
            ->setMaxResults(5)
            ->getQuery()
            ->getResult();

        // Get curriculum statistics for own department only
        $totalCurricula = $this->curriculumRepository->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.department = :deptId')
            ->setParameter('deptId', $departmentId)
            ->getQuery()
            ->getSingleScalarResult();

        $publishedCurricula = $this->curriculumRepository->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.department = :deptId')
            ->andWhere('c.isPublished = :published')
            ->setParameter('deptId', $departmentId)
            ->setParameter('published', true)
            ->getQuery()
            ->getSingleScalarResult();

        // Get schedule statistics for all managed departments (filtered by active semester)
        $qb = $this->scheduleRepository->createQueryBuilder('s')
            ->select('COUNT(s.id)')
            ->join('s.subject', 'subj')
            ->where('subj.department IN (:deptIds)')
            ->setParameter('deptIds', $managedDeptIds);

        if ($activeAcademicYear && $activeSemester) {
            $qb->andWhere('s.academicYear = :academicYear')
               ->andWhere('s.semester = :semester')
               ->setParameter('academicYear', $activeAcademicYear)
               ->setParameter('semester', $activeSemester);
        }

        $totalSchedules = $qb->getQuery()->getSingleScalarResult();

        $qb = $this->scheduleRepository->createQueryBuilder('s')
            ->select('COUNT(s.id)')
            ->join('s.subject', 'subj')
            ->where('subj.department IN (:deptIds)')
            ->andWhere('s.status = :status')
            ->setParameter('deptIds', $managedDeptIds)
            ->setParameter('status', 'active');

        if ($activeAcademicYear && $activeSemester) {
            $qb->andWhere('s.academicYear = :academicYear')
               ->andWhere('s.semester = :semester')
               ->setParameter('academicYear', $activeAcademicYear)
               ->setParameter('semester', $activeSemester);
        }

        $activeSchedules = $qb->getQuery()->getSingleScalarResult();

        $qb = $this->scheduleRepository->createQueryBuilder('s')
            ->select('COUNT(s.id)')
            ->join('s.subject', 'subj')
            ->where('subj.department IN (:deptIds)')
            ->andWhere('s.isConflicted = :conflicted')
            ->setParameter('deptIds', $managedDeptIds)
            ->setParameter('conflicted', true);

        if ($activeAcademicYear && $activeSemester) {
            $qb->andWhere('s.academicYear = :academicYear')
               ->andWhere('s.semester = :semester')
               ->setParameter('academicYear', $activeAcademicYear)
               ->setParameter('semester', $activeSemester);
        }

        $conflictedSchedules = $qb->getQuery()->getSingleScalarResult();

        // Get room statistics
        $totalRooms = $this->roomRepository->createQueryBuilder('r')
            ->select('COUNT(r.id)')
            ->where('r.department IN (:deptIds)')
            ->setParameter('deptIds', $managedDeptIds)
            ->getQuery()
            ->getSingleScalarResult();

        // Calculate room utilization (percentage of rooms with active schedules)
        $qb = $this->scheduleRepository->createQueryBuilder('s')
            ->select('COUNT(DISTINCT r.id)')
            ->join('s.room', 'r')
            ->join('s.subject', 'subj')
            ->where('subj.department IN (:deptIds)')
            ->andWhere('s.status = :status')
            ->setParameter('deptIds', $managedDeptIds)
            ->setParameter('status', 'active');
        
        if ($activeAcademicYear && $activeSemester) {
            $qb->andWhere('s.academicYear = :academicYear')
               ->andWhere('s.semester = :semester')
               ->setParameter('academicYear', $activeAcademicYear)
               ->setParameter('semester', $activeSemester);
        }
        
        $roomsWithSchedules = $qb->getQuery()->getSingleScalarResult();

        $roomUtilization = $totalRooms > 0 ? round(($roomsWithSchedules / $totalRooms) * 100) : 0;

        // Get all active faculty in the department
        $allFaculty = $this->userRepository->createQueryBuilder('u')
            ->select('u')
            ->where('u.role = :role')
            ->andWhere('u.department = :deptId')
            ->andWhere('u.isActive = :active')
            ->setParameter('role', 3)
            ->setParameter('deptId', $departmentId)
            ->setParameter('active', true)
            ->getQuery()
            ->getResult();

        // Calculate teaching load units for all faculty
        $facultyLoads = [];
        foreach ($allFaculty as $faculty) {
            $qb = $this->scheduleRepository->createQueryBuilder('s')
                ->where('s.faculty = :facultyId')
                ->andWhere('s.status = :status')
                ->setParameter('facultyId', $faculty->getId())
                ->setParameter('status', 'active');
            
            if ($activeAcademicYear && $activeSemester) {
                $qb->andWhere('s.academicYear = :academicYear')
                   ->andWhere('s.semester = :semester')
                   ->setParameter('academicYear', $activeAcademicYear)
                   ->setParameter('semester', $activeSemester);
            }
            
            $schedules = $qb->getQuery()->getResult();

            $totalUnits = 0;
            foreach ($schedules as $schedule) {
                $subject = $schedule->getSubject();
                if ($subject) {
                    $totalUnits += (int) ($subject->getUnits() ?? 0);
                }
            }

            $facultyLoads[] = [
                'faculty' => $faculty,
                'current_load' => $totalUnits,
                'max_load' => 21,
                'percentage' => $totalUnits > 0 ? round(($totalUnits / 21) * 100) : 0
            ];
        }

        // Sort faculty by workload percentage (highest first) to show most loaded faculty
        usort($facultyLoads, function($a, $b) {
            return $b['percentage'] <=> $a['percentage'];
        });

        // Limit to top 5 faculty by workload for dashboard display
        $facultyLoads = array_slice($facultyLoads, 0, 5);

        // Gather recent activities from multiple sources
        $recentActivities = [];

        // Get actual activity logs for this department
        try {
            if (!empty($managedDepartments)) {
                $dbActivities = $this->activityLogRepository->findByDepartments($managedDepartments, 1, 10);

                if (!empty($dbActivities)) {
                    foreach ($dbActivities as $activity) {
                        $recentActivities[] = [
                            'type' => $activity->getAction(),
                            'title' => $activity->getAction(),
                            'description' => $activity->getDescription(),
                            'date' => $activity->getCreatedAt(),
                            'icon' => 'activity'
                        ];
                    }
                } else {
                    // If no database activities, show system message
                    $recentActivities[] = [
                        'type' => 'system_notice',
                        'title' => 'No activities yet',
                        'description' => 'Activities will appear here as you make changes in your department (assignments, schedule updates, etc.)',
                        'date' => new \DateTime(),
                        'icon' => 'info'
                    ];
                }
            }
        } catch (\Exception $e) {
            // If there's an error fetching from DB, show a system message
            $recentActivities[] = [
                'type' => 'system_notice',
                'title' => 'Activities loading',
                'description' => 'Real-time activities will appear here as you use the system',
                'date' => new \DateTime(),
                'icon' => 'info'
            ];
        }

        // Get detailed conflict information for active semester
        $conflictDetails = $this->conflictDetector->getConflictedSchedulesWithDetails(
            $departmentId,
            $activeAcademicYear,
            $activeSemester
        );

        return [
            'department' => $department,
            'total_faculty' => $totalFaculty,
            'active_faculty' => $activeFaculty,
            'inactive_faculty' => $totalFaculty - $activeFaculty,
            'recent_faculty_count' => $recentFacultyCount,
            'this_month_faculty' => $thisMonthFaculty,
            'recent_faculty' => $recentFaculty,
            'total_curricula' => $totalCurricula,
            'published_curricula' => $publishedCurricula,
            'draft_curricula' => $totalCurricula - $publishedCurricula,
            'total_schedules' => $totalSchedules,
            'active_schedules' => $activeSchedules,
            'conflicted_schedules' => $conflictedSchedules,
            'conflict_details' => $conflictDetails,
            'pending_schedules' => $totalSchedules - $activeSchedules,
            'total_rooms' => $totalRooms,
            'room_utilization' => $roomUtilization,
            'faculty_loads' => $facultyLoads,
            'recent_activities' => $recentActivities,
        ];
    }

    /**
     * Get faculty members for this department with filters
     */
    public function getFacultyWithFilters(User $departmentHead, array $filters = []): array
    {
        $this->validateDepartmentHead($departmentHead);
        $departmentId = $departmentHead->getDepartmentId();

        if (!$departmentId) {
            throw new \RuntimeException('Department Head has no assigned department.');
        }

        // Force role to be faculty and scoped to the department head's primary department.
        // This keeps the list consistent with canAccessUser() edit permissions.
        $filters['role'] = 3; // Faculty

        // Use the UserService to get filtered users
        $qb = $this->userRepository->createQueryBuilder('u')
            ->leftJoin('u.department', 'd')
            ->leftJoin('d.college', 'c')
            ->where('u.role = :role')
            ->andWhere('u.department = :deptId')
            ->setParameter('role', 3)
            ->setParameter('deptId', $departmentId);

        // Apply search filter
        if (!empty($filters['search'])) {
            $qb->andWhere(
                $qb->expr()->orX(
                    $qb->expr()->like('u.username', ':search'),
                    $qb->expr()->like('u.firstName', ':search'),
                    $qb->expr()->like('u.lastName', ':search'),
                    $qb->expr()->like('u.email', ':search'),
                    $qb->expr()->like('u.employeeId', ':search')
                )
            );
            $qb->setParameter('search', '%' . $filters['search'] . '%');
        }

        // Apply active filter
        if (isset($filters['is_active']) && $filters['is_active'] !== null) {
            $qb->andWhere('u.isActive = :isActive')
               ->setParameter('isActive', $filters['is_active']);
        }

        // Apply sorting (allow-list for safety)
        $allowedSortFields = [
            'id' => 'u.id',
            'username' => 'u.username',
            'firstName' => 'u.firstName',
            'lastName' => 'u.lastName',
            'email' => 'u.email',
            'employeeId' => 'u.employeeId',
            'isActive' => 'u.isActive',
            'createdAt' => 'u.createdAt',
            'updatedAt' => 'u.updatedAt',
        ];
        $sortField = (string) ($filters['sort_field'] ?? 'createdAt');
        $orderBy = $allowedSortFields[$sortField] ?? 'u.createdAt';
        $sortDirection = strtoupper((string) ($filters['sort_direction'] ?? 'DESC')) === 'ASC' ? 'ASC' : 'DESC';
        $qb->orderBy($orderBy, $sortDirection);

        // Get total count
        $totalQuery = clone $qb;
        $totalCount = (int) $totalQuery->select('COUNT(u.id)')->getQuery()->getSingleScalarResult();

        // Apply pagination
        $page = $filters['page'] ?? 1;
        $limit = $filters['limit'] ?? 20;
        $offset = ($page - 1) * $limit;

        $qb->setFirstResult($offset)
           ->setMaxResults($limit);

        $users = $qb->getQuery()->getResult();

        return [
            'users' => $users,
            'total' => $totalCount,
            'page' => $page,
            'limit' => $limit,
            'pages' => ceil($totalCount / $limit),
            'has_previous' => $page > 1,
            'has_next' => $page < ceil($totalCount / $limit),
        ];
    }

    /**
     * Check if department head can access a specific user
     */
    public function canAccessUser(User $departmentHead, User $user): bool
    {
        if ($departmentHead->getRole() !== 2) {
            return false;
        }

        // Department heads can only access faculty in their department
        return $user->getRole() === 3 
            && $user->getDepartmentId() === $departmentHead->getDepartmentId();
    }

    /**
     * Get curricula for department head's department
     */
    public function getCurricula(User $departmentHead): array
    {
        $this->validateDepartmentHead($departmentHead);
        $departmentId = $departmentHead->getDepartmentId();

        if (!$departmentId) {
            throw new \RuntimeException('Department Head has no assigned department.');
        }

        return $this->curriculumRepository->createQueryBuilder('c')
            ->where('c.department = :deptId')
            ->setParameter('deptId', $departmentId)
            ->orderBy('c.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Validate that user is a department head
     */
    private function validateDepartmentHead(User $user): void
    {
        if ($user->getRole() !== 2) {
            throw new AccessDeniedException('User is not a department head.');
        }
    }

    /**
     * Get faculty statistics
     */
    public function getFacultyStatistics(User $departmentHead): array
    {
        $this->validateDepartmentHead($departmentHead);
        $departmentId = $departmentHead->getDepartmentId();

        if (!$departmentId) {
            throw new \RuntimeException('Department Head has no assigned department.');
        }

        $managedDeptIds = $this->getManagedDepartmentIds($departmentId);

        // Get total faculty across all managed departments
        $total = $this->userRepository->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:deptIds)')
            ->setParameter('role', 3)
            ->setParameter('deptIds', $managedDeptIds)
            ->getQuery()
            ->getSingleScalarResult();

        // Get active faculty count
        $active = $this->userRepository->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:deptIds)')
            ->andWhere('u.isActive = :active')
            ->setParameter('role', 3)
            ->setParameter('deptIds', $managedDeptIds)
            ->setParameter('active', true)
            ->getQuery()
            ->getSingleScalarResult();

        // Get faculty created this month
        $thisMonthStart = new \DateTime('first day of this month 00:00:00');
        $thisMonth = $this->userRepository->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:deptIds)')
            ->andWhere('u.createdAt >= :date')
            ->setParameter('role', 3)
            ->setParameter('deptIds', $managedDeptIds)
            ->setParameter('date', $thisMonthStart)
            ->getQuery()
            ->getSingleScalarResult();

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $total - $active,
            'thisMonth' => $thisMonth,
        ];
    }

    /**
     * Get rooms for department head's department with filters
     */
    public function getRoomsWithFilters(User $departmentHead, array $filters = []): array
    {
        $this->validateDepartmentHead($departmentHead);
        $departmentId = $departmentHead->getDepartmentId();

        if (!$departmentId) {
            throw new \RuntimeException('Department Head has no assigned department.');
        }

        // Get the department entity to check for group membership
        $department = $this->departmentRepository->find($departmentId);
        if (!$department) {
            throw new \RuntimeException('Department not found.');
        }

        $qb = $this->roomRepository->createQueryBuilder('r')
            ->leftJoin('r.department', 'd')
            ->leftJoin('r.departmentGroup', 'dg')
            ->leftJoin('d.departmentGroup', 'dept_group');

        // Filter rooms: either directly owned by department OR shared via department group
        $departmentGroup = $department->getDepartmentGroup();
        if ($departmentGroup) {
            // Room is accessible if:
            // 1. Room belongs directly to this department, OR
            // 2. Room is assigned to the department group, OR
            // 3. Room's department is in the same group
            $qb->where(
                $qb->expr()->orX(
                    $qb->expr()->eq('r.department', ':deptId'),
                    $qb->expr()->eq('r.departmentGroup', ':groupId'),
                    $qb->expr()->eq('dept_group.id', ':groupId')
                )
            )
            ->setParameter('deptId', $departmentId)
            ->setParameter('groupId', $departmentGroup->getId());
        } else {
            // No group, only show rooms owned by this department
            $qb->where('r.department = :deptId')
                ->setParameter('deptId', $departmentId);
        }

        // Apply search filter
        if (!empty($filters['search'])) {
            $qb->andWhere(
                $qb->expr()->orX(
                    $qb->expr()->like('r.code', ':search'),
                    $qb->expr()->like('r.name', ':search'),
                    $qb->expr()->like('r.building', ':search')
                )
            );
            $qb->setParameter('search', '%' . $filters['search'] . '%');
        }

        // Apply type filter
        if (!empty($filters['type'])) {
            $qb->andWhere('r.type = :type')
               ->setParameter('type', $filters['type']);
        }

        // Apply active filter
        if (isset($filters['is_active']) && $filters['is_active'] !== null) {
            $qb->andWhere('r.isActive = :isActive')
               ->setParameter('isActive', $filters['is_active']);
        }

        // Apply sorting (allow-list for safety)
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
        $sortField = (string) ($filters['sort_field'] ?? 'code');
        $orderBy = $allowedSortFields[$sortField] ?? 'r.code';
        $sortDirection = strtoupper((string) ($filters['sort_direction'] ?? 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $qb->orderBy($orderBy, $sortDirection);

        // Apply pagination
        $page = $filters['page'] ?? 1;
        $limit = $filters['limit'] ?? 20;
        $offset = ($page - 1) * $limit;

        $qb->setFirstResult($offset)
           ->setMaxResults($limit);

        $rooms = $qb->getQuery()->getResult();

        // Get total count for pagination
        $countQb = $this->roomRepository->createQueryBuilder('r')
            ->select('COUNT(r.id)')
            ->leftJoin('r.department', 'd')
            ->leftJoin('d.departmentGroup', 'dept_group');

        // Apply same filtering logic for count
        if ($departmentGroup) {
            $countQb->where(
                $countQb->expr()->orX(
                    $countQb->expr()->eq('r.department', ':deptId'),
                    $countQb->expr()->eq('r.departmentGroup', ':groupId'),
                    $countQb->expr()->eq('dept_group.id', ':groupId')
                )
            )
            ->setParameter('deptId', $departmentId)
            ->setParameter('groupId', $departmentGroup->getId());
        } else {
            $countQb->where('r.department = :deptId')
                ->setParameter('deptId', $departmentId);
        }

        if (!empty($filters['search'])) {
            $countQb->andWhere(
                $countQb->expr()->orX(
                    $countQb->expr()->like('r.code', ':search'),
                    $countQb->expr()->like('r.name', ':search'),
                    $countQb->expr()->like('r.building', ':search')
                )
            );
            $countQb->setParameter('search', '%' . $filters['search'] . '%');
        }

        if (!empty($filters['type'])) {
            $countQb->andWhere('r.type = :type')
                    ->setParameter('type', $filters['type']);
        }

        if (isset($filters['is_active']) && $filters['is_active'] !== null) {
            $countQb->andWhere('r.isActive = :isActive')
                    ->setParameter('isActive', $filters['is_active']);
        }

        $total = $countQb->getQuery()->getSingleScalarResult();

        return [
            'rooms' => $rooms,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'pages' => ceil($total / $limit),
        ];
    }

    /**
     * Get room statistics for department head's department
     */
    public function getRoomStatistics(User $departmentHead): array
    {
        $this->validateDepartmentHead($departmentHead);
        $departmentId = $departmentHead->getDepartmentId();

        if (!$departmentId) {
            throw new \RuntimeException('Department Head has no assigned department.');
        }

        // Get the department entity to check for group membership
        $department = $this->departmentRepository->find($departmentId);
        if (!$department) {
            throw new \RuntimeException('Department not found.');
        }

        $departmentGroup = $department->getDepartmentGroup();

        // Get active semester for filtering schedule-based statistics
        $activeAcademicYear = $this->systemSettingsService->getActiveAcademicYear();
        $activeSemester = $this->systemSettingsService->getActiveSemester();

        // Count total rooms (owned by department OR shared via group)
        $totalQb = $this->roomRepository->createQueryBuilder('r')
            ->select('COUNT(r.id)')
            ->leftJoin('r.department', 'd')
            ->leftJoin('d.departmentGroup', 'dept_group');
        
        if ($departmentGroup) {
            $totalQb->where(
                $totalQb->expr()->orX(
                    $totalQb->expr()->eq('r.department', ':deptId'),
                    $totalQb->expr()->eq('r.departmentGroup', ':groupId'),
                    $totalQb->expr()->eq('dept_group.id', ':groupId')
                )
            )
            ->setParameter('deptId', $departmentId)
            ->setParameter('groupId', $departmentGroup->getId());
        } else {
            $totalQb->where('r.department = :deptId')
                ->setParameter('deptId', $departmentId);
        }
        
        $total = $totalQb->getQuery()->getSingleScalarResult();

        // Count active rooms
        $activeQb = $this->roomRepository->createQueryBuilder('r')
            ->select('COUNT(r.id)')
            ->leftJoin('r.department', 'd')
            ->leftJoin('d.departmentGroup', 'dept_group')
            ->andWhere('r.isActive = true');
        
        if ($departmentGroup) {
            $activeQb->andWhere(
                $activeQb->expr()->orX(
                    $activeQb->expr()->eq('r.department', ':deptId'),
                    $activeQb->expr()->eq('r.departmentGroup', ':groupId'),
                    $activeQb->expr()->eq('dept_group.id', ':groupId')
                )
            )
            ->setParameter('deptId', $departmentId)
            ->setParameter('groupId', $departmentGroup->getId());
        } else {
            $activeQb->andWhere('r.department = :deptId')
                ->setParameter('deptId', $departmentId);
        }
        
        $active = $activeQb->getQuery()->getSingleScalarResult();

        // Count by type
        $byType = [];
        $types = ['classroom', 'laboratory', 'auditorium', 'office'];
        foreach ($types as $type) {
            $typeQb = $this->roomRepository->createQueryBuilder('r')
                ->select('COUNT(r.id)')
                ->leftJoin('r.department', 'd')
                ->leftJoin('d.departmentGroup', 'dept_group')
                ->andWhere('r.type = :type')
                ->andWhere('r.isActive = true')
                ->setParameter('type', $type);
            
            if ($departmentGroup) {
                $typeQb->andWhere(
                    $typeQb->expr()->orX(
                        $typeQb->expr()->eq('r.department', ':deptId'),
                        $typeQb->expr()->eq('r.departmentGroup', ':groupId'),
                        $typeQb->expr()->eq('dept_group.id', ':groupId')
                    )
                )
                ->setParameter('deptId', $departmentId)
                ->setParameter('groupId', $departmentGroup->getId());
            } else {
                $typeQb->andWhere('r.department = :deptId')
                    ->setParameter('deptId', $departmentId);
            }
            
            $byType[$type] = $typeQb->getQuery()->getSingleScalarResult();
        }

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $total - $active,
            'by_type' => $byType,
        ];
    }

    /**
     * Validate that a room belongs to the department head's department or is shared via group
     */
    public function validateRoomAccess(User $departmentHead, Room $room): void
    {
        $this->validateDepartmentHead($departmentHead);
        $departmentId = $departmentHead->getDepartmentId();

        if (!$departmentId) {
            throw new \RuntimeException('Department Head has no assigned department.');
        }

        // Get the department entity to check for group access
        $department = $this->departmentRepository->find($departmentId);
        if (!$department) {
            throw new \RuntimeException('Department not found.');
        }

        // Use the Room entity's helper method to check accessibility
        if (!$room->isAccessibleByDepartment($department)) {
            throw new AccessDeniedException('You do not have access to this room.');
        }
    }

    /**
     * Get curricula with filters and pagination
     */
    public function getCurriculaWithFilters(User $departmentHead, array $filters): array
    {
        $this->validateDepartmentHead($departmentHead);
        $departmentId = $departmentHead->getDepartmentId();

        if (!$departmentId) {
            throw new \RuntimeException('Department Head has no assigned department.');
        }

        $qb = $this->curriculumRepository->createQueryBuilder('c')
            ->where('c.department = :deptId')
            ->setParameter('deptId', $departmentId);

        // Apply search filter
        if (!empty($filters['search'])) {
            $qb->andWhere('c.name LIKE :search')
                ->setParameter('search', '%' . $filters['search'] . '%');
        }

        // Apply published filter
        if (isset($filters['is_published']) && $filters['is_published'] !== '') {
            $qb->andWhere('c.isPublished = :isPublished')
                ->setParameter('isPublished', (bool)$filters['is_published']);
        }

        // Apply sorting (allow-list for safety)
        $allowedSortFields = [
            'id' => 'c.id',
            'name' => 'c.name',
            'version' => 'c.version',
            'isPublished' => 'c.isPublished',
            'createdAt' => 'c.createdAt',
            'updatedAt' => 'c.updatedAt',
        ];
        $sortField = (string) ($filters['sort_field'] ?? 'createdAt');
        $orderBy = $allowedSortFields[$sortField] ?? 'c.createdAt';
        $sortDirection = strtoupper((string) ($filters['sort_direction'] ?? 'DESC')) === 'ASC' ? 'ASC' : 'DESC';
        $qb->orderBy($orderBy, $sortDirection);

        // Get total count
        $totalQb = clone $qb;
        $total = $totalQb->select('COUNT(c.id)')
            ->getQuery()
            ->getSingleScalarResult();

        // Apply pagination
        $page = max(1, $filters['page'] ?? 1);
        $limit = max(1, min(100, $filters['limit'] ?? 20));
        $offset = ($page - 1) * $limit;

        $qb->setFirstResult($offset)
            ->setMaxResults($limit);

        $curricula = $qb->getQuery()->getResult();

        $totalPages = (int)ceil($total / $limit);

        return [
            'curricula' => $curricula,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => $totalPages,
            'has_previous' => $page > 1,
            'has_next' => $page < $totalPages,
        ];
    }

    /**
     * Get curriculum statistics
     */
    public function getCurriculumStatistics(User $departmentHead): array
    {
        $this->validateDepartmentHead($departmentHead);
        $departmentId = $departmentHead->getDepartmentId();

        if (!$departmentId) {
            throw new \RuntimeException('Department Head has no assigned department.');
        }

        $total = $this->curriculumRepository->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.department = :deptId')
            ->setParameter('deptId', $departmentId)
            ->getQuery()
            ->getSingleScalarResult();

        $published = $this->curriculumRepository->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.department = :deptId')
            ->andWhere('c.isPublished = :published')
            ->setParameter('deptId', $departmentId)
            ->setParameter('published', true)
            ->getQuery()
            ->getSingleScalarResult();

        $draft = $total - $published;

        // Get recent curricula (this month)
        $thisMonthStart = new \DateTime('first day of this month 00:00:00');
        $thisMonth = $this->curriculumRepository->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.department = :deptId')
            ->andWhere('c.createdAt >= :date')
            ->setParameter('deptId', $departmentId)
            ->setParameter('date', $thisMonthStart)
            ->getQuery()
            ->getSingleScalarResult();

        return [
            'total' => $total,
            'published' => $published,
            'draft' => $draft,
            'thisMonth' => $thisMonth,
        ];
    }

    /**
     * Get curriculum by ID with access validation
     */
    public function getCurriculumById(User $departmentHead, int $id): \App\Entity\Curriculum
    {
        $this->validateDepartmentHead($departmentHead);
        $departmentId = $departmentHead->getDepartmentId();

        if (!$departmentId) {
            throw new \RuntimeException('Department Head has no assigned department.');
        }

        $curriculum = $this->curriculumRepository->find($id);

        if (!$curriculum) {
            throw new \RuntimeException('Curriculum not found.');
        }

        if ($curriculum->getDepartmentId() !== $departmentId) {
            throw new AccessDeniedException('You do not have access to this curriculum.');
        }

        return $curriculum;
    }

    /**
     * Publish a curriculum
     */
    public function publishCurriculum(User $departmentHead, int $id): void
    {
        $curriculum = $this->getCurriculumById($departmentHead, $id);
        
        $curriculum->setIsPublished(true);
        $curriculum->setUpdatedAt(new \DateTime());
        
        $this->entityManager->flush();
    }

    /**
     * Unpublish a curriculum
     */
    public function unpublishCurriculum(User $departmentHead, int $id): void
    {
        $curriculum = $this->getCurriculumById($departmentHead, $id);
        
        $curriculum->setIsPublished(false);
        $curriculum->setUpdatedAt(new \DateTime());
        
        $this->entityManager->flush();
    }

    /**
     * Get faculty workload report data
     */
    public function getFacultyWorkloadReport(
        \App\Entity\Department $department,
        ?string $academicYearId = null,
        ?string $semester = null,
        string $statusFilter = 'all'
    ): array {
        $departmentId = $department->getId();
        $managedDepartments = $this->getManagedDepartments($departmentId);

        // Get all faculty across all managed departments
        $faculty = $this->userRepository->createQueryBuilder('u')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:depts)')
            ->andWhere('u.isActive = :active')
            ->setParameter('role', 3)
            ->setParameter('depts', $managedDepartments)
            ->setParameter('active', true)
            ->orderBy('u.firstName', 'ASC')
            ->addOrderBy('u.lastName', 'ASC')
            ->getQuery()
            ->getResult();

        // Get academic years for filter
        $academicYears = $this->entityManager->getRepository(\App\Entity\AcademicYear::class)
            ->findBy(['isActive' => true], ['year' => 'DESC']);

        // Get the currently active academic year and semester from system settings
        // This matches the logic used in faculty assignments
        $currentAcademicYear = $this->entityManager->getRepository(\App\Entity\AcademicYear::class)
            ->findOneBy(['isCurrent' => true]);
        $currentSemester = $currentAcademicYear?->getCurrentSemester();

        // If no academic year filter is selected, use the current active one
        // This ensures consistency with faculty assignments page
        if (!$academicYearId && $currentAcademicYear) {
            $academicYearId = (string)$currentAcademicYear->getId();
        }

        // If no semester filter is selected, use the current active semester
        if (!$semester && $currentSemester) {
            $semester = $currentSemester;
        }

        $facultyWorkload = [];
        $totalUnits = 0;
        $overloadedCount = 0;
        $optimalCount = 0;
        $underloadedCount = 0;
        $standardLoad = 21; // Standard teaching load in units

        foreach ($faculty as $facultyMember) {
            // Get schedules for this faculty from all managed departments
            $qb = $this->entityManager->createQueryBuilder();
            $qb->select('s', 'sub', 'r')
                ->from(\App\Entity\Schedule::class, 's')
                ->leftJoin('s.subject', 'sub')
                ->leftJoin('s.room', 'r')
                ->where('s.faculty = :faculty')
                ->andWhere('s.status = :status')
                ->andWhere('sub.department IN (:depts)')
                ->setParameter('faculty', $facultyMember)
                ->setParameter('status', 'active')
                ->setParameter('depts', $managedDepartments);

            if ($academicYearId) {
                // Get the academic year entity
                $academicYear = $this->entityManager->getRepository(\App\Entity\AcademicYear::class)
                    ->find($academicYearId);
                if ($academicYear) {
                    $qb->andWhere('s.academicYear = :academicYear')
                       ->setParameter('academicYear', $academicYear);
                }
            }

            if ($semester) {
                $qb->andWhere('s.semester = :semester')
                   ->setParameter('semester', $semester);
            }

            $schedules = $qb->getQuery()->getResult();

            // Calculate total units
            $units = 0;
            $courses = [];
            foreach ($schedules as $schedule) {
                $subject = $schedule->getSubject();
                if ($subject) {
                    $units += $subject->getUnits();
                    
                    // Safely format schedule time
                    $scheduleTime = '';
                    if ($schedule->getDayPattern()) {
                        $scheduleTime = $schedule->getDayPattern();
                    }
                    if ($schedule->getStartTime() && $schedule->getEndTime()) {
                        $scheduleTime .= ' ' . $schedule->getStartTime()->format('g:i A') . '-' . $schedule->getEndTime()->format('g:i A');
                    }
                    
                    $courses[] = [
                        'code' => $subject->getCode() ?? 'N/A',
                        'name' => $subject->getTitle() ?? 'Untitled',
                        'units' => $subject->getUnits() ?? 0,
                        'section' => $schedule->getSection() ?? null,
                        'schedule' => $scheduleTime ?: 'TBA',
                        'room' => $schedule->getRoom() ? $schedule->getRoom()->getCode() : null,
                    ];
                }
            }            // Determine status
            $status = 'optimal';
            $statusColor = 'green';
            if ($units > $standardLoad) {
                $status = 'overloaded';
                $statusColor = 'red';
                $overloadedCount++;
            } elseif ($units < 15) {
                $status = 'underloaded';
                $statusColor = 'yellow';
                $underloadedCount++;
            } else {
                $optimalCount++;
            }

            $totalUnits += $units;

            $workloadInfo = [
                'id' => $facultyMember->getId(),
                'name' => $facultyMember->getFirstName() . ' ' . $facultyMember->getLastName(),
                'employeeId' => $facultyMember->getEmployeeId(),
                'email' => $facultyMember->getEmail(),
                'units' => $units,
                'percentage' => ($units / $standardLoad) * 100,
                'status' => $status,
                'status_color' => $statusColor,
                'courses' => $courses,
                'course_count' => count($courses),
            ];

            // Apply status filter
            if ($statusFilter === 'all' || $statusFilter === $status) {
                $facultyWorkload[] = $workloadInfo;
            }
        }

        // Sort by units descending
        usort($facultyWorkload, function($a, $b) {
            return $b['units'] <=> $a['units'];
        });

        $statistics = [
            'total_faculty' => count($faculty),
            'overloaded' => $overloadedCount,
            'optimal' => $optimalCount,
            'underloaded' => $underloadedCount,
            'average_load' => count($faculty) > 0 ? round($totalUnits / count($faculty), 2) : 0,
            'total_units' => $totalUnits,
            'standard_load' => $standardLoad,
        ];

        return [
            'faculty_workload' => $facultyWorkload,
            'statistics' => $statistics,
            'academic_years' => $academicYears,
            'selected_academic_year' => $academicYearId,
            'selected_semester' => $semester,
        ];
    }

    /**
     * Get faculty workload report for multiple managed departments
     */
    public function getFacultyWorkloadReportByDepartments(
        array $managedDepartments,
        ?string $academicYearId = null,
        ?string $semester = null,
        string $statusFilter = 'all'
    ): array {
        // Get all faculty across all managed departments
        $faculty = $this->userRepository->createQueryBuilder('u')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:depts)')
            ->andWhere('u.isActive = :active')
            ->setParameter('role', 3)
            ->setParameter('depts', $managedDepartments)
            ->setParameter('active', true)
            ->orderBy('u.firstName', 'ASC')
            ->addOrderBy('u.lastName', 'ASC')
            ->getQuery()
            ->getResult();

        // Get academic years for filter
        $academicYears = $this->entityManager->getRepository(\App\Entity\AcademicYear::class)
            ->findBy(['isActive' => true], ['year' => 'DESC']);

        // Get the currently active academic year and semester from system settings
        $currentAcademicYear = $this->entityManager->getRepository(\App\Entity\AcademicYear::class)
            ->findOneBy(['isCurrent' => true]);
        $currentSemester = $currentAcademicYear?->getCurrentSemester();

        // If no academic year filter is selected, use the current active one
        if (!$academicYearId && $currentAcademicYear) {
            $academicYearId = (string)$currentAcademicYear->getId();
        }

        // If no semester filter is selected, use the current active semester
        if (!$semester && $currentSemester) {
            $semester = $currentSemester;
        }

        $facultyWorkload = [];
        $totalUnits = 0;
        $overloadedCount = 0;
        $optimalCount = 0;
        $underloadedCount = 0;
        $standardLoad = 21; // Standard teaching load in units

        foreach ($faculty as $facultyMember) {
            // Get schedules for this faculty from all managed departments
            $qb = $this->entityManager->createQueryBuilder();
            $qb->select('s', 'sub', 'r')
                ->from(\App\Entity\Schedule::class, 's')
                ->leftJoin('s.subject', 'sub')
                ->leftJoin('s.room', 'r')
                ->where('s.faculty = :faculty')
                ->andWhere('s.status = :status')
                ->andWhere('sub.department IN (:depts)')
                ->setParameter('faculty', $facultyMember)
                ->setParameter('status', 'active')
                ->setParameter('depts', $managedDepartments);

            if ($academicYearId) {
                // Get the academic year entity
                $academicYear = $this->entityManager->getRepository(\App\Entity\AcademicYear::class)
                    ->find($academicYearId);
                if ($academicYear) {
                    $qb->andWhere('s.academicYear = :academicYear')
                       ->setParameter('academicYear', $academicYear);
                }
            }

            if ($semester) {
                $qb->andWhere('s.semester = :semester')
                   ->setParameter('semester', $semester);
            }

            $schedules = $qb->getQuery()->getResult();

            // Calculate total units
            $units = 0;
            $courses = [];
            foreach ($schedules as $schedule) {
                $subject = $schedule->getSubject();
                if ($subject) {
                    $units += $subject->getUnits();

                    // Safely format schedule time
                    $scheduleTime = '';
                    if ($schedule->getDayPattern()) {
                        $scheduleTime = $schedule->getDayPattern();
                    }
                    if ($schedule->getStartTime() && $schedule->getEndTime()) {
                        $scheduleTime .= ' ' . $schedule->getStartTime()->format('g:i A') . '-' . $schedule->getEndTime()->format('g:i A');
                    }

                    $courses[] = [
                        'code' => $subject->getCode() ?? 'N/A',
                        'name' => $subject->getTitle() ?? 'Untitled',
                        'units' => $subject->getUnits() ?? 0,
                        'section' => $schedule->getSection() ?? null,
                        'schedule' => $scheduleTime ?: 'TBA',
                        'room' => $schedule->getRoom() ? $schedule->getRoom()->getCode() : null,
                        'department' => $subject->getDepartment() ? [
                            'id' => $subject->getDepartment()->getId(),
                            'code' => $subject->getDepartment()->getCode(),
                            'name' => $subject->getDepartment()->getName(),
                        ] : null,
                    ];
                }
            }

            // Determine status
            $status = 'optimal';
            $statusColor = 'green';
            if ($units > $standardLoad) {
                $status = 'overloaded';
                $statusColor = 'red';
                $overloadedCount++;
            } elseif ($units < 15) {
                $status = 'underloaded';
                $statusColor = 'yellow';
                $underloadedCount++;
            } else {
                $optimalCount++;
            }

            $totalUnits += $units;

            $workloadInfo = [
                'id' => $facultyMember->getId(),
                'name' => $facultyMember->getFirstName() . ' ' . $facultyMember->getLastName(),
                'employeeId' => $facultyMember->getEmployeeId(),
                'email' => $facultyMember->getEmail(),
                'units' => $units,
                'percentage' => ($units / $standardLoad) * 100,
                'status' => $status,
                'status_color' => $statusColor,
                'courses' => $courses,
                'course_count' => count($courses),
                'department' => $facultyMember->getDepartment() ? [
                    'id' => $facultyMember->getDepartment()->getId(),
                    'code' => $facultyMember->getDepartment()->getCode(),
                    'name' => $facultyMember->getDepartment()->getName(),
                ] : null,
            ];

            // Apply status filter
            if ($statusFilter === 'all' || $statusFilter === $status) {
                $facultyWorkload[] = $workloadInfo;
            }
        }

        // Sort by units descending
        usort($facultyWorkload, function($a, $b) {
            return $b['units'] <=> $a['units'];
        });

        $statistics = [
            'total_faculty' => count($faculty),
            'overloaded' => $overloadedCount,
            'optimal' => $optimalCount,
            'underloaded' => $underloadedCount,
            'average_load' => count($faculty) > 0 ? round($totalUnits / count($faculty), 2) : 0,
            'total_units' => $totalUnits,
            'standard_load' => $standardLoad,
        ];

        return [
            'faculty_workload' => $facultyWorkload,
            'statistics' => $statistics,
            'academic_years' => $academicYears,
            'selected_academic_year' => $academicYearId,
            'selected_semester' => $semester,
        ];
    }
}

