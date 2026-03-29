<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Entity\College;
use App\Entity\Department;
use App\Entity\Subject;
use App\Entity\Room;
use App\Entity\AcademicYear;
use App\Entity\Curriculum;
use App\Entity\CurriculumTerm;
use App\Entity\CurriculumSubject;
use App\Entity\Schedule;
use App\Entity\ScheduleChangeRequest;
use App\Entity\DepartmentGroup;
use App\Entity\Notification;
use App\Repository\CollegeRepository;
use App\Repository\DepartmentRepository;
use App\Repository\SubjectRepository;
use App\Repository\RoomRepository;
use App\Repository\AcademicYearRepository;
use App\Repository\CurriculumRepository;
use App\Repository\CurriculumTermRepository;
use App\Repository\CurriculumSubjectRepository;
use App\Repository\ScheduleRepository;
use App\Repository\DepartmentGroupRepository;
use App\Repository\ActivityLogRepository;
use App\Service\ActivityLogService;
use App\Service\AcademicYearService;
use App\Service\CollegeService;
use App\Service\CurriculumUploadService;
use App\Service\DashboardService;
use App\Service\DepartmentService;
use App\Service\FacultyReportPdfService;
use App\Service\NotificationService;
use App\Service\RoomSchedulePdfService;
use App\Service\RoomService;
use App\Service\RoomsReportPdfService;
use App\Service\ScheduleConflictDetector;
use App\Service\SubjectsReportPdfService;
use App\Service\SystemSettingsService;
use App\Service\TeachingLoadPdfService;
use App\Service\UserService;
use Doctrine\ORM\EntityManagerInterface;
use InvalidArgumentException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin', name: 'api_admin_')]
#[IsGranted('ROLE_ADMIN')]
class ApiAdminController extends AbstractController
{
    public function __construct(
        private DashboardService $dashboardService,
        private SystemSettingsService $systemSettingsService,
        private UserService $userService,
        private ActivityLogService $activityLogService,
        private CollegeRepository $collegeRepository,
        private DepartmentRepository $departmentRepository,
        private SubjectRepository $subjectRepository,
        private RoomRepository $roomRepository,
        private AcademicYearRepository $academicYearRepository,
        private CurriculumRepository $curriculumRepository,
        private CurriculumTermRepository $curriculumTermRepository,
        private CurriculumSubjectRepository $curriculumSubjectRepository,
        private ScheduleRepository $scheduleRepository,
        private DepartmentGroupRepository $departmentGroupRepository,
        private ActivityLogRepository $activityLogRepository,
        private EntityManagerInterface $entityManager,
        private CurriculumUploadService $curriculumUploadService,
        private CollegeService $collegeService,
        private DepartmentService $departmentService,
        private RoomService $roomService,
        private RoomSchedulePdfService $roomSchedulePdfService,
        private AcademicYearService $academicYearService,
        private NotificationService $notificationService,
        private ScheduleConflictDetector $scheduleConflictDetector,
        private FacultyReportPdfService $facultyReportPdfService,
        private RoomsReportPdfService $roomsReportPdfService,
        private SubjectsReportPdfService $subjectsReportPdfService,
        private TeachingLoadPdfService $teachingLoadPdfService,
    ) {
    }

