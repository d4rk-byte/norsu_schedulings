<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Entity\Room;
use App\Entity\Schedule;
use App\Entity\Subject;
use App\Entity\AcademicYear;
use App\Entity\Curriculum;
use App\Entity\Notification;
use App\Entity\ScheduleChangeRequest;
use App\Entity\ActivityLog;
use App\Repository\AcademicYearRepository;
use App\Repository\RoomRepository;
use App\Repository\ScheduleRepository;
use App\Repository\SubjectRepository;
use App\Repository\DepartmentRepository;
use App\Service\ActivityLogService;
use App\Service\DepartmentHeadService;
use App\Service\NotificationService;
use App\Service\SystemSettingsService;
use App\Service\ScheduleConflictDetector;
use App\Service\CurriculumUploadService;
use App\Service\UserService;
use App\Service\TeachingLoadPdfService;
use App\Service\RoomSchedulePdfService;
use App\Service\FacultyReportPdfService;
use App\Service\RoomsReportPdfService;
use App\Service\SubjectsReportPdfService;
use Doctrine\ORM\EntityManagerInterface;
use InvalidArgumentException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/department-head', name: 'api_dh_')]
#[IsGranted('ROLE_DEPARTMENT_HEAD')]
class ApiDepartmentHeadController extends AbstractController
{
    public function __construct(
        private DepartmentHeadService $departmentHeadService,
        private SystemSettingsService $systemSettingsService,
        private UserService $userService,
        private ActivityLogService $activityLogService,
        private EntityManagerInterface $entityManager,
        private RoomRepository $roomRepository,
        private ScheduleRepository $scheduleRepository,
        private SubjectRepository $subjectRepository,
        private AcademicYearRepository $academicYearRepository,
        private DepartmentRepository $departmentRepository,
        private NotificationService $notificationService,
        private ScheduleConflictDetector $scheduleConflictDetector,
        private CurriculumUploadService $curriculumUploadService,
        private TeachingLoadPdfService $teachingLoadPdfService,
        private RoomSchedulePdfService $roomSchedulePdfService,
        private FacultyReportPdfService $facultyReportPdfService,
        private RoomsReportPdfService $roomsReportPdfService,
        private SubjectsReportPdfService $subjectsReportPdfService,
        private UserPasswordHasherInterface $passwordHasher,
    ) {
    }

    private function getDH(): User
    {
        /** @var User $user */
        $user = $this->getUser();
        return $user;
    }

    /**
     * Get all managed departments (primary + grouped departments)
     * @return \App\Entity\Department[]
     */
    private function getManagedDepartments(User $dh): array
    {
        $deptId = $dh->getDepartmentId();
        if (!$deptId) {
            return [];
        }

        $department = $this->departmentRepository->find($deptId);
        if (!$department) {
            return [];
        }

        $managedDepts = [$department];

        // If department is part of a group, add all group departments
        if ($department->getDepartmentGroup()) {
            foreach ($department->getDepartmentGroup()->getDepartments() as $groupDept) {
                if ($groupDept->getId() !== $deptId) {
                    $managedDepts[] = $groupDept;
                }
            }
        }

        return $managedDepts;
    }

    /**
     * @return int[]
     */
    private function getManagedDepartmentIds(User $dh): array
    {
        return array_map(static fn($d) => (int) $d->getId(), $this->getManagedDepartments($dh));
    }

