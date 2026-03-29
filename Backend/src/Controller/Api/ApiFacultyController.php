<?php

namespace App\Controller\Api;

use App\Entity\AcademicYear;
use App\Entity\College;
use App\Entity\Department;
use App\Entity\Notification;
use App\Entity\Room;
use App\Entity\Schedule;
use App\Entity\ScheduleChangeRequest;
use App\Entity\User;
use App\Service\ActivityLogService;
use App\Service\NotificationService;
use App\Service\ScheduleConflictDetector;
use App\Service\SystemSettingsService;
use App\Service\TeachingLoadPdfService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use TCPDF;

#[Route('/api/faculty', name: 'api_faculty_')]
#[IsGranted('ROLE_FACULTY')]
class ApiFacultyController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private SystemSettingsService $systemSettingsService,
        private TeachingLoadPdfService $teachingLoadPdfService,
        private NotificationService $notificationService,
        private ScheduleConflictDetector $scheduleConflictDetector,
        private ActivityLogService $activityLogService,
        private UserPasswordHasherInterface $passwordHasher,
    ) {
    }

    // ──────────────────────────────────────────────
    //  PROFILE
    // ──────────────────────────────────────────────

    #[Route('/profile', name: 'profile', methods: ['GET'])]
    public function profile(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        return $this->json([
            'id'           => $user->getId(),
            'username'     => $user->getUsername(),
            'email'        => $user->getEmail(),
            'first_name'   => $user->getFirstName(),
            'middle_name'  => $user->getMiddleName(),
            'last_name'    => $user->getLastName(),
            'full_name'    => $user->getFullName(),
            'employee_id'  => $user->getEmployeeId(),
            'position'     => $user->getPosition(),
            'address'      => $user->getAddress(),
            'other_designation' => $user->getOtherDesignation(),
            'department'   => $user->getDepartment() ? [
                'id'   => $user->getDepartment()->getId(),
                'name' => $user->getDepartment()->getName(),
            ] : null,
            'college' => $user->getCollege() ? [
                'id'   => $user->getCollege()->getId(),
                'name' => $user->getCollege()->getName(),
            ] : null,
            'profile_complete' => $this->isProfileComplete($user),
            'missing_profile_fields' => $this->getMissingProfileFields($user),
        ]);
    }

    #[Route('/profile', name: 'profile_update', methods: ['PUT', 'PATCH'])]
    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);

        if (!is_array($data)) {
            return $this->json([
                'success' => false,
                'message' => 'Invalid request payload.',
            ], Response::HTTP_BAD_REQUEST);
        }

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

            return $this->json([
                'success' => true,
                'message' => 'Profile updated successfully.',
            ]);
        } catch (\Exception $e) {
            return $this->json([
                'success' => false,
                'message' => 'Failed to update profile.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/profile/change-password', name: 'profile_change_password', methods: ['PUT'])]
    public function changePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);

        if (!is_array($data)) {
            return $this->json([
                'success' => false,
                'message' => 'Invalid request payload.',
            ], Response::HTTP_BAD_REQUEST);
        }

        $currentPassword = (string) ($data['currentPassword'] ?? '');
        $newPassword = (string) ($data['newPassword'] ?? '');
        $confirmPassword = (string) ($data['confirmPassword'] ?? '');

        if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
            return $this->json([
                'success' => false,
                'message' => 'All password fields are required.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (!$this->passwordHasher->isPasswordValid($user, $currentPassword)) {
            return $this->json([
                'success' => false,
                'message' => 'Current password is incorrect.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (strlen($newPassword) < 6) {
            return $this->json([
                'success' => false,
                'message' => 'New password must be at least 6 characters long.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($newPassword !== $confirmPassword) {
            return $this->json([
                'success' => false,
                'message' => 'New password and confirmation do not match.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
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
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/profile/completion-options', name: 'profile_completion_options', methods: ['GET'])]
    public function profileCompletionOptions(): JsonResponse
    {
        $collegeRepository = $this->entityManager->getRepository(College::class);
        $departmentRepository = $this->entityManager->getRepository(Department::class);

        $colleges = $collegeRepository->findActive();
        $departments = $departmentRepository->findActive();

        return $this->json([
            'success' => true,
            'data' => [
                'colleges' => array_map(static fn(College $college) => [
                    'id' => $college->getId(),
                    'code' => $college->getCode(),
                    'name' => $college->getName(),
                ], $colleges),
                'departments' => array_map(static fn(Department $department) => [
                    'id' => $department->getId(),
                    'code' => $department->getCode(),
                    'name' => $department->getName(),
                    'college_id' => $department->getCollege()?->getId(),
                ], $departments),
            ],
        ]);
    }

    #[Route('/profile/complete', name: 'profile_complete', methods: ['PUT'])]
    public function completeProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json([
                'success' => false,
                'message' => 'Invalid request payload.',
            ], Response::HTTP_BAD_REQUEST);
        }

        $firstName = trim((string) ($data['first_name'] ?? ''));
        $middleName = trim((string) ($data['middle_name'] ?? ''));
        $lastName = trim((string) ($data['last_name'] ?? ''));
        $position = trim((string) ($data['position'] ?? ''));
        $address = trim((string) ($data['address'] ?? ''));
        $otherDesignation = trim((string) ($data['other_designation'] ?? ''));
        $collegeId = (int) ($data['college_id'] ?? 0);
        $departmentId = (int) ($data['department_id'] ?? 0);

        $errors = [];
        if ($firstName === '') {
            $errors['first_name'] = 'First name is required.';
        }
        if ($lastName === '') {
            $errors['last_name'] = 'Last name is required.';
        }
        if ($position === '') {
            $errors['position'] = 'Position is required.';
        }
        if ($collegeId <= 0) {
            $errors['college_id'] = 'College is required.';
        }
        if ($departmentId <= 0) {
            $errors['department_id'] = 'Department is required.';
        }

        $collegeRepository = $this->entityManager->getRepository(College::class);
        $departmentRepository = $this->entityManager->getRepository(Department::class);

        $college = null;
        if ($collegeId > 0) {
            $college = $collegeRepository->find($collegeId);
            if (!$college || !$college->isActive() || $college->getDeletedAt() !== null) {
                $errors['college_id'] = 'Selected college is invalid.';
            }
        }

        $department = null;
        if ($departmentId > 0) {
            $department = $departmentRepository->find($departmentId);
            if (!$department || !$department->getIsActive() || $department->getDeletedAt() !== null) {
                $errors['department_id'] = 'Selected department is invalid.';
            }
        }

        if ($college && $department && $department->getCollege()?->getId() !== $college->getId()) {
            $errors['department_id'] = 'Selected department does not belong to the selected college.';
        }

        if (!empty($errors)) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'Validation failed.',
                    'details' => $errors,
                ],
            ], 422);
        }

        try {
            $user->setFirstName($firstName);
            $user->setMiddleName($middleName !== '' ? $middleName : null);
            $user->setLastName($lastName);
            $user->setCollege($college);
            $user->setDepartment($department);
            $user->setPosition($position);
            $user->setAddress($address !== '' ? $address : null);
            $user->setOtherDesignation($otherDesignation !== '' ? $otherDesignation : null);
            $user->setUpdatedAt(new \DateTime());

            $this->entityManager->flush();

            return $this->json([
                'success' => true,
                'message' => 'Profile completed successfully.',
            ]);
        } catch (\Exception $e) {
            return $this->json([
                'success' => false,
                'message' => 'Failed to complete profile.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    private function getMissingProfileFields(User $user): array
    {
        $missing = [];

        if (trim((string) $user->getFirstName()) === '') {
            $missing[] = 'first_name';
        }
        if (trim((string) $user->getLastName()) === '') {
            $missing[] = 'last_name';
        }
        if (!$user->getCollege()) {
            $missing[] = 'college_id';
        }
        if (!$user->getDepartment()) {
            $missing[] = 'department_id';
        }
        if (trim((string) $user->getPosition()) === '') {
            $missing[] = 'position';
        }

        return $missing;
    }

    private function isProfileComplete(User $user): bool
    {
        return count($this->getMissingProfileFields($user)) === 0;
    }

    // ──────────────────────────────────────────────
    //  SETTINGS (read-only)
    // ──────────────────────────────────────────────

    #[Route('/settings', name: 'settings', methods: ['GET'])]
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

    // ──────────────────────────────────────────────
    //  DASHBOARD
    // ──────────────────────────────────────────────

    #[Route('/dashboard', name: 'dashboard', methods: ['GET'])]
    public function dashboard(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $currentAcademicYear = $this->entityManager->getRepository(AcademicYear::class)
            ->findOneBy(['isCurrent' => true]);

        $activeSemester = $currentAcademicYear?->getCurrentSemester();

        // Today's day name
        $today = new \DateTime();
        $dayOfWeek = $today->format('l');

        // All active schedules for stats and today's list
        $todaySchedules = [];
        $allSchedules = [];
        if ($currentAcademicYear && $activeSemester) {
            $allSchedules = $this->entityManager->getRepository(Schedule::class)
                ->createQueryBuilder('s')
                ->leftJoin('s.subject', 'sub')->addSelect('sub')
                ->leftJoin('s.room', 'r')->addSelect('r')
                ->where('s.faculty = :faculty')
                ->andWhere('s.status = :status')
                ->andWhere('s.academicYear = :ay')
                ->andWhere('s.semester = :semester')
                ->setParameter('faculty', $user)
                ->setParameter('status', 'active')
                ->setParameter('ay', $currentAcademicYear)
                ->setParameter('semester', $activeSemester)
                ->orderBy('s.startTime', 'ASC')
                ->getQuery()
                ->getResult();

            $todaySchedules = array_values(array_filter(
                $allSchedules,
                static function (Schedule $schedule) use ($dayOfWeek): bool {
                    return in_array($dayOfWeek, $schedule->getDaysFromPattern(), true);
                }
            ));
        }

        // Calculate statistics
        $totalHours = 0;
        $uniqueClasses = [];
        $totalStudents = 0;
        foreach ($allSchedules as $schedule) {
            $start = $schedule->getStartTime();
            $end = $schedule->getEndTime();
            $diff = $start->diff($end);
            $hours = $diff->h + ($diff->i / 60);
            $daysPerWeek = count($schedule->getDaysFromPattern());
            $totalHours += $hours * $daysPerWeek;

            $classKey = $schedule->getSubject()->getId() . '_' . $schedule->getSection();
            if (!isset($uniqueClasses[$classKey])) {
                $uniqueClasses[$classKey] = true;
                $totalStudents += $schedule->getEnrolledStudents();
            }
        }

        return $this->json([
            'today'       => $dayOfWeek,
            'academic_year' => $currentAcademicYear ? [
                'id'       => $currentAcademicYear->getId(),
                'year'     => $currentAcademicYear->getYear(),
                'semester' => $activeSemester,
            ] : null,
            'today_schedules' => array_map([$this, 'serializeSchedule'], $todaySchedules),
            'stats' => [
                'total_hours'    => round($totalHours, 1),
                'active_classes' => count($uniqueClasses),
                'total_students' => $totalStudents,
                'today_count'    => count($todaySchedules),
            ],
        ]);
    }

    // ──────────────────────────────────────────────
    //  SCHEDULE
    // ──────────────────────────────────────────────

    #[Route('/schedule', name: 'schedule', methods: ['GET'])]
    public function schedule(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $currentAcademicYear = $this->entityManager->getRepository(AcademicYear::class)
            ->findOneBy(['isCurrent' => true]);

        $activeSemester = $this->systemSettingsService->getActiveSemester();
        $selectedSemester = $request->query->get('semester', $activeSemester);

        $schedules = $this->entityManager->getRepository(Schedule::class)
            ->createQueryBuilder('s')
            ->leftJoin('s.subject', 'sub')->addSelect('sub')
            ->leftJoin('s.room', 'r')->addSelect('r')
            ->leftJoin('s.academicYear', 'ay')->addSelect('ay')
            ->where('s.faculty = :faculty')
            ->andWhere('s.status = :status')
            ->andWhere('ay.isCurrent = :isCurrent')
            ->andWhere('s.semester = :semester')
            ->setParameter('faculty', $user)
            ->setParameter('status', 'active')
            ->setParameter('isCurrent', true)
            ->setParameter('semester', $selectedSemester)
            ->orderBy('s.startTime', 'ASC')
            ->getQuery()
            ->getResult();

        // Calculate stats
        $stats = $this->calculateScheduleStats($schedules);

        return $this->json([
            'academic_year' => $currentAcademicYear ? [
                'id'   => $currentAcademicYear->getId(),
                'year' => $currentAcademicYear->getYear(),
            ] : null,
            'semester'  => $selectedSemester,
            'schedules' => array_map([$this, 'serializeSchedule'], $schedules),
            'stats'     => $stats,
        ]);
    }

    #[Route('/schedule/weekly', name: 'schedule_weekly', methods: ['GET'])]
    public function scheduleWeekly(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $activeSemester = $this->systemSettingsService->getActiveSemester();
        $selectedSemester = $request->query->get('semester', $activeSemester);

        $schedules = $this->entityManager->getRepository(Schedule::class)
            ->createQueryBuilder('s')
            ->leftJoin('s.subject', 'sub')->addSelect('sub')
            ->leftJoin('s.room', 'r')->addSelect('r')
            ->where('s.faculty = :faculty')
            ->andWhere('s.status = :status')
            ->andWhere('s.semester = :semester')
            ->setParameter('faculty', $user)
            ->setParameter('status', 'active')
            ->setParameter('semester', $selectedSemester)
            ->orderBy('s.startTime', 'ASC')
            ->getQuery()
            ->getResult();

        $weekly = [
            'Monday'    => [],
            'Tuesday'   => [],
            'Wednesday' => [],
            'Thursday'  => [],
            'Friday'    => [],
            'Saturday'  => [],
            'Sunday'    => [],
        ];

        foreach ($schedules as $schedule) {
            foreach ($schedule->getDaysFromPattern() as $day) {
                if (isset($weekly[$day])) {
                    $weekly[$day][] = $this->serializeSchedule($schedule);
                }
            }
        }

        return $this->json([
            'semester' => $selectedSemester,
            'weekly'   => $weekly,
        ]);
    }

    #[Route('/rooms', name: 'rooms_list', methods: ['GET'])]
    public function listRooms(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $department = $user->getDepartment();
        if (!$department instanceof Department) {
            return $this->json([
                'success' => true,
                'data' => [],
                'meta' => [
                    'total' => 0,
                    'limit' => 0,
                ],
            ]);
        }

        $limit = max(1, min(500, (int) $request->query->get('limit', 200)));
        $search = strtolower(trim((string) $request->query->get('search', '')));

        $roomRepository = $this->entityManager->getRepository(Room::class);
        $rooms = $roomRepository->findAccessibleByDepartment($department);

        if ($search !== '') {
            $rooms = array_values(array_filter($rooms, static function (Room $room) use ($search): bool {
                $values = [
                    strtolower((string) ($room->getCode() ?? '')),
                    strtolower((string) ($room->getName() ?? '')),
                    strtolower((string) ($room->getBuilding() ?? '')),
                    strtolower((string) ($room->getFloor() ?? '')),
                ];

                foreach ($values as $value) {
                    if ($value !== '' && str_contains($value, $search)) {
                        return true;
                    }
                }

                return false;
            }));
        }

        $total = count($rooms);
        $rooms = array_slice($rooms, 0, $limit);

        return $this->json([
            'success' => true,
            'data' => array_map([$this, 'serializeRoomSummary'], $rooms),
            'meta' => [
                'total' => $total,
                'limit' => $limit,
            ],
        ]);
    }

    // ──────────────────────────────────────────────
    //  CLASSES
    // ──────────────────────────────────────────────

    #[Route('/classes', name: 'classes', methods: ['GET'])]
    public function classes(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $currentAcademicYear = $this->entityManager->getRepository(AcademicYear::class)
            ->findOneBy(['isCurrent' => true]);

        $activeSemester = $this->systemSettingsService->getActiveSemester();
        $selectedSemester = $request->query->get('semester', $activeSemester);

        $schedules = $this->entityManager->getRepository(Schedule::class)
            ->createQueryBuilder('s')
            ->leftJoin('s.subject', 'sub')->addSelect('sub')
            ->leftJoin('s.room', 'r')->addSelect('r')
            ->leftJoin('s.academicYear', 'ay')->addSelect('ay')
            ->where('s.faculty = :faculty')
            ->andWhere('s.status = :status')
            ->andWhere('ay.isCurrent = :isCurrent')
            ->andWhere('s.semester = :semester')
            ->setParameter('faculty', $user)
            ->setParameter('status', 'active')
            ->setParameter('isCurrent', true)
            ->setParameter('semester', $selectedSemester)
            ->orderBy('s.startTime', 'ASC')
            ->getQuery()
            ->getResult();

        $totalStudents = 0;
        $totalHours = 0;
        foreach ($schedules as $schedule) {
            $totalStudents += $schedule->getEnrolledStudents() ?? 0;
            if ($schedule->getStartTime() && $schedule->getEndTime()) {
                $hours = ($schedule->getEndTime()->getTimestamp() - $schedule->getStartTime()->getTimestamp()) / 3600;
                $totalHours += $hours * count($schedule->getDaysFromPattern());
            }
        }

        return $this->json([
            'academic_year' => $currentAcademicYear ? [
                'id'   => $currentAcademicYear->getId(),
                'year' => $currentAcademicYear->getYear(),
            ] : null,
            'semester'  => $selectedSemester,
            'classes'   => array_map([$this, 'serializeSchedule'], $schedules),
            'stats'     => [
                'total_classes'  => count($schedules),
                'total_students' => $totalStudents,
                'teaching_hours' => round($totalHours, 1),
            ],
        ]);
    }

    #[Route('/classes/{id}/enrolled-students', name: 'classes_update_enrolled_students', methods: ['PATCH'], requirements: ['id' => '\\d+'])]
    public function updateClassEnrolledStudents(int $id, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $schedule = $this->entityManager->getRepository(Schedule::class)
            ->createQueryBuilder('s')
            ->leftJoin('s.academicYear', 'ay')
            ->where('s.id = :id')
            ->andWhere('s.faculty = :faculty')
            ->andWhere('s.status = :status')
            ->andWhere('ay.isCurrent = :isCurrent')
            ->setParameter('id', $id)
            ->setParameter('faculty', $user)
            ->setParameter('status', 'active')
            ->setParameter('isCurrent', true)
            ->getQuery()
            ->getOneOrNullResult();

        if (!$schedule instanceof Schedule) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 404,
                    'message' => 'Class not found.',
                ],
            ], Response::HTTP_NOT_FOUND);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 400,
                    'message' => 'Invalid request payload.',
                ],
            ], Response::HTTP_BAD_REQUEST);
        }

        $rawEnrolledStudents = $data['enrolled_students'] ?? $data['enrolledStudents'] ?? null;
        $enrolledStudents = filter_var($rawEnrolledStudents, FILTER_VALIDATE_INT);

        if ($enrolledStudents === false || $enrolledStudents < 0) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'enrolled_students must be a non-negative whole number.',
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $previousEnrolledStudents = $schedule->getEnrolledStudents() ?? 0;

        $schedule->setEnrolledStudents($enrolledStudents);
        $this->entityManager->flush();

        $subjectCode = (string) ($schedule->getSubject()?->getCode() ?? 'Unknown Subject');
        $section = (string) ($schedule->getSection() ?? '-');
        $this->activityLogService->log(
            'schedule.students_updated',
            "Faculty updated enrolled students for {$subjectCode} (Section {$section})",
            'Schedule',
            $schedule->getId(),
            [
                'updated_by_role' => 'faculty',
                'previous_enrolled_students' => $previousEnrolledStudents,
                'new_enrolled_students' => $enrolledStudents,
                'subject_code' => $schedule->getSubject()?->getCode(),
                'section' => $schedule->getSection(),
            ],
            $user,
        );

        return $this->json([
            'success' => true,
            'message' => 'Class student count updated successfully.',
            'data' => $this->serializeSchedule($schedule),
        ]);
    }

    // ──────────────────────────────────────────────
    //  SCHEDULE CHANGE REQUESTS
    // ──────────────────────────────────────────────

    #[Route('/schedule-change-requests', name: 'schedule_change_requests_list', methods: ['GET'])]
    public function listScheduleChangeRequests(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $status = trim((string) $request->query->get('status', ''));
        $validStatuses = [
            ScheduleChangeRequest::STATUS_PENDING,
            ScheduleChangeRequest::STATUS_APPROVED,
            ScheduleChangeRequest::STATUS_REJECTED,
            ScheduleChangeRequest::STATUS_CANCELLED,
        ];

        if ($status !== '' && !in_array($status, $validStatuses, true)) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'Invalid status filter.',
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $limit = max(1, min(100, (int) $request->query->get('limit', 50)));

        $changeRequests = $this->entityManager
            ->getRepository(ScheduleChangeRequest::class)
            ->findByRequester($user, $status !== '' ? $status : null, $limit);

        return $this->json([
            'success' => true,
            'data' => array_map([$this, 'serializeScheduleChangeRequest'], $changeRequests),
        ]);
    }

    #[Route('/schedule-change-requests/{id}', name: 'schedule_change_requests_show', methods: ['GET'], requirements: ['id' => '\\d+'])]
    public function getScheduleChangeRequest(int $id): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $changeRequest = $this->entityManager
            ->getRepository(ScheduleChangeRequest::class)
            ->findOneBy([
                'id' => $id,
                'requester' => $user,
            ]);

        if (!$changeRequest instanceof ScheduleChangeRequest) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 404,
                    'message' => 'Schedule change request not found.',
                ],
            ], Response::HTTP_NOT_FOUND);
        }

        return $this->json([
            'success' => true,
            'data' => $this->serializeScheduleChangeRequest($changeRequest),
        ]);
    }

    #[Route('/schedule-change-requests/check-conflict', name: 'schedule_change_requests_check_conflict', methods: ['POST'])]
    public function checkScheduleChangeRequestConflict(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 400,
                    'message' => 'Invalid request payload.',
                ],
            ], Response::HTTP_BAD_REQUEST);
        }

        $scheduleId = filter_var($data['schedule_id'] ?? $data['scheduleId'] ?? null, FILTER_VALIDATE_INT);
        if ($scheduleId === false || $scheduleId <= 0) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'schedule_id is required and must be a valid integer.',
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $schedule = $this->entityManager->getRepository(Schedule::class)
            ->createQueryBuilder('s')
            ->leftJoin('s.subject', 'sub')->addSelect('sub')
            ->leftJoin('s.room', 'room')->addSelect('room')
            ->leftJoin('s.academicYear', 'ay')->addSelect('ay')
            ->where('s.id = :id')
            ->andWhere('s.faculty = :faculty')
            ->andWhere('s.status = :status')
            ->andWhere('ay.isCurrent = :isCurrent')
            ->setParameter('id', $scheduleId)
            ->setParameter('faculty', $user)
            ->setParameter('status', 'active')
            ->setParameter('isCurrent', true)
            ->getQuery()
            ->getOneOrNullResult();

        if (!$schedule instanceof Schedule) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 404,
                    'message' => 'Schedule not found.',
                ],
            ], Response::HTTP_NOT_FOUND);
        }

        $proposedDayPattern = trim((string) ($data['day_pattern'] ?? $data['dayPattern'] ?? $schedule->getDayPattern() ?? ''));
        $proposedStartRaw = trim((string) ($data['start_time'] ?? $data['startTime'] ?? $schedule->getStartTime()?->format('H:i') ?? ''));
        $proposedEndRaw = trim((string) ($data['end_time'] ?? $data['endTime'] ?? $schedule->getEndTime()?->format('H:i') ?? ''));

        $sectionInput = array_key_exists('section', $data) ? $data['section'] : $schedule->getSection();
        $proposedSection = trim((string) ($sectionInput ?? ''));
        $proposedSection = $proposedSection !== '' ? $proposedSection : null;

        $proposedStartTime = $this->parseTimeValue($proposedStartRaw);
        $proposedEndTime = $this->parseTimeValue($proposedEndRaw);

        $rawRoomId = $data['room_id'] ?? $data['roomId'] ?? $schedule->getRoom()?->getId();
        $proposedRoomId = filter_var($rawRoomId, FILTER_VALIDATE_INT);

        $errors = [];

        if ($proposedDayPattern === '') {
            $errors['day_pattern'] = 'day_pattern is required.';
        }

        if (!$proposedStartTime) {
            $errors['start_time'] = 'start_time must be a valid time in HH:MM format.';
        }

        if (!$proposedEndTime) {
            $errors['end_time'] = 'end_time must be a valid time in HH:MM format.';
        }

        if ($proposedStartTime && $proposedEndTime && $proposedStartTime >= $proposedEndTime) {
            $errors['time_range'] = 'end_time must be later than start_time.';
        }

        if ($proposedRoomId === false || $proposedRoomId <= 0) {
            $errors['room_id'] = 'room_id is required and must be a valid integer.';
        }

        $proposedRoom = null;
        if (!isset($errors['room_id'])) {
            $proposedRoom = $this->entityManager->getRepository(Room::class)->find((int) $proposedRoomId);
            if (!$proposedRoom instanceof Room || !$proposedRoom->isActive() || $proposedRoom->getDeletedAt() !== null) {
                $errors['room_id'] = 'Selected room is invalid or inactive.';
            }
        }

        if (!empty($errors)) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'Validation failed.',
                    'details' => $errors,
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $proposedSchedule = $this->buildProposedScheduleDraft(
            $schedule,
            $proposedRoom,
            $proposedDayPattern,
            $proposedStartTime,
            $proposedEndTime,
            $proposedSection,
        );

        $rawConflicts = $this->scheduleConflictDetector->detectConflicts($proposedSchedule, false);
        $conflicts = array_values(array_filter($rawConflicts, static function (array $conflict) use ($schedule): bool {
            if (!isset($conflict['schedule']) || !$conflict['schedule'] instanceof Schedule) {
                return true;
            }

            return $conflict['schedule']->getId() !== $schedule->getId();
        }));

        return $this->json([
            'success' => true,
            'data' => [
                'hasConflict' => !empty($conflicts),
                'conflicts' => array_map([$this, 'serializeConflictForResponse'], $conflicts),
            ],
        ]);
    }

    #[Route('/schedule-change-requests', name: 'schedule_change_requests_create', methods: ['POST'])]
    public function createScheduleChangeRequest(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 400,
                    'message' => 'Invalid request payload.',
                ],
            ], Response::HTTP_BAD_REQUEST);
        }

        $scheduleId = filter_var($data['schedule_id'] ?? $data['scheduleId'] ?? null, FILTER_VALIDATE_INT);
        if ($scheduleId === false || $scheduleId <= 0) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'schedule_id is required and must be a valid integer.',
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $schedule = $this->entityManager->getRepository(Schedule::class)
            ->createQueryBuilder('s')
            ->leftJoin('s.subject', 'sub')->addSelect('sub')
            ->leftJoin('sub.department', 'subDept')->addSelect('subDept')
            ->leftJoin('s.room', 'room')->addSelect('room')
            ->leftJoin('s.academicYear', 'ay')->addSelect('ay')
            ->where('s.id = :id')
            ->andWhere('s.faculty = :faculty')
            ->andWhere('s.status = :status')
            ->andWhere('ay.isCurrent = :isCurrent')
            ->setParameter('id', $scheduleId)
            ->setParameter('faculty', $user)
            ->setParameter('status', 'active')
            ->setParameter('isCurrent', true)
            ->getQuery()
            ->getOneOrNullResult();

        if (!$schedule instanceof Schedule) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 404,
                    'message' => 'Schedule not found.',
                ],
            ], Response::HTTP_NOT_FOUND);
        }

        $existingPendingRequest = $this->entityManager
            ->getRepository(ScheduleChangeRequest::class)
            ->findOneBy([
                'schedule' => $schedule,
                'requester' => $user,
                'status' => ScheduleChangeRequest::STATUS_PENDING,
            ]);

        if ($existingPendingRequest instanceof ScheduleChangeRequest) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 409,
                    'message' => 'You already have a pending change request for this schedule.',
                ],
            ], Response::HTTP_CONFLICT);
        }

        $proposedDayPattern = trim((string) ($data['day_pattern'] ?? $data['dayPattern'] ?? $schedule->getDayPattern() ?? ''));
        $proposedStartRaw = trim((string) ($data['start_time'] ?? $data['startTime'] ?? $schedule->getStartTime()?->format('H:i') ?? ''));
        $proposedEndRaw = trim((string) ($data['end_time'] ?? $data['endTime'] ?? $schedule->getEndTime()?->format('H:i') ?? ''));

        $sectionInput = array_key_exists('section', $data) ? $data['section'] : $schedule->getSection();
        $proposedSection = trim((string) ($sectionInput ?? ''));
        $proposedSection = $proposedSection !== '' ? $proposedSection : null;

        $reason = trim((string) ($data['reason'] ?? $data['request_reason'] ?? $data['requestReason'] ?? ''));
        $reason = $reason !== '' ? $reason : null;

        $proposedStartTime = $this->parseTimeValue($proposedStartRaw);
        $proposedEndTime = $this->parseTimeValue($proposedEndRaw);

        $rawRoomId = $data['room_id'] ?? $data['roomId'] ?? $schedule->getRoom()?->getId();
        $proposedRoomId = filter_var($rawRoomId, FILTER_VALIDATE_INT);

        $errors = [];

        if ($proposedDayPattern === '') {
            $errors['day_pattern'] = 'day_pattern is required.';
        }

        if (!$proposedStartTime) {
            $errors['start_time'] = 'start_time must be a valid time in HH:MM format.';
        }

        if (!$proposedEndTime) {
            $errors['end_time'] = 'end_time must be a valid time in HH:MM format.';
        }

        if ($proposedStartTime && $proposedEndTime && $proposedStartTime >= $proposedEndTime) {
            $errors['time_range'] = 'end_time must be later than start_time.';
        }

        if ($proposedRoomId === false || $proposedRoomId <= 0) {
            $errors['room_id'] = 'room_id is required and must be a valid integer.';
        }

        $proposedRoom = null;
        if (!isset($errors['room_id'])) {
            $proposedRoom = $this->entityManager->getRepository(Room::class)->find((int) $proposedRoomId);
            if (!$proposedRoom instanceof Room || !$proposedRoom->isActive() || $proposedRoom->getDeletedAt() !== null) {
                $errors['room_id'] = 'Selected room is invalid or inactive.';
            }
        }

        if ($reason !== null && strlen($reason) > 2000) {
            $errors['reason'] = 'reason cannot exceed 2000 characters.';
        }

        if (!empty($errors)) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'Validation failed.',
                    'details' => $errors,
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $currentSection = trim((string) ($schedule->getSection() ?? ''));
        $currentSection = $currentSection !== '' ? $currentSection : null;

        $hasChange =
            trim((string) ($schedule->getDayPattern() ?? '')) !== $proposedDayPattern
            || $schedule->getStartTime()?->format('H:i:s') !== $proposedStartTime?->format('H:i:s')
            || $schedule->getEndTime()?->format('H:i:s') !== $proposedEndTime?->format('H:i:s')
            || (int) ($schedule->getRoom()?->getId() ?? 0) !== (int) ($proposedRoom?->getId() ?? 0)
            || $currentSection !== $proposedSection;

        if (!$hasChange) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'No schedule changes were detected to submit.',
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $proposedSchedule = $this->buildProposedScheduleDraft(
            $schedule,
            $proposedRoom,
            $proposedDayPattern,
            $proposedStartTime,
            $proposedEndTime,
            $proposedSection,
        );

        $rawConflicts = $this->scheduleConflictDetector->detectConflicts($proposedSchedule, false);
        $conflicts = array_values(array_filter($rawConflicts, static function (array $conflict) use ($schedule): bool {
            if (!isset($conflict['schedule']) || !$conflict['schedule'] instanceof Schedule) {
                return true;
            }

            return $conflict['schedule']->getId() !== $schedule->getId();
        }));

        if (!empty($conflicts)) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'Schedule change request cannot be submitted because conflicts were detected.',
                    'details' => [
                        'conflicts' => array_map([$this, 'serializeConflictForResponse'], $conflicts),
                    ],
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $subjectDepartment = $schedule->getSubject()?->getDepartment();
        $departmentHeadApprover = $subjectDepartment?->getHead();
        if (
            $departmentHeadApprover instanceof User
            && ((int) $departmentHeadApprover->getRole() !== 2 || !$departmentHeadApprover->isActive() || $departmentHeadApprover->getDeletedAt() !== null)
        ) {
            $departmentHeadApprover = null;
        }
        $departmentHeadNotificationRecipients = $this->resolveDepartmentHeadNotificationRecipients(
            $subjectDepartment,
            $departmentHeadApprover,
        );

        $adminApprovers = $this->entityManager->getRepository(User::class)
            ->createQueryBuilder('u')
            ->where('u.role = :role')
            ->andWhere('u.isActive = :active')
            ->andWhere('u.deletedAt IS NULL')
            ->setParameter('role', 1)
            ->setParameter('active', true)
            ->orderBy('u.id', 'ASC')
            ->getQuery()
            ->getResult();

        $adminApprover = !empty($adminApprovers) ? $adminApprovers[0] : null;

        $requestedChanges = [
            'from' => [
                'day_pattern' => $schedule->getDayPattern(),
                'start_time' => $schedule->getStartTime()?->format('H:i'),
                'end_time' => $schedule->getEndTime()?->format('H:i'),
                'section' => $currentSection,
                'room' => $this->serializeRoomSummary($schedule->getRoom()),
            ],
            'to' => [
                'day_pattern' => $proposedDayPattern,
                'start_time' => $proposedStartTime?->format('H:i'),
                'end_time' => $proposedEndTime?->format('H:i'),
                'section' => $proposedSection,
                'room' => $this->serializeRoomSummary($proposedRoom),
            ],
        ];

        $changeRequest = new ScheduleChangeRequest();
        $changeRequest
            ->setSchedule($schedule)
            ->setRequester($user)
            ->setSubjectDepartment($subjectDepartment)
            ->setAdminApprover($adminApprover)
            ->setDepartmentHeadApprover($departmentHeadApprover)
            ->setProposedRoom($proposedRoom)
            ->setProposedDayPattern($proposedDayPattern)
            ->setProposedStartTime($proposedStartTime)
            ->setProposedEndTime($proposedEndTime)
            ->setProposedSection($proposedSection)
            ->setRequestReason($reason)
            ->setRequestedChanges($requestedChanges)
            ->setStatus(ScheduleChangeRequest::STATUS_PENDING)
            ->setAdminStatus(ScheduleChangeRequest::APPROVAL_PENDING)
            ->setDepartmentHeadStatus(ScheduleChangeRequest::APPROVAL_PENDING);

        $this->entityManager->persist($changeRequest);
        $this->entityManager->flush();

        $subjectCode = (string) ($schedule->getSubject()?->getCode() ?? 'Unknown Subject');
        $sectionLabel = (string) ($schedule->getSection() ?? '-');
        $facultyName = (string) $user->getFullName();

        $this->activityLogService->log(
            'schedule_change.request_submitted',
            "Faculty submitted schedule change request for {$subjectCode} (Section {$sectionLabel})",
            'ScheduleChangeRequest',
            $changeRequest->getId(),
            [
                'schedule_id' => $schedule->getId(),
                'subject_code' => $schedule->getSubject()?->getCode(),
                'section' => $schedule->getSection(),
                'requested_changes' => $requestedChanges,
                'subject_department_id' => $subjectDepartment?->getId(),
                'department_head_approver_id' => $departmentHeadApprover?->getId(),
            ],
            $user,
        );

        $notificationTitle = 'Schedule Change Request Submitted';
        $notificationMessage = sprintf(
            '%s requested a schedule change for %s (Section %s).',
            $facultyName,
            $subjectCode,
            $sectionLabel,
        );
        $notificationMetadata = [
            'schedule_change_request_id' => $changeRequest->getId(),
            'schedule_id' => $schedule->getId(),
            'requester_id' => $user->getId(),
        ];

        if (!empty($adminApprovers)) {
            $this->notificationService->createForMultipleUsers(
                $adminApprovers,
                Notification::TYPE_SYSTEM,
                $notificationTitle,
                $notificationMessage,
                $notificationMetadata,
            );
        }

        if (!empty($departmentHeadNotificationRecipients)) {
            $adminApproverIds = array_map(static fn(User $admin): int => (int) $admin->getId(), $adminApprovers);

            $departmentHeadNotificationRecipients = array_values(array_filter(
                $departmentHeadNotificationRecipients,
                static fn(User $recipient): bool => !in_array((int) $recipient->getId(), $adminApproverIds, true),
            ));

            if (!empty($departmentHeadNotificationRecipients)) {
                $this->notificationService->createForMultipleUsers(
                    $departmentHeadNotificationRecipients,
                    Notification::TYPE_SYSTEM,
                    $notificationTitle,
                    $notificationMessage,
                    $notificationMetadata,
                );
            }
        }

        return $this->json([
            'success' => true,
            'message' => 'Schedule change request submitted successfully.',
            'data' => $this->serializeScheduleChangeRequest($changeRequest),
        ], Response::HTTP_CREATED);
    }

    #[Route('/schedule-change-requests/{id}/cancel', name: 'schedule_change_requests_cancel', methods: ['POST'], requirements: ['id' => '\\d+'])]
    public function cancelScheduleChangeRequest(int $id): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $changeRequest = $this->entityManager
            ->getRepository(ScheduleChangeRequest::class)
            ->findOneBy([
                'id' => $id,
                'requester' => $user,
            ]);

        if (!$changeRequest instanceof ScheduleChangeRequest) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 404,
                    'message' => 'Schedule change request not found.',
                ],
            ], Response::HTTP_NOT_FOUND);
        }

        if (!$changeRequest->canBeCancelled()) {
            return $this->json([
                'success' => false,
                'error' => [
                    'code' => 422,
                    'message' => 'Only pending requests can be cancelled.',
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $changeRequest
            ->setStatus(ScheduleChangeRequest::STATUS_CANCELLED)
            ->setCancelledAt(new \DateTime());

        $this->entityManager->flush();

        $subjectCode = (string) ($changeRequest->getSchedule()?->getSubject()?->getCode() ?? 'Unknown Subject');
        $sectionLabel = (string) ($changeRequest->getSchedule()?->getSection() ?? '-');

        $this->activityLogService->log(
            'schedule_change.request_cancelled',
            "Faculty cancelled schedule change request for {$subjectCode} (Section {$sectionLabel})",
            'ScheduleChangeRequest',
            $changeRequest->getId(),
            [
                'schedule_id' => $changeRequest->getSchedule()?->getId(),
                'subject_code' => $changeRequest->getSchedule()?->getSubject()?->getCode(),
                'section' => $changeRequest->getSchedule()?->getSection(),
            ],
            $user,
        );

        return $this->json([
            'success' => true,
            'message' => 'Schedule change request cancelled successfully.',
            'data' => $this->serializeScheduleChangeRequest($changeRequest),
        ]);
    }

    // ──────────────────────────────────────────────
    //  PDF EXPORTS
    // ──────────────────────────────────────────────

    #[Route('/schedule/export-pdf', name: 'schedule_export_pdf', methods: ['GET'])]
    public function exportSchedulePdf(Request $request): Response
    {
        /** @var User $user */
        $user = $this->getUser();

        $currentAcademicYear = $this->entityManager->getRepository(AcademicYear::class)
            ->findOneBy(['isCurrent' => true]);

        $activeSemester = $this->systemSettingsService->getActiveSemester();
        $selectedSemester = $request->query->get('semester', $activeSemester);

        $schedules = $this->entityManager->getRepository(Schedule::class)
            ->createQueryBuilder('s')
            ->leftJoin('s.subject', 'sub')->addSelect('sub')
            ->leftJoin('s.room', 'r')->addSelect('r')
            ->leftJoin('s.academicYear', 'ay')->addSelect('ay')
            ->where('s.faculty = :faculty')
            ->andWhere('s.status = :status')
            ->andWhere('ay.isCurrent = :isCurrent')
            ->andWhere('s.semester = :semester')
            ->setParameter('faculty', $user)
            ->setParameter('status', 'active')
            ->setParameter('isCurrent', true)
            ->setParameter('semester', $selectedSemester)
            ->orderBy('s.startTime', 'ASC')
            ->getQuery()
            ->getResult();

        $weeklySchedule = $this->buildWeeklySchedule($schedules);
        $stats = $this->calculateScheduleStats($schedules);
        $pdf = $this->generateSchedulePdf($user, $schedules, $weeklySchedule, $stats, $currentAcademicYear, $selectedSemester);

        return new Response(
            $pdf->Output('teaching-schedule.pdf', 'S'),
            200,
            [
                'Content-Type'        => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="teaching-schedule.pdf"',
            ]
        );
    }

    #[Route('/schedule/teaching-load-pdf', name: 'teaching_load_pdf', methods: ['GET'])]
    public function exportTeachingLoadPdf(Request $request): Response
    {
        /** @var User $user */
        $user = $this->getUser();

        $currentAcademicYear = $this->entityManager->getRepository(AcademicYear::class)
            ->findOneBy(['isCurrent' => true]);

        if (!$currentAcademicYear) {
            return $this->json([
                'success' => false,
                'message' => 'No active academic year found.',
            ], Response::HTTP_NOT_FOUND);
        }

        $activeSemester = $this->systemSettingsService->getActiveSemester();
        $selectedSemester = $request->query->get('semester', $activeSemester);

        $pdfContent = $this->teachingLoadPdfService->generateTeachingLoadPdf(
            $user,
            $currentAcademicYear,
            $selectedSemester
        );

        $facultyName = str_replace(' ', '_', $user->getFirstName() . '_' . $user->getLastName());
        $filename = 'Teaching_Load_' . $facultyName . '_' . $currentAcademicYear->getYear() . '_Sem' . $selectedSemester . '.pdf';

        return new Response(
            $pdfContent,
            200,
            [
                'Content-Type'        => 'application/pdf',
                'Content-Disposition' => 'inline; filename="' . $filename . '"',
                'Cache-Control'       => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma'              => 'no-cache',
                'Expires'             => '0',
            ]
        );
    }

    // ──────────────────────────────────────────────
    //  NOTIFICATIONS
    // ──────────────────────────────────────────────

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

    // ══════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ══════════════════════════════════════════════

    private function serializeSchedule(Schedule $schedule): array
    {
        return [
            'id'                => $schedule->getId(),
            'subject' => [
                'id'    => $schedule->getSubject()?->getId(),
                'code'  => $schedule->getSubject()?->getCode(),
                'title' => $schedule->getSubject()?->getTitle(),
                'units' => $schedule->getSubject()?->getUnits(),
                'type'  => $schedule->getSubject()?->getType(),
            ],
            'room' => [
                'id'       => $schedule->getRoom()?->getId(),
                'name'     => $schedule->getRoom()?->getName(),
                'code'     => $schedule->getRoom()?->getCode(),
                'building' => $schedule->getRoom()?->getBuilding(),
                'floor'    => $schedule->getRoom()?->getFloor(),
                'capacity' => $schedule->getRoom()?->getCapacity(),
            ],
            'day_pattern'       => $schedule->getDayPattern(),
            'day_pattern_label' => $schedule->getDayPatternLabel(),
            'days'              => $schedule->getDaysFromPattern(),
            'start_time'        => $schedule->getStartTime()?->format('H:i'),
            'end_time'          => $schedule->getEndTime()?->format('H:i'),
            'start_time_12h'    => $schedule->getStartTime()?->format('g:i A'),
            'end_time_12h'      => $schedule->getEndTime()?->format('g:i A'),
            'section'           => $schedule->getSection(),
            'enrolled_students' => $schedule->getEnrolledStudents(),
            'updated_at'        => $schedule->getUpdatedAt()?->format(DATE_ATOM),
            'semester'          => $schedule->getSemester(),
            'academic_year' => $schedule->getAcademicYear() ? [
                'id'   => $schedule->getAcademicYear()->getId(),
                'year' => $schedule->getAcademicYear()->getYear(),
            ] : null,
            'status' => $schedule->getStatus(),
        ];
    }

    private function serializeScheduleChangeRequest(ScheduleChangeRequest $changeRequest): array
    {
        return [
            'id' => $changeRequest->getId(),
            'status' => $changeRequest->getStatus(),
            'admin_status' => $changeRequest->getAdminStatus(),
            'department_head_status' => $changeRequest->getDepartmentHeadStatus(),
            'request_reason' => $changeRequest->getRequestReason(),
            'submitted_at' => $changeRequest->getSubmittedAt()?->format(DATE_ATOM),
            'cancelled_at' => $changeRequest->getCancelledAt()?->format(DATE_ATOM),
            'created_at' => $changeRequest->getCreatedAt()?->format(DATE_ATOM),
            'updated_at' => $changeRequest->getUpdatedAt()?->format(DATE_ATOM),
            'schedule' => $changeRequest->getSchedule() ? $this->serializeSchedule($changeRequest->getSchedule()) : null,
            'subject_department' => $changeRequest->getSubjectDepartment() ? [
                'id' => $changeRequest->getSubjectDepartment()?->getId(),
                'code' => $changeRequest->getSubjectDepartment()?->getCode(),
                'name' => $changeRequest->getSubjectDepartment()?->getName(),
            ] : null,
            'approvers' => [
                'admin' => $this->serializeUserSummary($changeRequest->getAdminApprover()),
                'department_head' => $this->serializeUserSummary($changeRequest->getDepartmentHeadApprover()),
            ],
            'proposal' => [
                'day_pattern' => $changeRequest->getProposedDayPattern(),
                'start_time' => $changeRequest->getProposedStartTime()?->format('H:i'),
                'end_time' => $changeRequest->getProposedEndTime()?->format('H:i'),
                'section' => $changeRequest->getProposedSection(),
                'room' => $this->serializeRoomSummary($changeRequest->getProposedRoom()),
            ],
            'requested_changes' => $changeRequest->getRequestedChanges(),
            'conflict_snapshot' => $changeRequest->getConflictSnapshot(),
            'can_cancel' => $changeRequest->canBeCancelled(),
        ];
    }

    private function serializeUserSummary(?User $user): ?array
    {
        if (!$user instanceof User) {
            return null;
        }

        return [
            'id' => $user->getId(),
            'full_name' => $user->getFullName(),
            'email' => $user->getEmail(),
            'role' => $user->getRoleDisplayName(),
        ];
    }

    private function serializeRoomSummary(?Room $room): ?array
    {
        if (!$room instanceof Room) {
            return null;
        }

        return [
            'id' => $room->getId(),
            'name' => $room->getName(),
            'code' => $room->getCode(),
            'building' => $room->getBuilding(),
            'floor' => $room->getFloor(),
        ];
    }

    private function parseTimeValue(?string $value): ?\DateTimeInterface
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        foreach (['H:i', 'H:i:s'] as $format) {
            $time = \DateTime::createFromFormat($format, $value);
            $errors = \DateTime::getLastErrors();

            if ($time instanceof \DateTime && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
                return $time;
            }
        }

        return null;
    }

    private function buildProposedScheduleDraft(
        Schedule $source,
        Room $proposedRoom,
        string $proposedDayPattern,
        \DateTimeInterface $proposedStartTime,
        \DateTimeInterface $proposedEndTime,
        ?string $proposedSection,
    ): Schedule {
        $draft = new Schedule();
        $draft->setAcademicYear($source->getAcademicYear());
        $draft->setSemester($source->getSemester());
        $draft->setSubject($source->getSubject());
        $draft->setFaculty($source->getFaculty());
        $draft->setRoom($proposedRoom);
        $draft->setDayPattern($proposedDayPattern);
        $draft->setStartTime(new \DateTime($proposedStartTime->format('H:i:s')));
        $draft->setEndTime(new \DateTime($proposedEndTime->format('H:i:s')));
        $draft->setSection($proposedSection);
        $draft->setEnrolledStudents($source->getEnrolledStudents());
        $draft->setStatus('active');

        return $draft;
    }

    /**
     * @return User[]
     */
    private function resolveDepartmentHeadNotificationRecipients(?Department $subjectDepartment, ?User $assignedApprover): array
    {
        if ($assignedApprover instanceof User) {
            return [$assignedApprover];
        }

        if (!$subjectDepartment instanceof Department) {
            return [];
        }

        $departmentIds = [(int) $subjectDepartment->getId()];
        $departmentGroup = $subjectDepartment->getDepartmentGroup();
        if ($departmentGroup !== null) {
            foreach ($departmentGroup->getDepartments() as $groupDepartment) {
                $departmentId = (int) $groupDepartment->getId();
                if ($departmentId > 0) {
                    $departmentIds[] = $departmentId;
                }
            }
        }

        $departmentIds = array_values(array_unique($departmentIds));
        if (empty($departmentIds)) {
            return [];
        }

        $departmentHeads = $this->entityManager
            ->getRepository(User::class)
            ->createQueryBuilder('u')
            ->where('u.role = :role')
            ->andWhere('u.isActive = :active')
            ->andWhere('u.deletedAt IS NULL')
            ->andWhere('u.department IN (:departmentIds)')
            ->setParameter('role', 2)
            ->setParameter('active', true)
            ->setParameter('departmentIds', $departmentIds)
            ->orderBy('u.id', 'ASC')
            ->getQuery()
            ->getResult();

        return array_values(array_filter($departmentHeads, static fn($user): bool => $user instanceof User));
    }

    private function serializeConflictForResponse(array $conflict): array
    {
        $entry = [
            'type' => $conflict['type'] ?? 'conflict',
            'message' => $conflict['message'] ?? 'Conflict detected.',
        ];

        if (isset($conflict['schedule']) && $conflict['schedule'] instanceof Schedule) {
            $entry['schedule'] = $this->serializeSchedule($conflict['schedule']);
        }

        return $entry;
    }

    private function buildWeeklySchedule(array $schedules): array
    {
        $weekly = [
            'Monday' => [], 'Tuesday' => [], 'Wednesday' => [],
            'Thursday' => [], 'Friday' => [], 'Saturday' => [], 'Sunday' => [],
        ];
        foreach ($schedules as $schedule) {
            foreach ($schedule->getDaysFromPattern() as $day) {
                if (isset($weekly[$day])) {
                    $weekly[$day][] = $schedule;
                }
            }
        }
        return $weekly;
    }

    private function calculateScheduleStats(array $schedules): array
    {
        $totalHours = 0;
        $totalStudents = 0;
        $uniqueRooms = [];
        $uniqueSubjects = [];

        foreach ($schedules as $schedule) {
            $start = $schedule->getStartTime();
            $end = $schedule->getEndTime();
            if ($start && $end) {
                $diff = $start->diff($end);
                $hours = $diff->h + ($diff->i / 60);
                $totalHours += $hours * count($schedule->getDaysFromPattern());
            }
            $totalStudents += $schedule->getEnrolledStudents() ?? 0;
            if ($schedule->getRoom()) {
                $uniqueRooms[$schedule->getRoom()->getId()] = true;
            }
            if ($schedule->getSubject()) {
                $uniqueSubjects[$schedule->getSubject()->getId()] = true;
            }
        }

        return [
            'total_hours'    => round($totalHours, 1),
            'total_classes'  => count($schedules),
            'total_students' => $totalStudents,
            'total_rooms'    => count($uniqueRooms),
        ];
    }

    private function generateSchedulePdf(User $user, array $schedules, array $weeklySchedule, array $stats, ?AcademicYear $academicYear, string $semester): TCPDF
    {
        $pdf = new TCPDF('L', 'mm', 'A4', true, 'UTF-8', false);
        $pdf->SetCreator('Smart Scheduling System');
        $pdf->SetAuthor($user->getFirstName() . ' ' . $user->getLastName());
        $pdf->SetTitle('Teaching Schedule');
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->SetMargins(15, 15, 15);
        $pdf->SetAutoPageBreak(true, 15);
        $pdf->AddPage();

        $pdf->SetFont('helvetica', 'B', 16);
        $pdf->Cell(0, 10, 'Teaching Schedule', 0, 1, 'C');

        $pdf->SetFont('helvetica', '', 10);
        $facultyName = $user->getFirstName() . ' ' . $user->getLastName();
        $ayText = $academicYear ? $academicYear->getYear() : '';
        $pdf->Cell(0, 5, $facultyName . ' - ' . $ayText . ' (' . $semester . ' Semester)', 0, 1, 'C');
        $pdf->Ln(5);

        // Stats row
        $pdf->SetFont('helvetica', 'B', 10);
        $boxWidth = 60;
        $statsData = [
            ['Total Hours', $stats['total_hours']],
            ['Classes', $stats['total_classes']],
            ['Students', $stats['total_students']],
            ['Rooms', $stats['total_rooms']],
        ];
        $x = 15;
        foreach ($statsData as $stat) {
            $pdf->SetXY($x, $pdf->GetY());
            $pdf->SetFillColor(240, 240, 240);
            $pdf->Cell($boxWidth, 15, '', 1, 0, 'C', true);
            $pdf->SetXY($x, $pdf->GetY());
            $pdf->Cell($boxWidth, 7, $stat[0], 0, 2, 'C');
            $pdf->SetFont('helvetica', 'B', 14);
            $pdf->Cell($boxWidth, 8, (string)$stat[1], 0, 0, 'C');
            $pdf->SetFont('helvetica', 'B', 10);
            $x += $boxWidth + 5;
        }
        $pdf->Ln(20);

        // Table
        $pdf->SetFont('helvetica', 'B', 12);
        $pdf->Cell(0, 7, 'Class List', 0, 1, 'L');
        $pdf->Ln(2);

        $pdf->SetFont('helvetica', 'B', 9);
        $pdf->SetFillColor(220, 220, 220);
        $pdf->Cell(30, 7, 'Code', 1, 0, 'L', true);
        $pdf->Cell(65, 7, 'Subject', 1, 0, 'L', true);
        $pdf->Cell(45, 7, 'Schedule', 1, 0, 'L', true);
        $pdf->Cell(40, 7, 'Room', 1, 0, 'L', true);
        $pdf->Cell(25, 7, 'Students', 1, 0, 'C', true);
        $pdf->Cell(25, 7, 'Section', 1, 1, 'C', true);

        $pdf->SetFont('helvetica', '', 8);
        foreach ($schedules as $schedule) {
            $pdf->Cell(30, 12, $schedule->getSubject()->getCode(), 1, 0, 'L');
            $pdf->MultiCell(65, 12, $schedule->getSubject()->getTitle(), 1, 'L', false, 0);
            $pdf->MultiCell(45, 6, $schedule->getDayPatternLabel() . "\n" . $schedule->getStartTime()->format('g:i A') . '-' . $schedule->getEndTime()->format('g:i A'), 1, 'L', false, 0);
            $pdf->Cell(40, 12, $schedule->getRoom()->getName(), 1, 0, 'L');
            $pdf->Cell(25, 12, (string)($schedule->getEnrolledStudents() ?? 0), 1, 0, 'C');
            $pdf->Cell(25, 12, $schedule->getSection() ?? '-', 1, 1, 'C');
        }

        return $pdf;
    }
}