    // ================================================================
    // Helper: serialize a User entity to the JSON shape the frontend expects
    // ================================================================
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
            'deletedAt'        => $user->getDeletedAt()?->format('c'),
        ];
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
    // Profile (current admin user)
    // ================================================================

    #[Route('/profile', name: 'profile', methods: ['GET'])]
    public function profile(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

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
        /** @var User $user */
        $user = $this->getUser();

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

    // ================================================================
    // Users CRUD
    // ================================================================

    #[Route('/users', name: 'users_list', methods: ['GET'])]
    public function listUsers(Request $request): JsonResponse
    {
        $isActiveParam = $request->query->get('is_active');
        $isActive = null;
        if ($isActiveParam !== null && $isActiveParam !== '') {
            $isActive = $isActiveParam === '1' || $isActiveParam === 'true';
        }

        $includeDeletedParam = $request->query->get('include_deleted', '0');
        $includeDeleted = $includeDeletedParam === '1' || strtolower((string) $includeDeletedParam) === 'true';

        // Resolve department group: if the department is in a group, include all departments in that group
        $departmentId = $request->query->get('department_id') ? (int) $request->query->get('department_id') : null;
        $departmentIds = null;
        if ($departmentId) {
            $dept = $this->departmentRepository->find($departmentId);
            $group = $dept?->getDepartmentGroup();
            if ($group) {
                $departmentIds = array_map(fn($d) => $d->getId(), $group->getDepartments()->toArray());
            } else {
                $departmentIds = [$departmentId];
            }
        }

        $filters = [
            'page'           => $request->query->getInt('page', 1),
            'limit'          => $request->query->getInt('limit', 20),
            'search'         => $request->query->get('search'),
            'role'           => $request->query->get('role') ? (int) $request->query->get('role') : null,
            'is_active'      => $isActive,
            'include_deleted' => $includeDeleted,
            'college_id'     => $request->query->get('college_id') ? (int) $request->query->get('college_id') : null,
            'department_ids' => $departmentIds,
            'sort_field'     => $request->query->get('sort', 'createdAt'),
            'sort_direction' => strtoupper($request->query->get('direction', 'DESC')),
        ];

        $result = $this->userService->getUsersWithFilters($filters);

        $users = array_map(fn(User $u) => $this->serializeUser($u), $result['users']);

        return $this->json([
            'success' => true,
            'data' => $users,
            'meta' => [
                'total'      => $result['total'],
                'page'       => $result['page'],
                'limit'      => $result['limit'],
                'totalPages' => $result['totalPages'],
            ],
        ]);
    }

    #[Route('/users/{id}', name: 'users_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getUserById(int $id): JsonResponse
    {
        try {
            $user = $this->userService->getUserById($id);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'User not found.']], 404);
        }

        return $this->json(['success' => true, 'data' => $this->serializeUser($user)]);
    }

    #[Route('/users/check-availability', name: 'users_check_availability', methods: ['POST'])]
    public function checkUserAvailability(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);
        }

        $excludeUserId = isset($data['excludeUserId']) ? (int) $data['excludeUserId'] : null;

        if (isset($data['username'])) {
            $username = trim((string) $data['username']);
            if ($username === '') {
                return $this->json(['success' => true, 'data' => ['available' => true]]);
            }

            $formatError = $this->userService->validateUsernameSafety($username);
            if ($formatError) {
                return $this->json([
                    'success' => true,
                    'data' => ['available' => false, 'message' => $formatError],
                ]);
            }

            $available = $this->userService->isUsernameAvailable($username, $excludeUserId);
            return $this->json([
                'success' => true,
                'data' => ['available' => $available, 'message' => $available ? null : 'Username already taken.'],
            ]);
        }

        if (isset($data['email'])) {
            $email = trim((string) $data['email']);
            if ($email === '') {
                return $this->json(['success' => true, 'data' => ['available' => true]]);
            }

            $available = $this->userService->isEmailAvailable($email, $excludeUserId);
            return $this->json([
                'success' => true,
                'data' => ['available' => $available, 'message' => $available ? null : 'Email already in use.'],
            ]);
        }

        if (isset($data['employeeId'])) {
            $employeeId = trim((string) $data['employeeId']);
            if ($employeeId === '') {
                return $this->json(['success' => true, 'data' => ['available' => true]]);
            }

            $formatError = $this->userService->validateEmployeeIdSafety($employeeId);
            if ($formatError) {
                return $this->json([
                    'success' => true,
                    'data' => ['available' => false, 'message' => $formatError],
                ]);
            }

            $available = $this->userService->isEmployeeIdAvailable($employeeId, $excludeUserId);
            return $this->json([
                'success' => true,
                'data' => ['available' => $available, 'message' => $available ? null : 'Employee ID already in use.'],
            ]);
        }

        return $this->json(['success' => true, 'data' => ['available' => true]]);
    }

    #[Route('/users', name: 'users_create', methods: ['POST'])]
    public function createUser(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);
        }

        // Validate required fields
        $errors = [];
        if (empty($data['username']))  $errors['username'] = 'Username is required.';
        if (empty($data['email']))     $errors['email']    = 'Email is required.';
        if (empty($data['password']) || strlen($data['password']) < 6) $errors['password'] = 'Password must be at least 6 characters.';
        if (empty($data['role']) || !in_array((int) $data['role'], [1, 2, 3])) $errors['role'] = 'Valid role is required.';

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

        $role = isset($data['role']) ? (int) $data['role'] : null;
        $collegeId = !empty($data['collegeId']) ? (int) $data['collegeId'] : null;
        $departmentId = !empty($data['departmentId']) ? (int) $data['departmentId'] : null;

        if ($role !== 1) {
            if (!$collegeId) $errors['collegeId'] = 'College is required for non-admin users.';
            if (!$departmentId) $errors['departmentId'] = 'Department is required for non-admin users.';

            if ($collegeId && $departmentId) {
                $college = $this->collegeRepository->find($collegeId);
                $department = $this->departmentRepository->find($departmentId);

                if (!$college) {
                    $errors['collegeId'] = 'College not found.';
                }
                if (!$department) {
                    $errors['departmentId'] = 'Department not found.';
                } elseif ($department->getCollege()?->getId() !== $collegeId) {
                    $errors['departmentId'] = 'Selected department does not belong to selected college.';
                }
            }
        }

        // Check uniqueness
        if (!isset($errors['username']) && !empty($data['username']) && !$this->userService->isUsernameAvailable($data['username'])) {
            $errors['username'] = 'This username is already taken.';
        }
        if (!empty($data['email']) && !$this->userService->isEmailAvailable($data['email'])) {
            $errors['email'] = 'This email is already in use.';
        }
        if (!isset($errors['employeeId']) && !empty($data['employeeId']) && !$this->userService->isEmployeeIdAvailable($data['employeeId'])) {
            $errors['employeeId'] = 'This Employee ID is already in use.';
        }

        if ($errors) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => $errors]], 422);
        }

        try {
            $userData = [
                'username'    => $data['username'],
                'email'       => $data['email'],
                'firstName'   => $data['firstName'] ?? null,
                'middleName'  => $data['middleName'] ?? null,
                'lastName'    => $data['lastName'] ?? null,
                'role'        => (int) $data['role'],
                'employeeId'  => $data['employeeId'] ?? null,
                'position'    => $data['position'] ?? null,
                'address'          => $data['address'] ?? null,
                'otherDesignation' => $data['otherDesignation'] ?? null,
                'collegeId'        => !empty($data['collegeId']) ? (int) $data['collegeId'] : null,
                'departmentId'     => !empty($data['departmentId']) ? (int) $data['departmentId'] : null,
                'isActive'         => $data['isActive'] ?? true,
            ];

            $user = $this->userService->createUser($userData, $data['password']);

            $this->activityLogService->logUserActivity('user.created', $user, [
                'role' => $user->getRoleDisplayName(),
            ]);

            return $this->json(['success' => true, 'data' => $this->serializeUser($user)], 201);
        } catch (InvalidArgumentException $e) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => $e->getMessage()],
            ], 422);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 500, 'message' => 'Failed to create user: ' . $e->getMessage()]], 500);
        }
    }

    #[Route('/users/{id}', name: 'users_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateUser(int $id, Request $request): JsonResponse
    {
        try {
            $user = $this->userService->getUserById($id);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'User not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);
        }

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
            $errors['username'] = 'This username is already taken.';
        }
        if (isset($data['email']) && !$this->userService->isEmailAvailable($data['email'], $id)) {
            $errors['email'] = 'This email is already in use.';
        }
        if (
            !isset($errors['employeeId'])
            && isset($data['employeeId'])
            && trim((string) $data['employeeId']) !== ''
            && !$this->userService->isEmployeeIdAvailable($data['employeeId'], $id)
        ) {
            $errors['employeeId'] = 'This Employee ID is already in use.';
        }
        if (isset($data['password']) && strlen($data['password']) < 6) {
            $errors['password'] = 'Password must be at least 6 characters.';
        }

        $effectiveRole = isset($data['role']) ? (int) $data['role'] : (int) $user->getRole();
        $effectiveCollegeId = array_key_exists('collegeId', $data)
            ? ($data['collegeId'] ? (int) $data['collegeId'] : null)
            : $user->getCollege()?->getId();
        $effectiveDepartmentId = array_key_exists('departmentId', $data)
            ? ($data['departmentId'] ? (int) $data['departmentId'] : null)
            : $user->getDepartment()?->getId();

        if ($effectiveRole !== 1) {
            if (!$effectiveCollegeId) $errors['collegeId'] = 'College is required for non-admin users.';
            if (!$effectiveDepartmentId) $errors['departmentId'] = 'Department is required for non-admin users.';

            if ($effectiveCollegeId && $effectiveDepartmentId) {
                $department = $this->departmentRepository->find($effectiveDepartmentId);
                if (!$department) {
                    $errors['departmentId'] = 'Department not found.';
                } elseif ($department->getCollege()?->getId() !== $effectiveCollegeId) {
                    $errors['departmentId'] = 'Selected department does not belong to selected college.';
                }
            }
        }

        if ($errors) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => $errors]], 422);
        }

        try {
            $userData = [];
            if (isset($data['username']))    $userData['username']    = $data['username'];
            if (isset($data['email']))       $userData['email']       = $data['email'];
            if (isset($data['firstName']))   $userData['firstName']   = $data['firstName'];
            if (isset($data['middleName']))  $userData['middleName']  = $data['middleName'];
            if (isset($data['lastName']))    $userData['lastName']    = $data['lastName'];
            if (isset($data['role']))        $userData['role']        = (int) $data['role'];
            if (isset($data['employeeId']))  $userData['employeeId']  = $data['employeeId'];
            if (isset($data['position']))    $userData['position']    = $data['position'];
            if (isset($data['address']))     $userData['address']     = $data['address'];
            if (array_key_exists('otherDesignation', $data)) $userData['otherDesignation'] = $data['otherDesignation'];
            if (array_key_exists('collegeId', $data))    $userData['collegeId']    = $data['collegeId'] ? (int) $data['collegeId'] : null;
            if (array_key_exists('departmentId', $data)) $userData['departmentId'] = $data['departmentId'] ? (int) $data['departmentId'] : null;
            if (isset($data['isActive']))    $userData['isActive']    = (bool) $data['isActive'];

            $newPassword = $data['password'] ?? null;
            $this->userService->updateUser($user, $userData, $newPassword);

            $this->activityLogService->logUserActivity('user.updated', $user, [
                'updated_fields' => array_keys($userData),
                'password_changed' => !empty($newPassword),
            ]);

            return $this->json(['success' => true, 'data' => $this->serializeUser($user)]);
        } catch (InvalidArgumentException $e) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => $e->getMessage()],
            ], 422);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 500, 'message' => 'Failed to update user: ' . $e->getMessage()]], 500);
        }
    }

    #[Route('/users/{id}', name: 'users_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteUser(int $id): JsonResponse
    {
        try {
            $user = $this->userService->getUserById($id);
            $name = $user->getFullName();
            $this->userService->deleteUser($user);

            $this->activityLogService->log('user.deleted', "User {$name} was deleted", 'User', $id);

            return $this->json(['success' => true, 'data' => ['message' => 'User deleted successfully.']]);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'User not found.']], 404);
        }
    }

    #[Route('/users/{id}/restore', name: 'users_restore', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function restoreUser(int $id): JsonResponse
    {
        try {
            $user = $this->userService->getUserById($id);
            if ($user->getDeletedAt() === null) {
                return $this->json([
                    'success' => false,
                    'error' => ['code' => 422, 'message' => 'User is not deleted.'],
                ], 422);
            }

            $this->userService->restoreUser($user);
            $this->activityLogService->logUserActivity('user.restored', $user);

            return $this->json(['success' => true, 'data' => $this->serializeUser($user)]);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'User not found.']], 404);
        }
    }

    #[Route('/users/{id}/permanent-delete', name: 'users_permanent_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function permanentlyDeleteUser(int $id): JsonResponse
    {
        try {
            $user = $this->userService->getUserById($id);
            if ($user->getDeletedAt() === null) {
                return $this->json([
                    'success' => false,
                    'error' => ['code' => 422, 'message' => 'User must be soft-deleted before permanent deletion.'],
                ], 422);
            }

            $name = $user->getFullName();
            $this->userService->permanentlyDeleteUser($user);
            $this->activityLogService->log('user.permanently_deleted', "User {$name} was permanently deleted", 'User', $id);

            return $this->json(['success' => true, 'data' => ['message' => 'User permanently deleted successfully.']]);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'User not found.']], 404);
        }
    }

    #[Route('/users/{id}/activate', name: 'users_activate', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function activateUser(int $id): JsonResponse
    {
        try {
            $user = $this->userService->getUserById($id);
            $this->userService->activateUser($user);
            $this->activityLogService->logUserActivity('user.activated', $user);
            return $this->json(['success' => true, 'data' => $this->serializeUser($user)]);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'User not found.']], 404);
        }
    }

    #[Route('/users/{id}/deactivate', name: 'users_deactivate', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function deactivateUser(int $id): JsonResponse
    {
        try {
            $user = $this->userService->getUserById($id);
            $this->userService->deactivateUser($user);
            $this->activityLogService->logUserActivity('user.deactivated', $user);
            return $this->json(['success' => true, 'data' => $this->serializeUser($user)]);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'User not found.']], 404);
        }
    }

    // ================================================================
    // Colleges CRUD
    // ================================================================

    #[Route('/colleges/stats', name: 'colleges_stats', methods: ['GET'])]
    public function collegesStats(): JsonResponse
    {
        $stats = $this->collegeService->getCollegeStatistics();
        return $this->json(['success' => true, 'data' => $stats]);
    }

    #[Route('/colleges', name: 'colleges_list', methods: ['GET'])]
    public function listColleges(Request $request): JsonResponse
    {
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 200);
        $search = $request->query->get('search');

        $sortField = $request->query->get('sort', 'name');
        $sortDirection = strtoupper($request->query->get('direction', 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $allowedSorts = ['code' => 'c.code', 'name' => 'c.name', 'dean' => 'c.dean', 'isActive' => 'c.isActive', 'createdAt' => 'c.createdAt'];
        $orderColumn = $allowedSorts[$sortField] ?? 'c.name';

        $qb = $this->entityManager->createQueryBuilder()
            ->select('c')
            ->from(College::class, 'c')
            ->where('c.deletedAt IS NULL')
            ->orderBy($orderColumn, $sortDirection);

        if ($search) {
            $qb->andWhere('c.name LIKE :s OR c.code LIKE :s OR c.dean LIKE :s')
               ->setParameter('s', '%' . $search . '%');
        }

        $total = (int) (clone $qb)->select('COUNT(c.id)')->getQuery()->getSingleScalarResult();
        $colleges = $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit)->getQuery()->getResult();

        $items = array_map(fn(College $c) => $this->serializeCollege($c), $colleges);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int) ceil($total / $limit)],
        ]);
    }

    #[Route('/colleges/{id}', name: 'colleges_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getCollege(int $id): JsonResponse
    {
        $college = $this->collegeRepository->find($id);
        if (!$college || $college->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'College not found.']], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeCollege($college)]);
    }

    #[Route('/colleges', name: 'colleges_create', methods: ['POST'])]
    public function createCollege(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);
        }

        $errors = [];
        if (empty($data['code'])) $errors['code'] = 'Code is required.';
        if (empty($data['name'])) $errors['name'] = 'Name is required.';
        if (!empty($data['code']) && $this->collegeRepository->findByCode($data['code'])) {
            $errors['code'] = 'College code already exists.';
        }
        if ($errors) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => $errors]], 422);
        }

        $college = new College();
        $college->setCode($data['code']);
        $college->setName($data['name']);
        $college->setDescription($data['description'] ?? null);
        $college->setDean($data['dean'] ?? null);
        $college->setIsActive($data['isActive'] ?? true);
        $college->setCreatedAt(new \DateTime());
        $college->setUpdatedAt(new \DateTime());

        $this->entityManager->persist($college);
        $this->entityManager->flush();

        $this->activityLogService->log('college.created', "College {$college->getName()} created", 'College', $college->getId());

        return $this->json(['success' => true, 'data' => $this->serializeCollege($college)], 201);
    }

    #[Route('/colleges/{id}', name: 'colleges_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateCollege(int $id, Request $request): JsonResponse
    {
        $college = $this->collegeRepository->find($id);
        if (!$college || $college->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'College not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);
        }

        if (isset($data['code']) && $data['code'] !== $college->getCode()) {
            $existing = $this->collegeRepository->findByCode($data['code']);
            if ($existing && $existing->getId() !== $id) {
                return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['code' => 'College code already exists.']]], 422);
            }
            $college->setCode($data['code']);
        }
        if (isset($data['name'])) $college->setName($data['name']);
        if (array_key_exists('description', $data)) $college->setDescription($data['description']);
        if (array_key_exists('dean', $data)) $college->setDean($data['dean']);
        if (isset($data['isActive'])) $college->setIsActive((bool) $data['isActive']);
        $college->setUpdatedAt(new \DateTime());

        $this->entityManager->flush();
        $this->activityLogService->log('college.updated', "College {$college->getName()} updated", 'College', $college->getId());

        return $this->json(['success' => true, 'data' => $this->serializeCollege($college)]);
    }

    #[Route('/colleges/{id}', name: 'colleges_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteCollege(int $id): JsonResponse
    {
        $college = $this->collegeRepository->find($id);
        if (!$college || $college->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'College not found.']], 404);
        }

        $college->setDeletedAt(new \DateTime());
        $this->entityManager->flush();
        $this->activityLogService->log('college.deleted', "College {$college->getName()} deleted", 'College', $id);

        return $this->json(['success' => true, 'data' => ['message' => 'College deleted successfully.']]);
    }

    #[Route('/colleges/{id}/activate', name: 'colleges_activate', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function activateCollege(int $id): JsonResponse
    {
        $college = $this->collegeRepository->find($id);
        if (!$college || $college->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'College not found.']], 404);
        }
        $college->setIsActive(true);
        $college->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();
        return $this->json(['success' => true, 'data' => $this->serializeCollege($college)]);
    }

    #[Route('/colleges/{id}/deactivate', name: 'colleges_deactivate', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function deactivateCollege(int $id): JsonResponse
    {
        $college = $this->collegeRepository->find($id);
        if (!$college || $college->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'College not found.']], 404);
        }
        $college->setIsActive(false);
        $college->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();
        return $this->json(['success' => true, 'data' => $this->serializeCollege($college)]);
    }

    #[Route('/colleges/bulk-action', name: 'colleges_bulk', methods: ['POST'])]
    public function bulkActionColleges(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $action = $data['action'] ?? '';
        $ids = $data['ids'] ?? [];

        if (!in_array($action, ['activate', 'deactivate', 'delete']) || empty($ids)) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid action or empty IDs.']], 400);
        }

        $count = 0;
        foreach ($ids as $id) {
            $college = $this->collegeRepository->find($id);
            if (!$college || $college->getDeletedAt()) continue;
            match ($action) {
                'activate' => $college->setIsActive(true),
                'deactivate' => $college->setIsActive(false),
                'delete' => $college->setDeletedAt(new \DateTime()),
            };
            $college->setUpdatedAt(new \DateTime());
            $count++;
        }
        $this->entityManager->flush();

        return $this->json(['success' => true, 'data' => ['message' => "{$count} colleges updated.", 'affected' => $count]]);
    }

    #[Route('/colleges/check-code', name: 'colleges_check_code', methods: ['POST'])]
    public function checkCollegeCode(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $code = $data['code'] ?? '';
        $available = !$this->collegeRepository->findByCode($code);
        return $this->json(['success' => true, 'data' => ['available' => $available]]);
    }

    // ================================================================
    // Departments CRUD
    // ================================================================

    #[Route('/departments/stats', name: 'departments_stats', methods: ['GET'])]
    public function departmentsStats(): JsonResponse
    {
        $stats = $this->departmentService->getDepartmentStatistics();
        return $this->json(['success' => true, 'data' => $stats]);
    }

    #[Route('/departments', name: 'departments_list', methods: ['GET'])]
    public function listDepartments(Request $request): JsonResponse
    {
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 200);
        $search = $request->query->get('search');
        $collegeId = $request->query->get('college_id');

        $sortField = $request->query->get('sort', 'name');
        $sortDirection = strtoupper($request->query->get('direction', 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $allowedSorts = ['code' => 'd.code', 'name' => 'd.name', 'isActive' => 'd.isActive', 'createdAt' => 'd.createdAt'];
        $orderColumn = $allowedSorts[$sortField] ?? 'd.name';

        $qb = $this->entityManager->createQueryBuilder()
            ->select('d')
            ->from(Department::class, 'd')
            ->leftJoin('d.college', 'c')
            ->where('d.deletedAt IS NULL')
            ->orderBy($orderColumn, $sortDirection);

        if ($collegeId) {
            $qb->andWhere('d.college = :collegeId')->setParameter('collegeId', (int) $collegeId);
        }
        if ($search) {
            $qb->andWhere('d.name LIKE :s OR d.code LIKE :s')
               ->setParameter('s', '%' . $search . '%');
        }

        $total = (int) (clone $qb)->select('COUNT(d.id)')->getQuery()->getSingleScalarResult();
        $departments = $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit)->getQuery()->getResult();

        $items = array_map(fn(Department $d) => $this->serializeDepartment($d), $departments);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int) ceil($total / $limit)],
        ]);
    }

    #[Route('/departments/{id}', name: 'departments_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getDepartment(int $id): JsonResponse
    {
        $dept = $this->departmentRepository->find($id);
        if (!$dept || $dept->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department not found.']], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeDepartment($dept)]);
    }

    #[Route('/departments', name: 'departments_create', methods: ['POST'])]
    public function createDepartment(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        $errors = [];
        if (empty($data['code'])) $errors['code'] = 'Code is required.';
        if (empty($data['name'])) $errors['name'] = 'Name is required.';
        if (!empty($data['code']) && $this->departmentRepository->findByCode($data['code'])) {
            $errors['code'] = 'Department code already exists.';
        }
        if ($errors) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => $errors]], 422);
        }

        $dept = new Department();
        $dept->setCode($data['code']);
        $dept->setName($data['name']);
        $dept->setDescription($data['description'] ?? null);
        $dept->setContactEmail($data['contactEmail'] ?? null);
        $dept->setIsActive($data['isActive'] ?? true);
        $dept->setCreatedAt(new \DateTime());
        $dept->setUpdatedAt(new \DateTime());

        if (!empty($data['collegeId'])) {
            $college = $this->collegeRepository->find((int) $data['collegeId']);
            if ($college) $dept->setCollege($college);
        }
        if (!empty($data['headId'])) {
            $head = $this->entityManager->getRepository(User::class)->find((int) $data['headId']);
            if ($head) $dept->setHead($head);
        }
        if (!empty($data['departmentGroupId'])) {
            $group = $this->departmentGroupRepository->find((int) $data['departmentGroupId']);
            if ($group) $dept->setDepartmentGroup($group);
        }

        $this->entityManager->persist($dept);
        $this->entityManager->flush();

        $this->activityLogService->log('department.created', "Department {$dept->getName()} created", 'Department', $dept->getId());

        return $this->json(['success' => true, 'data' => $this->serializeDepartment($dept)], 201);
    }

    #[Route('/departments/{id}', name: 'departments_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateDepartment(int $id, Request $request): JsonResponse
    {
        $dept = $this->departmentRepository->find($id);
        if (!$dept || $dept->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (isset($data['code']) && $data['code'] !== $dept->getCode()) {
            $existing = $this->departmentRepository->findByCode($data['code']);
            if ($existing && $existing->getId() !== $id) {
                return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['code' => 'Department code already exists.']]], 422);
            }
            $dept->setCode($data['code']);
        }
        if (isset($data['name'])) $dept->setName($data['name']);
        if (array_key_exists('description', $data)) $dept->setDescription($data['description']);
        if (array_key_exists('contactEmail', $data)) $dept->setContactEmail($data['contactEmail']);
        if (isset($data['isActive'])) $dept->setIsActive((bool) $data['isActive']);
        if (array_key_exists('collegeId', $data)) {
            $dept->setCollege($data['collegeId'] ? $this->collegeRepository->find((int) $data['collegeId']) : null);
        }
        if (array_key_exists('headId', $data)) {
            $dept->setHead($data['headId'] ? $this->entityManager->getRepository(User::class)->find((int) $data['headId']) : null);
        }
        if (array_key_exists('departmentGroupId', $data)) {
            $dept->setDepartmentGroup($data['departmentGroupId'] ? $this->departmentGroupRepository->find((int) $data['departmentGroupId']) : null);
        }
        $dept->setUpdatedAt(new \DateTime());

        $this->entityManager->flush();
        $this->activityLogService->log('department.updated', "Department {$dept->getName()} updated", 'Department', $dept->getId());

        return $this->json(['success' => true, 'data' => $this->serializeDepartment($dept)]);
    }

    #[Route('/departments/{id}', name: 'departments_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteDepartment(int $id): JsonResponse
    {
        $dept = $this->departmentRepository->find($id);
        if (!$dept || $dept->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department not found.']], 404);
        }
        $dept->setDeletedAt(new \DateTime());
        $this->entityManager->flush();
        $this->activityLogService->log('department.deleted', "Department {$dept->getName()} deleted", 'Department', $id);

        return $this->json(['success' => true, 'data' => ['message' => 'Department deleted successfully.']]);
    }

    #[Route('/departments/{id}/toggle-status', name: 'departments_toggle', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function toggleDepartment(int $id): JsonResponse
    {
        $dept = $this->departmentRepository->find($id);
        if (!$dept || $dept->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department not found.']], 404);
        }
        $dept->setIsActive(!$dept->getIsActive());
        $dept->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        return $this->json(['success' => true, 'data' => $this->serializeDepartment($dept)]);
    }

    // ================================================================
    // Subjects CRUD
    // ================================================================

    #[Route('/subjects', name: 'subjects_list', methods: ['GET'])]
    public function listSubjects(Request $request): JsonResponse
    {
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 20);
        $search = $request->query->get('search');
        $departmentId = $request->query->getInt('department_id', 0);
        if ($departmentId <= 0) {
            $departmentId = (int) $request->query->get('department', 0);
        }
        $strict = $request->query->getBoolean('strict', false);
        $includeGroup = $request->query->getBoolean('include_group', true);
        $semester = $request->query->get('semester');
        $yearLevel = $request->query->get('year_level');

        $sortField = $request->query->get('sort', 'code');
        $sortDirection = strtoupper($request->query->get('direction', 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $allowedSorts = ['code' => 's.code', 'title' => 's.title', 'units' => 's.units', 'isActive' => 's.isActive'];
        $orderColumn = $allowedSorts[$sortField] ?? 's.code';

        $qb = $this->entityManager->createQueryBuilder()
            ->select('DISTINCT s')
            ->from(Subject::class, 's')
            ->leftJoin('s.department', 'd')
            ->leftJoin('d.departmentGroup', 'dg')
            ->where('s.deletedAt IS NULL')
            ->orderBy($orderColumn, $sortDirection);

        if ($search) {
            $qb->andWhere('s.code LIKE :s OR s.title LIKE :s')
               ->setParameter('s', '%' . $search . '%');
        }
        if ($departmentId) {
            if ($strict) {
                // Strict mode: only subjects that belong to published curricula of this department.
                $qb->innerJoin(CurriculumSubject::class, 'cs', 'WITH', 'cs.subject = s')
                   ->innerJoin('cs.curriculumTerm', 'ct')
                   ->innerJoin('ct.curriculum', 'c')
                   ->andWhere('c.department = :dId')
                   ->andWhere('c.isPublished = :published')
                   ->setParameter('dId', (int) $departmentId)
                   ->setParameter('published', true);
            } else {
                if ($includeGroup) {
                    $dept = $this->departmentRepository->find((int) $departmentId);
                    $group = $dept?->getDepartmentGroup();
                    if ($group) {
                        $qb->andWhere('s.department = :dId OR dg.id = :gId')
                           ->setParameter('dId', (int) $departmentId)
                           ->setParameter('gId', $group->getId());
                    } else {
                        $qb->andWhere('s.department = :dId')->setParameter('dId', (int) $departmentId);
                    }
                } else {
                    $qb->andWhere('s.department = :dId')->setParameter('dId', (int) $departmentId);
                }
            }
        }
        if ($semester) {
            $qb->andWhere('s.semester = :sem')->setParameter('sem', $semester);
        }
        if ($yearLevel) {
            $qb->andWhere('s.yearLevel = :yl')->setParameter('yl', (int) $yearLevel);
        }

        $total = (int) (clone $qb)->select('COUNT(DISTINCT s.id)')->getQuery()->getSingleScalarResult();
        $subjects = $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit)->getQuery()->getResult();

        $items = array_map(fn(Subject $s) => $this->serializeSubject($s), $subjects);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int) ceil($total / $limit)],
        ]);
    }

    #[Route('/subjects/{id}', name: 'subjects_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getSubject(int $id): JsonResponse
    {
        $subject = $this->subjectRepository->find($id);
        if (!$subject || $subject->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Subject not found.']], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeSubject($subject)]);
    }

    #[Route('/subjects', name: 'subjects_create', methods: ['POST'])]
    public function createSubject(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        $errors = [];
        if (empty($data['code'])) $errors['code'] = 'Code is required.';
        if (empty($data['title'])) $errors['title'] = 'Title is required.';
        $dept = null;
        if (!empty($data['departmentId'])) {
            $dept = $this->departmentRepository->find((int) $data['departmentId']);
            if (!$dept) {
                $errors['departmentId'] = 'Department not found.';
            }
        }
        if (!empty($data['code'])) {
            if ($dept) {
                $existingInDepartment = $this->subjectRepository->findOneBy([
                    'code' => $data['code'],
                    'department' => $dept,
                    'deletedAt' => null,
                ]);
                if ($existingInDepartment) {
                    $errors['code'] = 'Subject code already exists in this department.';
                }
            } elseif ($this->subjectRepository->findByCode($data['code'])) {
                $errors['code'] = 'Subject code already exists.';
            }
        }
        if ($errors) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => $errors]], 422);
        }

        $subject = new Subject();
        $subject->setCode($data['code']);
        $subject->setTitle($data['title']);
        $subject->setDescription($data['description'] ?? null);
        $subject->setUnits((int) ($data['units'] ?? 3));
        $subject->setLectureHours($data['lectureHours'] ?? null);
        $subject->setLabHours($data['labHours'] ?? null);
        $subject->setType($data['type'] ?? 'lecture');
        $subject->setYearLevel($data['yearLevel'] ?? null);
        $subject->setSemester($data['semester'] ?? null);
        $subject->setIsActive($data['isActive'] ?? true);
        $subject->setCreatedAt(new \DateTime());
        $subject->setUpdatedAt(new \DateTime());

        if ($dept) {
            $subject->setDepartment($dept);
        }

        $this->entityManager->persist($subject);
        $this->entityManager->flush();

        $this->activityLogService->log('subject.created', "Subject {$subject->getCode()} created", 'Subject', $subject->getId());

        return $this->json(['success' => true, 'data' => $this->serializeSubject($subject)], 201);
    }

    #[Route('/subjects/{id}', name: 'subjects_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateSubject(int $id, Request $request): JsonResponse
    {
        $subject = $this->subjectRepository->find($id);
        if (!$subject || $subject->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Subject not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        $targetDepartment = $subject->getDepartment();
        if (array_key_exists('departmentId', $data)) {
            $targetDepartment = $data['departmentId'] ? $this->departmentRepository->find((int) $data['departmentId']) : null;
            if ($data['departmentId'] && !$targetDepartment) {
                return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['departmentId' => 'Department not found.']]], 422);
            }
        }

        $targetCode = $data['code'] ?? $subject->getCode();
        if ($targetCode) {
            if ($targetDepartment) {
                $existing = $this->subjectRepository->findOneBy([
                    'code' => $targetCode,
                    'department' => $targetDepartment,
                    'deletedAt' => null,
                ]);
            } else {
                $existing = $this->subjectRepository->findByCode($targetCode);
            }
            if ($existing && $existing->getId() !== $id) {
                return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['code' => 'Subject code already exists in this department.']]], 422);
            }
        }

        if (isset($data['code']) && $data['code'] !== $subject->getCode()) {
            $subject->setCode($data['code']);
        }
        if (isset($data['title'])) $subject->setTitle($data['title']);
        if (array_key_exists('description', $data)) $subject->setDescription($data['description']);
        if (isset($data['units'])) $subject->setUnits((int) $data['units']);
        if (array_key_exists('lectureHours', $data)) $subject->setLectureHours($data['lectureHours']);
        if (array_key_exists('labHours', $data)) $subject->setLabHours($data['labHours']);
        if (isset($data['type'])) $subject->setType($data['type']);
        if (array_key_exists('yearLevel', $data)) $subject->setYearLevel($data['yearLevel']);
        if (array_key_exists('semester', $data)) $subject->setSemester($data['semester']);
        if (isset($data['isActive'])) $subject->setIsActive((bool) $data['isActive']);
        if (array_key_exists('departmentId', $data)) {
            $subject->setDepartment($targetDepartment);
        }
        $subject->setUpdatedAt(new \DateTime());

        $this->entityManager->flush();
        $this->activityLogService->log('subject.updated', "Subject {$subject->getCode()} updated", 'Subject', $subject->getId());

        return $this->json(['success' => true, 'data' => $this->serializeSubject($subject)]);
    }

    #[Route('/subjects/{id}', name: 'subjects_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteSubject(int $id): JsonResponse
    {
        $subject = $this->subjectRepository->find($id);
        if (!$subject || $subject->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Subject not found.']], 404);
        }
        $subject->setDeletedAt(new \DateTime());
        $this->entityManager->flush();
        $this->activityLogService->log('subject.deleted', "Subject {$subject->getCode()} deleted", 'Subject', $id);

        return $this->json(['success' => true, 'data' => ['message' => 'Subject deleted successfully.']]);
    }

    // ================================================================
    // Rooms CRUD
    // ================================================================

    #[Route('/rooms/stats', name: 'rooms_stats', methods: ['GET'])]
    public function roomsStats(): JsonResponse
    {
        $stats = $this->roomService->getRoomStatistics([]);
        return $this->json(['success' => true, 'data' => $stats]);
    }

    #[Route('/rooms', name: 'rooms_list', methods: ['GET'])]
    public function listRooms(Request $request): JsonResponse
    {
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 20);
        $search = $request->query->get('search');
        $departmentId = $request->query->get('department_id');

        $sortField = $request->query->get('sort', 'code');
        $sortDirection = strtoupper($request->query->get('direction', 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $allowedSorts = ['code' => 'r.code', 'name' => 'r.name', 'capacity' => 'r.capacity', 'building' => 'r.building', 'isActive' => 'r.isActive'];
        $orderColumn = $allowedSorts[$sortField] ?? 'r.code';

        $qb = $this->entityManager->createQueryBuilder()
            ->select('r')
            ->from(Room::class, 'r')
            ->leftJoin('r.department', 'd')
            ->leftJoin('r.departmentGroup', 'rg')
            ->leftJoin('d.departmentGroup', 'dg')
            ->where('r.deletedAt IS NULL')
            ->orderBy($orderColumn, $sortDirection);

        if ($search) {
            $qb->andWhere('r.code LIKE :s OR r.name LIKE :s OR r.building LIKE :s')
               ->setParameter('s', '%' . $search . '%');
        }
        if ($departmentId) {
            $dept = $this->departmentRepository->find((int) $departmentId);
            $group = $dept?->getDepartmentGroup();
            if ($group) {
                // Include rooms from: this department, the group, or any department in the same group
                $qb->andWhere('r.department = :dId OR r.departmentGroup = :gId OR dg.id = :gId')
                   ->setParameter('dId', (int) $departmentId)
                   ->setParameter('gId', $group->getId());
            } else {
                $qb->andWhere('r.department = :dId')->setParameter('dId', (int) $departmentId);
            }
        }

        $total = (int) (clone $qb)->select('COUNT(r.id)')->getQuery()->getSingleScalarResult();
        $rooms = $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit)->getQuery()->getResult();

        $items = array_map(fn(Room $r) => $this->serializeRoom($r), $rooms);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int) ceil($total / $limit)],
        ]);
    }

    #[Route('/rooms/{id}', name: 'rooms_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getRoom(int $id): JsonResponse
    {
        $room = $this->roomRepository->find($id);
        if (!$room || $room->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeRoom($room)]);
    }

    #[Route('/rooms', name: 'rooms_create', methods: ['POST'])]
    public function createRoom(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (empty($data['code'])) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['code' => 'Code is required.']]], 422);
        }

        if (empty($data['departmentId'])) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['departmentId' => 'Department is required.']]], 422);
        }

        $department = $this->departmentRepository->find((int) $data['departmentId']);
        if (!$department) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['departmentId' => 'Selected department does not exist.']]], 422);
        }

        $type = array_key_exists('type', $data) ? trim((string) $data['type']) : null;
        if ($type === '') {
            $type = null;
        }

        $building = array_key_exists('building', $data) ? trim((string) $data['building']) : null;
        if ($building === '') {
            $building = null;
        }

        $floor = array_key_exists('floor', $data) ? trim((string) $data['floor']) : null;
        if ($floor === '') {
            $floor = null;
        }

        $room = new Room();
        $room->setCode($data['code']);
        $room->setName($data['name'] ?? null);
        try {
            $room->setType($type);
        } catch (\InvalidArgumentException) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['type' => 'Invalid room type.']]], 422);
        }
        $room->setCapacity($data['capacity'] ?? null);
        $room->setBuilding($building);
        $room->setFloor($floor);
        $room->setEquipment($data['equipment'] ?? null);
        $room->setIsActive($data['isActive'] ?? true);
        $room->setCreatedAt(new \DateTime());
        $room->setUpdatedAt(new \DateTime());

        $room->setDepartment($department);
        if (!empty($data['departmentGroupId'])) {
            $group = $this->departmentGroupRepository->find((int) $data['departmentGroupId']);
            if ($group) $room->setDepartmentGroup($group);
        }

        $this->entityManager->persist($room);
        $this->entityManager->flush();

        $this->activityLogService->log('room.created', "Room {$room->getCode()} created", 'Room', $room->getId());

        return $this->json(['success' => true, 'data' => $this->serializeRoom($room)], 201);
    }

    #[Route('/rooms/{id}', name: 'rooms_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateRoom(int $id, Request $request): JsonResponse
    {
        $room = $this->roomRepository->find($id);
        if (!$room || $room->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (isset($data['code'])) $room->setCode($data['code']);
        if (array_key_exists('name', $data)) $room->setName($data['name']);
        if (array_key_exists('type', $data)) {
            $type = trim((string) $data['type']);
            if ($type === '') {
                $type = null;
            }

            try {
                $room->setType($type);
            } catch (\InvalidArgumentException) {
                return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['type' => 'Invalid room type.']]], 422);
            }
        }
        if (array_key_exists('capacity', $data)) $room->setCapacity($data['capacity']);
        if (array_key_exists('building', $data)) {
            $building = trim((string) $data['building']);
            $room->setBuilding($building === '' ? null : $building);
        }
        if (array_key_exists('floor', $data)) {
            $floor = trim((string) $data['floor']);
            $room->setFloor($floor === '' ? null : $floor);
        }
        if (array_key_exists('equipment', $data)) $room->setEquipment($data['equipment']);
        if (isset($data['isActive'])) $room->setIsActive((bool) $data['isActive']);
        if (array_key_exists('departmentId', $data)) {
            $room->setDepartment($data['departmentId'] ? $this->departmentRepository->find((int) $data['departmentId']) : null);
        }
        if (array_key_exists('departmentGroupId', $data)) {
            $room->setDepartmentGroup($data['departmentGroupId'] ? $this->departmentGroupRepository->find((int) $data['departmentGroupId']) : null);
        }
        $room->setUpdatedAt(new \DateTime());

        $this->entityManager->flush();
        $this->activityLogService->log('room.updated', "Room {$room->getCode()} updated", 'Room', $room->getId());

        return $this->json(['success' => true, 'data' => $this->serializeRoom($room)]);
    }

    #[Route('/rooms/{id}', name: 'rooms_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteRoom(int $id): JsonResponse
    {
        $room = $this->roomRepository->find($id);
        if (!$room || $room->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
        }
        $room->setDeletedAt(new \DateTime());
        $this->entityManager->flush();
        $this->activityLogService->log('room.deleted', "Room {$room->getCode()} deleted", 'Room', $id);

        return $this->json(['success' => true, 'data' => ['message' => 'Room deleted successfully.']]);
    }

    #[Route('/rooms/{id}/history', name: 'rooms_history', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getRoomHistory(int $id, Request $request): JsonResponse
    {
        $room = $this->roomRepository->find($id);
        if (!$room || $room->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
        }

        $schedules = $this->scheduleRepository->findByRoom($id);
        $items = array_map(fn(Schedule $s) => $this->serializeSchedule($s), $schedules);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => count($items), 'page' => 1, 'limit' => count($items), 'totalPages' => 1],
        ]);
    }

    #[Route('/rooms/{id}/schedule-pdf', name: 'rooms_schedule_pdf', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getRoomSchedulePdf(int $id, Request $request): Response
    {
        $room = $this->roomRepository->find($id);
        if (!$room || $room->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Room not found.']], 404);
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
                $semester !== '' ? $semester : null
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
    // Academic Years CRUD
    // ================================================================

    #[Route('/academic-years/stats', name: 'academic_years_stats', methods: ['GET'])]
    public function academicYearsStats(): JsonResponse
    {
        $stats = $this->academicYearService->getStatistics();
        return $this->json(['success' => true, 'data' => $stats]);
    }

    #[Route('/academic-years', name: 'academic_years_list', methods: ['GET'])]
    public function listAcademicYears(Request $request): JsonResponse
    {
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 20);
        $search = $request->query->get('search');

        $sortField = $request->query->get('sort', 'year');
        $sortDirection = strtoupper($request->query->get('direction', 'DESC')) === 'ASC' ? 'ASC' : 'DESC';
        $allowedSorts = ['year' => 'a.year', 'startDate' => 'a.startDate', 'isActive' => 'a.isActive'];
        $orderColumn = $allowedSorts[$sortField] ?? 'a.year';

        $qb = $this->entityManager->createQueryBuilder()
            ->select('a')
            ->from(AcademicYear::class, 'a')
            ->where('a.deletedAt IS NULL')
            ->orderBy($orderColumn, $sortDirection);

        if ($search) {
            $qb->andWhere('a.year LIKE :s')->setParameter('s', '%' . $search . '%');
        }

        $total = (int) (clone $qb)->select('COUNT(a.id)')->getQuery()->getSingleScalarResult();
        $years = $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit)->getQuery()->getResult();

        $items = array_map(fn(AcademicYear $a) => $this->serializeAcademicYear($a), $years);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int) ceil($total / $limit)],
        ]);
    }

    #[Route('/academic-years/{id}', name: 'academic_years_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getAcademicYear(int $id): JsonResponse
    {
        $ay = $this->academicYearRepository->find($id);
        if (!$ay || $ay->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Academic year not found.']], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeAcademicYear($ay)]);
    }

    #[Route('/academic-years', name: 'academic_years_create', methods: ['POST'])]
    public function createAcademicYear(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (empty($data['year'])) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['year' => 'Year is required.']]], 422);
        }

        $ay = new AcademicYear();
        $ay->setYear($data['year']);
        $ay->setStartDate(!empty($data['startDate']) ? new \DateTime($data['startDate']) : null);
        $ay->setEndDate(!empty($data['endDate']) ? new \DateTime($data['endDate']) : null);
        $ay->setIsCurrent($data['isCurrent'] ?? false);
        $ay->setCurrentSemester($data['currentSemester'] ?? null);
        $ay->setIsActive($data['isActive'] ?? true);
        $ay->setFirstSemStart(!empty($data['firstSemStart']) ? new \DateTime($data['firstSemStart']) : null);
        $ay->setFirstSemEnd(!empty($data['firstSemEnd']) ? new \DateTime($data['firstSemEnd']) : null);
        $ay->setSecondSemStart(!empty($data['secondSemStart']) ? new \DateTime($data['secondSemStart']) : null);
        $ay->setSecondSemEnd(!empty($data['secondSemEnd']) ? new \DateTime($data['secondSemEnd']) : null);
        $ay->setSummerStart(!empty($data['summerStart']) ? new \DateTime($data['summerStart']) : null);
        $ay->setSummerEnd(!empty($data['summerEnd']) ? new \DateTime($data['summerEnd']) : null);
        $ay->setCreatedAt(new \DateTime());
        $ay->setUpdatedAt(new \DateTime());

        $this->entityManager->persist($ay);
        $this->entityManager->flush();

        $this->activityLogService->log('academic_year.created', "Academic year {$ay->getYear()} created", 'AcademicYear', $ay->getId());

        return $this->json(['success' => true, 'data' => $this->serializeAcademicYear($ay)], 201);
    }

    #[Route('/academic-years/{id}', name: 'academic_years_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateAcademicYear(int $id, Request $request): JsonResponse
    {
        $ay = $this->academicYearRepository->find($id);
        if (!$ay || $ay->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Academic year not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (isset($data['year'])) $ay->setYear($data['year']);
        if (array_key_exists('startDate', $data)) $ay->setStartDate($data['startDate'] ? new \DateTime($data['startDate']) : null);
        if (array_key_exists('endDate', $data)) $ay->setEndDate($data['endDate'] ? new \DateTime($data['endDate']) : null);
        if (isset($data['isCurrent'])) $ay->setIsCurrent((bool) $data['isCurrent']);
        if (array_key_exists('currentSemester', $data)) $ay->setCurrentSemester($data['currentSemester']);
        if (isset($data['isActive'])) $ay->setIsActive((bool) $data['isActive']);
        if (array_key_exists('firstSemStart', $data)) $ay->setFirstSemStart($data['firstSemStart'] ? new \DateTime($data['firstSemStart']) : null);
        if (array_key_exists('firstSemEnd', $data)) $ay->setFirstSemEnd($data['firstSemEnd'] ? new \DateTime($data['firstSemEnd']) : null);
        if (array_key_exists('secondSemStart', $data)) $ay->setSecondSemStart($data['secondSemStart'] ? new \DateTime($data['secondSemStart']) : null);
        if (array_key_exists('secondSemEnd', $data)) $ay->setSecondSemEnd($data['secondSemEnd'] ? new \DateTime($data['secondSemEnd']) : null);
        if (array_key_exists('summerStart', $data)) $ay->setSummerStart($data['summerStart'] ? new \DateTime($data['summerStart']) : null);
        if (array_key_exists('summerEnd', $data)) $ay->setSummerEnd($data['summerEnd'] ? new \DateTime($data['summerEnd']) : null);
        $ay->setUpdatedAt(new \DateTime());

        $this->entityManager->flush();
        $this->activityLogService->log('academic_year.updated', "Academic year {$ay->getYear()} updated", 'AcademicYear', $ay->getId());

        return $this->json(['success' => true, 'data' => $this->serializeAcademicYear($ay)]);
    }

    #[Route('/academic-years/{id}', name: 'academic_years_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteAcademicYear(int $id): JsonResponse
    {
        $ay = $this->academicYearRepository->find($id);
        if (!$ay || $ay->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Academic year not found.']], 404);
        }
        $ay->setDeletedAt(new \DateTime());
        $this->entityManager->flush();
        $this->activityLogService->log('academic_year.deleted', "Academic year {$ay->getYear()} deleted", 'AcademicYear', $id);

        return $this->json(['success' => true, 'data' => ['message' => 'Academic year deleted successfully.']]);
    }

    #[Route('/academic-years/{id}/set-current', name: 'academic_years_set_current', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function setCurrentAcademicYear(int $id, Request $request): JsonResponse
    {
        $ay = $this->academicYearRepository->find($id);
        if (!$ay || $ay->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Academic year not found.']], 404);
        }

        if (!$ay->isActive()) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Cannot set an inactive academic year as current. Activate it first.']], 422);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $semester = $data['semester'] ?? null;

        // Validate semester if provided
        $validSemesters = ['1st', '2nd', 'Summer'];
        if ($semester && !in_array($semester, $validSemesters, true)) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Invalid semester. Must be one of: 1st, 2nd, Summer.']], 422);
        }

        // Unset all others
        $all = $this->academicYearRepository->findAll();
        foreach ($all as $other) {
            $other->setIsCurrent(false);
        }
        $ay->setIsCurrent(true);
        if ($semester) {
            $ay->setCurrentSemester($semester);
        }
        $ay->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        $this->activityLogService->log('academic_year.set_current', "Academic year {$ay->getYear()} set as current" . ($semester ? " ({$semester} Semester)" : ''), 'AcademicYear', $ay->getId());

        return $this->json(['success' => true, 'data' => $this->serializeAcademicYear($ay)]);
    }

    #[Route('/academic-years/{id}/toggle-status', name: 'academic_years_toggle_status', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function toggleAcademicYearStatus(int $id): JsonResponse
    {
        $ay = $this->academicYearRepository->find($id);
        if (!$ay || $ay->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Academic year not found.']], 404);
        }

        if ($ay->isCurrent() && $ay->isActive()) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Cannot deactivate the current academic year. Set another year as current first.']], 422);
        }

        $ay->setIsActive(!$ay->isActive());
        $ay->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        $status = $ay->isActive() ? 'activated' : 'deactivated';
        $this->activityLogService->log("academic_year.{$status}", "Academic year {$ay->getYear()} {$status}", 'AcademicYear', $ay->getId());

        return $this->json(['success' => true, 'data' => $this->serializeAcademicYear($ay)]);
    }

    #[Route('/academic-years/{id}/set-semester', name: 'academic_years_set_semester', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function setAcademicYearSemester(int $id, Request $request): JsonResponse
    {
        $ay = $this->academicYearRepository->find($id);
        if (!$ay || $ay->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Academic year not found.']], 404);
        }

        if (!$ay->isCurrent()) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Can only change semester on the current academic year.']], 422);
        }

        $data = json_decode($request->getContent(), true);
        $semester = $data['semester'] ?? null;

        $validSemesters = ['1st', '2nd', 'Summer'];
        if (!$semester || !in_array($semester, $validSemesters, true)) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Invalid semester. Must be one of: 1st, 2nd, Summer.']], 422);
        }

        $ay->setCurrentSemester($semester);
        $ay->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        $this->activityLogService->log('academic_year.semester_changed', "Academic year {$ay->getYear()} semester changed to {$semester}", 'AcademicYear', $ay->getId());

        return $this->json(['success' => true, 'data' => $this->serializeAcademicYear($ay)]);
    }

    // ================================================================
    // Curricula CRUD
    // ================================================================

    #[Route('/curricula/stats', name: 'curricula_stats', methods: ['GET'])]
    public function curriculaStats(): JsonResponse
    {
        $departments = $this->departmentRepository->findBy(['deletedAt' => null], ['name' => 'ASC']);

        $totalAll = 0;
        $publishedAll = 0;
        $draftAll = 0;
        $deptData = [];

        foreach ($departments as $dept) {
            $curricula = $this->curriculumRepository->findBy(['department' => $dept, 'deletedAt' => null]);
            $published = count(array_filter($curricula, fn($c) => $c->isPublished()));
            $draft = count($curricula) - $published;

            $totalAll += count($curricula);
            $publishedAll += $published;
            $draftAll += $draft;

            $college = $dept->getCollege();
            $deptData[] = [
                'id'        => $dept->getId(),
                'name'      => $dept->getName(),
                'code'      => $dept->getCode(),
                'college'   => $college ? ['id' => $college->getId(), 'name' => $college->getName(), 'code' => $college->getCode()] : null,
                'curricula' => ['total' => count($curricula), 'published' => $published, 'draft' => $draft],
            ];
        }

        return $this->json([
            'success' => true,
            'data' => [
                'statistics' => ['total' => $totalAll, 'published' => $publishedAll, 'draft' => $draftAll, 'departments' => count($departments)],
                'departments' => $deptData,
            ],
        ]);
    }

    #[Route('/curricula', name: 'curricula_list', methods: ['GET'])]
    public function listCurricula(Request $request): JsonResponse
    {
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 20);
        $search = $request->query->get('search');
        $departmentId = $request->query->get('department_id');
        $collegeId = $request->query->get('college_id');

        $sortField = $request->query->get('sort', 'createdAt');
        $sortDirection = strtoupper($request->query->get('direction', 'DESC')) === 'ASC' ? 'ASC' : 'DESC';
        $allowedSorts = ['name' => 'c.name', 'version' => 'c.version', 'isPublished' => 'c.isPublished', 'createdAt' => 'c.createdAt'];
        $orderColumn = $allowedSorts[$sortField] ?? 'c.createdAt';

        $qb = $this->entityManager->createQueryBuilder()
            ->select('c')
            ->from(Curriculum::class, 'c')
            ->leftJoin('c.department', 'd')
            ->where('c.deletedAt IS NULL')
            ->orderBy($orderColumn, $sortDirection);

        if ($search) {
            $qb->andWhere('c.name LIKE :s')->setParameter('s', '%' . $search . '%');
        }
        if ($departmentId) {
            $qb->andWhere('c.department = :dId')->setParameter('dId', (int) $departmentId);
        }
        if ($collegeId) {
            $qb->andWhere('d.college = :cId')->setParameter('cId', (int) $collegeId);
        }

        $total = (int) (clone $qb)->select('COUNT(c.id)')->getQuery()->getSingleScalarResult();
        $curricula = $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit)->getQuery()->getResult();

        $items = array_map(fn(Curriculum $c) => $this->serializeCurriculum($c), $curricula);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int) ceil($total / $limit)],
        ]);
    }

    #[Route('/curricula/{id}', name: 'curricula_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getCurriculum(int $id): JsonResponse
    {
        $curriculum = $this->curriculumRepository->find($id);
        if (!$curriculum || $curriculum->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Curriculum not found.']], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($curriculum, true)]);
    }

    #[Route('/curricula', name: 'curricula_create', methods: ['POST'])]
    public function createCurriculum(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (empty($data['name'])) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['name' => 'Name is required.']]], 422);
        }

        $curriculum = new Curriculum();
        $curriculum->setName($data['name']);
        $curriculum->setVersion($data['version'] ?? null);
        $curriculum->setNotes($data['notes'] ?? null);
        $curriculum->setIsPublished($data['isPublished'] ?? false);
        $curriculum->setEffectiveYearId($data['effectiveYearId'] ?? null);
        $curriculum->setCreatedAt(new \DateTime());
        $curriculum->setUpdatedAt(new \DateTime());

        if (!empty($data['departmentId'])) {
            $dept = $this->departmentRepository->find((int) $data['departmentId']);
            if ($dept) $curriculum->setDepartment($dept);
        }

        $this->entityManager->persist($curriculum);
        $this->entityManager->flush();

        $this->activityLogService->log('curriculum.created', "Curriculum {$curriculum->getName()} created", 'Curriculum', $curriculum->getId());

        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($curriculum)], 201);
    }

    #[Route('/curricula/{id}', name: 'curricula_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateCurriculum(int $id, Request $request): JsonResponse
    {
        $curriculum = $this->curriculumRepository->find($id);
        if (!$curriculum || $curriculum->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Curriculum not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (isset($data['name'])) $curriculum->setName($data['name']);
        if (array_key_exists('version', $data)) $curriculum->setVersion($data['version']);
        if (array_key_exists('notes', $data)) $curriculum->setNotes($data['notes']);
        if (isset($data['isPublished'])) $curriculum->setIsPublished((bool) $data['isPublished']);
        if (array_key_exists('effectiveYearId', $data)) $curriculum->setEffectiveYearId($data['effectiveYearId']);
        if (array_key_exists('departmentId', $data)) {
            $curriculum->setDepartment($data['departmentId'] ? $this->departmentRepository->find((int) $data['departmentId']) : null);
        }
        $curriculum->setUpdatedAt(new \DateTime());

        $this->entityManager->flush();
        $this->activityLogService->log('curriculum.updated', "Curriculum {$curriculum->getName()} updated", 'Curriculum', $curriculum->getId());

        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($curriculum)]);
    }

    #[Route('/curricula/{id}', name: 'curricula_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteCurriculum(int $id): JsonResponse
    {
        $curriculum = $this->curriculumRepository->find($id);
        if (!$curriculum || $curriculum->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Curriculum not found.']], 404);
        }
        $curriculum->setDeletedAt(new \DateTime());
        $this->entityManager->flush();
        $this->activityLogService->log('curriculum.deleted', "Curriculum {$curriculum->getName()} deleted", 'Curriculum', $id);

        return $this->json(['success' => true, 'data' => ['message' => 'Curriculum deleted successfully.']]);
    }

    #[Route('/curricula/{id}/publish', name: 'curricula_publish', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function publishCurriculum(int $id): JsonResponse
    {
        $curriculum = $this->curriculumRepository->find($id);
        if (!$curriculum || $curriculum->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Curriculum not found.']], 404);
        }
        $curriculum->setIsPublished(true);
        $curriculum->setUpdatedAt(new \DateTime());
        $this->entityManager->flush();

        $this->activityLogService->log('curriculum.published', "Curriculum {$curriculum->getName()} published", 'Curriculum', $curriculum->getId());

        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($curriculum)]);
    }

    // ---- Curriculum Term & Subject Management ----

    #[Route('/curricula/{id}/terms/generate', name: 'curricula_terms_generate', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function generateDefaultTerms(int $id, Request $request): JsonResponse
    {
        $curriculum = $this->curriculumRepository->find($id);
        if (!$curriculum || $curriculum->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Curriculum not found.']], 404);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $years = (int) ($data['years'] ?? 4);
        if ($years < 1 || $years > 6) $years = 4;

        $semesters = ['1st', '2nd'];
        $created = 0;
        for ($y = 1; $y <= $years; $y++) {
            foreach ($semesters as $sem) {
                // Skip if term already exists
                $exists = $this->curriculumTermRepository->findOneBy(['curriculum' => $curriculum, 'year_level' => $y, 'semester' => $sem]);
                if ($exists) continue;

                $term = new CurriculumTerm();
                $term->setCurriculum($curriculum);
                $term->setYearLevel($y);
                $term->setSemester($sem);
                $this->entityManager->persist($term);
                $created++;
            }
        }
        $this->entityManager->flush();

        return $this->json(['success' => true, 'message' => "Generated {$created} terms.", 'data' => $this->serializeCurriculum($curriculum, true)]);
    }

    #[Route('/curricula/{id}/terms', name: 'curricula_terms_add', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function addCurriculumTerm(int $id, Request $request): JsonResponse
    {
        $curriculum = $this->curriculumRepository->find($id);
        if (!$curriculum || $curriculum->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Curriculum not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        $yearLevel = (int) ($data['yearLevel'] ?? 0);
        $semester = $data['semester'] ?? '';
        $termName = $data['termName'] ?? null;

        if ($yearLevel < 1 || !$semester) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Year level and semester are required.']], 400);
        }

        $exists = $this->curriculumTermRepository->findOneBy(['curriculum' => $curriculum, 'year_level' => $yearLevel, 'semester' => $semester]);
        if ($exists) {
            return $this->json(['success' => false, 'error' => ['code' => 409, 'message' => 'This term already exists.']], 409);
        }

        $term = new CurriculumTerm();
        $term->setCurriculum($curriculum);
        $term->setYearLevel($yearLevel);
        $term->setSemester($semester);
        if ($termName) $term->setTermName($termName);
        $this->entityManager->persist($term);
        $this->entityManager->flush();

        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($curriculum, true)], 201);
    }

    #[Route('/curricula/terms/{id}', name: 'curricula_terms_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteCurriculumTerm(int $id): JsonResponse
    {
        $term = $this->curriculumTermRepository->find($id);
        if (!$term) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Term not found.']], 404);
        }

        $curriculum = $term->getCurriculum();
        // Remove all subjects in this term first
        foreach ($term->getCurriculumSubjects() as $cs) {
            $this->entityManager->remove($cs);
        }
        $this->entityManager->remove($term);
        $this->entityManager->flush();

        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($curriculum, true)]);
    }

    #[Route('/curricula/terms/{termId}/subjects', name: 'curricula_term_subjects_add', methods: ['POST'], requirements: ['termId' => '\d+'])]
    public function addSubjectToTerm(int $termId, Request $request): JsonResponse
    {
        $term = $this->curriculumTermRepository->find($termId);
        if (!$term) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Term not found.']], 404);
        }

        $curriculum = $term->getCurriculum();
        $curriculumDepartment = $curriculum?->getDepartment();

        $data = json_decode($request->getContent(), true);
        $subjectId = (int) ($data['subjectId'] ?? 0);
        $subject = $this->subjectRepository->find($subjectId);
        if (!$subject) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Subject not found.']], 404);
        }

        // Prevent cross-department subject leakage into curricula.
        if ($curriculumDepartment && $subject->getDepartment()?->getId() !== $curriculumDepartment->getId()) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 409, 'message' => 'Subject does not belong to this curriculum department.'],
            ], 409);
        }

        // Check if already added
        $exists = $this->curriculumSubjectRepository->findOneBy(['curriculumTerm' => $term, 'subject' => $subject]);
        if ($exists) {
            return $this->json(['success' => false, 'error' => ['code' => 409, 'message' => 'Subject already in this term.']], 409);
        }

        // Enforce one subject placement per curriculum to avoid duplicates across terms.
        $existsInCurriculum = $this->entityManager->createQueryBuilder()
            ->select('COUNT(cs2.id)')
            ->from(CurriculumSubject::class, 'cs2')
            ->innerJoin('cs2.curriculumTerm', 'ct2')
            ->where('ct2.curriculum = :curriculum')
            ->andWhere('cs2.subject = :subject')
            ->setParameter('curriculum', $curriculum)
            ->setParameter('subject', $subject)
            ->getQuery()
            ->getSingleScalarResult();

        if ((int) $existsInCurriculum > 0) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 409, 'message' => 'Subject is already assigned in this curriculum.'],
            ], 409);
        }

        $cs = new CurriculumSubject();
        $cs->setCurriculumTerm($term);
        $cs->setSubject($subject);
        $this->entityManager->persist($cs);
        $this->entityManager->flush();

        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($term->getCurriculum(), true)], 201);
    }

    #[Route('/curricula/subjects/{id}', name: 'curricula_subjects_remove', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function removeSubjectFromTerm(int $id): JsonResponse
    {
        $cs = $this->curriculumSubjectRepository->find($id);
        if (!$cs) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Curriculum subject not found.']], 404);
        }

        $curriculum = $cs->getCurriculum();
        $this->entityManager->remove($cs);
        $this->entityManager->flush();

        return $this->json(['success' => true, 'data' => $this->serializeCurriculum($curriculum, true)]);
    }

    #[Route('/curricula/{id}/available-subjects', name: 'curricula_available_subjects', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getAvailableSubjects(int $id, Request $request): JsonResponse
    {
        $curriculum = $this->curriculumRepository->find($id);
        if (!$curriculum || $curriculum->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Curriculum not found.']], 404);
        }

        $curriculumDepartment = $curriculum->getDepartment();
        if (!$curriculumDepartment) {
            return $this->json(['success' => true, 'data' => []]);
        }

        $search = $request->query->get('search', '');

        // Collect subjects already assigned to any term in this curriculum.
        $assignedIdsRaw = $this->entityManager->createQueryBuilder()
            ->select('DISTINCT IDENTITY(cs2.subject) AS subject_id')
            ->from(CurriculumSubject::class, 'cs2')
            ->innerJoin('cs2.curriculumTerm', 'ct2')
            ->where('ct2.curriculum = :curriculum')
            ->setParameter('curriculum', $curriculum)
            ->getQuery()
            ->getScalarResult();

        $assignedSubjectIds = array_map(
            static fn(array $row): int => (int) ($row['subject_id'] ?? 0),
            $assignedIdsRaw
        );
        $assignedSubjectIds = array_values(array_filter($assignedSubjectIds, static fn(int $value): bool => $value > 0));

        $qb = $this->entityManager->createQueryBuilder()
            ->select('s')
            ->from(Subject::class, 's')
            ->where('s.isActive = true')
            ->andWhere('s.deletedAt IS NULL')
            ->andWhere('s.department = :department')
            ->setParameter('department', $curriculumDepartment)
            ->orderBy('s.code', 'ASC');

        if (!empty($assignedSubjectIds)) {
            $qb->andWhere('s.id NOT IN (:assignedIds)')
               ->setParameter('assignedIds', $assignedSubjectIds);
        }

        if ($search) {
            $qb->andWhere('s.code LIKE :q OR s.title LIKE :q')->setParameter('q', '%' . $search . '%');
        }

        $subjects = $qb->setMaxResults(50)->getQuery()->getResult();

        $items = array_map(fn(Subject $s) => [
            'id'           => $s->getId(),
            'code'         => $s->getCode(),
            'title'        => $s->getTitle(),
            'units'        => $s->getUnits(),
            'lectureHours' => $s->getLectureHours(),
            'labHours'     => $s->getLabHours(),
            'type'         => $s->getType(),
        ], $subjects);

        return $this->json(['success' => true, 'data' => $items]);
    }

    // ================================================================
    // Curricula Upload
    // ================================================================

    #[Route('/curricula/template/download', name: 'curricula_template_download', methods: ['GET'])]
    public function downloadCurriculumTemplate(): JsonResponse
    {
        $csv = $this->curriculumUploadService->generateTemplate();
        return $this->json(['success' => true, 'data' => ['content' => $csv, 'filename' => 'curriculum_template.csv']]);
    }

    #[Route('/curricula/{id}/upload', name: 'curricula_upload', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function uploadCurriculum(int $id, Request $request): JsonResponse
    {
        $curriculum = $this->curriculumRepository->find($id);
        if (!$curriculum || $curriculum->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Curriculum not found.']], 404);
        }

        $file = $request->files->get('curriculum_file');
        if (!$file) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'No file uploaded.']], 400);
        }

        $maxSize = 10 * 1024 * 1024;
        if ($file->getSize() > $maxSize) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'File size exceeds 10MB limit.']], 400);
        }

        $extension = strtolower($file->getClientOriginalExtension());
        if (!in_array($extension, ['csv', 'xlsx', 'xls'])) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid format. Supported: CSV, XLSX, XLS']], 400);
        }

        $autoCreateTerms = $request->request->get('auto_create_terms', '1') === '1';

        try {
            $result = $this->curriculumUploadService->processUpload($file, $curriculum, $autoCreateTerms);
            if (!$result['success']) {
                return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => $result['message'] ?? 'Upload failed.'], 'details' => $result], 400);
            }
            $this->entityManager->refresh($curriculum);
            $result['data'] = $this->serializeCurriculum($curriculum, true);
            return $this->json($result);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 500, 'message' => 'Error processing upload: ' . $e->getMessage()]], 500);
        }
    }

    #[Route('/curricula/bulk-upload', name: 'curricula_bulk_upload', methods: ['POST'])]
    public function bulkUploadCurriculum(Request $request): JsonResponse
    {
        $file = $request->files->get('curriculum_file');
        $curriculumName = $request->request->get('curriculum_name');
        $version = $request->request->get('version');
        $departmentId = $request->request->get('department_id');
        $autoCreateTerms = $request->request->has('auto_create_terms') ? ($request->request->get('auto_create_terms') === '1') : true;

        if (!$file) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'No file uploaded.']], 400);
        }
        if (!$curriculumName || !$version || !$departmentId) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Missing required fields (name, version, department).']], 400);
        }

        $maxSize = 10 * 1024 * 1024;
        if ($file->getSize() > $maxSize) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'File size exceeds 10MB limit.']], 400);
        }

        $extension = strtolower($file->getClientOriginalExtension());
        if (!in_array($extension, ['csv', 'xlsx', 'xls'])) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid format. Supported: CSV, XLSX, XLS']], 400);
        }

        $department = $this->departmentRepository->find($departmentId);
        if (!$department) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department not found.']], 404);
        }

        $this->entityManager->beginTransaction();
        try {
            $curriculum = new Curriculum();
            $curriculum->setName($curriculumName);
            $curriculum->setVersion((int)$version);
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

    #[Route('/curricula/{id}/repair-subject-links', name: 'curricula_repair_subject_links', methods: ['POST'], requirements: ['id' => '\\d+'])]
    public function repairCurriculumSubjectLinks(int $id): JsonResponse
    {
        $curriculum = $this->curriculumRepository->find($id);
        if (!$curriculum || $curriculum->getDeletedAt()) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Curriculum not found.']], 404);
        }

        $stats = $this->repairCurriculumSubjectLinksInternal($curriculum);
        if ($stats['error'] ?? false) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => $stats['error']]], 400);
        }

        $this->entityManager->flush();

        $department = $curriculum->getDepartment();

        return $this->json([
            'success' => true,
            'data' => [
                'curriculumId' => $curriculum->getId(),
                'department' => ['id' => $department->getId(), 'name' => $department->getName()],
                'inspected' => $stats['inspected'],
                'createdSubjects' => $stats['createdSubjects'],
                'relinked' => $stats['relinked'],
                'removedDuplicateLinks' => $stats['removedDuplicateLinks'],
            ],
        ]);
    }

    #[Route('/curricula/repair-subject-links-all', name: 'curricula_repair_subject_links_all', methods: ['POST'])]
    public function repairAllCurriculumSubjectLinks(Request $request): JsonResponse
    {
        $departmentId = (int) ($request->request->get('departmentId') ?? $request->query->get('departmentId'));
        $criteria = ['deletedAt' => null];

        if ($departmentId > 0) {
            $department = $this->departmentRepository->find($departmentId);
            if (!$department) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department not found.']], 404);
            }
            $criteria['department'] = $department;
        }

        $curricula = $this->curriculumRepository->findBy($criteria, ['id' => 'ASC']);

        $totalCurricula = 0;
        $totalInspected = 0;
        $totalCreatedSubjects = 0;
        $totalRelinked = 0;
        $totalRemovedDuplicateLinks = 0;
        $skippedNoDepartment = 0;
        $results = [];

        $this->entityManager->beginTransaction();
        try {
            foreach ($curricula as $curriculum) {
                $totalCurricula++;
                $stats = $this->repairCurriculumSubjectLinksInternal($curriculum);

                if ($stats['error'] ?? false) {
                    $skippedNoDepartment++;
                    $results[] = [
                        'curriculumId' => $curriculum->getId(),
                        'curriculumName' => $curriculum->getName(),
                        'status' => 'skipped',
                        'reason' => $stats['error'],
                    ];
                    continue;
                }

                $totalInspected += $stats['inspected'];
                $totalCreatedSubjects += $stats['createdSubjects'];
                $totalRelinked += $stats['relinked'];
                $totalRemovedDuplicateLinks += $stats['removedDuplicateLinks'];

                $results[] = [
                    'curriculumId' => $curriculum->getId(),
                    'curriculumName' => $curriculum->getName(),
                    'department' => [
                        'id' => $curriculum->getDepartment()?->getId(),
                        'name' => $curriculum->getDepartment()?->getName(),
                    ],
                    'inspected' => $stats['inspected'],
                    'createdSubjects' => $stats['createdSubjects'],
                    'relinked' => $stats['relinked'],
                    'removedDuplicateLinks' => $stats['removedDuplicateLinks'],
                ];
            }

            $this->entityManager->flush();
            $this->entityManager->commit();
        } catch (\Throwable $e) {
            if ($this->entityManager->getConnection()->isTransactionActive()) {
                $this->entityManager->rollback();
            }
            return $this->json(['success' => false, 'error' => ['code' => 500, 'message' => 'Bulk repair failed: ' . $e->getMessage()]], 500);
        }

        return $this->json([
            'success' => true,
            'data' => [
                'scope' => $departmentId > 0 ? 'department' : 'all',
                'departmentId' => $departmentId > 0 ? $departmentId : null,
                'curriculaProcessed' => $totalCurricula,
                'curriculaSkippedNoDepartment' => $skippedNoDepartment,
                'inspected' => $totalInspected,
                'createdSubjects' => $totalCreatedSubjects,
                'relinked' => $totalRelinked,
                'removedDuplicateLinks' => $totalRemovedDuplicateLinks,
                'results' => $results,
            ],
        ]);
    }

    // ================================================================
    // Schedule Change Requests (Admin Review Queue)
    // ================================================================

    #[Route('/schedule-change-requests', name: 'schedule_change_requests_list', methods: ['GET'])]
    public function listScheduleChangeRequests(Request $request): JsonResponse
    {
        $status = trim((string) $request->query->get('status', ScheduleChangeRequest::STATUS_PENDING));
        $adminStatus = trim((string) $request->query->get('admin_status', ScheduleChangeRequest::APPROVAL_PENDING));
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

        if (!in_array($adminStatus, $validApprovalStatuses, true)) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'Invalid admin_status filter.'],
            ], 422);
        }

        $requests = $this->entityManager
            ->getRepository(ScheduleChangeRequest::class)
            ->findForAdmin(
                $status === 'all' ? null : $status,
                $adminStatus === 'all' ? null : $adminStatus,
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
        $requestEntity = $this->entityManager->getRepository(ScheduleChangeRequest::class)->find($id);
        if (!$requestEntity instanceof ScheduleChangeRequest) {
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
        return $this->reviewScheduleChangeRequestAsAdmin($id, true, $request);
    }

    #[Route('/schedule-change-requests/{id}/reject', name: 'schedule_change_requests_reject', methods: ['POST'], requirements: ['id' => '\\d+'])]
    public function rejectScheduleChangeRequest(int $id, Request $request): JsonResponse
    {
        return $this->reviewScheduleChangeRequestAsAdmin($id, false, $request);
    }

    private function reviewScheduleChangeRequestAsAdmin(int $id, bool $approved, Request $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $this->getUser();

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

        if ($requestEntity->getStatus() !== ScheduleChangeRequest::STATUS_PENDING) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'Only pending requests can be reviewed.'],
            ], 422);
        }

        if ($requestEntity->getAdminStatus() !== ScheduleChangeRequest::APPROVAL_PENDING) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'Admin review has already been completed for this request.'],
            ], 422);
        }

        $comment = $payload['comment'];

        $requestEntity
            ->setAdminStatus($approved ? ScheduleChangeRequest::APPROVAL_APPROVED : ScheduleChangeRequest::APPROVAL_REJECTED)
            ->setAdminReviewer($admin)
            ->setAdminReviewedAt(new \DateTime())
            ->setAdminComment($comment);

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
            $approved ? 'schedule_change.request_admin_approved' : 'schedule_change.request_admin_rejected',
            "Admin {$decisionVerb} schedule change request for {$subjectCode} (Section {$sectionLabel})",
            'ScheduleChangeRequest',
            $requestEntity->getId(),
            [
                'schedule_id' => $schedule?->getId(),
                'subject_code' => $schedule?->getSubject()?->getCode(),
                'section' => $sectionLabel,
                'final_status' => $outcome['status'],
                'admin_comment' => $comment,
            ],
            $admin,
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
                $admin,
            );
        } elseif (($outcome['status'] ?? null) === ScheduleChangeRequest::STATUS_REJECTED) {
            $this->activityLogService->log(
                'schedule_change.request_finalized_rejected',
                "Schedule change request for {$subjectCode} (Section {$sectionLabel}) was rejected",
                'ScheduleChangeRequest',
                $requestEntity->getId(),
                [
                    'schedule_id' => $schedule?->getId(),
                    'admin_comment' => $comment,
                ],
                $admin,
            );
        }

        $this->notifyRequesterOnScheduleChangeDecision($requestEntity, 'Admin', $approved, (string) $outcome['status']);

        if (
            $approved
            && ($outcome['status'] ?? null) === ScheduleChangeRequest::STATUS_PENDING
            && $requestEntity->getDepartmentHeadStatus() === ScheduleChangeRequest::APPROVAL_PENDING
            && $requestEntity->getDepartmentHeadApprover() instanceof User
        ) {
            $departmentHeadApprover = $requestEntity->getDepartmentHeadApprover();
            $this->notificationService->create(
                $departmentHeadApprover,
                Notification::TYPE_SYSTEM,
                'Schedule Change Request Awaiting Your Review',
                sprintf(
                    'A schedule change request for %s (Section %s) is waiting for your approval.',
                    $subjectCode,
                    $sectionLabel,
                ),
                [
                    'schedule_change_request_id' => $requestEntity->getId(),
                    'schedule_id' => $schedule?->getId(),
                ],
            );
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

        $comment = trim((string) ($data['comment'] ?? $data['admin_comment'] ?? $data['adminComment'] ?? ''));
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
    // Schedules CRUD
    // ================================================================

    #[Route('/schedules', name: 'schedules_list', methods: ['GET'])]
    public function listSchedules(Request $request): JsonResponse
    {
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 20);
        $search = $request->query->get('search');
        $academicYearId = $request->query->get('academic_year_id');
        $semester = $request->query->get('semester');
        $departmentId = $request->query->get('department_id');
        $roomId = $request->query->get('room_id');
        $dayPattern = $request->query->get('day_pattern');
        $status = $request->query->get('status');

        $activeAy = $academicYearId ? $this->academicYearRepository->find($academicYearId) : $this->systemSettingsService->getActiveAcademicYear();
        $activeSem = $semester ?: $this->systemSettingsService->getActiveSemester();

        $sortField = $request->query->get('sort', 'createdAt');
        $sortDirection = strtoupper($request->query->get('direction', 'DESC')) === 'ASC' ? 'ASC' : 'DESC';
        $allowedSorts = ['subject' => 'sub.code', 'faculty' => 'f.lastName', 'dayPattern' => 's.dayPattern', 'status' => 's.status', 'createdAt' => 's.createdAt'];
        $orderColumn = $allowedSorts[$sortField] ?? 's.createdAt';

        $qb = $this->entityManager->createQueryBuilder()
            ->select('s')
            ->from(Schedule::class, 's')
            ->leftJoin('s.subject', 'sub')
            ->leftJoin('s.room', 'r')
            ->leftJoin('s.faculty', 'f')
            ->orderBy($orderColumn, $sortDirection);

        if ($activeAy) {
            $qb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAy);
        }
        if ($activeSem) {
            $qb->andWhere('s.semester = :sem')->setParameter('sem', $activeSem);
        }
        if ($departmentId > 0) {
            $includeGroup = filter_var($request->query->get('include_group', false), FILTER_VALIDATE_BOOLEAN);
            $deptIds = [$departmentId];

            if ($includeGroup) {
                $selectedDepartment = $this->departmentRepository->find($departmentId);
                $group = $selectedDepartment?->getDepartmentGroup();
                if ($group) {
                    $deptIds = array_values(array_filter(array_map(
                        static fn(Department $d) => $d->getId(),
                        $group->getDepartments()->toArray(),
                    )));
                }
            }

            $qb->leftJoin('sub.department', 'd')
               ->andWhere('d.id IN (:deptIds)')
               ->setParameter('deptIds', $deptIds);
        }
        if ($roomId) {
            $qb->andWhere('r.id = :roomId')->setParameter('roomId', (int) $roomId);
        }
        if ($dayPattern) {
            $qb->andWhere('s.dayPattern = :dayPattern')->setParameter('dayPattern', $dayPattern);
        }
        if ($status) {
            $qb->andWhere('s.status = :status')->setParameter('status', $status);
        }
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
        $schedule = $this->scheduleRepository->find($id);
        if (!$schedule) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Schedule not found.']], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeSchedule($schedule)]);
    }

    #[Route('/schedules', name: 'schedules_create', methods: ['POST'])]
    public function createSchedule(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        $schedule = new Schedule();

        if (!empty($data['academicYearId'])) {
            $ay = $this->academicYearRepository->find((int) $data['academicYearId']);
            if ($ay) $schedule->setAcademicYear($ay);
        }
        $schedule->setSemester($data['semester'] ?? null);

        if (!empty($data['subjectId'])) {
            $subject = $this->subjectRepository->find((int) $data['subjectId']);
            if ($subject) $schedule->setSubject($subject);
        }
        if (!empty($data['roomId'])) {
            $room = $this->roomRepository->find((int) $data['roomId']);
            if ($room) $schedule->setRoom($room);
        }
        if (!empty($data['facultyId'])) {
            $faculty = $this->entityManager->getRepository(User::class)->find((int) $data['facultyId']);
            if ($faculty) $schedule->setFaculty($faculty);
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

        $this->activityLogService->log('schedule.created', "Schedule created", 'Schedule', $schedule->getId());

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
        $schedule = $this->scheduleRepository->find($id);
        if (!$schedule) {
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
            if ($subject) $schedule->setSubject($subject);
        }
        if (array_key_exists('roomId', $data)) {
            $schedule->setRoom($data['roomId'] ? $this->roomRepository->find((int) $data['roomId']) : null);
        }
        if (array_key_exists('facultyId', $data)) {
            $schedule->setFaculty($data['facultyId'] ? $this->entityManager->getRepository(User::class)->find((int) $data['facultyId']) : null);
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
        $this->activityLogService->log('schedule.updated', "Schedule updated", 'Schedule', $schedule->getId());

        $response = ['success' => true, 'data' => $this->serializeSchedule($schedule)];
        if (!empty($conflicts)) {
            $response['meta'] = [
                'conflicts' => array_map(fn($c) => $c['message'] ?? $c['type'], $conflicts),
            ];
        }
        return $this->json($response);
    }

    #[Route('/schedules/{id}/assign-faculty', name: 'schedules_assign_faculty', methods: ['POST'], requirements: ['id' => '\\d+'])]
    public function assignFacultyToSchedule(int $id, Request $request): JsonResponse
    {
        $schedule = $this->scheduleRepository->find($id);
        if (!$schedule) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Schedule not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);
        }

        $departmentId = isset($data['departmentId']) ? (int) $data['departmentId'] : 0;
        if ($departmentId <= 0) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'departmentId is required.']], 400);
        }

        $selectedDepartment = $this->departmentRepository->find($departmentId);
        if (!$selectedDepartment) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Selected department not found.']], 404);
        }

        $allowedDepartmentIds = [$selectedDepartment->getId()];

        $scheduleDepartmentId = $schedule->getSubject()?->getDepartment()?->getId();
        if (!$scheduleDepartmentId || !in_array($scheduleDepartmentId, $allowedDepartmentIds, true)) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 409, 'message' => 'Schedule does not belong to the selected department.'],
            ], 409);
        }

        $facultyId = array_key_exists('facultyId', $data) && $data['facultyId'] !== null ? (int) $data['facultyId'] : null;
        if ($facultyId !== null) {
            $faculty = $this->entityManager->getRepository(User::class)->find($facultyId);
            if (!$faculty) {
                return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Faculty not found.']], 404);
            }
            $schedule->setFaculty($faculty);

            // Enforce faculty conflict prevention on assignment.
            $conflicts = $this->scheduleConflictDetector->detectConflicts($schedule, true);
            $facultyConflicts = array_values(array_filter($conflicts, static fn(array $c): bool => ($c['type'] ?? '') === 'faculty_conflict'));
            if (!empty($facultyConflicts)) {
                $serialized = array_map(function (array $c): array {
                    $entry = [
                        'type' => $c['type'] ?? 'faculty_conflict',
                        'message' => $c['message'] ?? 'Faculty conflict detected.',
                    ];
                    if (isset($c['schedule']) && $c['schedule'] instanceof Schedule) {
                        $entry['schedule'] = $this->serializeSchedule($c['schedule']);
                    }
                    return $entry;
                }, $facultyConflicts);

                return $this->json([
                    'success' => false,
                    'error' => ['code' => 409, 'message' => 'Faculty conflict detected.'],
                    'data' => ['conflicts' => $serialized],
                ], 409);
            }
        } else {
            $schedule->setFaculty(null);
        }

        // Recompute schedule conflict marker after assignment/unassignment.
        $remainingConflicts = $this->scheduleConflictDetector->detectConflicts($schedule, true);
        $schedule->setIsConflicted(!empty($remainingConflicts));

        $this->entityManager->flush();
        $this->activityLogService->log('schedule.updated', 'Faculty assignment updated', 'Schedule', $schedule->getId());

        return $this->json(['success' => true, 'data' => $this->serializeSchedule($schedule)]);
    }

    #[Route('/schedules/{id}/toggle-overload', name: 'schedules_toggle_overload', methods: ['POST'], requirements: ['id' => '\\d+'])]
    public function toggleScheduleOverload(int $id): JsonResponse
    {
        $schedule = $this->scheduleRepository->find($id);
        if (!$schedule) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Schedule not found.']], 404);
        }

        if (!$schedule->getFaculty()) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Schedule must have a faculty assigned.']], 400);
        }

        $newOverloadStatus = !$schedule->getIsOverload();
        $schedule->setIsOverload($newOverloadStatus);

        try {
            $this->entityManager->flush();

            $this->activityLogService->log(
                $newOverloadStatus ? 'schedule.overload_enabled' : 'schedule.overload_disabled',
                sprintf(
                    "Schedule %s as overload: %s - %s (%s)",
                    $newOverloadStatus ? 'marked' : 'unmarked',
                    $schedule->getFaculty()->getFullName(),
                    $schedule->getSubject()?->getTitle() ?? 'Unknown Subject',
                    $schedule->getSection() ?? 'N/A'
                ),
                'Schedule',
                $schedule->getId(),
                [
                    'faculty_name' => $schedule->getFaculty()->getFullName(),
                    'subject' => $schedule->getSubject()?->getTitle(),
                    'section' => $schedule->getSection(),
                    'is_overload' => $newOverloadStatus,
                ]
            );

            return $this->json([
                'success' => true,
                'data' => [
                    'schedule' => $this->serializeSchedule($schedule),
                    'isOverload' => $newOverloadStatus,
                ],
            ]);
        } catch (\Exception $e) {
            return $this->json(['success' => false, 'error' => ['code' => 500, 'message' => 'Failed to update overload status.']], 500);
        }
    }

    #[Route('/schedules/scan-conflicts', name: 'schedules_scan_conflicts', methods: ['POST'])]
    public function scanScheduleConflicts(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $departmentId = $data['departmentId'] ?? null;

        $criteria = ['status' => 'active'];
        $schedules = $this->scheduleRepository->findBy($criteria);

        // Filter by department if provided
        if ($departmentId) {
            $schedules = array_filter($schedules, function (Schedule $s) use ($departmentId) {
                return $s->getSubject()?->getDepartment()?->getId() === (int) $departmentId;
            });
        }

        // Reset all to not conflicted first
        foreach ($schedules as $schedule) {
            $schedule->setIsConflicted(false);
        }

        $conflictCount = 0;
        foreach ($schedules as $schedule) {
            $conflicts = $this->scheduleConflictDetector->detectConflicts($schedule, true);
            if (!empty($conflicts)) {
                $schedule->setIsConflicted(true);
                $conflictCount++;
                // Also flag the counterparts
                foreach ($conflicts as $c) {
                    if (isset($c['schedule']) && $c['schedule'] instanceof Schedule) {
                        $c['schedule']->setIsConflicted(true);
                    }
                }
            }
        }

        $this->entityManager->flush();

        return $this->json([
            'success' => true,
            'data' => [
                'scanned' => count($schedules),
                'conflicts' => $conflictCount,
            ],
        ]);
    }

    #[Route('/schedules/{id}', name: 'schedules_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteSchedule(int $id): JsonResponse
    {
        $schedule = $this->scheduleRepository->find($id);
        if (!$schedule) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Schedule not found.']], 404);
        }
        $this->entityManager->remove($schedule);
        $this->entityManager->flush();
        $this->activityLogService->log('schedule.deleted', "Schedule deleted", 'Schedule', $id);

        return $this->json(['success' => true, 'data' => ['message' => 'Schedule deleted successfully.']]);
    }

    #[Route('/schedules/check-conflict', name: 'schedules_check_conflict', methods: ['POST'])]
    public function checkScheduleConflict(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        // Build a temporary Schedule entity to leverage the full ScheduleConflictDetector
        $schedule = new Schedule();
        $schedule->setStatus('active');

        if (!empty($data['roomId'])) {
            $room = $this->roomRepository->find($data['roomId']);
            if ($room) $schedule->setRoom($room);
        }
        if (!empty($data['facultyId'])) {
            $faculty = $this->entityManager->getRepository(User::class)->find($data['facultyId']);
            if ($faculty) $schedule->setFaculty($faculty);
        }
        if (!empty($data['subjectId'])) {
            $subject = $this->subjectRepository->find($data['subjectId']);
            if ($subject) $schedule->setSubject($subject);
        }
        if (!empty($data['academicYearId'])) {
            $ay = $this->academicYearRepository->find($data['academicYearId']);
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

    #[Route('/schedules/faculty-loading', name: 'schedules_faculty_loading', methods: ['GET'])]
    public function getFacultyLoading(Request $request): JsonResponse
    {
        $page = max(1, $request->query->getInt('page', 1));
        $limit = max(1, min(200, $request->query->getInt('limit', 20)));
        $search = trim((string) $request->query->get('search', ''));
        $sort = (string) $request->query->get('sort', 'fullName');
        $direction = strtolower((string) $request->query->get('direction', 'asc')) === 'desc' ? 'DESC' : 'ASC';
        $departmentId = $request->query->getInt('department_id', 0);
        if ($departmentId <= 0) {
            // Backward compatibility: some callers still send `department`.
            $departmentId = (int) $request->query->get('department', 0);
        }

        $academicYearId = $request->query->get('academic_year_id');
        $semester = $request->query->get('semester');

        $activeAy = $academicYearId ? $this->academicYearRepository->find($academicYearId) : $this->systemSettingsService->getActiveAcademicYear();
        $activeSem = $semester ?: $this->systemSettingsService->getActiveSemester();

        if ($departmentId <= 0) {
            return $this->json([
                'success' => true,
                'data' => [],
                'meta' => [
                    'total' => 0,
                    'page' => $page,
                    'limit' => $limit,
                    'totalPages' => 0,
                ],
                'summary' => [
                    'totalSchedules' => 0,
                    'assignedSchedules' => 0,
                    'unassignedSchedules' => 0,
                ],
            ]);
        }

        $selectedDepartment = $this->departmentRepository->find($departmentId);
        if (!$selectedDepartment) {
            // Return an empty successful payload so UI does not break on stale links/ids.
            return $this->json([
                'success' => true,
                'data' => [],
                'meta' => [
                    'total' => 0,
                    'page' => $page,
                    'limit' => $limit,
                    'totalPages' => 0,
                ],
                'summary' => [
                    'totalSchedules' => 0,
                    'assignedSchedules' => 0,
                    'unassignedSchedules' => 0,
                ],
                'selectedDepartment' => null,
            ]);
        }

        // Faculty loading should default to the exact selected department only.
        // Set include_group=1 explicitly if grouped aggregation is needed.
        $includeGroup = filter_var($request->query->get('include_group', false), FILTER_VALIDATE_BOOLEAN);
        $departmentsForFaculty = [$selectedDepartment];
        $group = $selectedDepartment->getDepartmentGroup();
        if ($includeGroup && $group) {
            $departmentsForFaculty = $group->getDepartments()->toArray();
        }

        $deptIds = array_values(array_filter(array_map(static fn(Department $d) => $d->getId(), $departmentsForFaculty)));
        if (empty($deptIds)) {
            return $this->json([
                'success' => true,
                'data' => [],
                'meta' => [
                    'total' => 0,
                    'page' => $page,
                    'limit' => $limit,
                    'totalPages' => 0,
                ],
                'summary' => [
                    'totalSchedules' => 0,
                    'assignedSchedules' => 0,
                    'unassignedSchedules' => 0,
                ],
            ]);
        }

        // Legacy flow summary cards: total schedules, assigned schedules, unassigned schedules for selected department/group.
        $summaryQb = $this->entityManager->createQueryBuilder()
            ->select('COUNT(s.id) AS totalSchedules')
            ->addSelect('SUM(CASE WHEN s.faculty IS NOT NULL THEN 1 ELSE 0 END) AS assignedSchedules')
            ->from(Schedule::class, 's')
            ->innerJoin('s.subject', 'sub')
            ->where('sub.department IN (:deptIds)')
            ->setParameter('deptIds', $deptIds);

        if ($activeAy) {
            $summaryQb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAy);
        }
        if ($activeSem) {
            $summaryQb->andWhere('s.semester = :sem')->setParameter('sem', $activeSem);
        }

        $summaryRow = $summaryQb->getQuery()->getOneOrNullResult();
        $totalSchedules = (int) ($summaryRow['totalSchedules'] ?? 0);
        $assignedSchedules = (int) ($summaryRow['assignedSchedules'] ?? 0);
        $unassignedSchedules = max(0, $totalSchedules - $assignedSchedules);

        // Get faculty list from department/group (legacy behavior includes faculty even with zero assigned schedules).
        $facultyQb = $this->entityManager->createQueryBuilder()
            ->select('u', 'd')
            ->from(User::class, 'u')
            ->leftJoin('u.department', 'd')
            ->where('u.department IN (:deptEntities)')
            ->andWhere('u.role = :facultyRole')
            ->andWhere('u.deletedAt IS NULL')
            ->setParameter('deptEntities', $departmentsForFaculty)
            ->setParameter('facultyRole', 3)
            ->orderBy('u.firstName', 'ASC')
            ->addOrderBy('u.lastName', 'ASC');

        $facultyUsers = $facultyQb->getQuery()->getResult();

        $facultyIds = array_values(array_filter(array_map(static fn(User $u) => $u->getId(), $facultyUsers)));
        $aggregatesByFaculty = [];
        if (!empty($facultyIds)) {
            $aggQb = $this->entityManager->createQueryBuilder()
                ->select('IDENTITY(s.faculty) AS facultyId')
                ->addSelect('COUNT(s.id) AS scheduleCount')
                ->addSelect('COALESCE(SUM(sub.units), 0) AS totalUnits')
                ->addSelect('COALESCE(SUM(COALESCE(sub.lectureHours, 0) + COALESCE(sub.labHours, 0)), 0) AS totalHours')
                ->from(Schedule::class, 's')
                ->innerJoin('s.subject', 'sub')
                ->where('s.faculty IN (:facultyIds)')
                ->andWhere('sub.department IN (:deptIds)')
                ->setParameter('facultyIds', $facultyIds)
                ->setParameter('deptIds', $deptIds)
                ->groupBy('s.faculty');

            if ($activeAy) {
                $aggQb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAy);
            }
            if ($activeSem) {
                $aggQb->andWhere('s.semester = :sem')->setParameter('sem', $activeSem);
            }

            foreach ($aggQb->getQuery()->getArrayResult() as $row) {
                $aggregatesByFaculty[(int) $row['facultyId']] = [
                    'scheduleCount' => (int) $row['scheduleCount'],
                    'totalUnits' => (float) $row['totalUnits'],
                    'totalHours' => (float) $row['totalHours'],
                ];
            }
        }

        $items = array_map(static function (User $u) use ($aggregatesByFaculty): array {
            $facultyId = (int) $u->getId();
            $agg = $aggregatesByFaculty[$facultyId] ?? ['scheduleCount' => 0, 'totalUnits' => 0.0, 'totalHours' => 0.0];
            $hours = (float) $agg['totalHours'];
            return [
                'id' => $facultyId,
                'fullName' => $u->getFullName() ?: $u->getUsername(),
                'employeeId' => $u->getEmployeeId(),
                'department' => $u->getDepartment()?->getName(),
                'position' => $u->getPosition(),
                'isActive' => (bool) $u->isActive(),
                'createdAt' => $u->getCreatedAt()?->format('c'),
                'scheduleCount' => (int) $agg['scheduleCount'],
                'assignedCount' => (int) $agg['scheduleCount'],
                'totalUnits' => (float) $agg['totalUnits'],
                'totalHours' => $hours,
                'isOverloaded' => $hours > 24,
            ];
        }, $facultyUsers);

        if ($search !== '') {
            $q = strtolower($search);
            $items = array_values(array_filter($items, static function (array $item) use ($q): bool {
                return str_contains(strtolower((string) $item['fullName']), $q)
                    || str_contains(strtolower((string) ($item['employeeId'] ?? '')), $q)
                    || str_contains(strtolower((string) ($item['position'] ?? '')), $q)
                    || str_contains(strtolower((string) ($item['department'] ?? '')), $q);
            }));
        }

        $sortMap = [
            'fullName' => static fn(array $i) => strtolower((string) $i['fullName']),
            'employeeId' => static fn(array $i) => strtolower((string) ($i['employeeId'] ?? '')),
            'position' => static fn(array $i) => strtolower((string) ($i['position'] ?? '')),
            'isActive' => static fn(array $i) => (int) $i['isActive'],
            'createdAt' => static fn(array $i) => (string) ($i['createdAt'] ?? ''),
            'scheduleCount' => static fn(array $i) => (float) $i['scheduleCount'],
            'totalUnits' => static fn(array $i) => (float) $i['totalUnits'],
            'totalHours' => static fn(array $i) => (float) $i['totalHours'],
        ];
        $sortExtractor = $sortMap[$sort] ?? $sortMap['fullName'];

        usort($items, static function (array $a, array $b) use ($sortExtractor, $direction): int {
            $va = $sortExtractor($a);
            $vb = $sortExtractor($b);
            if ($va == $vb) {
                return ($a['id'] <=> $b['id']);
            }
            return $direction === 'DESC' ? (($va < $vb) ? 1 : -1) : (($va < $vb) ? -1 : 1);
        });

        $total = count($items);
        $totalPages = (int) ceil($total / $limit);
        $paged = array_slice($items, ($page - 1) * $limit, $limit);

        return $this->json([
            'success' => true,
            'data' => $paged,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => $totalPages,
            ],
            'summary' => [
                'totalSchedules' => $totalSchedules,
                'assignedSchedules' => $assignedSchedules,
                'unassignedSchedules' => $unassignedSchedules,
            ],
            'selectedDepartment' => [
                'id' => $selectedDepartment->getId(),
                'name' => $selectedDepartment->getName(),
                'group' => $group ? ['id' => $group->getId(), 'name' => $group->getName()] : null,
            ],
        ]);
    }

    // ================================================================
    // Department Groups CRUD
    // ================================================================

    #[Route('/department-groups/stats', name: 'dept_groups_stats', methods: ['GET'])]
    public function departmentGroupsStats(): JsonResponse
    {
        $groups = $this->departmentGroupRepository->findAllWithDepartments();
        $totalGroups = count($groups);
        $totalGrouped = 0;
        foreach ($groups as $g) { $totalGrouped += count($g->getDepartments()); }
        $totalDepts = $this->departmentRepository->createQueryBuilder('d')->select('COUNT(d.id)')->where('d.deletedAt IS NULL')->getQuery()->getSingleScalarResult();
        return $this->json(['success' => true, 'data' => [
            'total_groups' => $totalGroups,
            'grouped_departments' => $totalGrouped,
            'ungrouped_departments' => $totalDepts - $totalGrouped,
        ]]);
    }

    #[Route('/department-groups', name: 'dept_groups_list', methods: ['GET'])]
    public function listDepartmentGroups(Request $request): JsonResponse
    {
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 20);
        $search = $request->query->get('search');

        $groups = $this->departmentGroupRepository->findAllWithDepartments();

        if ($search) {
            $groups = array_filter($groups, fn(DepartmentGroup $g) =>
                stripos($g->getName(), $search) !== false ||
                stripos($g->getDescription() ?? '', $search) !== false
            );
            $groups = array_values($groups);
        }

        $sortField = $request->query->get('sort', 'name');
        $sortDirection = strtoupper($request->query->get('direction', 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        if ($sortField === 'name') {
            usort($groups, fn(DepartmentGroup $a, DepartmentGroup $b) =>
                $sortDirection === 'ASC' ? strcmp($a->getName(), $b->getName()) : strcmp($b->getName(), $a->getName())
            );
        }

        $total = count($groups);
        $paged = array_slice($groups, ($page - 1) * $limit, $limit);

        $items = array_map(fn(DepartmentGroup $g) => $this->serializeDepartmentGroup($g), $paged);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int) ceil($total / $limit)],
        ]);
    }

    #[Route('/department-groups/{id}', name: 'dept_groups_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getDepartmentGroup(int $id): JsonResponse
    {
        $group = $this->departmentGroupRepository->findOneWithDepartments($id);
        if (!$group) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department group not found.']], 404);
        }
        return $this->json(['success' => true, 'data' => $this->serializeDepartmentGroup($group)]);
    }

    #[Route('/department-groups', name: 'dept_groups_create', methods: ['POST'])]
    public function createDepartmentGroup(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (empty($data['name'])) {
            return $this->json(['success' => false, 'error' => ['code' => 422, 'message' => 'Validation failed.', 'details' => ['name' => 'Name is required.']]], 422);
        }

        $group = new DepartmentGroup();
        $group->setName($data['name']);
        $group->setDescription($data['description'] ?? null);
        $group->setColor($data['color'] ?? null);
        $group->setCreatedAt(new \DateTimeImmutable());
        $group->setUpdatedAt(new \DateTimeImmutable());

        if (!empty($data['departmentIds']) && is_array($data['departmentIds'])) {
            foreach ($data['departmentIds'] as $deptId) {
                $dept = $this->departmentRepository->find((int) $deptId);
                if ($dept) {
                    $dept->setDepartmentGroup($group);
                    $group->addDepartment($dept);
                }
            }
        }

        $this->entityManager->persist($group);
        $this->entityManager->flush();

        $this->activityLogService->log('department_group.created', "Department group {$group->getName()} created", 'DepartmentGroup', $group->getId());

        return $this->json(['success' => true, 'data' => $this->serializeDepartmentGroup($group)], 201);
    }

    #[Route('/department-groups/{id}', name: 'dept_groups_update', methods: ['PUT', 'PATCH'], requirements: ['id' => '\d+'])]
    public function updateDepartmentGroup(int $id, Request $request): JsonResponse
    {
        $group = $this->departmentGroupRepository->find($id);
        if (!$group) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department group not found.']], 404);
        }

        $data = json_decode($request->getContent(), true);
        if (!$data) return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);

        if (isset($data['name'])) $group->setName($data['name']);
        if (array_key_exists('description', $data)) $group->setDescription($data['description']);
        if (array_key_exists('color', $data)) $group->setColor($data['color']);
        $group->setUpdatedAt(new \DateTimeImmutable());

        if (isset($data['departmentIds']) && is_array($data['departmentIds'])) {
            // Clear existing
            foreach ($group->getDepartments() as $dept) {
                $dept->setDepartmentGroup(null);
            }
            // Set new
            foreach ($data['departmentIds'] as $deptId) {
                $dept = $this->departmentRepository->find((int) $deptId);
                if ($dept) {
                    $dept->setDepartmentGroup($group);
                }
            }
        }

        $this->entityManager->flush();
        $this->activityLogService->log('department_group.updated', "Department group {$group->getName()} updated", 'DepartmentGroup', $group->getId());

        return $this->json(['success' => true, 'data' => $this->serializeDepartmentGroup($group)]);
    }

    #[Route('/department-groups/{id}', name: 'dept_groups_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteDepartmentGroup(int $id): JsonResponse
    {
        $group = $this->departmentGroupRepository->find($id);
        if (!$group) {
            return $this->json(['success' => false, 'error' => ['code' => 404, 'message' => 'Department group not found.']], 404);
        }
        // Clear department associations
        foreach ($group->getDepartments() as $dept) {
            $dept->setDepartmentGroup(null);
        }
        $this->entityManager->remove($group);
        $this->entityManager->flush();
        $this->activityLogService->log('department_group.deleted', "Department group {$group->getName()} deleted", 'DepartmentGroup', $id);

        return $this->json(['success' => true, 'data' => ['message' => 'Department group deleted successfully.']]);
    }

    // ================================================================
    // Activity Logs
    // ================================================================

    #[Route('/activity-logs', name: 'activity_logs_list', methods: ['GET'])]
    public function listActivityLogs(Request $request): JsonResponse
    {
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 20);
        $search = $request->query->get('search');
        $action = $request->query->get('action');
        $entityType = $request->query->get('entityType');

        $qb = $this->entityManager->createQueryBuilder()
            ->select('a')
            ->from(\App\Entity\ActivityLog::class, 'a')
            ->leftJoin('a.user', 'u')
            ->orderBy('a.createdAt', 'DESC');

        if ($search) {
            $qb->andWhere('a.action LIKE :s OR a.description LIKE :s OR a.entityType LIKE :s')
               ->setParameter('s', '%' . $search . '%');
        }

        if ($action) {
            $qb->andWhere('a.action = :action')
               ->setParameter('action', $action);
        }

        if ($entityType) {
            $qb->andWhere('a.entityType = :entityType')
               ->setParameter('entityType', $entityType);
        }

        $total = (int) (clone $qb)->select('COUNT(a.id)')->getQuery()->getSingleScalarResult();
        $logs = $qb->setFirstResult(($page - 1) * $limit)->setMaxResults($limit)->getQuery()->getResult();

        $items = array_map(fn(\App\Entity\ActivityLog $a) => [
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
                'role' => $a->getUser()->getRole(),
                'roleDisplayName' => $a->getUser()->getRoleDisplayName(),
            ] : null,
        ], $logs);

        return $this->json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int) ceil($total / $limit)],
        ]);
    }

    // ================================================================
    // Notifications
    // ================================================================

    #[Route('/notifications', name: 'notifications', methods: ['GET'])]
    public function notifications(Request $request): JsonResponse
    {
        /** @var User $user */
        $user   = $this->getUser();
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
        /** @var User $user */
        $user = $this->getUser();

        return $this->json([
            'unread_count' => $this->notificationService->getUnreadCount($user),
        ]);
    }

    #[Route('/notifications/{id}/read', name: 'notification_read', methods: ['POST'])]
    public function markNotificationRead(int $id): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
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
        /** @var User $user */
        $user    = $this->getUser();
        $updated = $this->notificationService->markAllAsRead($user);

        return $this->json([
            'success' => true,
            'updated' => $updated,
        ]);
    }

    #[Route('/notifications/{id}', name: 'notification_delete', methods: ['DELETE'])]
    public function deleteNotification(int $id): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $notification = $this->entityManager->getRepository(Notification::class)->find($id);

        if (!$notification || !$this->notificationService->delete($notification, $user)) {
            return $this->json(['error' => 'Notification not found'], 404);
        }

        return $this->json(['success' => true]);
    }

    // ================================================================
    // Reports
    // ================================================================

    #[Route('/reports/faculty-workload', name: 'reports_faculty_workload', methods: ['GET'])]
    public function reportFacultyWorkload(Request $request): JsonResponse
    {
        $requestedAcademicYearId = (int) $request->query->get('academic_year_id', 0);
        $requestedSemester = (string) $request->query->get('semester', '');
        $allYears = filter_var($request->query->get('all_years', false), FILTER_VALIDATE_BOOL);
        $allSemesters = strtolower($requestedSemester) === 'all';

        $activeAy = $allYears
            ? null
            : ($requestedAcademicYearId > 0
                ? $this->academicYearRepository->find($requestedAcademicYearId)
                : $this->systemSettingsService->getActiveAcademicYear());
        $activeSem = $allSemesters
            ? null
            : ($requestedSemester ?: $this->systemSettingsService->getActiveSemester());

        $faculty = $this->entityManager->getRepository(User::class)->findBy(['role' => 3, 'isActive' => true]);
        $workloads = [];

        foreach ($faculty as $f) {
            $qb = $this->entityManager->createQueryBuilder()
                ->select('s')
                ->from(Schedule::class, 's')
                ->join('s.subject', 'sub')
                ->where('s.faculty = :fId')
                ->andWhere('s.status = :status')
                ->setParameter('fId', $f->getId())
                ->setParameter('status', 'active');

            if ($activeAy) $qb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAy);
            if ($activeSem) $qb->andWhere('s.semester = :sem')->setParameter('sem', $activeSem);

            $schedules = $qb->getQuery()->getResult();
            $totalUnits = 0;
            foreach ($schedules as $s) {
                if ($s->getSubject()) $totalUnits += $s->getSubject()->getUnits();
            }

            $workloads[] = [
                'id'         => $f->getId(),
                'name'       => $f->getFullName(),
                'employeeId' => $f->getEmployeeId(),
                'college'    => $f->getCollege()?->getName(),
                'department' => $f->getDepartment()?->getName(),
                'units'      => $totalUnits,
                'schedules'  => count($schedules),
                'percentage' => round(($totalUnits / 21) * 100),
                'status'     => $totalUnits > 21 ? 'overloaded' : ($totalUnits >= 15 ? 'optimal' : 'underloaded'),
            ];
        }

        usort($workloads, fn($a, $b) => $b['units'] <=> $a['units']);

        return $this->json(['success' => true, 'data' => $workloads]);
    }

    #[Route('/reports/room-utilization', name: 'reports_room_utilization', methods: ['GET'])]
    public function reportRoomUtilization(Request $request): JsonResponse
    {
        $requestedAcademicYearId = (int) $request->query->get('academic_year_id', 0);
        $requestedSemester = (string) $request->query->get('semester', '');
        $allYears = filter_var($request->query->get('all_years', false), FILTER_VALIDATE_BOOL);
        $allSemesters = strtolower($requestedSemester) === 'all';

        $activeAy = $allYears
            ? null
            : ($requestedAcademicYearId > 0
                ? $this->academicYearRepository->find($requestedAcademicYearId)
                : $this->systemSettingsService->getActiveAcademicYear());
        $activeSem = $allSemesters
            ? null
            : ($requestedSemester ?: $this->systemSettingsService->getActiveSemester());

        $rooms = $this->roomRepository->findActive();
        $utilization = [];

        foreach ($rooms as $room) {
            $qb = $this->entityManager->createQueryBuilder()
                ->select('COUNT(s.id)')
                ->from(Schedule::class, 's')
                ->where('s.room = :rId')
                ->andWhere('s.status = :status')
                ->setParameter('rId', $room->getId())
                ->setParameter('status', 'active');

            if ($activeAy) $qb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAy);
            if ($activeSem) $qb->andWhere('s.semester = :sem')->setParameter('sem', $activeSem);

            $count = (int) $qb->getQuery()->getSingleScalarResult();

            $utilization[] = [
                'id'       => $room->getId(),
                'code'     => $room->getCode(),
                'name'     => $room->getName(),
                'type'     => $room->getType(),
                'capacity' => $room->getCapacity(),
                'building' => $room->getBuilding(),
                'department' => $room->getDepartment()?->getName(),
                'college' => $room->getDepartment()?->getCollege()?->getName(),
                'schedules' => $count,
                'utilization' => min(100, round(($count / 40) * 100)),
            ];
        }

        usort($utilization, fn($a, $b) => $b['schedules'] <=> $a['schedules']);

        return $this->json(['success' => true, 'data' => $utilization]);
    }

    #[Route('/reports/subject-offerings', name: 'reports_subject_offerings', methods: ['GET'])]
    public function reportSubjectOfferings(Request $request): JsonResponse
    {
        $requestedAcademicYearId = (int) $request->query->get('academic_year_id', 0);
        $requestedSemester = (string) $request->query->get('semester', '');
        $allYears = filter_var($request->query->get('all_years', false), FILTER_VALIDATE_BOOL);
        $allSemesters = strtolower($requestedSemester) === 'all';

        $activeAy = $allYears
            ? null
            : ($requestedAcademicYearId > 0
                ? $this->academicYearRepository->find($requestedAcademicYearId)
                : $this->systemSettingsService->getActiveAcademicYear());
        $activeSem = $allSemesters
            ? null
            : ($requestedSemester ?: $this->systemSettingsService->getActiveSemester());

        $semesterVariants = $this->getSemesterVariants($activeSem);

        $subjectsQb = $this->entityManager->getRepository(Subject::class)
            ->createQueryBuilder('sub')
            ->leftJoin('sub.department', 'd')
            ->where('sub.deletedAt IS NULL')
            ->orderBy('d.name', 'ASC')
            ->addOrderBy('sub.code', 'ASC');

        if (!empty($semesterVariants)) {
            $subjectsQb->andWhere('sub.semester IN (:subjectSemesters)')
                ->setParameter('subjectSemesters', $semesterVariants);
        }

        $subjects = $subjectsQb->getQuery()->getResult();

        $offerings = [];

        foreach ($subjects as $subject) {
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

            if ($activeAy) {
                $qb->andWhere('s.academicYear = :ayFilter')->setParameter('ayFilter', $activeAy);
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

            $offerings[] = [
                'id' => $subject->getId(),
                'code' => $subject->getCode(),
                'title' => $subject->getTitle(),
                'units' => $subject->getUnits(),
                'type' => $subject->getType(),
                'department' => $subject->getDepartment()?->getName(),
                'college' => $subject->getDepartment()?->getCollege()?->getName(),
                'schedules' => count($scheduleRows),
                'offerings' => $scheduleRows,
            ];
        }

        usort($offerings, fn($a, $b) => $b['schedules'] <=> $a['schedules']);

        return $this->json(['success' => true, 'data' => $offerings]);
    }

    #[Route('/reports/{type}/pdf', name: 'reports_pdf', methods: ['GET'])]
    public function exportPdfReport(string $type, Request $request): Response
    {
        if ($type === 'faculty-workload') {
            $requestedAcademicYearId = (int) $request->query->get('academic_year_id', 0);
            $requestedSemester = (string) $request->query->get('semester', '');
            $search = trim((string) $request->query->get('search', ''));
            $status = (string) $request->query->get('status', 'all');
            $collegeFilter = trim((string) $request->query->get('college', ''));
            $departmentFilter = trim((string) $request->query->get('department', ''));
            $allYears = filter_var($request->query->get('all_years', false), FILTER_VALIDATE_BOOL);
            $allSemesters = strtolower($requestedSemester) === 'all';

            $activeAy = $allYears
                ? null
                : ($requestedAcademicYearId > 0
                    ? $this->academicYearRepository->find($requestedAcademicYearId)
                    : $this->systemSettingsService->getActiveAcademicYear());
            $activeSem = $allSemesters
                ? null
                : ($requestedSemester ?: $this->systemSettingsService->getActiveSemester());

            $faculty = $this->entityManager->getRepository(User::class)->findBy(['role' => 3, 'isActive' => true]);
            $rows = [];

            foreach ($faculty as $member) {
                $qb = $this->entityManager->createQueryBuilder()
                    ->select('s', 'sub')
                    ->from(Schedule::class, 's')
                    ->join('s.subject', 'sub')
                    ->where('s.faculty = :fId')
                    ->andWhere('s.status = :status')
                    ->setParameter('fId', $member->getId())
                    ->setParameter('status', 'active');

                if ($activeAy) {
                    $qb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAy);
                }
                if ($activeSem) {
                    $qb->andWhere('s.semester = :sem')->setParameter('sem', $activeSem);
                }

                $schedules = $qb->getQuery()->getResult();
                $totalUnits = 0;
                foreach ($schedules as $schedule) {
                    if ($schedule->getSubject()) {
                        $totalUnits += (int) $schedule->getSubject()->getUnits();
                    }
                }

                $computedStatus = $totalUnits > 21 ? 'overloaded' : ($totalUnits >= 15 ? 'optimal' : 'underloaded');
                $memberCollege = $member->getCollege()?->getName() ?? 'Unassigned';
                $memberDepartment = $member->getDepartment()?->getName() ?? 'Unassigned';

                if ($status !== '' && $status !== 'all' && $computedStatus !== $status) {
                    continue;
                }
                if ($collegeFilter !== '' && $collegeFilter !== 'all' && strcasecmp($memberCollege, $collegeFilter) !== 0) {
                    continue;
                }
                if ($departmentFilter !== '' && $departmentFilter !== 'all' && strcasecmp($memberDepartment, $departmentFilter) !== 0) {
                    continue;
                }
                if ($search !== '') {
                    $haystack = strtolower(implode(' ', [
                        $member->getFullName() ?? '',
                        $member->getEmployeeId() ?? '',
                        $memberCollege,
                        $memberDepartment,
                    ]));
                    if (!str_contains($haystack, strtolower($search))) {
                        continue;
                    }
                }

                $rows[] = [
                    0 => $member,
                    'scheduleCount' => count($schedules),
                    'totalUnits' => $totalUnits,
                ];
            }

            usort($rows, fn($a, $b) => ($b['totalUnits'] <=> $a['totalUnits']));

            $pdfContent = $this->facultyReportPdfService->generateFacultyReportPdf(
                $rows,
                $activeAy?->getYear(),
                $activeSem ?: null,
                ($departmentFilter !== '' && $departmentFilter !== 'all') ? $departmentFilter : null,
                $search !== '' ? $search : null,
            );

            $filename = sprintf(
                'Faculty_Workload_%s_%s.pdf',
                $activeAy?->getYear() ?? 'CurrentAY',
                $activeSem ?: 'CurrentSem'
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

        if ($type === 'room-utilization') {
            $requestedAcademicYearId = (int) $request->query->get('academic_year_id', 0);
            $requestedSemester = (string) $request->query->get('semester', '');
            $search = trim((string) $request->query->get('search', ''));
            $typeFilter = trim((string) $request->query->get('type', ''));
            $buildingFilter = trim((string) $request->query->get('building', ''));
            $collegeFilter = trim((string) $request->query->get('college', ''));
            $allYears = filter_var($request->query->get('all_years', false), FILTER_VALIDATE_BOOL);
            $allSemesters = strtolower($requestedSemester) === 'all';

            $activeAy = $allYears
                ? null
                : ($requestedAcademicYearId > 0
                    ? $this->academicYearRepository->find($requestedAcademicYearId)
                    : $this->systemSettingsService->getActiveAcademicYear());
            $activeSem = $allSemesters
                ? null
                : ($requestedSemester ?: $this->systemSettingsService->getActiveSemester());

            $rooms = $this->roomRepository->findActive();
            $rows = [];

            foreach ($rooms as $room) {
                $roomCollege = $room->getDepartment()?->getCollege()?->getName() ?? 'Unassigned';
                $roomBuilding = $room->getBuilding() ?? 'Unassigned';
                $roomType = $room->getType() ?? '';

                if ($collegeFilter !== '' && $collegeFilter !== 'all' && strcasecmp($roomCollege, $collegeFilter) !== 0) {
                    continue;
                }
                if ($buildingFilter !== '' && $buildingFilter !== 'all' && strcasecmp($roomBuilding, $buildingFilter) !== 0) {
                    continue;
                }
                if ($typeFilter !== '' && $typeFilter !== 'all' && strcasecmp($roomType, $typeFilter) !== 0) {
                    continue;
                }
                if ($search !== '') {
                    $haystack = strtolower(implode(' ', [
                        $room->getCode() ?? '',
                        $room->getName() ?? '',
                        $roomType,
                        $roomBuilding,
                        $roomCollege,
                    ]));
                    if (!str_contains($haystack, strtolower($search))) {
                        continue;
                    }
                }

                $qb = $this->entityManager->createQueryBuilder()
                    ->select('s', 'sub', 'd')
                    ->from(Schedule::class, 's')
                    ->leftJoin('s.subject', 'sub')
                    ->leftJoin('sub.department', 'd')
                    ->where('s.room = :room')
                    ->andWhere('s.status = :status')
                    ->setParameter('room', $room)
                    ->setParameter('status', 'active');

                if ($activeAy) {
                    $qb->andWhere('s.academicYear = :ay')->setParameter('ay', $activeAy);
                }
                if ($activeSem) {
                    $qb->andWhere('s.semester = :sem')->setParameter('sem', $activeSem);
                }

                $schedules = $qb->getQuery()->getResult();
                $deptNames = [];
                foreach ($schedules as $schedule) {
                    $deptName = $schedule->getSubject()?->getDepartment()?->getName();
                    if ($deptName && !in_array($deptName, $deptNames, true)) {
                        $deptNames[] = $deptName;
                    }
                }

                $rows[] = [
                    0 => $room,
                    'scheduleCount' => count($schedules),
                    'departments' => !empty($deptNames) ? implode(', ', $deptNames) : 'N/A',
                ];
            }

            usort($rows, fn($a, $b) => ($b['scheduleCount'] <=> $a['scheduleCount']));

            $pdfContent = $this->roomsReportPdfService->generateRoomsReportPdf(
                $rows,
                $activeAy?->getYear(),
                $activeSem ?: null,
                null,
                $search !== '' ? $search : null,
            );

            $filename = sprintf(
                'Room_Utilization_%s_%s.pdf',
                $activeAy?->getYear() ?? 'CurrentAY',
                $activeSem ?: 'CurrentSem'
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

        if ($type === 'subject-offerings') {
            $requestedAcademicYearId = (int) $request->query->get('academic_year_id', 0);
            $requestedSemester = (string) $request->query->get('semester', '');
            $search = trim((string) $request->query->get('search', ''));
            $collegeFilter = trim((string) $request->query->get('college', ''));
            $departmentFilter = trim((string) $request->query->get('department', ''));
            $allYears = filter_var($request->query->get('all_years', false), FILTER_VALIDATE_BOOL);
            $allSemesters = strtolower($requestedSemester) === 'all';

            $activeAy = $allYears
                ? null
                : ($requestedAcademicYearId > 0
                    ? $this->academicYearRepository->find($requestedAcademicYearId)
                    : $this->systemSettingsService->getActiveAcademicYear());
            $activeSem = $allSemesters
                ? null
                : ($requestedSemester ?: $this->systemSettingsService->getActiveSemester());

            $semesterVariants = $this->getSemesterVariants($activeSem);

            $subjectsQb = $this->entityManager->getRepository(Subject::class)
                ->createQueryBuilder('sub')
                ->leftJoin('sub.department', 'd')
                ->where('sub.deletedAt IS NULL')
                ->orderBy('d.name', 'ASC')
                ->addOrderBy('sub.code', 'ASC');

            if (!empty($semesterVariants)) {
                $subjectsQb->andWhere('sub.semester IN (:subjectSemesters)')
                    ->setParameter('subjectSemesters', $semesterVariants);
            }

            $subjects = $subjectsQb->getQuery()->getResult();

            $rows = [];

            foreach ($subjects as $subject) {
                $subjectCollege = $subject->getDepartment()?->getCollege()?->getName() ?? 'Unassigned';
                $subjectDepartment = $subject->getDepartment()?->getName() ?? 'Unassigned';

                if ($collegeFilter !== '' && $collegeFilter !== 'all' && strcasecmp($subjectCollege, $collegeFilter) !== 0) {
                    continue;
                }
                if ($departmentFilter !== '' && $departmentFilter !== 'all' && strcasecmp($subjectDepartment, $departmentFilter) !== 0) {
                    continue;
                }

                if ($search !== '') {
                    $haystack = strtolower(implode(' ', [
                        $subject->getCode() ?? '',
                        $subject->getTitle() ?? '',
                        $subject->getType() ?? '',
                        $subjectCollege,
                        $subjectDepartment,
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

                if ($activeAy) {
                    $qb->andWhere('s.academicYear = :ayFilter')->setParameter('ayFilter', $activeAy);
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
                $activeAy?->getYear(),
                $activeSem ?: null,
                ($departmentFilter !== '' && $departmentFilter !== 'all') ? $departmentFilter : null,
                $search !== '' ? $search : null,
            );

            $filename = sprintf(
                'Subject_Offerings_%s_%s.pdf',
                $activeAy?->getYear() ?? 'CurrentAY',
                $activeSem ?: 'CurrentSem'
            );

            return new Response(
                $pdfContent,
                200,
                [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => 'inline; filename="' . $filename . '"',
                ]
            );
        }

        if ($type !== 'teaching-load') {
            return $this->json([
                'success' => false,
                'error' => ['code' => 501, 'message' => 'PDF export not yet implemented for this report type.'],
            ], 501);
        }

        $facultyId = (int) $request->query->get('facultyId', 0);
        if ($facultyId <= 0) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 422, 'message' => 'facultyId is required.'],
            ], 422);
        }

        $faculty = $this->entityManager->getRepository(User::class)->find($facultyId);
        if (!$faculty) {
            return $this->json([
                'success' => false,
                'error' => ['code' => 404, 'message' => 'Faculty not found.'],
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
            'Teaching_Load_%s_%s_Sem%s.pdf',
            $safeName,
            $academicYear->getYear(),
            $selectedSemester ?: 'Current'
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

    // ================================================================
    // Settings
    // ================================================================

    #[Route('/settings', name: 'settings_get', methods: ['GET'])]
    public function getSettings(): JsonResponse
    {
        $activeAy = $this->systemSettingsService->getActiveAcademicYear();

        return $this->json(['success' => true, 'data' => [
            'currentAcademicYear' => $activeAy ? $this->serializeAcademicYear($activeAy) : null,
            'activeSemester'      => $this->systemSettingsService->getActiveSemester(),
            'hasActiveSemester'   => $this->systemSettingsService->hasActiveSemester(),
            'auto_activate_new_users' => $this->systemSettingsService->isAutoActivateNewUsersEnabled(),
        ]]);
    }

    #[Route('/settings', name: 'settings_update', methods: ['PUT'])]
    public function updateSettings(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['success' => false, 'error' => ['code' => 400, 'message' => 'Invalid JSON.']], 400);
        }

        if (array_key_exists('auto_activate_new_users', $data) || array_key_exists('autoActivateNewUsers', $data)) {
            $rawValue = $data['auto_activate_new_users'] ?? $data['autoActivateNewUsers'];
            $enabled = filter_var($rawValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

            if ($enabled === null) {
                return $this->json([
                    'success' => false,
                    'error' => ['code' => 422, 'message' => 'Invalid value for auto_activate_new_users.'],
                ], 422);
            }

            $this->systemSettingsService->setAutoActivateNewUsersEnabled($enabled);
        }

        if (!empty($data['academicYearId']) && !empty($data['semester'])) {
            $this->systemSettingsService->setActiveSemester(
                (int) $data['academicYearId'],
                $data['semester']
            );
        }

        return $this->json(['success' => true, 'data' => [
            'currentAcademicYear' => $this->systemSettingsService->getActiveAcademicYear() ? $this->serializeAcademicYear($this->systemSettingsService->getActiveAcademicYear()) : null,
            'activeSemester'      => $this->systemSettingsService->getActiveSemester(),
            'hasActiveSemester'   => $this->systemSettingsService->hasActiveSemester(),
            'auto_activate_new_users' => $this->systemSettingsService->isAutoActivateNewUsersEnabled(),
        ]]);
    }

    #[Route('/dashboard/stats', name: 'dashboard_stats', methods: ['GET'])]
    public function dashboardStats(): JsonResponse
    {
        $data = $this->dashboardService->getAdminDashboardData();
        $activeYear = $this->systemSettingsService->getActiveAcademicYear();

        $activities = [];
        if (!empty($data['recent_activities'])) {
            foreach ($data['recent_activities'] as $activity) {
                $activities[] = [
                    'id' => $activity->getId(),
                    'action' => $activity->getAction(),
                    'description' => $activity->getDescription(),
                    'entityType' => $activity->getEntityType(),
                    'entityId' => $activity->getEntityId(),
                    'metadata' => $activity->getMetadata(),
                    'ipAddress' => $activity->getIpAddress(),
                    'createdAt' => $activity->getCreatedAt()?->format('c'),
                    'user' => $activity->getUser() ? [
                        'id' => $activity->getUser()->getId(),
                        'fullName' => $activity->getUser()->getFullName(),
                        'role' => $activity->getUser()->getRole(),
                        'roleDisplayName' => $activity->getUser()->getRoleDisplayName(),
                    ] : null,
                ];
            }
        }

        return $this->json([
            'status' => 'success',
            'data' => [
                'totalUsers' => $data['total_users'] ?? 0,
                'totalFaculty' => $data['faculty_count'] ?? 0,
                'totalDepartmentHeads' => $data['dept_head_count'] ?? 0,
                'totalAdmins' => $data['admin_count'] ?? 0,
                'activeUsers' => $data['active_users'] ?? 0,
                'totalColleges' => $data['college_count'] ?? 0,
                'totalDepartments' => $data['department_count'] ?? 0,
                'totalSubjects' => $data['total_subjects'] ?? 0,
                'totalRooms' => $data['total_rooms'] ?? 0,
                'availableRooms' => $data['available_rooms'] ?? 0,
                'totalSchedules' => 0, // TODO: add schedule count to DashboardService
                'totalCurriculums' => $data['total_curriculums'] ?? 0,
                'activeCurriculums' => $data['active_curriculums'] ?? 0,
                'growthPercent' => $data['growth_percent'] ?? 0,
                'thisMonthUsers' => $data['this_month_users'] ?? 0,
                'currentAcademicYear' => $activeYear ? [
                    'id' => $activeYear->getId(),
                    'year' => $activeYear->getYear(),
                    'currentSemester' => $activeYear->getCurrentSemester(),
                    'isCurrent' => $activeYear->isCurrent(),
                    'isActive' => $activeYear->isActive(),
                    'startDate' => $activeYear->getStartDate()?->format('Y-m-d'),
                    'endDate' => $activeYear->getEndDate()?->format('Y-m-d'),
                    'firstSemStart' => $activeYear->getFirstSemStart()?->format('Y-m-d'),
                    'firstSemEnd' => $activeYear->getFirstSemEnd()?->format('Y-m-d'),
                    'secondSemStart' => $activeYear->getSecondSemStart()?->format('Y-m-d'),
                    'secondSemEnd' => $activeYear->getSecondSemEnd()?->format('Y-m-d'),
                    'summerStart' => $activeYear->getSummerStart()?->format('Y-m-d'),
                    'summerEnd' => $activeYear->getSummerEnd()?->format('Y-m-d'),
                ] : null,
                'recentActivities' => $activities,
            ],
        ]);
    }

    private function repairCurriculumSubjectLinksInternal(Curriculum $curriculum): array
    {
        $department = $curriculum->getDepartment();
        if (!$department) {
            return ['error' => 'Curriculum has no department.'];
        }

        $inspected = 0;
        $createdSubjects = 0;
        $relinked = 0;
        $removedDuplicateLinks = 0;

        foreach ($curriculum->getCurriculumTerms() as $term) {
            foreach ($term->getCurriculumSubjects() as $cs) {
                $inspected++;
                $subject = $cs->getSubject();
                if (!$subject) {
                    continue;
                }

                $subjectDeptId = $subject->getDepartment()?->getId();
                if ($subjectDeptId === $department->getId()) {
                    continue;
                }

                $localSubject = $this->subjectRepository->findOneBy([
                    'code' => $subject->getCode(),
                    'department' => $department,
                    'deletedAt' => null,
                ]);

                if (!$localSubject) {
                    $localSubject = new Subject();
                    $localSubject->setCode($subject->getCode());
                    $localSubject->setTitle($subject->getTitle());
                    $localSubject->setDescription($subject->getDescription());
                    $localSubject->setUnits($subject->getUnits());
                    $localSubject->setLectureHours($subject->getLectureHours());
                    $localSubject->setLabHours($subject->getLabHours());
                    $localSubject->setType($subject->getType());
                    $localSubject->setYearLevel($subject->getYearLevel());
                    $localSubject->setSemester($subject->getSemester());
                    $localSubject->setDepartment($department);
                    $localSubject->setIsActive((bool) $subject->isActive());
                    $localSubject->setCreatedAt(new \DateTime());
                    $localSubject->setUpdatedAt(new \DateTime());
                    $this->entityManager->persist($localSubject);
                    $createdSubjects++;
                }

                $existingLink = $this->curriculumSubjectRepository->findOneBy([
                    'curriculumTerm' => $term,
                    'subject' => $localSubject,
                ]);

                if ($existingLink) {
                    $this->entityManager->remove($cs);
                    $removedDuplicateLinks++;
                    continue;
                }

                $cs->setSubject($localSubject);
                $cs->setUpdatedAt(new \DateTimeImmutable());
                $relinked++;
            }
        }

        return [
            'inspected' => $inspected,
            'createdSubjects' => $createdSubjects,
            'relinked' => $relinked,
            'removedDuplicateLinks' => $removedDuplicateLinks,
        ];
    }

    // ================================================================
    // Serialization Helpers
    // ================================================================

    private function serializeCollege(College $c): array
    {
        return [
            'id'          => $c->getId(),
            'code'        => $c->getCode(),
            'name'        => $c->getName(),
            'description' => $c->getDescription(),
            'dean'        => $c->getDean(),
            'isActive'    => $c->isActive(),
            'createdAt'   => $c->getCreatedAt()?->format('c'),
            'updatedAt'   => $c->getUpdatedAt()?->format('c'),
        ];
    }

    private function serializeDepartment(Department $d): array
    {
        return [
            'id'              => $d->getId(),
            'code'            => $d->getCode(),
            'name'            => $d->getName(),
            'description'     => $d->getDescription(),
            'contactEmail'    => $d->getContactEmail(),
            'isActive'        => (bool) $d->getIsActive(),
            'head'            => $d->getHead() ? ['id' => $d->getHead()->getId(), 'fullName' => $d->getHead()->getFullName()] : null,
            'college'         => $d->getCollege() ? ['id' => $d->getCollege()->getId(), 'name' => $d->getCollege()->getName()] : null,
            'departmentGroup' => $d->getDepartmentGroup() ? ['id' => $d->getDepartmentGroup()->getId(), 'name' => $d->getDepartmentGroup()->getName()] : null,
            'createdAt'       => $d->getCreatedAt()?->format('c'),
            'updatedAt'       => $d->getUpdatedAt()?->format('c'),
        ];
    }

    private function serializeSubject(Subject $s): array
    {
        return [
            'id'           => $s->getId(),
            'code'         => $s->getCode(),
            'title'        => $s->getTitle(),
            'description'  => $s->getDescription(),
            'units'        => $s->getUnits(),
            'lectureHours' => $s->getLectureHours(),
            'labHours'     => $s->getLabHours(),
            'type'         => $s->getType(),
            'yearLevel'    => $s->getYearLevel(),
            'semester'     => $s->getSemester(),
            'isActive'     => (bool) $s->isActive(),
            'department'   => $s->getDepartment() ? ['id' => $s->getDepartment()->getId(), 'name' => $s->getDepartment()->getName()] : null,
            'createdAt'    => $s->getCreatedAt()?->format('c'),
            'updatedAt'    => $s->getUpdatedAt()?->format('c'),
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

    private function serializeAcademicYear(AcademicYear $a): array
    {
        return [
            'id'              => $a->getId(),
            'year'            => $a->getYear(),
            'startDate'       => $a->getStartDate()?->format('Y-m-d'),
            'endDate'         => $a->getEndDate()?->format('Y-m-d'),
            'isCurrent'       => (bool) $a->isCurrent(),
            'currentSemester' => $a->getCurrentSemester(),
            'isActive'        => (bool) $a->isActive(),
            'firstSemStart'   => $a->getFirstSemStart()?->format('Y-m-d'),
            'firstSemEnd'     => $a->getFirstSemEnd()?->format('Y-m-d'),
            'secondSemStart'  => $a->getSecondSemStart()?->format('Y-m-d'),
            'secondSemEnd'    => $a->getSecondSemEnd()?->format('Y-m-d'),
            'summerStart'     => $a->getSummerStart()?->format('Y-m-d'),
            'summerEnd'       => $a->getSummerEnd()?->format('Y-m-d'),
            'createdAt'       => $a->getCreatedAt()?->format('c'),
            'updatedAt'       => $a->getUpdatedAt()?->format('c'),
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
            'canAdminReview' => $request->getStatus() === ScheduleChangeRequest::STATUS_PENDING
                && $request->getAdminStatus() === ScheduleChangeRequest::APPROVAL_PENDING,
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
                            'id'           => $cs->getSubject()->getId(),
                            'code'         => $cs->getSubject()->getCode(),
                            'title'        => $cs->getSubject()->getTitle(),
                            'units'        => $cs->getSubject()->getUnits(),
                            'lectureHours' => $cs->getSubject()->getLectureHours(),
                            'labHours'     => $cs->getSubject()->getLabHours(),
                            'type'         => $cs->getSubject()->getType(),
                        ] : null,
                    ];
                }
                $terms[] = [
                    'id'                 => $term->getId(),
                    'yearLevel'          => $term->getYearLevel(),
                    'semester'           => $term->getSemester(),
                    'termName'           => $term->getTermName(),
                    'displayName'        => $term->getDisplayName(),
                    'totalUnits'         => $term->getTotalUnits(),
                    'curriculumSubjects' => $subjects,
                    'createdAt'          => $term->getCreatedAt()->format('c'),
                    'updatedAt'          => $term->getUpdatedAt()->format('c'),
                ];
            }
            $data['curriculumTerms'] = $terms;
        }

        return $data;
    }

    private function serializeDepartmentGroup(DepartmentGroup $g): array
    {
        $departments = [];
        foreach ($g->getDepartments() as $d) {
            $departments[] = ['id' => $d->getId(), 'code' => $d->getCode(), 'name' => $d->getName()];
        }

        return [
            'id'          => $g->getId(),
            'name'        => $g->getName(),
            'description' => $g->getDescription(),
            'color'       => $g->getColor(),
            'departments' => $departments,
            'createdAt'   => $g->getCreatedAt()?->format('c'),
            'updatedAt'   => $g->getUpdatedAt()?->format('c'),
        ];
    }
}