    private function canAccessScheduleChangeRequest(User $dh, ScheduleChangeRequest $requestEntity): bool
    {
        $departmentId = $dh->getDepartmentId();
        if ($departmentId === null) {
            return false;
        }

        $requesterDepartmentId = $requestEntity->getRequester()?->getDepartment()?->getId();

        if ($requesterDepartmentId === null) {
            return false;
        }

        return (int) $requesterDepartmentId === (int) $departmentId;
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

    // ================================================================
    // Profile (current DH user)
    // ================================================================

    #[Route('/profile', name: 'profile', methods: ['GET'])]
    public function profile(): JsonResponse
    {
        $user = $this->getDH();

        return $this->json([
            'id'                => $user->getId(),
            'username'          => $user->getUsername(),
            'email'             => $user->getEmail(),
            'first_name'        => $user->getFirstName(),
            'middle_name'       => $user->getMiddleName(),
            'last_name'         => $user->getLastName(),
            'full_name'         => $user->getFullName(),
            'role'              => $user->getRole(),
            'role_string'       => $user->getRoleString(),
            'role_display_name' => $user->getRoleDisplayName(),
            'employee_id'       => $user->getEmployeeId(),
            'position'          => $user->getPosition(),
            'address'           => $user->getAddress(),
            'other_designation' => $user->getOtherDesignation(),
            'is_active'         => (bool) $user->isActive(),
            'last_login'        => $user->getLastLogin()?->format('c'),
            'college'           => $user->getCollege() ? [
                'id'   => $user->getCollege()->getId(),
                'name' => $user->getCollege()->getName(),
            ] : null,
            'department'        => $user->getDepartment() ? [
                'id'   => $user->getDepartment()->getId(),
                'name' => $user->getDepartment()->getName(),
            ] : null,
        ]);
    }

    #[Route('/profile', name: 'profile_update', methods: ['PUT'])]
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $this->getDH();

        $data = json_decode($request->getContent(), true);

        if (isset($data['first_name'])) {
            $user->setFirstName($data['first_name']);
        }
        if (isset($data['middle_name'])) {
            $user->setMiddleName($data['middle_name']);
        }
        if (isset($data['last_name'])) {
            $user->setLastName($data['last_name']);
        }
        if (isset($data['address'])) {
            $user->setAddress($data['address']);
        }
        if (isset($data['other_designation'])) {
            $user->setOtherDesignation($data['other_designation']);
        }

        try {
            $user->setUpdatedAt(new \DateTime());
            $this->entityManager->flush();
            return $this->json(['success' => true, 'message' => 'Profile updated successfully.']);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'message' => 'Failed to update profile.'], 500);
        }
    }

    #[Route('/profile/change-password', name: 'profile_change_password', methods: ['PUT'])]
    public function changePassword(Request $request): JsonResponse
    {
        $user = $this->getDH();
        $data = json_decode($request->getContent(), true);

        if (!is_array($data)) {
            return $this->json([
                'success' => false,
                'message' => 'Invalid request payload.',
            ], 400);
        }

        $currentPassword = (string) ($data['currentPassword'] ?? '');
        $newPassword = (string) ($data['newPassword'] ?? '');
        $confirmPassword = (string) ($data['confirmPassword'] ?? '');

        if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
            return $this->json([
                'success' => false,
                'message' => 'All password fields are required.',
            ], 422);
        }

        if (!$this->passwordHasher->isPasswordValid($user, $currentPassword)) {
            return $this->json([
                'success' => false,
                'message' => 'Current password is incorrect.',
            ], 422);
        }

        if (strlen($newPassword) < 6) {
            return $this->json([
                'success' => false,
                'message' => 'New password must be at least 6 characters long.',
            ], 422);
        }

        if ($newPassword !== $confirmPassword) {
            return $this->json([
                'success' => false,
                'message' => 'New password and confirmation do not match.',
            ], 422);
        }

        try {
            $user->setPassword($this->passwordHasher->hashPassword($user, $newPassword));
            $user->setUpdatedAt(new \DateTime());

            $this->entityManager->flush();
            $this->activityLogService->logUserActivity('user.password_changed', $user);

            return $this->json([
                'success' => true,
                'message' => 'Password changed successfully.',
            ]);
        } catch (\Exception) {
            return $this->json([
                'success' => false,
                'message' => 'Failed to update password.',
            ], 500);
        }
    }

    // ================================================================
    // Notifications
    // ================================================================

    #[Route('/notifications', name: 'notifications', methods: ['GET'])]
    public function notifications(Request $request): JsonResponse
    {
        $user   = $this->getDH();
        $limit  = (int) $request->query->get('limit', 20);
        $offset = (int) $request->query->get('offset', 0);

        $notifications = $this->notificationService->getForUser($user, $limit, $offset);
        $unreadCount   = $this->notificationService->getUnreadCount($user);

        return $this->json([
            'notifications' => array_map(
                fn(Notification $n) => $this->notificationService->serialize($n),
                $notifications,
            ),
            'unread_count' => $unreadCount,
        ]);
    }

    #[Route('/notifications/unread-count', name: 'notifications_unread_count', methods: ['GET'])]
    public function notificationsUnreadCount(): JsonResponse
    {
        $user = $this->getDH();

        return $this->json([
            'unread_count' => $this->notificationService->getUnreadCount($user),
        ]);
    }

    #[Route('/notifications/{id}/read', name: 'notification_read', methods: ['POST'])]
    public function markNotificationRead(int $id): JsonResponse
    {
        $user = $this->getDH();
        $notification = $this->entityManager->getRepository(Notification::class)->find($id);

        if (!$notification || $notification->getUser()?->getId() !== $user->getId()) {
            return $this->json(['error' => 'Notification not found'], 404);
        }

        $this->notificationService->markAsRead($notification);

        return $this->json(['success' => true]);
    }

    #[Route('/notifications/read-all', name: 'notifications_read_all', methods: ['POST'])]
    public function markAllNotificationsRead(): JsonResponse
    {
        $user    = $this->getDH();
        $updated = $this->notificationService->markAllAsRead($user);

        return $this->json([
            'success' => true,
            'updated' => $updated,
        ]);
    }

    #[Route('/notifications/{id}', name: 'notification_delete', methods: ['DELETE'])]
    public function deleteNotification(int $id): JsonResponse
    {
        $user = $this->getDH();
        $notification = $this->entityManager->getRepository(Notification::class)->find($id);

        if (!$notification || !$this->notificationService->delete($notification, $user)) {
            return $this->json(['error' => 'Notification not found'], 404);
        }

        return $this->json(['success' => true]);
    }

    // ================================================================
    // Dashboard
    // ================================================================

    #[Route('/dashboard', name: 'dashboard', methods: ['GET'])]
    public function dashboard(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $academicYearId = $request->query->get('academic_year_id');
        $semester = $request->query->get('semester');

        $selectedAcademicYear = $academicYearId ? $this->academicYearRepository->find((int) $academicYearId) : null;
        $selectedSemester = $semester ?: null;

        $data = $this->departmentHeadService->getDashboardData($dh, $selectedAcademicYear, $selectedSemester, false);

        $facultyWorkloads = [];
        foreach ($data['faculty_loads'] as $fl) {
            $f = $fl['faculty'];
            $facultyWorkloads[] = [
                'id'         => $f->getId(),
                'name'       => $f->getFullName(),
                'units'      => $fl['current_load'],
                'percentage' => $fl['percentage'],
                'status'     => $fl['percentage'] > 100 ? 'overloaded' : ($fl['percentage'] >= 70 ? 'optimal' : 'underloaded'),
            ];
        }

        $recentActivities = [];
        foreach ($data['recent_activities'] as $act) {
            $recentActivities[] = [
                'id'          => count($recentActivities) + 1,
                'type'        => $act['type'],
                'description' => $act['description'],
                'timestamp'   => $act['date'] instanceof \DateTimeInterface ? $act['date']->format('c') : (string) $act['date'],
            ];
        }

        return $this->json(['success' => true, 'data' => [
            'totalFaculty'     => $data['total_faculty'],
            'activeFaculty'    => $data['active_faculty'],
            'inactiveFaculty'  => $data['inactive_faculty'],
            'totalSchedules'   => $data['total_schedules'],
            'totalCurricula'   => $data['total_curricula'],
            'totalRooms'       => $data['total_rooms'],
            'schedulesByStatus' => [
                'active'   => $data['active_schedules'],
                'inactive' => $data['total_schedules'] - $data['active_schedules'],
                'draft'    => 0,
            ],
            'facultyWorkloads'  => $facultyWorkloads,
            'recentActivities'  => $recentActivities,
            'conflicts'         => $data['conflicted_schedules'],
            'roomUtilization'   => $data['room_utilization'],
        ]]);
    }

    // ================================================================
    // Department Info
    // ================================================================

    #[Route('/department-info', name: 'dept_info', methods: ['GET'])]
    public function departmentInfo(): JsonResponse
    {
        $dh = $this->getDH();
        $dept = $dh->getDepartment();
        if (!$dept) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'No department assigned.']], 404);
        }

        return $this->json(['success' => true, 'data' => [
            'id'              => $dept->getId(),
            'code'            => $dept->getCode(),
            'name'            => $dept->getName(),
            'description'     => $dept->getDescription(),
            'contactEmail'    => $dept->getContactEmail(),
            'isActive'        => (bool) $dept->getIsActive(),
            'head'            => ['id' => $dh->getId(), 'fullName' => $dh->getFullName()],
            'college'         => $dept->getCollege() ? ['id' => $dept->getCollege()->getId(), 'name' => $dept->getCollege()->getName()] : null,
            'departmentGroup' => $dept->getDepartmentGroup() ? ['id' => $dept->getDepartmentGroup()->getId(), 'name' => $dept->getDepartmentGroup()->getName()] : null,
        ]]);
    }

    // ================================================================
    // Faculty CRUD (scoped to department)
    // ================================================================

    #[Route('/faculty', name: 'faculty_list', methods: ['GET'])]
    public function listFaculty(Request $request): JsonResponse
    {
        $dh = $this->getDH();

        $isActiveParam = $request->query->get('is_active');
        $isActive = null;
        if ($isActiveParam !== null && $isActiveParam !== '') {
            $isActive = $isActiveParam === '1' || $isActiveParam === 'true';
        }

        $filters = [
            'page'           => $request->query->getInt('page', 1),
            'limit'          => $request->query->getInt('limit', 20),
            'search'         => $request->query->get('search'),
            'is_active'      => $isActive,
            'sort_field'     => $request->query->get('sort', 'createdAt'),
            'sort_direction' => strtoupper($request->query->get('direction', 'DESC')),
        ];

        $result = $this->departmentHeadService->getFacultyWithFilters($dh, $filters);
        $users = array_map(fn(User $u) => $this->serializeUser($u), $result['users']);

        return $this->json([
            'success' => true,
            'data'    => $users,
            'meta'    => [
                'total'      => $result['total'],
                'page'       => $result['page'],
                'limit'      => $result['limit'],
                'totalPages' => (int) $result['pages'],
            ],
        ]);
    }

    #[Route('/faculty/{id}', name: 'faculty_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getFaculty(int $id): JsonResponse
    {
        $dh = $this->getDH();
        $user = $this->entityManager->getRepository(User::class)->find($id);
        if (!$user || !$this->departmentHeadService->canAccessUser($dh, $user)) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Faculty not found.']], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeUser($user)]);
    }

    #[Route('/faculty', name: 'faculty_create', methods: ['POST'])]
    public function createFaculty(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        $dhDepartment = $dh->getDepartment();
        if (!$dhDepartment) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'Department Head account has no assigned department.'],
            ], 422);
        }

        $dhCollege = $dhDepartment->getCollege();
        if (!$dhCollege) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'Department Head department has no assigned college.'],
            ], 422);
        }

        $errors = [];
        if (empty($data['username']))  $errors['username'] = 'Username is required.';
        if (empty($data['email']))     $errors['email']    = 'Email is required.';
        if (empty($data['password']) || strlen($data['password']) < 6) $errors['password'] = 'Password must be at least 6 characters.';

        if (!empty($data['username'])) {
            $usernameError = $this->userService->validateUsernameSafety((string) $data['username']);
            if ($usernameError) {
                $errors['username'] = $usernameError;
            }
        }

        if (isset($data['employeeId'])) {
            $employeeIdError = $this->userService->validateEmployeeIdSafety((string) $data['employeeId']);
            if ($employeeIdError) {
                $errors['employeeId'] = $employeeIdError;
            }
        }

        if (!isset($errors['username']) && !empty($data['username']) && !$this->userService->isUsernameAvailable($data['username'])) {
            $errors['username'] = 'Username already taken.';
        }
        if (!empty($data['email']) && !$this->userService->isEmailAvailable($data['email'])) {
            $errors['email'] = 'Email already in use.';
        }
        if (!isset($errors['employeeId']) && !empty($data['employeeId']) && !$this->userService->isEmployeeIdAvailable($data['employeeId'])) {
            $errors['employeeId'] = 'Employee ID already in use.';
        }
        if ($errors) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => $errors]], 422);
        }

        $userData = [
            'username'    => $data['username'],
            'email'       => $data['email'],
            'firstName'   => $data['firstName'] ?? null,
            'middleName'  => $data['middleName'] ?? null,
            'lastName'    => $data['lastName'] ?? null,
            'role'        => 3, // Always faculty
            'employeeId'  => $data['employeeId'] ?? null,
            'position'    => $data['position'] ?? null,
            'address'     => $data['address'] ?? null,
            'otherDesignation' => $data['otherDesignation'] ?? null,
            'collegeId'   => $dhCollege->getId(),
            'departmentId' => $dhDepartment->getId(),
            'isActive'    => $data['isActive'] ?? true,
        ];

        try {
            $user = $this->userService->createUser($userData, $data['password']);
            $this->activityLogService->logUserActivity('faculty.created', $user, ['by' => $dh->getFullName()]);
            return $this->json(['success' => true, 'data' => $this->serializeUser($user)], 201);
        } catch (InvalidArgumentException $e) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => $e->getMessage()],
            ], 422);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 500, 'message' => 'Failed to create faculty: ' . $e->getMessage()]], 500);
        }
    }

    #[Route('/faculty/{id}', name: 'faculty_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateFaculty(int $id, Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $user = $this->entityManager->getRepository(User::class)->find($id);
        if (!$user || !$this->departmentHeadService->canAccessUser($dh, $user)) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Faculty not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        $errors = [];
        if (isset($data['username'])) {
            $usernameError = $this->userService->validateUsernameSafety((string) $data['username']);
            if ($usernameError) {
                $errors['username'] = $usernameError;
            }
        }

        if (isset($data['employeeId'])) {
            $employeeIdError = $this->userService->validateEmployeeIdSafety((string) $data['employeeId']);
            if ($employeeIdError) {
                $errors['employeeId'] = $employeeIdError;
            }
        }

        if (!isset($errors['username']) && isset($data['username']) && !$this->userService->isUsernameAvailable($data['username'], $id)) {
            $errors['username'] = 'Username already taken.';
        }
        if (isset($data['email']) && !$this->userService->isEmailAvailable($data['email'], $id)) {
            $errors['email'] = 'Email already in use.';
        }
        if (
            !isset($errors['employeeId'])
            &&
            isset($data['employeeId'])
            && trim((string) $data['employeeId']) !== ''
            && !$this->userService->isEmployeeIdAvailable((string) $data['employeeId'], $id)
        ) {
            $errors['employeeId'] = 'Employee ID already in use.';
        }
        if ($errors) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => $errors]], 422);
        }

        $userData = [];
        if (isset($data['username']))    $userData['username']    = $data['username'];
        if (isset($data['email']))       $userData['email']       = $data['email'];
        if (isset($data['firstName']))   $userData['firstName']   = $data['firstName'];
        if (isset($data['middleName']))  $userData['middleName']  = $data['middleName'];
        if (isset($data['lastName']))    $userData['lastName']    = $data['lastName'];
        if (isset($data['employeeId']))  $userData['employeeId']  = $data['employeeId'];
        if (isset($data['position']))    $userData['position']    = $data['position'];
        if (isset($data['address']))     $userData['address']     = $data['address'];
        if (array_key_exists('otherDesignation', $data)) $userData['otherDesignation'] = $data['otherDesignation'];
        if (isset($data['isActive']))    $userData['isActive']    = (bool) $data['isActive'];

        $newPassword = $data['password'] ?? null;
        try {
            $this->userService->updateUser($user, $userData, $newPassword);
            $this->activityLogService->logUserActivity('faculty.updated', $user, ['by' => $dh->getFullName()]);
        } catch (InvalidArgumentException $e) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => $e->getMessage()],
            ], 422);
        } catch (\Exception $e) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 500, 'message' => 'Failed to update faculty: ' . $e->getMessage()],
            ], 500);
        }

        return $this->json(['success' => true, 'data' => $this->serializeUser($user)]);
    }

    #[Route('/faculty/{id}', name: 'faculty_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteFaculty(int $id): JsonResponse
    {
        $dh = $this->getDH();
        $user = $this->entityManager->getRepository(User::class)->find($id);
        if (!$user || !$this->departmentHeadService->canAccessUser($dh, $user)) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Faculty not found.']], 404);
        }
        $name = $user->getFullName();
        $this->userService->deleteUser($user);
        $this->activityLogService->log('faculty.deleted', "Faculty {$name} deleted", 'User', $id);

        return $this->json(['success' => true, 'data' => ['message' => 'Faculty deleted successfully.']]);
    }

    #[Route('/faculty/{id}/activate', name: 'faculty_activate', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function activateFaculty(int $id): JsonResponse
    {
        $dh = $this->getDH();
        $user = $this->entityManager->getRepository(User::class)->find($id);
        if (!$user || !$this->departmentHeadService->canAccessUser($dh, $user)) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Faculty not found.']], 404);
        }
        $this->userService->activateUser($user);
        return $this->json(['success' => true, 'data' => $this->serializeUser($user)]);
    }

    #[Route('/faculty/{id}/deactivate', name: 'faculty_deactivate', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function deactivateFaculty(int $id): JsonResponse
    {
        $dh = $this->getDH();
        $user = $this->entityManager->getRepository(User::class)->find($id);
        if (!$user || !$this->departmentHeadService->canAccessUser($dh, $user)) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Faculty not found.']], 404);
        }
        $this->userService->deactivateUser($user);
        return $this->json(['success' => true, 'data' => $this->serializeUser($user)]);
    }

    #[Route('/faculty/generate-password', name: 'faculty_gen_pwd', methods: ['POST'])]
    public function generatePassword(): JsonResponse
    {
        $password = bin2hex(random_bytes(4));
        return $this->json(['success' => true, 'data' => ['password' => $password]]);
    }

    #[Route('/faculty/check-availability', name: 'faculty_check_avail', methods: ['POST'])]
    public function checkAvailability(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (isset($data['username'])) {
            $username = trim((string) $data['username']);
            if ($username === '') {
                return $this->json(['success' => true, 'data' => ['available' => true]]);
            }

            $formatError = $this->userService->validateUsernameSafety($username);
            if ($formatError) {
                return $this->json(['success' => true, 'data' => ['available' => false, 'message' => $formatError]]);
            }

            $available = $this->userService->isUsernameAvailable($username);
            return $this->json(['success' => true, 'data' => ['available' => $available, 'message' => $available ? null : 'Username already taken.']]);
        }
        if (isset($data['email'])) {
            $available = $this->userService->isEmailAvailable($data['email']);
            return $this->json(['success' => true, 'data' => ['available' => $available, 'message' => $available ? null : 'Email already in use.']]);
        }
        if (isset($data['employeeId'])) {
            $employeeId = trim((string) $data['employeeId']);
            if ($employeeId === '') {
                return $this->json(['success' => true, 'data' => ['available' => true]]);
            }

            $formatError = $this->userService->validateEmployeeIdSafety($employeeId);
            if ($formatError) {
                return $this->json(['success' => true, 'data' => ['available' => false, 'message' => $formatError]]);
            }

            $available = $this->userService->isEmployeeIdAvailable($employeeId);
            return $this->json(['success' => true, 'data' => ['available' => $available, 'message' => $available ? null : 'Employee ID already in use.']]);
        }

        return $this->json(['success' => true, 'data' => ['available' => true]]);
    }

    // ================================================================
    // Schedule Change Requests (Department Head Review Queue)
    // ================================================================

    #[Route('/schedule-change-requests', name: 'schedule_change_requests_list', methods: ['GET'])]
    public function listScheduleChangeRequests(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $departmentId = $dh->getDepartmentId();

        if ($departmentId === null) {
            return $this->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $status = trim((string) $request->query->get('status', ScheduleChangeRequest::STATUS_PENDING));
        $departmentHeadStatus = trim((string) $request->query->get('department_head_status', ScheduleChangeRequest::APPROVAL_PENDING));
        $limit = max(1, min(100, (int) $request->query->get('limit', 50)));

        $validRequestStatuses = [
            ScheduleChangeRequest::STATUS_PENDING,
            ScheduleChangeRequest::STATUS_APPROVED,
            ScheduleChangeRequest::STATUS_REJECTED,
            ScheduleChangeRequest::STATUS_CANCELLED,
            'all',
        ];

        $validApprovalStatuses = [
            ScheduleChangeRequest::APPROVAL_PENDING,
            ScheduleChangeRequest::APPROVAL_APPROVED,
            ScheduleChangeRequest::APPROVAL_REJECTED,
            'all',
        ];

        if (!in_array($status, $validRequestStatuses, true)) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'Invalid status filter.'],
            ], 422);
        }

        if (!in_array($departmentHeadStatus, $validApprovalStatuses, true)) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'Invalid department_head_status filter.'],
            ], 422);
        }

        $requests = $this->entityManager
            ->getRepository(ScheduleChangeRequest::class)
            ->findForDepartmentHead(
                $dh,
                (int) $departmentId,
                $status === 'all' ? null : $status,
                $departmentHeadStatus === 'all' ? null : $departmentHeadStatus,
                $limit,
            );

        return $this->json([
            'success' => true,
            'data' => array_map([$this, 'serializeScheduleChangeRequest'], $requests),
        ]);
    }

    #[Route('/schedule-change-requests/{id}', name: 'schedule_change_requests_show', methods: ['GET'], requirements: ['id' => '\\d+'])]
    public function getScheduleChangeRequest(int $id): JsonResponse
    {
        $dh = $this->getDH();

        $requestEntity = $this->entityManager->getRepository(ScheduleChangeRequest::class)->find($id);
        if (!$requestEntity instanceof ScheduleChangeRequest) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 404, 'message' => 'Schedule change request not found.'],
            ], 404);
        }

        if (!$this->canAccessScheduleChangeRequest($dh, $requestEntity)) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 404, 'message' => 'Schedule change request not found.'],
            ], 404);
        }

        return $this->json([
            'success' => true,
            'data' => $this->serializeScheduleChangeRequest($requestEntity),
        ]);
    }

    #[Route('/schedule-change-requests/{id}/approve', name: 'schedule_change_requests_approve', methods: ['POST'], requirements: ['id' => '\\d+'])]
    public function approveScheduleChangeRequest(int $id, Request $request): JsonResponse
    {
        return $this->reviewScheduleChangeRequestAsDepartmentHead($id, true, $request);
    }

    #[Route('/schedule-change-requests/{id}/reject', name: 'schedule_change_requests_reject', methods: ['POST'], requirements: ['id' => '\\d+'])]
    public function rejectScheduleChangeRequest(int $id, Request $request): JsonResponse
    {
        return $this->reviewScheduleChangeRequestAsDepartmentHead($id, false, $request);
    }

    private function reviewScheduleChangeRequestAsDepartmentHead(int $id, bool $approved, Request $request): JsonResponse
    {
        $dh = $this->getDH();

        $payload = $this->parseScheduleChangeReviewPayload($request);
        if ($payload instanceof JsonResponse) {
            return $payload;
        }

        $requestEntity = $this->entityManager->getRepository(ScheduleChangeRequest::class)->find($id);
        if (!$requestEntity instanceof ScheduleChangeRequest) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 404, 'message' => 'Schedule change request not found.'],
            ], 404);
        }

        if (!$this->canAccessScheduleChangeRequest($dh, $requestEntity)) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 404, 'message' => 'Schedule change request not found.'],
            ], 404);
        }

        if (!$requestEntity->getDepartmentHeadApprover() instanceof User) {
            $requestEntity->setDepartmentHeadApprover($dh);
        }

        if ($requestEntity->getStatus() !== ScheduleChangeRequest::STATUS_PENDING) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'Only pending requests can be reviewed.'],
            ], 422);
        }

        if ($requestEntity->getDepartmentHeadStatus() !== ScheduleChangeRequest::APPROVAL_PENDING) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'Department head review has already been completed for this request.'],
            ], 422);
        }

        $comment = $payload['comment'];

        $requestEntity
            ->setDepartmentHeadStatus($approved ? ScheduleChangeRequest::APPROVAL_APPROVED : ScheduleChangeRequest::APPROVAL_REJECTED)
            ->setDepartmentHeadReviewer($dh)
            ->setDepartmentHeadReviewedAt(new \DateTime())
            ->setDepartmentHeadComment($comment);

        $outcome = $this->resolveScheduleChangeRequestOutcome($requestEntity, $approved);
        if ($outcome['success'] !== true) {
            $code = (int) ($outcome['code'] ?? Response::HTTP_CONFLICT);
            $error = [
                'code' => $code,
                'message' => (string) ($outcome['error'] ?? 'Unable to finalize schedule change request.'),
            ];

            if (isset($outcome['details']) && is_array($outcome['details'])) {
                $error['details'] = $outcome['details'];
            }

            return $this->json([
                'success' => false,
                'error' => $error,
            ], $code);
        }

        $this->entityManager->flush();

        $schedule = $requestEntity->getSchedule();
        $subjectCode = (string) ($schedule?->getSubject()?->getCode() ?? 'Unknown Subject');
        $sectionLabel = (string) ($schedule?->getSection() ?? '-');
        $decisionVerb = $approved ? 'approved' : 'rejected';

        $this->activityLogService->log(
            $approved ? 'schedule_change.request_department_head_approved' : 'schedule_change.request_department_head_rejected',
            "Department head {$decisionVerb} schedule change request for {$subjectCode} (Section {$sectionLabel})",
            'ScheduleChangeRequest',
            $requestEntity->getId(),
            [
                'schedule_id' => $schedule?->getId(),
                'subject_code' => $schedule?->getSubject()?->getCode(),
                'section' => $sectionLabel,
                'final_status' => $outcome['status'],
                'department_head_comment' => $comment,
            ],
            $dh,
        );

        if (($outcome['status'] ?? null) === ScheduleChangeRequest::STATUS_APPROVED) {
            $this->activityLogService->log(
                'schedule_change.request_finalized_approved',
                "Schedule change request for {$subjectCode} (Section {$sectionLabel}) was approved and applied",
                'ScheduleChangeRequest',
                $requestEntity->getId(),
                [
                    'schedule_id' => $schedule?->getId(),
                    'changes_summary' => $outcome['changesSummary'] ?? null,
                ],
                $dh,
            );
        } elseif (($outcome['status'] ?? null) === ScheduleChangeRequest::STATUS_REJECTED) {
            $this->activityLogService->log(
                'schedule_change.request_finalized_rejected',
                "Schedule change request for {$subjectCode} (Section {$sectionLabel}) was rejected",
                'ScheduleChangeRequest',
                $requestEntity->getId(),
                [
                    'schedule_id' => $schedule?->getId(),
                    'department_head_comment' => $comment,
                ],
                $dh,
            );
        }

        $this->notifyRequesterOnScheduleChangeDecision($requestEntity, 'Department Head', $approved, (string) $outcome['status']);

        if (
            $approved
            && ($outcome['status'] ?? null) === ScheduleChangeRequest::STATUS_PENDING
            && $requestEntity->getAdminStatus() === ScheduleChangeRequest::APPROVAL_PENDING
        ) {
            $metadata = [
                'schedule_change_request_id' => $requestEntity->getId(),
                'schedule_id' => $schedule?->getId(),
            ];

            $title = 'Schedule Change Request Awaiting Your Review';
            $message = sprintf(
                'A schedule change request for %s (Section %s) is waiting for admin approval.',
                $subjectCode,
                $sectionLabel,
            );

            $adminApprover = $requestEntity->getAdminApprover();
            if ($adminApprover instanceof User) {
                $this->notificationService->create(
                    $adminApprover,
                    Notification::TYPE_SYSTEM,
                    $title,
                    $message,
                    $metadata,
                );
            } else {
                $activeAdmins = $this->entityManager->getRepository(User::class)
                    ->createQueryBuilder('u')
                    ->where('u.role = :role')
                    ->andWhere('u.isActive = :active')
                    ->andWhere('u.deletedAt IS NULL')
                    ->setParameter('role', 1)
                    ->setParameter('active', true)
                    ->orderBy('u.id', 'ASC')
                    ->getQuery()
                    ->getResult();

                if (!empty($activeAdmins)) {
                    $this->notificationService->createForMultipleUsers(
                        $activeAdmins,
                        Notification::TYPE_SYSTEM,
                        $title,
                        $message,
                        $metadata,
                    );
                }
            }
        }

        $message = $approved
            ? 'Schedule change request approved successfully.'
            : 'Schedule change request rejected successfully.';

        if (($outcome['status'] ?? null) === ScheduleChangeRequest::STATUS_APPROVED) {
            $message = 'Schedule change request approved and applied successfully.';
        }

        return $this->json([
            'success' => true,
            'message' => $message,
            'data' => $this->serializeScheduleChangeRequest($requestEntity),
        ]);
    }

    private function parseScheduleChangeReviewPayload(Request $request): array|JsonResponse
    {
        $raw = trim((string) $request->getContent());
        if ($raw === '') {
            return ['comment' => null];
        }

        $data = json_decode($raw, true);
        if (!is_array($data)) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 400, 'message' => 'Invalid request payload.'],
            ], 400);
        }

        $comment = trim((string) ($data['comment'] ?? $data['department_head_comment'] ?? $data['departmentHeadComment'] ?? ''));
        $comment = $comment !== '' ? $comment : null;

        if ($comment !== null && strlen($comment) > 2000) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'comment cannot exceed 2000 characters.',
                ],
            ], 422);
        }

        return ['comment' => $comment];
    }

    private function resolveScheduleChangeRequestOutcome(ScheduleChangeRequest $requestEntity, bool $currentDecisionApproved): array
    {
        if (!$currentDecisionApproved) {
            $requestEntity->setStatus(ScheduleChangeRequest::STATUS_REJECTED);

            return [
                'success' => true,
                'status' => ScheduleChangeRequest::STATUS_REJECTED,
            ];
        }

        $adminApproved = $requestEntity->getAdminStatus() === ScheduleChangeRequest::APPROVAL_APPROVED;
        $departmentHeadApproved = $requestEntity->getDepartmentHeadStatus() === ScheduleChangeRequest::APPROVAL_APPROVED;

        if ($adminApproved || $departmentHeadApproved) {
            $applyResult = $this->applyApprovedScheduleChangeRequest($requestEntity);
            if ($applyResult['success'] !== true) {
                return $applyResult + ['status' => ScheduleChangeRequest::STATUS_PENDING];
            }

            $requestEntity->setStatus(ScheduleChangeRequest::STATUS_APPROVED);

            return [
                'success' => true,
                'status' => ScheduleChangeRequest::STATUS_APPROVED,
                'changesSummary' => $applyResult['changesSummary'] ?? null,
            ];
        }

        $requestEntity->setStatus(ScheduleChangeRequest::STATUS_PENDING);

        return [
            'success' => true,
            'status' => ScheduleChangeRequest::STATUS_PENDING,
        ];
    }

    private function applyApprovedScheduleChangeRequest(ScheduleChangeRequest $requestEntity): array
    {
        $schedule = $requestEntity->getSchedule();
        $proposedRoom = $requestEntity->getProposedRoom();
        $proposedStartTime = $requestEntity->getProposedStartTime();
        $proposedEndTime = $requestEntity->getProposedEndTime();
        $proposedDayPattern = trim((string) $requestEntity->getProposedDayPattern());

        if (
            !$schedule instanceof Schedule
            || !$proposedRoom instanceof Room
            || !$proposedStartTime instanceof \DateTimeInterface
            || !$proposedEndTime instanceof \DateTimeInterface
            || $proposedDayPattern === ''
        ) {
            return [
                'success' => false,
                'code' => Response::HTTP_UNPROCESSABLE_ENTITY,
                'error' => 'Schedule change request has incomplete proposal data.',
            ];
        }

        $originalRoom = $schedule->getRoom();
        $originalDayPattern = $schedule->getDayPattern();
        $originalStartTime = $schedule->getStartTime() ? new \DateTime($schedule->getStartTime()->format('H:i:s')) : null;
        $originalEndTime = $schedule->getEndTime() ? new \DateTime($schedule->getEndTime()->format('H:i:s')) : null;
        $originalSection = $schedule->getSection();

        $schedule
            ->setRoom($proposedRoom)
            ->setDayPattern($proposedDayPattern)
            ->setStartTime(new \DateTime($proposedStartTime->format('H:i:s')))
            ->setEndTime(new \DateTime($proposedEndTime->format('H:i:s')))
            ->setSection($requestEntity->getProposedSection());

        $conflicts = $this->scheduleConflictDetector->detectConflicts($schedule, true);

        if (!empty($conflicts)) {
            $schedule
                ->setRoom($originalRoom)
                ->setDayPattern($originalDayPattern)
                ->setStartTime($originalStartTime)
                ->setEndTime($originalEndTime)
                ->setSection($originalSection);

            return [
                'success' => false,
                'code' => Response::HTTP_CONFLICT,
                'error' => 'Schedule change cannot be finalized because conflicts were detected at approval time.',
                'details' => [
                    'conflicts' => array_map(static fn(array $conflict) => $conflict['message'] ?? ($conflict['type'] ?? 'Conflict detected.'), $conflicts),
                ],
            ];
        }

        $schedule->setIsConflicted(false);
        $schedule->setUpdatedAt(new \DateTime());

        $fromDayPattern = trim((string) ($originalDayPattern ?? '-'));
        $fromStartTime = $originalStartTime?->format('H:i') ?? '-';
        $fromEndTime = $originalEndTime?->format('H:i') ?? '-';
        $toStartTime = $proposedStartTime->format('H:i');
        $toEndTime = $proposedEndTime->format('H:i');

        $fromRoom = $originalRoom?->getCode() ?: $originalRoom?->getName() ?: 'N/A';
        $toRoom = $proposedRoom->getCode() ?: $proposedRoom->getName() ?: 'N/A';

        $fromSection = $originalSection ?: '-';
        $toSection = $requestEntity->getProposedSection() ?: '-';

        return [
            'success' => true,
            'changesSummary' => sprintf(
                'Day/Time %s %s-%s -> %s %s-%s; Room %s -> %s; Section %s -> %s',
                $fromDayPattern,
                $fromStartTime,
                $fromEndTime,
                $proposedDayPattern,
                $toStartTime,
                $toEndTime,
                $fromRoom,
                $toRoom,
                $fromSection,
                $toSection,
            ),
        ];
    }

    private function notifyRequesterOnScheduleChangeDecision(
        ScheduleChangeRequest $requestEntity,
        string $reviewerRole,
        bool $approved,
        string $finalStatus,
    ): void {
        $requester = $requestEntity->getRequester();
        if (!$requester instanceof User) {
            return;
        }

        $schedule = $requestEntity->getSchedule();
        $subjectCode = (string) ($schedule?->getSubject()?->getCode() ?? 'Unknown Subject');
        $sectionLabel = (string) ($schedule?->getSection() ?? '-');

        if (!$approved || $finalStatus === ScheduleChangeRequest::STATUS_REJECTED) {
            $title = 'Schedule Change Request Rejected';
            $message = sprintf(
                'Your schedule change request for %s (Section %s) was rejected by %s.',
                $subjectCode,
                $sectionLabel,
                $reviewerRole,
            );
        } elseif ($finalStatus === ScheduleChangeRequest::STATUS_APPROVED) {
            $title = 'Schedule Change Request Approved';
            $message = sprintf(
                'Your schedule change request for %s (Section %s) has been approved and applied.',
                $subjectCode,
                $sectionLabel,
            );
        } else {
            $title = 'Schedule Change Request Updated';
            $message = sprintf(
                'Your schedule change request for %s (Section %s) was approved by %s and remains pending review.',
                $subjectCode,
                $sectionLabel,
                $reviewerRole,
            );
        }

        $this->notificationService->create(
            $requester,
            Notification::TYPE_SYSTEM,
            $title,
            $message,
            [
                'schedule_change_request_id' => $requestEntity->getId(),
                'schedule_id' => $schedule?->getId(),
                'status' => $finalStatus,
            ],
        );
    }

    // ================================================================
    // Schedules CRUD (scoped to department)
    // ================================================================

    #[Route('/schedules', name: 'schedules_list', methods: ['GET'])]
    public function listSchedules(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 20);
        $search = $request->query->get('search');
        $academicYearId = $request->query->get('academic_year_id');
        $semester = $request->query->get('semester');
        $roomId = $request->query->get('room_id');
        $dayPattern = $request->query->get('day_pattern');
        $status = $request->query->get('status');
        $includeGroup = filter_var($request->query->get('include_group', false), FILTER_VALIDATE_BOOLEAN);

        $activeAy = $academicYearId ? $this->academicYearRepository->find($academicYearId) : $this->systemSettingsService->getActiveAcademicYear();
        $activeSem = $semester ?: $this->systemSettingsService->getActiveSemester();

        $primaryDepartment = $dh->getDepartment();
        if (!$primaryDepartment) {
            return $this->json([
                'success' => true,
                'data' => [],
                'meta' => ['total' => 0, 'page' => $page, 'limit' => $limit, 'totalPages' => 0],
            ]);
        }

        $departmentsForSchedules = $includeGroup
            ? $this->getManagedDepartments($dh)
            : [$primaryDepartment];

        $qb = $this->entityManager->createQueryBuilder()
            ->select('s')
            ->from(Schedule::class, 's')
            ->join('s.subject', 'sub')
            ->leftJoin('s.room', 'r')
            ->leftJoin('s.faculty', 'f')
            ->where('sub.department IN (:deptIds)')
            ->setParameter('deptIds', $departmentsForSchedules)
            ->orderBy('s.createdAt', 'DESC');

        if ($activeAy) $qb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAy);
        if ($activeSem) $qb->andWhere('s.semester = :sem')->setParameter('sem', $activeSem);
        if ($roomId) $qb->andWhere('r.id = :roomId')->setParameter('roomId', (int) $roomId);
        if ($dayPattern) $qb->andWhere('s.dayPattern = :dayPattern')->setParameter('dayPattern', $dayPattern);
        if ($status) $qb->andWhere('s.status = :status')->setParameter('status', $status);
        if ($search) {
            $qb->andWhere('sub.code LIKE :s OR sub.title LIKE :s OR r.code LIKE :s')
               ->setParameter('s', '%' . $search . '%');
        }

        $total = (int) (clone $qb)->select('COUNT(s.id)')->getQuery()->getSingleScalarResult();
        $schedules = $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit)->getQuery()->getResult();

        $items = array_map(fn(Schedule $s) => $this->serializeSchedule($s), $schedules);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int) ceil($total / $limit)],
        ]);
    }

    #[Route('/schedules/{id}', name: 'schedules_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getSchedule(int $id): JsonResponse
    {
        $dh = $this->getDH();
        $schedule = $this->scheduleRepository->find($id);

        // Check if schedule belongs to a managed department
        $managedDepts = $this->getManagedDepartments($dh);
        $managedDeptIds = array_map(fn($d) => $d->getId(), $managedDepts);

        if (!$schedule || !$schedule->getSubject() || !in_array($schedule->getSubject()->getDepartment()?->getId(), $managedDeptIds, true)) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Schedule not found.']], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeSchedule($schedule)]);
    }

    #[Route('/schedules', name: 'schedules_create', methods: ['POST'])]
    public function createSchedule(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        $managedDeptIds = $this->getManagedDepartmentIds($dh);
        if (empty($managedDeptIds)) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Department access is not configured.']], 403);
        }

        $schedule = new Schedule();

        if (!empty($data['academicYearId'])) {
            $ay = $this->academicYearRepository->find((int) $data['academicYearId']);
            if ($ay) $schedule->setAcademicYear($ay);
        }
        $schedule->setSemester($data['semester'] ?? null);

        if (!empty($data['subjectId'])) {
            $subject = $this->subjectRepository->find((int) $data['subjectId']);
            if (!$subject) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Subject not found.']], 404);
            }

            $subjectDeptId = $subject->getDepartment()?->getId();
            if ($subjectDeptId === null || !in_array((int) $subjectDeptId, $managedDeptIds, true)) {
                return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'You can only create schedules for managed departments.']], 403);
            }

            $schedule->setSubject($subject);
        }
        if (!empty($data['roomId'])) {
            $room = $this->roomRepository->find((int) $data['roomId']);
            if (!$room) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
            }

            try {
                $this->departmentHeadService->validateRoomAccess($dh, $room);
            } catch (\Exception) {
                return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Access denied for selected room.']], 403);
            }

            $schedule->setRoom($room);
        }
        if (!empty($data['facultyId'])) {
            $faculty = $this->entityManager->getRepository(User::class)->find((int) $data['facultyId']);
            if (!$faculty) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Faculty not found.']], 404);
            }

            if ((int) $faculty->getRole() !== 3 || !in_array((int) ($faculty->getDepartmentId() ?? 0), $managedDeptIds, true)) {
                return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'You can only assign faculty from managed departments.']], 403);
            }

            $schedule->setFaculty($faculty);
        }

        $schedule->setDayPattern($data['dayPattern'] ?? null);
        $schedule->setStartTime(!empty($data['startTime']) ? new \DateTime($data['startTime']) : null);
        $schedule->setEndTime(!empty($data['endTime']) ? new \DateTime($data['endTime']) : null);
        $schedule->setSection($data['section'] ?? null);
        $schedule->setEnrolledStudents($data['enrolledStudents'] ?? 0);
        $schedule->setStatus($data['status'] ?? 'active');
        $schedule->setNotes($data['notes'] ?? null);

        // Run conflict detection and flag schedule
        $conflicts = $this->scheduleConflictDetector->detectConflicts($schedule);
        $schedule->setIsConflicted(!empty($conflicts));

        $this->entityManager->persist($schedule);
        $this->entityManager->flush();

        // Also flag the conflicting counterpart schedules
        if (!empty($conflicts)) {
            foreach ($conflicts as $c) {
                if (isset($c['schedule']) && $c['schedule'] instanceof Schedule) {
                    $c['schedule']->setIsConflicted(true);
                }
            }
            $this->entityManager->flush();
        }

        $scheduleLabel = $this->formatScheduleLabel($schedule);
        $this->activityLogService->log(
            'schedule.created',
            "Schedule created: {$scheduleLabel}",
            'Schedule',
            $schedule->getId(),
            [
                'subject_code' => $schedule->getSubject()?->getCode(),
                'subject_title' => $schedule->getSubject()?->getTitle(),
                'section' => $schedule->getSection(),
            ]
        );

        $response = ['success' => true, 'data' => $this->serializeSchedule($schedule)];
        if (!empty($conflicts)) {
            $response['meta'] = [
                'conflicts' => array_map(fn($c) => $c['message'] ?? $c['type'], $conflicts),
            ];
        }
        return $this->json($response, 201);
    }

    #[Route('/schedules/{id}', name: 'schedules_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateSchedule(int $id, Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $schedule = $this->scheduleRepository->find($id);

        // Check if schedule belongs to a managed department
        $managedDepts = $this->getManagedDepartments($dh);
        $managedDeptIds = array_map(fn($d) => $d->getId(), $managedDepts);

        if (!$schedule || !$schedule->getSubject() || !in_array($schedule->getSubject()->getDepartment()?->getId(), $managedDeptIds, true)) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Schedule not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (!empty($data['academicYearId'])) {
            $ay = $this->academicYearRepository->find((int) $data['academicYearId']);
            if ($ay) $schedule->setAcademicYear($ay);
        }
        if (isset($data['semester'])) $schedule->setSemester($data['semester']);
        if (!empty($data['subjectId'])) {
            $subject = $this->subjectRepository->find((int) $data['subjectId']);
            if (!$subject) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Subject not found.']], 404);
            }

            $subjectDeptId = $subject->getDepartment()?->getId();
            if ($subjectDeptId === null || !in_array((int) $subjectDeptId, $managedDeptIds, true)) {
                return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'You can only assign subjects from managed departments.']], 403);
            }

            $schedule->setSubject($subject);
        }
        if (array_key_exists('roomId', $data)) {
            if ($data['roomId']) {
                $room = $this->roomRepository->find((int) $data['roomId']);
                if (!$room) {
                    return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
                }

                try {
                    $this->departmentHeadService->validateRoomAccess($dh, $room);
                } catch (\Exception) {
                    return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Access denied for selected room.']], 403);
                }

                $schedule->setRoom($room);
            } else {
                $schedule->setRoom(null);
            }
        }
        if (array_key_exists('facultyId', $data)) {
            if ($data['facultyId']) {
                $faculty = $this->entityManager->getRepository(User::class)->find((int) $data['facultyId']);
                if (!$faculty) {
                    return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Faculty not found.']], 404);
                }

                if ((int) $faculty->getRole() !== 3 || !in_array((int) ($faculty->getDepartmentId() ?? 0), $managedDeptIds, true)) {
                    return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'You can only assign faculty from managed departments.']], 403);
                }

                $schedule->setFaculty($faculty);
            } else {
                $schedule->setFaculty(null);
            }
        }
        if (isset($data['dayPattern'])) $schedule->setDayPattern($data['dayPattern']);
        if (!empty($data['startTime'])) $schedule->setStartTime(new \DateTime($data['startTime']));
        if (!empty($data['endTime'])) $schedule->setEndTime(new \DateTime($data['endTime']));
        if (array_key_exists('section', $data)) $schedule->setSection($data['section']);
        if (isset($data['enrolledStudents'])) $schedule->setEnrolledStudents((int) $data['enrolledStudents']);
        if (isset($data['status'])) $schedule->setStatus($data['status']);
        if (array_key_exists('notes', $data)) $schedule->setNotes($data['notes']);

        // Run conflict detection and flag schedule (exclude self)
        $conflicts = $this->scheduleConflictDetector->detectConflicts($schedule, true);
        $schedule->setIsConflicted(!empty($conflicts));

        // Also flag/unflag the conflicting counterpart schedules
        if (!empty($conflicts)) {
            foreach ($conflicts as $c) {
                if (isset($c['schedule']) && $c['schedule'] instanceof Schedule) {
                    $c['schedule']->setIsConflicted(true);
                }
            }
        }

        $this->entityManager->flush();

        $response = ['success' => true, 'data' => $this->serializeSchedule($schedule)];
        if (!empty($conflicts)) {
            $response['meta'] = [
                'conflicts' => array_map(fn($c) => $c['message'] ?? $c['type'], $conflicts),
            ];
        }
        return $this->json($response);
    }

    #[Route('/schedules/check-conflict', name: 'schedules_check_conflict', methods: ['POST'])]
    public function checkScheduleConflict(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        $managedDeptIds = $this->getManagedDepartmentIds($dh);
        if (empty($managedDeptIds)) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Department access is not configured.']], 403);
        }

        // Build a temporary Schedule entity to leverage the full ScheduleConflictDetector
        $schedule = new Schedule();
        $schedule->setStatus('active');

        if (!empty($data['roomId'])) {
            $room = $this->roomRepository->find((int) $data['roomId']);
            if (!$room) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
            }

            try {
                $this->departmentHeadService->validateRoomAccess($dh, $room);
            } catch (\Exception) {
                return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Access denied for selected room.']], 403);
            }

            $schedule->setRoom($room);
        }
        if (!empty($data['facultyId'])) {
            $faculty = $this->entityManager->getRepository(User::class)->find((int) $data['facultyId']);
            if (!$faculty) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Faculty not found.']], 404);
            }

            if ((int) $faculty->getRole() !== 3 || !in_array((int) ($faculty->getDepartmentId() ?? 0), $managedDeptIds, true)) {
                return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'You can only use faculty from managed departments.']], 403);
            }

            $schedule->setFaculty($faculty);
        }
        if (!empty($data['subjectId'])) {
            $subject = $this->subjectRepository->find((int) $data['subjectId']);
            if (!$subject) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Subject not found.']], 404);
            }

            $subjectDeptId = $subject->getDepartment()?->getId();
            if ($subjectDeptId === null || !in_array((int) $subjectDeptId, $managedDeptIds, true)) {
                return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'You can only use subjects from managed departments.']], 403);
            }

            $schedule->setSubject($subject);
        }
        if (!empty($data['academicYearId'])) {
            $ay = $this->academicYearRepository->find((int) $data['academicYearId']);
            if ($ay) $schedule->setAcademicYear($ay);
        }
        if (!empty($data['dayPattern'])) $schedule->setDayPattern($data['dayPattern']);
        if (!empty($data['startTime'])) $schedule->setStartTime(new \DateTime($data['startTime']));
        if (!empty($data['endTime'])) $schedule->setEndTime(new \DateTime($data['endTime']));
        if (!empty($data['semester'])) $schedule->setSemester($data['semester']);
        if (!empty($data['section'])) $schedule->setSection($data['section']);

        $excludeId = $data['excludeId'] ?? null;

        // Run full conflict detection (room + faculty + section with day overlap)
        $rawConflicts = $this->scheduleConflictDetector->detectConflicts($schedule, false);

        // Filter out the excluded schedule (for edit mode)
        if ($excludeId) {
            $rawConflicts = array_values(array_filter($rawConflicts, function ($c) use ($excludeId) {
                return !(isset($c['schedule']) && $c['schedule'] instanceof Schedule && $c['schedule']->getId() === (int) $excludeId);
            }));
        }

        // Serialize results
        $conflicts = [];
        foreach ($rawConflicts as $c) {
            $entry = [
                'type' => $c['type'],
                'message' => $c['message'] ?? $c['type'],
            ];
            if (isset($c['schedule']) && $c['schedule'] instanceof Schedule) {
                $entry['schedule'] = $this->serializeSchedule($c['schedule']);
            }
            $conflicts[] = $entry;
        }

        return $this->json(['success' => true, 'data' => ['hasConflict' => count($conflicts) > 0, 'conflicts' => $conflicts]]);
    }

    // ================================================================
    // Rooms (scoped to department + group)
    // ================================================================

    #[Route('/rooms', name: 'rooms_list', methods: ['GET'])]
    public function listRooms(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 20);
        $search = $request->query->get('search');

        $isActiveParam = $request->query->get('is_active');
        $isActive = null;
        if ($isActiveParam !== null && $isActiveParam !== '') {
            $isActive = $isActiveParam === '1' || $isActiveParam === 'true';
        }

        $result = $this->departmentHeadService->getRoomsWithFilters($dh, [
            'page'   => $page,
            'limit'  => $limit,
            'search' => $search,
            'is_active' => $isActive,
            'type'   => $request->query->get('type'),
        ]);

        $items = array_map(fn(Room $r) => $this->serializeRoom($r), $result['rooms']);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $result['total'], 'page' => $result['page'], 'limit' => $result['limit'], 'totalPages' => (int) $result['pages']],
        ]);
    }

    #[Route('/rooms/{id}', name: 'rooms_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getRoom(int $id): JsonResponse
    {
        $dh = $this->getDH();
        $room = $this->roomRepository->find($id);
        if (!$room || $room->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
        }

        try {
            $this->departmentHeadService->validateRoomAccess($dh, $room);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Access denied.']], 403);
        }

        return $this->json(['success' => true, 'data' => $this->serializeRoom($room)]);
    }

    #[Route('/rooms', name: 'rooms_create', methods: ['POST'])]
    public function createRoom(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (empty($data['code'])) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['code' => 'Code is required.']]], 422);
        }

        $room = new Room();
        $room->setCode($data['code']);
        $room->setName($data['name'] ?? null);
        $room->setType($data['type'] ?? null);
        $room->setCapacity($data['capacity'] ?? null);
        $room->setBuilding($data['building'] ?? null);
        $room->setFloor($data['floor'] ?? null);
        $room->setEquipment($data['equipment'] ?? null);
        $room->setIsActive($data['isActive'] ?? true);
        $room->setCreatedAt(new \DateTime());
        $room->setUpdatedAt(new \DateTime());

        // Always assign to DH's department
        $dept = $this->departmentRepository->find($dh->getDepartmentId());
        if ($dept) $room->setDepartment($dept);

        $this->entityManager->persist($room);
        $this->entityManager->flush();

        return $this->json(['success' => true, 'data' => $this->serializeRoom($room)], 201);
    }

    #[Route('/rooms/{id}', name: 'rooms_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateRoom(int $id, Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $room = $this->roomRepository->find($id);
        if (!$room || $room->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
        }

        try {
            $this->departmentHeadService->validateRoomAccess($dh, $room);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Access denied.']], 403);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (isset($data['code'])) $room->setCode($data['code']);
        if (array_key_exists('name', $data)) $room->setName($data['name']);
        if (array_key_exists('type', $data)) $room->setType($data['type']);
        if (array_key_exists('capacity', $data)) $room->setCapacity($data['capacity']);
        if (array_key_exists('building', $data)) $room->setBuilding($data['building']);
        if (array_key_exists('floor', $data)) $room->setFloor($data['floor']);
        if (array_key_exists('equipment', $data)) $room->setEquipment($data['equipment']);
        if (isset($data['isActive'])) $room->setIsActive((bool) $data['isActive']);
        $room->setUpdatedAt(new \DateTime());

        $this->entityManager->flush();

        return $this->json(['success' => true, 'data' => $this->serializeRoom($room)]);
    }

    #[Route('/rooms/{id}/activate', name: 'rooms_activate', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function activateRoom(int $id): JsonResponse
    {
        $dh = $this->getDH();
        $room = $this->roomRepository->find($id);
        if (!$room) return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
        try { $this->departmentHeadService->validateRoomAccess($dh, $room); } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Access denied.']], 403);
        }
        $room->setIsActive(true);
        $room->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();
        return $this->json(['success' => true, 'data' => $this->serializeRoom($room)]);
    }

    #[Route('/rooms/{id}/deactivate', name: 'rooms_deactivate', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function deactivateRoom(int $id): JsonResponse
    {
        $dh = $this->getDH();
        $room = $this->roomRepository->find($id);
        if (!$room) return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
        try { $this->departmentHeadService->validateRoomAccess($dh, $room); } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Access denied.']], 403);
        }
        $room->setIsActive(false);
        $room->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();
        return $this->json(['success' => true, 'data' => $this->serializeRoom($room)]);
    }

    #[Route('/rooms/{id}/schedule-pdf', name: 'rooms_schedule_pdf', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getRoomSchedulePdf(int $id, Request $request): Response
    {
        $dh = $this->getDH();
        $room = $this->roomRepository->find($id);

        if (!$room || $room->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
        }

        try {
            $this->departmentHeadService->validateRoomAccess($dh, $room);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Access denied.']], 403);
        }

        $academicYear = trim((string) $request->query->get('academic_year', ''));
        $semester = trim((string) $request->query->get('semester', ''));

        if ($academicYear === '' || $semester === '') {
            $activeYear = $this->systemSettingsService->getActiveAcademicYear();
            $activeSemester = $this->systemSettingsService->getActiveSemester();

            if ($academicYear === '' && $activeYear) {
                $academicYear = $activeYear->getYear();
            }
            if ($semester === '' && $activeSemester) {
                $semester = $activeSemester;
            }
        }

        try {
            $pdfContent = $this->roomSchedulePdfService->generateRoomSchedulePdf(
                $room,
                $academicYear !== '' ? $academicYear : null,
                $semester !== '' ? $semester : null,
            );

            $filename = sprintf('room_schedule_%s_%s.pdf', $room->getCode(), date('Y-m-d'));

            return new Response(
                $pdfContent,
                Response::HTTP_OK,
                [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => 'inline; filename="' . $filename . '"',
                ]
            );
        } catch (\Throwable $e) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 500,
                    'message' => 'Failed to generate room PDF.',
                ],
            ], 500);
        }
    }

    // ================================================================
    // Curricula (scoped to department)
    // ================================================================

    #[Route('/curricula', name: 'curricula_list', methods: ['GET'])]
    public function listCurricula(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $filters = [
            'page'           => $request->query->getInt('page', 1),
            'limit'          => $request->query->getInt('limit', 20),
            'search'         => $request->query->get('search'),
            'is_published'   => $request->query->get('is_published'),
            'sort_field'     => $request->query->get('sort', 'createdAt'),
            'sort_direction' => $request->query->get('direction', 'DESC'),
        ];

        $result = $this->departmentHeadService->getCurriculaWithFilters($dh, $filters);

        $items = array_map(fn(Curriculum $c) => $this->serializeCurriculum($c), $result['curricula']);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $result['total'], 'page' => $result['page'], 'limit' => $result['limit'], 'totalPages' => (int) $result['pages']],
        ]);
    }

    #[Route('/curricula/{id}', name: 'curricula_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getCurriculum(int $id): JsonResponse
    {
        $dh = $this->getDH();
        try {
            $curriculum = $this->departmentHeadService->getCurriculumById($dh, $id);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => $e->getMessage()]], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($curriculum, true)]);
    }

    #[Route('/curricula/{id}/publish', name: 'curricula_publish', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function publishCurriculum(int $id): JsonResponse
    {
        $dh = $this->getDH();
        try {
            $this->departmentHeadService->publishCurriculum($dh, $id);
            $curriculum = $this->departmentHeadService->getCurriculumById($dh, $id);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => $e->getMessage()]], 400);
        }
        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($curriculum)]);
    }

    #[Route('/curricula/{id}/unpublish', name: 'curricula_unpublish', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function unpublishCurriculum(int $id): JsonResponse
    {
        $dh = $this->getDH();
        try {
            $this->departmentHeadService->unpublishCurriculum($dh, $id);
            $curriculum = $this->departmentHeadService->getCurriculumById($dh, $id);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => $e->getMessage()]], 400);
        }
        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($curriculum)]);
    }

    #[Route('/curricula/template/download', name: 'curricula_template_download', methods: ['GET'])]
    public function downloadCurriculumTemplate(): JsonResponse
    {
        $csv = $this->curriculumUploadService->generateTemplate();
        return $this->json(['success' => true, 'data' => ['content' => $csv, 'filename' => 'curriculum_template.csv']]);
    }

    #[Route('/curricula/bulk-upload', name: 'curricula_bulk_upload', methods: ['POST'])]
    public function bulkUploadCurriculum(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $department = $dh->getDepartment();

        if (!$department) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Department Head has no assigned department.']], 400);
        }

        $file = $request->files->get('curriculum_file');
        $curriculumName = trim((string) $request->request->get('curriculum_name', ''));
        $version = (int) $request->request->get('version', 1);
        $autoCreateTerms = $request->request->has('auto_create_terms') ? ($request->request->get('auto_create_terms') === '1') : true;

        if (!$file) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'No file uploaded.']], 400);
        }
        if ($curriculumName === '') {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Curriculum name is required.']], 400);
        }

        $maxSize = 10 * 1024 * 1024;
        if ($file->getSize() > $maxSize) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'File size exceeds 10MB limit.']], 400);
        }

        $extension = strtolower($file->getClientOriginalExtension());
        if (!in_array($extension, ['csv', 'xlsx', 'xls'])) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid format. Supported: CSV, XLSX, XLS']], 400);
        }

        $this->entityManager->beginTransaction();
        try {
            $curriculum = new Curriculum();
            $curriculum->setName($curriculumName);
            $curriculum->setVersion(max(1, $version));
            $curriculum->setDepartment($department);
            $curriculum->setIsPublished(false);
            $curriculum->setCreatedAt(new \DateTimeImmutable());
            $curriculum->setUpdatedAt(new \DateTimeImmutable());
            $this->entityManager->persist($curriculum);
            $this->entityManager->flush();

            $result = $this->curriculumUploadService->processUpload($file, $curriculum, $autoCreateTerms);
            if (!$result['success']) {
                $this->entityManager->rollback();
                return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => $result['message'] ?? 'Upload failed.'], 'details' => $result], 400);
            }

            $this->entityManager->commit();
            $this->entityManager->refresh($curriculum);
            $result['data'] = $this->serializeCurriculum($curriculum, true);
            return $this->json($result, 201);
        } catch (\Exception $e) {
            if ($this->entityManager->getConnection()->isTransactionActive()) {
                $this->entityManager->rollback();
            }
            return $this->json(['success' => false, 'error' => ['code' => 500, 'message' => 'Error processing upload: ' . $e->getMessage()]], 500);
        }
    }

    // ================================================================
    // Faculty Assignments
    // ================================================================

    #[Route('/faculty-assignments', name: 'faculty_assignments', methods: ['GET'])]
    public function facultyAssignments(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $academicYearId = $request->query->get('academic_year_id');
        $semester = $request->query->get('semester');

        $activeAy = $academicYearId ? $this->academicYearRepository->find($academicYearId) : $this->systemSettingsService->getActiveAcademicYear();
        $activeSem = $semester ?: $this->systemSettingsService->getActiveSemester();

        // Get all managed departments
        $managedDepts = $this->getManagedDepartments($dh);
        if (empty($managedDepts)) {
            return $this->json(['success' => true, 'data' => []]);
        }

        // Query faculty from all managed departments
        $faculty = $this->entityManager->getRepository(User::class)->createQueryBuilder('u')
            ->where('u.role = :role')
            ->andWhere('u.department IN (:depts)')
            ->andWhere('u.isActive = :active')
            ->setParameter('role', 3)
            ->setParameter('depts', $managedDepts)
            ->setParameter('active', true)
            ->orderBy('u.firstName', 'ASC')
            ->addOrderBy('u.lastName', 'ASC')
            ->getQuery()
            ->getResult();

        $assignments = [];
        foreach ($faculty as $f) {
            // Get all schedules from any managed department
            $qb = $this->entityManager->createQueryBuilder()
                ->select('s')
                ->from(Schedule::class, 's')
                ->join('s.subject', 'sub')
                ->where('s.faculty = :fId')
                ->andWhere('s.status = :status')
                ->andWhere('sub.department IN (:depts)')
                ->setParameter('fId', $f->getId())
                ->setParameter('status', 'active')
                ->setParameter('depts', $managedDepts);

            if ($activeAy) $qb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAy);
            if ($activeSem) $qb->andWhere('s.semester = :sem')->setParameter('sem', $activeSem);

            $schedules = $qb->getQuery()->getResult();

            $totalUnits = 0;
            $totalHours = 0;
            foreach ($schedules as $s) {
                if ($s->getSubject()) $totalUnits += $s->getSubject()->getUnits();
                $start = $s->getStartTime();
                $end = $s->getEndTime();
                if ($start && $end) {
                    $totalHours += ($start->diff($end)->h + $start->diff($end)->i / 60);
                }
            }

            $assignments[] = [
                'faculty'    => [
                    'id' => $f->getId(),
                    'fullName' => $f->getFullName(),
                    'employeeId' => $f->getEmployeeId(),
                    'position' => $f->getPosition(),
                    'department' => $f->getDepartment() ? [
                        'id' => $f->getDepartment()->getId(),
                        'code' => $f->getDepartment()->getCode(),
                        'name' => $f->getDepartment()->getName(),
                    ] : null,
                ],
                'schedules'  => array_map(fn(Schedule $s) => $this->serializeSchedule($s), $schedules),
                'totalUnits' => $totalUnits,
                'totalHours' => round($totalHours, 1),
            ];
        }

        return $this->json(['success' => true, 'data' => $assignments]);
    }

    // ================================================================
    // Schedule Assignments (Faculty Loading)
    // ================================================================

    #[Route('/schedules/{id}/assign-faculty', name: 'schedules_assign_faculty', methods: ['POST'], requirements: ['id' => '\\d+'])]
    public function assignFacultyToSchedule(int $id, Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $schedule = $this->scheduleRepository->find($id);
        if (!$schedule) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Schedule not found.']], 404);
        }

        $previousFaculty = $schedule->getFaculty();

        $primaryDepartment = $dh->getDepartment();
        if (!$primaryDepartment) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Department not found.']], 403);
        }

        $managedDepts = $this->getManagedDepartments($dh);
        $managedDeptIds = array_map(fn($d) => $d->getId(), $managedDepts);
        if (empty($managedDeptIds)) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Department not found.']], 403);
        }

        // Verify the schedule belongs to the department head's primary department
        $scheduleDept = $schedule->getSubject()?->getDepartment();
        if (!$scheduleDept || $scheduleDept->getId() !== $primaryDepartment->getId()) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'You can only modify schedules from your department.']], 403);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);
        }

        $facultyId = array_key_exists('facultyId', $data) && $data['facultyId'] !== null ? (int) $data['facultyId'] : null;
        if ($facultyId !== null) {
            $faculty = $this->entityManager->getRepository(User::class)->find($facultyId);
            if (!$faculty || !in_array($faculty->getDepartmentId(), $managedDeptIds, true)) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Faculty not found in your managed departments.']], 404);
            }
            $schedule->setFaculty($faculty);

            // Enforce faculty conflict prevention on assignment.
            $conflicts = $this->scheduleConflictDetector->detectConflicts($schedule, true);
            $facultyConflicts = array_values(array_filter($conflicts, static fn(array $c): bool => ($c['type'] ?? '') === 'faculty_conflict'));
            if (!empty($facultyConflicts)) {
                return $this->json([
                    'success' => false,
                    'error' => ['code' => 409, 'message' => 'Faculty conflict detected.'],
                ], 409);
            }
        } else {
            $schedule->setFaculty(null);
        }

        $this->entityManager->flush();

        $scheduleLabel = $this->formatScheduleLabel($schedule);
        $currentFaculty = $schedule->getFaculty();
        $currentFacultyName = $currentFaculty ? $currentFaculty->getFullName() : null;

        if ($facultyId !== null) {
            $assigneeLabel = $currentFacultyName ?? 'a faculty member';
            if ($previousFaculty && $currentFaculty && $previousFaculty->getId() !== $currentFaculty->getId()) {
                $description = sprintf('Reassigned %s from %s to %s.', $scheduleLabel, $previousFaculty->getFullName(), $assigneeLabel);
            } else {
                $description = sprintf('Assigned %s to %s.', $scheduleLabel, $assigneeLabel);
            }
        } else {
            if ($previousFaculty) {
                $description = sprintf('Unassigned %s from %s.', $scheduleLabel, $previousFaculty->getFullName());
            } else {
                $description = sprintf('Unassigned %s.', $scheduleLabel);
            }
        }

        $this->activityLogService->log(
            'schedule_assignment_changed',
            $description,
            'Schedule',
            $schedule->getId(),
            [
                'subject_code' => $schedule->getSubject()?->getCode(),
                'subject_title' => $schedule->getSubject()?->getTitle(),
                'section' => $schedule->getSection(),
                'faculty_name' => $currentFacultyName,
                'previous_faculty_name' => $previousFaculty?->getFullName(),
                'assigned' => $facultyId !== null,
            ]
        );

        return $this->json(['success' => true, 'data' => $this->serializeSchedule($schedule)]);
    }

    #[Route('/schedules/{id}/toggle-overload', name: 'schedules_toggle_overload', methods: ['POST'], requirements: ['id' => '\\d+'])]
    public function toggleOverloadSchedule(int $id): JsonResponse
    {
        $dh = $this->getDH();
        $schedule = $this->scheduleRepository->find($id);
        if (!$schedule) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Schedule not found.']], 404);
        }

        $primaryDepartment = $dh->getDepartment();
        if (!$primaryDepartment) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Department not found.']], 403);
        }

        $scheduleDeptId = $schedule->getSubject()?->getDepartment()?->getId();
        if (!$scheduleDeptId || $scheduleDeptId !== $primaryDepartment->getId()) {
            return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'You can only modify schedules from your department.']], 403);
        }

        $wasOverload = $schedule->isOverload();
        $schedule->setIsOverload(!$wasOverload);
        $this->entityManager->flush();

        $scheduleLabel = $this->formatScheduleLabel($schedule);
        $facultyName = $schedule->getFaculty()?->getFullName();
        if ($schedule->isOverload()) {
            $description = $facultyName
                ? sprintf('Marked %s as overload for %s.', $scheduleLabel, $facultyName)
                : sprintf('Marked %s as overload.', $scheduleLabel);
        } else {
            $description = $facultyName
                ? sprintf('Removed overload from %s for %s.', $scheduleLabel, $facultyName)
                : sprintf('Removed overload from %s.', $scheduleLabel);
        }

        $this->activityLogService->log(
            'schedule_overload_toggled',
            $description,
            'Schedule',
            $schedule->getId(),
            [
                'is_overload' => $schedule->isOverload(),
                'faculty_name' => $facultyName,
                'subject_code' => $schedule->getSubject()?->getCode(),
                'subject_title' => $schedule->getSubject()?->getTitle(),
                'section' => $schedule->getSection(),
            ]
        );

        return $this->json([
            'success' => true,
            'data' => [
                'schedule' => $this->serializeSchedule($schedule),
                'isOverload' => $schedule->isOverload(),
            ],
        ]);
    }

    // ================================================================
    // Reports
    // ================================================================

    #[Route('/reports/teaching-load/pdf', name: 'reports_teaching_load_pdf', methods: ['GET'])]
    public function reportTeachingLoadPdf(Request $request): Response
    {
        $dh = $this->getDH();

        $facultyId = (int) $request->query->get('facultyId', 0);
        if ($facultyId <= 0) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'facultyId is required.'],
            ], 422);
        }

        $faculty = $this->entityManager->getRepository(User::class)->find($facultyId);

        // Get all managed departments and check if faculty is in one of them
        $managedDepts = $this->getManagedDepartments($dh);
        $managedDeptIds = array_map(fn($d) => $d->getId(), $managedDepts);

        if (!$faculty || !in_array($faculty->getDepartmentId(), $managedDeptIds, true)) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 404, 'message' => 'Faculty not found in your managed departments.'],
            ], 404);
        }

        $academicYear = $this->systemSettingsService->getActiveAcademicYear();
        if (!$academicYear) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 404, 'message' => 'No active academic year found.'],
            ], 404);
        }

        $selectedSemester = $request->query->get('semester', $this->systemSettingsService->getActiveSemester());

        $pdfContent = $this->teachingLoadPdfService->generateTeachingLoadPdf(
            $faculty,
            $academicYear,
            $selectedSemester ?: null,
        );

        $safeName = str_replace(' ', '_', trim(($faculty->getFirstName() ?? '') . '_' . ($faculty->getLastName() ?? '')));
        if ($safeName === '_' || $safeName === '') {
            $safeName = 'faculty_' . $faculty->getId();
        }

        $filename = sprintf(
            'Teaching_Load_%s_%s.pdf',
            $safeName,
            $academicYear->getYear()
        );

        return new Response(
            $pdfContent,
            200,
            [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="' . $filename . '"',
                'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ]
        );
    }

    #[Route('/reports/faculty-workload', name: 'reports_faculty_workload', methods: ['GET'])]
    public function reportFacultyWorkload(Request $request): JsonResponse
    {
        try {
            $dh = $this->getDH();

            // Get all managed departments
            $managedDepts = $this->getManagedDepartments($dh);
            if (empty($managedDepts)) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department not found.']], 404);
            }

            $report = $this->departmentHeadService->getFacultyWorkloadReportByDepartments(
                $managedDepts,
                $request->query->get('academic_year_id'),
                $request->query->get('semester'),
                $request->query->get('status', 'all')
            );

            return $this->json(['success' => true, 'data' => $report]);
        } catch (\Exception $e) {
            return $this->json(
                ['success' => false, 'error' => ['code' => 500, 'message' => 'Failed to generate report: ' . $e->getMessage()]],
                500
            );
        }
    }

    #[Route('/reports/room-utilization', name: 'reports_room_utilization', methods: ['GET'])]
    public function reportRoomUtilization(Request $request): JsonResponse
    {
        try {
            $dh = $this->getDH();

            // Get all managed departments
            $managedDepts = $this->getManagedDepartments($dh);
            if (empty($managedDepts)) {
                return $this->json([
                    'success' => false,
                    'error' => [
                        'code' => 404,
                        'message' => 'Department not found.',
                    ],
                ], 404);
            }

            $requestedAcademicYearId = (int) $request->query->get('academic_year_id', 0);
            $requestedSemester = (string) $request->query->get('semester', '');

            $activeAcademicYear = $requestedAcademicYearId > 0
                ? $this->academicYearRepository->find($requestedAcademicYearId)
                : $this->systemSettingsService->getActiveAcademicYear();
            $activeSemester = $requestedSemester !== ''
                ? $requestedSemester
                : $this->systemSettingsService->getActiveSemester();

            // Get rooms from all managed departments
            $rooms = $this->roomRepository->createQueryBuilder('r')
                ->leftJoin('r.department', 'd')
                ->where('r.department IN (:depts)')
                ->setParameter('depts', $managedDepts)
                ->getQuery()
                ->getResult();

            $rows = [];

            foreach ($rooms as $room) {
                $qb = $this->entityManager->createQueryBuilder()
                    ->select('s')
                    ->from(Schedule::class, 's')
                    ->where('s.room = :room')
                    ->andWhere('s.status = :status')
                    ->setParameter('room', $room)
                    ->setParameter('status', 'active');

                if ($activeAcademicYear) {
                    $qb->andWhere('s.academicYear = :academicYear')
                        ->setParameter('academicYear', $activeAcademicYear);
                }
                if ($activeSemester) {
                    $qb->andWhere('s.semester = :semester')
                        ->setParameter('semester', $activeSemester);
                }

                $schedules = $qb->getQuery()->getResult();

                $scheduledHours = 0.0;
                foreach ($schedules as $schedule) {
                    $start = $schedule->getStartTime();
                    $end = $schedule->getEndTime();
                    if ($start && $end) {
                        $scheduledHours += max(0, ($end->getTimestamp() - $start->getTimestamp()) / 3600);
                    }
                }

                $availableHours = 40;
                $utilizationPercent = $availableHours > 0
                    ? (int) min(100, round(($scheduledHours / $availableHours) * 100))
                    : 0;

                $rows[] = [
                    'room' => [
                        'id' => $room->getId(),
                        'code' => $room->getCode(),
                        'name' => $room->getName(),
                        'capacity' => $room->getCapacity(),
                        'department' => $room->getDepartment() ? [
                            'id' => $room->getDepartment()->getId(),
                            'code' => $room->getDepartment()->getCode(),
                            'name' => $room->getDepartment()->getName(),
                        ] : null,
                    ],
                    'scheduledHours' => round($scheduledHours, 1),
                    'availableHours' => $availableHours,
                    'utilizationPercent' => $utilizationPercent,
                ];
            }

            usort($rows, fn(array $a, array $b) => $b['utilizationPercent'] <=> $a['utilizationPercent']);

            return $this->json(['success' => true, 'data' => $rows]);
        } catch (\Throwable $e) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 500,
                    'message' => 'Failed to load room utilization report.',
                ],
            ], 500);
        }
    }

    #[Route('/reports/{type}/pdf', name: 'reports_pdf', methods: ['GET'])]
    public function exportPdfReport(string $type, Request $request): Response
    {
        $dh = $this->getDH();
        $managedDepts = $this->getManagedDepartments($dh);

        if (empty($managedDepts)) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department not found.']], 404);
        }

        $requestedAcademicYearId = (int) $request->query->get('academic_year_id', 0);
        $requestedSemester = trim((string) $request->query->get('semester', ''));
        $search = trim((string) $request->query->get('search', ''));

        $activeAcademicYear = $requestedAcademicYearId > 0
            ? $this->academicYearRepository->find($requestedAcademicYearId)
            : $this->systemSettingsService->getActiveAcademicYear();

        // For export: empty/all semester means include all semesters.
        $activeSemester = null;
        if ($requestedSemester !== '' && strtolower($requestedSemester) !== 'all') {
            $activeSemester = $requestedSemester;
        }
        $semesterVariants = $this->getSemesterVariants($activeSemester);

        if ($type === 'faculty-workload') {
            $facultyMembers = $this->entityManager->getRepository(User::class)
                ->createQueryBuilder('u')
                ->where('u.role = :role')
                ->andWhere('u.department IN (:depts)')
                ->andWhere('u.isActive = :active')
                ->setParameter('role', 3)
                ->setParameter('depts', $managedDepts)
                ->setParameter('active', true)
                ->orderBy('u.lastName', 'ASC')
                ->addOrderBy('u.firstName', 'ASC')
                ->getQuery()
                ->getResult();

            $rows = [];
            foreach ($facultyMembers as $faculty) {
                $qb = $this->entityManager->createQueryBuilder()
                    ->select('s', 'sub')
                    ->from(Schedule::class, 's')
                    ->leftJoin('s.subject', 'sub')
                    ->where('s.faculty = :faculty')
                    ->andWhere('s.status = :status')
                    ->andWhere('sub.department IN (:depts)')
                    ->setParameter('faculty', $faculty)
                    ->setParameter('status', 'active')
                    ->setParameter('depts', $managedDepts);

                if ($activeAcademicYear) {
                    $qb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAcademicYear);
                }
                if (!empty($semesterVariants)) {
                    $qb->andWhere('s.semester IN (:semesters)')->setParameter('semesters', $semesterVariants);
                }

                $schedules = $qb->getQuery()->getResult();
                $totalUnits = 0;
                foreach ($schedules as $schedule) {
                    $totalUnits += (int) ($schedule->getSubject()?->getUnits() ?? 0);
                }

                if ($search !== '') {
                    $haystack = strtolower(implode(' ', [
                        $faculty->getFullName() ?? '',
                        $faculty->getEmployeeId() ?? '',
                        $faculty->getDepartment()?->getName() ?? '',
                    ]));
                    if (!str_contains($haystack, strtolower($search))) {
                        continue;
                    }
                }

                $rows[] = [
                    0 => $faculty,
                    'scheduleCount' => count($schedules),
                    'totalUnits' => $totalUnits,
                ];
            }

            $pdfContent = $this->facultyReportPdfService->generateFacultyReportPdf(
                $rows,
                $activeAcademicYear?->getYear(),
                $activeSemester,
                null,
                $search !== '' ? $search : null,
            );

            $filename = sprintf('Faculty_Workload_%s_%s.pdf', $activeAcademicYear?->getYear() ?? 'CurrentAY', $activeSemester ?: 'CurrentSem');

            return new Response($pdfContent, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="' . $filename . '"',
            ]);
        }

        if ($type === 'room-utilization') {
            $rooms = $this->roomRepository->createQueryBuilder('r')
                ->where('r.department IN (:depts)')
                ->setParameter('depts', $managedDepts)
                ->orderBy('r.code', 'ASC')
                ->getQuery()
                ->getResult();

            $rows = [];
            foreach ($rooms as $room) {
                $qb = $this->entityManager->createQueryBuilder()
                    ->select('s', 'sub', 'd')
                    ->from(Schedule::class, 's')
                    ->leftJoin('s.subject', 'sub')
                    ->leftJoin('sub.department', 'd')
                    ->where('s.room = :room')
                    ->andWhere('s.status = :status')
                    ->andWhere('sub.department IN (:depts)')
                    ->setParameter('room', $room)
                    ->setParameter('status', 'active')
                    ->setParameter('depts', $managedDepts);

                if ($activeAcademicYear) {
                    $qb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAcademicYear);
                }
                if (!empty($semesterVariants)) {
                    $qb->andWhere('s.semester IN (:semesters)')->setParameter('semesters', $semesterVariants);
                }

                $schedules = $qb->getQuery()->getResult();
                $deptNames = [];
                foreach ($schedules as $schedule) {
                    $deptName = $schedule->getSubject()?->getDepartment()?->getName();
                    if ($deptName && !in_array($deptName, $deptNames, true)) {
                        $deptNames[] = $deptName;
                    }
                }

                if ($search !== '') {
                    $haystack = strtolower(implode(' ', [
                        $room->getCode() ?? '',
                        $room->getName() ?? '',
                        $room->getBuilding() ?? '',
                        implode(' ', $deptNames),
                    ]));
                    if (!str_contains($haystack, strtolower($search))) {
                        continue;
                    }
                }

                $rows[] = [
                    0 => $room,
                    'scheduleCount' => count($schedules),
                    'departments' => !empty($deptNames) ? implode(', ', $deptNames) : 'N/A',
                ];
            }

            $pdfContent = $this->roomsReportPdfService->generateRoomsReportPdf(
                $rows,
                $activeAcademicYear?->getYear(),
                $activeSemester,
                null,
                $search !== '' ? $search : null,
            );

            $filename = sprintf('Room_Utilization_%s_%s.pdf', $activeAcademicYear?->getYear() ?? 'CurrentAY', $activeSemester ?: 'CurrentSem');

            return new Response($pdfContent, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="' . $filename . '"',
            ]);
        }

        if ($type === 'subject-offerings') {
            $subjects = $this->entityManager->getRepository(Subject::class)
                ->createQueryBuilder('sub')
                ->where('sub.deletedAt IS NULL')
                ->andWhere('sub.department IN (:depts)')
                ->setParameter('depts', $managedDepts)
                ->orderBy('sub.code', 'ASC')
                ->getQuery()
                ->getResult();

            $rows = [];
            foreach ($subjects as $subject) {
                if ($search !== '') {
                    $haystack = strtolower(implode(' ', [
                        $subject->getCode() ?? '',
                        $subject->getTitle() ?? '',
                        $subject->getDepartment()?->getName() ?? '',
                    ]));
                    if (!str_contains($haystack, strtolower($search))) {
                        continue;
                    }
                }

                $qb = $this->entityManager->createQueryBuilder()
                    ->select('s', 'r', 'f', 'ay')
                    ->from(Schedule::class, 's')
                    ->leftJoin('s.room', 'r')
                    ->leftJoin('s.faculty', 'f')
                    ->leftJoin('s.academicYear', 'ay')
                    ->where('s.subject = :subject')
                    ->andWhere('s.status = :status')
                    ->setParameter('subject', $subject)
                    ->setParameter('status', 'active');

                if ($activeAcademicYear) {
                    $qb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAcademicYear);
                }
                if (!empty($semesterVariants)) {
                    $qb->andWhere('s.semester IN (:semesters)')->setParameter('semesters', $semesterVariants);
                }

                $schedules = $qb->getQuery()->getResult();
                $scheduleRows = [];

                foreach ($schedules as $schedule) {
                    $scheduleRows[] = [
                        'section' => $schedule->getSection() ?: 'N/A',
                        'time' => $schedule->getStartTime() && $schedule->getEndTime()
                            ? ($schedule->getStartTime()->format('h:i A') . ' - ' . $schedule->getEndTime()->format('h:i A'))
                            : 'N/A',
                        'day' => $schedule->getDayPattern() ?: 'N/A',
                        'room' => $schedule->getRoom()?->getCode() ?: 'N/A',
                        'faculty' => $schedule->getFaculty()?->getFullName() ?: 'N/A',
                        'year' => $schedule->getAcademicYear()?->getYear(),
                        'semester' => $schedule->getSemester() ?: null,
                    ];
                }

                $rows[] = [
                    0 => $subject,
                    'schedules' => $scheduleRows,
                ];
            }

            $pdfContent = $this->subjectsReportPdfService->generateSubjectsHistoryPdf(
                $rows,
                $activeAcademicYear?->getYear(),
                $activeSemester,
                null,
                $search !== '' ? $search : null,
            );

            $filename = sprintf('Subject_Offerings_%s_%s.pdf', $activeAcademicYear?->getYear() ?? 'CurrentAY', $activeSemester ?: 'CurrentSem');

            return new Response($pdfContent, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="' . $filename . '"',
            ]);
        }

        return $this->json([
            'success' => false,
            'error' => ['code' => 501, 'message' => 'PDF export not yet implemented for this report type.'],
        ], 501);
    }

    // ================================================================
    // Settings
    // ================================================================

    #[Route('/settings', name: 'settings_get', methods: ['GET'])]
    public function getSettings(): JsonResponse
    {
        $activeAy = $this->systemSettingsService->getActiveAcademicYear();

        return $this->json(['success' => true, 'data' => [
            'currentAcademicYear' => $activeAy ? [
                'id'              => $activeAy->getId(),
                'year'            => $activeAy->getYear(),
                'currentSemester' => $activeAy->getCurrentSemester(),
            ] : null,
            'activeSemester'    => $this->systemSettingsService->getActiveSemester(),
            'hasActiveSemester' => $this->systemSettingsService->hasActiveSemester(),
        ]]);
    }

    #[Route('/settings', name: 'settings_update', methods: ['PUT'])]
    public function updateSettings(Request $request): JsonResponse
    {
        // DH can only view settings, not update system settings
        return $this->json(['success' => false, 'error' => ['code' => 403, 'message' => 'Department heads cannot modify system settings.']], 403);
    }

    // ================================================================
       // Lookup helpers (academic years, subjects)
    // ================================================================

    #[Route('/academic-years', name: 'academic_years', methods: ['GET'])]
    public function lookupAcademicYears(): JsonResponse
    {
        $years = $this->academicYearRepository->findActive();
        $items = array_map(fn(AcademicYear $a) => [
            'id'              => $a->getId(),
            'year'            => $a->getYear(),
            'isCurrent'       => (bool) $a->isCurrent(),
            'currentSemester' => $a->getCurrentSemester(),
            'isActive'        => (bool) $a->isActive(),
        ], $years);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => count($items), 'page' => 1, 'limit' => 100, 'totalPages' => 1],
        ]);
    }

    #[Route('/subjects', name: 'subjects', methods: ['GET'])]
    public function lookupSubjects(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $deptId = $dh->getDepartmentId();
        $requestedSemester = trim((string) $request->query->get('semester', ''));
        $semester = $requestedSemester !== '' ? $requestedSemester : $this->systemSettingsService->getActiveSemester();

        $subjects = $deptId
            ? $this->subjectRepository->findByDepartmentFromPublishedCurriculaBySemester($deptId, $semester)
            : [];

        $items = array_map(fn(Subject $s) => [
            'id'    => $s->getId(),
            'code'  => $s->getCode(),
            'title' => $s->getTitle(),
            'units' => $s->getUnits(),
            'type'  => $s->getType(),
        ], $subjects);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => count($items), 'page' => 1, 'limit' => 200, 'totalPages' => 1],
        ]);
    }

    // ================================================================
    // Activity Logs
    // ================================================================

    #[Route('/activity-logs', name: 'activity_logs_list', methods: ['GET'])]
    public function listActivityLogs(Request $request): JsonResponse
    {
        $dh = $this->getDH();
        $page = max(1, $request->query->getInt('page', 1));
        $limit = max(1, min(100, $request->query->getInt('limit', 20)));
        $search = trim((string) $request->query->get('search', ''));
        $action = $request->query->get('action');

        // Get all managed departments
        $managedDepts = $this->getManagedDepartments($dh);
        if (empty($managedDepts)) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 404, 'message' => 'Department not found.'],
            ], 404);
        }

        // Get paginated activity logs for all managed departments
        $logs = $this->entityManager->getRepository(ActivityLog::class)->findByDepartments($managedDepts, $page, $limit);
        $total = $this->entityManager->getRepository(ActivityLog::class)->countByDepartments($managedDepts);

        // Apply additional filters (search and action)
        $filtered = $logs;
        if ($search) {
            $searchLower = strtolower($search);
            $filtered = array_filter($logs, function ($log) use ($searchLower) {
                return stripos($log->getDescription(), $searchLower) !== false
                    || stripos($log->getAction(), $searchLower) !== false;
            });
        }

        if ($action) {
            $filtered = array_filter($filtered, function ($log) use ($action) {
                return $log->getAction() === $action;
            });
        }

        // Serialize results
        $items = array_map(function (ActivityLog $a) {
            return [
                'id'          => $a->getId(),
                'action'      => $a->getAction(),
                'description' => $a->getDescription(),
                'entityType'  => $a->getEntityType(),
                'entityId'    => $a->getEntityId(),
                'metadata'    => $a->getMetadata(),
                'ipAddress'   => $a->getIpAddress(),
                'createdAt'   => $a->getCreatedAt()?->format('c'),
                'user'        => $a->getUser() ? [
                    'id'       => $a->getUser()->getId(),
                    'fullName' => $a->getUser()->getFullName(),
                ] : null,
            ];
        }, $filtered);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => [
                'total'      => $total,
                'page'       => $page,
                'limit'      => $limit,
                'totalPages' => (int) ceil($total / $limit),
            ],
        ]);
    }

    // ================================================================
    // Serialization Helpers
    // ================================================================

    private function formatScheduleLabel(Schedule $schedule): string
    {
        $subject = $schedule->getSubject();
        $subjectLabel = $subject?->getCode() ?: $subject?->getTitle() ?: 'Unknown subject';
        $section = $schedule->getSection();

        return $section ? sprintf('%s (%s)', $subjectLabel, $section) : $subjectLabel;
    }

    private function serializeUser(User $user): array
    {
        return [
            'id'               => $user->getId(),
            'username'         => $user->getUsername(),
            'email'            => $user->getEmail(),
            'firstName'        => $user->getFirstName(),
            'middleName'       => $user->getMiddleName(),
            'lastName'         => $user->getLastName(),
            'fullName'         => $user->getFullName(),
            'role'             => $user->getRole(),
            'roleString'       => $user->getRoleString(),
            'roleDisplayName'  => $user->getRoleDisplayName(),
            'employeeId'       => $user->getEmployeeId(),
            'position'         => $user->getPosition(),
            'address'          => $user->getAddress(),
            'otherDesignation' => $user->getOtherDesignation(),
            'isActive'         => (bool) $user->isActive(),
            'lastLogin'        => $user->getLastLogin()?->format('c'),
            'college'          => $user->getCollege() ? [
                'id'   => $user->getCollege()->getId(),
                'name' => $user->getCollege()->getName(),
            ] : null,
            'department'       => $user->getDepartment() ? [
                'id'   => $user->getDepartment()->getId(),
                'name' => $user->getDepartment()->getName(),
            ] : null,
            'createdAt'        => $user->getCreatedAt()?->format('c'),
            'updatedAt'        => $user->getUpdatedAt()?->format('c'),
        ];
    }

    private function serializeSchedule(Schedule $s): array
    {
        return [
            'id'               => $s->getId(),
            'semester'         => $s->getSemester(),
            'dayPattern'       => $s->getDayPattern(),
            'startTime'        => $s->getStartTime()?->format('H:i'),
            'endTime'          => $s->getEndTime()?->format('H:i'),
            'section'          => $s->getSection(),
            'enrolledStudents' => $s->getEnrolledStudents(),
            'isConflicted'     => (bool) $s->getIsConflicted(),
            'isOverload'       => (bool) $s->getIsOverload(),
            'status'           => $s->getStatus(),
            'notes'            => $s->getNotes(),
            'subject'          => $s->getSubject() ? [
                'id'    => $s->getSubject()->getId(),
                'code'  => $s->getSubject()->getCode(),
                'title' => $s->getSubject()->getTitle(),
                'units' => $s->getSubject()->getUnits(),
                'department' => $s->getSubject()->getDepartment() ? [
                    'id' => $s->getSubject()->getDepartment()->getId(),
                    'name' => $s->getSubject()->getDepartment()->getName(),
                ] : null,
            ] : null,
            'room'             => $s->getRoom() ? [
                'id'       => $s->getRoom()->getId(),
                'code'     => $s->getRoom()->getCode(),
                'name'     => $s->getRoom()->getName(),
                'building' => $s->getRoom()->getBuilding(),
            ] : null,
            'faculty'          => $s->getFaculty() ? [
                'id'       => $s->getFaculty()->getId(),
                'fullName' => $s->getFaculty()->getFullName(),
            ] : null,
            'academicYear'     => $s->getAcademicYear() ? [
                'id'   => $s->getAcademicYear()->getId(),
                'year' => $s->getAcademicYear()->getYear(),
            ] : null,
            'createdAt'        => $s->getCreatedAt()?->format('c'),
            'updatedAt'        => $s->getUpdatedAt()?->format('c'),
        ];
    }

    private function serializeScheduleChangeRequest(ScheduleChangeRequest $request): array
    {
        return [
            'id' => $request->getId(),
            'status' => $request->getStatus(),
            'adminStatus' => $request->getAdminStatus(),
            'departmentHeadStatus' => $request->getDepartmentHeadStatus(),
            'requestReason' => $request->getRequestReason(),
            'adminComment' => $request->getAdminComment(),
            'departmentHeadComment' => $request->getDepartmentHeadComment(),
            'submittedAt' => $request->getSubmittedAt()?->format('c'),
            'adminReviewedAt' => $request->getAdminReviewedAt()?->format('c'),
            'departmentHeadReviewedAt' => $request->getDepartmentHeadReviewedAt()?->format('c'),
            'cancelledAt' => $request->getCancelledAt()?->format('c'),
            'createdAt' => $request->getCreatedAt()?->format('c'),
            'updatedAt' => $request->getUpdatedAt()?->format('c'),
            'requester' => $this->serializeScheduleChangeUserSummary($request->getRequester()),
            'subjectDepartment' => $request->getSubjectDepartment() ? [
                'id' => $request->getSubjectDepartment()?->getId(),
                'code' => $request->getSubjectDepartment()?->getCode(),
                'name' => $request->getSubjectDepartment()?->getName(),
            ] : null,
            'schedule' => $request->getSchedule() ? $this->serializeSchedule($request->getSchedule()) : null,
            'proposal' => [
                'dayPattern' => $request->getProposedDayPattern(),
                'startTime' => $request->getProposedStartTime()?->format('H:i'),
                'endTime' => $request->getProposedEndTime()?->format('H:i'),
                'section' => $request->getProposedSection(),
                'room' => $this->serializeScheduleChangeRoomSummary($request->getProposedRoom()),
            ],
            'approvers' => [
                'admin' => $this->serializeScheduleChangeUserSummary($request->getAdminApprover()),
                'departmentHead' => $this->serializeScheduleChangeUserSummary($request->getDepartmentHeadApprover()),
            ],
            'reviewers' => [
                'admin' => $this->serializeScheduleChangeUserSummary($request->getAdminReviewer()),
                'departmentHead' => $this->serializeScheduleChangeUserSummary($request->getDepartmentHeadReviewer()),
            ],
            'requestedChanges' => $request->getRequestedChanges(),
            'conflictSnapshot' => $request->getConflictSnapshot(),
            'canDepartmentHeadReview' => $request->getStatus() === ScheduleChangeRequest::STATUS_PENDING
                && $request->getDepartmentHeadStatus() === ScheduleChangeRequest::APPROVAL_PENDING,
        ];
    }

    private function serializeScheduleChangeUserSummary(?User $user): ?array
    {
        if (!$user instanceof User) {
            return null;
        }

        return [
            'id' => $user->getId(),
            'fullName' => $user->getFullName(),
            'email' => $user->getEmail(),
            'role' => $user->getRoleDisplayName(),
            'department' => $user->getDepartment() ? [
                'id' => $user->getDepartment()->getId(),
                'code' => $user->getDepartment()->getCode(),
                'name' => $user->getDepartment()->getName(),
            ] : null,
        ];
    }

    private function serializeScheduleChangeRoomSummary(?Room $room): ?array
    {
        if (!$room instanceof Room) {
            return null;
        }

        return [
            'id' => $room->getId(),
            'code' => $room->getCode(),
            'name' => $room->getName(),
            'building' => $room->getBuilding(),
            'floor' => $room->getFloor(),
            'capacity' => $room->getCapacity(),
        ];
    }

    private function serializeRoom(Room $r): array
    {
        return [
            'id'              => $r->getId(),
            'code'            => $r->getCode(),
            'name'            => $r->getName(),
            'type'            => $r->getType(),
            'capacity'        => $r->getCapacity(),
            'building'        => $r->getBuilding(),
            'floor'           => $r->getFloor(),
            'equipment'       => $r->getEquipment(),
            'isActive'        => (bool) $r->isActive(),
            'department'      => $r->getDepartment() ? ['id' => $r->getDepartment()->getId(), 'name' => $r->getDepartment()->getName()] : null,
            'departmentGroup' => $r->getDepartmentGroup() ? ['id' => $r->getDepartmentGroup()->getId(), 'name' => $r->getDepartmentGroup()->getName()] : null,
            'createdAt'       => $r->getCreatedAt()?->format('c'),
            'updatedAt'       => $r->getUpdatedAt()?->format('c'),
        ];
    }

    private function serializeCurriculum(Curriculum $c, bool $withTerms = false): array
    {
        $data = [
            'id'              => $c->getId(),
            'name'            => $c->getName(),
            'version'         => $c->getVersion(),
            'isPublished'     => (bool) $c->isPublished(),
            'effectiveYearId' => $c->getEffectiveYearId(),
            'notes'           => $c->getNotes(),
            'totalSubjects'   => $c->getTotalSubjects(),
            'totalUnits'      => $c->getTotalUnits(),
            'termCount'       => $c->getCurriculumTerms()->count(),
            'department'      => $c->getDepartment() ? ['id' => $c->getDepartment()->getId(), 'name' => $c->getDepartment()->getName()] : null,
            'createdAt'       => $c->getCreatedAt()?->format('c'),
            'updatedAt'       => $c->getUpdatedAt()?->format('c'),
        ];

        if ($withTerms) {
            $terms = [];
            foreach ($c->getCurriculumTerms() as $term) {
                $subjects = [];
                foreach ($term->getCurriculumSubjects() as $cs) {
                    $subjects[] = [
                        'id'              => $cs->getId(),
                        'sectionsMapping' => $cs->getSectionsMapping(),
                        'subject'         => $cs->getSubject() ? [
                            'id'    => $cs->getSubject()->getId(),
                            'code'  => $cs->getSubject()->getCode(),
                            'title' => $cs->getSubject()->getTitle(),
                            'units' => $cs->getSubject()->getUnits(),
                            'lectureHours' => $cs->getSubject()->getLectureHours(),
                            'labHours' => $cs->getSubject()->getLabHours(),
                            'type'  => $cs->getSubject()->getType(),
                        ] : null,
                    ];
                }
                $terms[] = [
                    'id'        => $term->getId(),
                    'yearLevel' => $term->getYearLevel(),
                    'semester'  => $term->getSemester(),
                    'termName'  => $term->getTermName(),
                    'displayName' => $term->getDisplayName(),
                    'totalUnits' => $term->getTotalUnits(),
                    'curriculumSubjects' => $subjects,
                    'createdAt' => $term->getCreatedAt()?->format('c'),
                    'updatedAt' => $term->getUpdatedAt()?->format('c'),
                ];
            }
            // Keep both keys for compatibility; frontend expects curriculumTerms.
            $data['curriculumTerms'] = $terms;
            $data['terms'] = $terms;
        }

        return $data;
    }
}
