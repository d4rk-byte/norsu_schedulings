<?php

namespace App\Service;

use App\Entity\College;
use App\Entity\Department;
use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Psr\Log\LoggerInterface;
use InvalidArgumentException;

class UserService
{
    private EntityManagerInterface $entityManager;
    private UserRepository $userRepository;
    private UserPasswordHasherInterface $passwordHasher;
    private LoggerInterface $logger;

    public function __construct(
        EntityManagerInterface $entityManager,
        UserRepository $userRepository,
        UserPasswordHasherInterface $passwordHasher,
        LoggerInterface $logger
    ) {
        $this->entityManager = $entityManager;
        $this->userRepository = $userRepository;
        $this->passwordHasher = $passwordHasher;
        $this->logger = $logger;
    }

    /**
     * Create a new user
     */
    public function createUser(array $userData, string $plainPassword, bool $enforceOrganizationRules = true): User
    {
        $user = new User();
        $this->populateUserData($user, $userData);
        if ($enforceOrganizationRules) {
            $this->validateCollegeDepartmentRules($user);
        }
        
        // Hash password
        $hashedPassword = $this->passwordHasher->hashPassword($user, $plainPassword);
        $user->setPassword($hashedPassword);
        
        $user->setCreatedAt(new \DateTime());
        $user->setUpdatedAt(new \DateTime());

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        $this->logger->info('User created', [
            'user_id' => $user->getId(),
            'username' => $user->getUsername(),
            'email' => $user->getEmail()
        ]);

        return $user;
    }

    /**
     * Update an existing user
     */
    public function updateUser(User $user, array $userData, ?string $newPassword = null): User
    {
        $this->populateUserData($user, $userData);
        $this->validateCollegeDepartmentRules($user);
        
        // Update password if provided
        if ($newPassword) {
            $hashedPassword = $this->passwordHasher->hashPassword($user, $newPassword);
            $user->setPassword($hashedPassword);
        }
        
        $user->setUpdatedAt(new \DateTime());

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        $this->logger->info('User updated', [
            'user_id' => $user->getId(),
            'username' => $user->getUsername(),
            'email' => $user->getEmail()
        ]);

        return $user;
    }

    /**
     * Soft delete a user
     */
    public function deleteUser(User $user): void
    {
        $this->userRepository->softDelete($user);

        $this->logger->info('User soft deleted', [
            'user_id' => $user->getId(),
            'username' => $user->getUsername(),
            'email' => $user->getEmail()
        ]);
    }

    /**
     * Permanently delete a user (hard delete)
     */
    public function permanentlyDeleteUser(User $user): void
    {
        $this->userRepository->hardDelete($user);

        $this->logger->info('User permanently deleted', [
            'user_id' => $user->getId(),
            'username' => $user->getUsername(),
            'email' => $user->getEmail()
        ]);
    }

    /**
     * Restore a soft deleted user
     */
    public function restoreUser(User $user): void
    {
        $this->userRepository->restore($user);

        $this->logger->info('User restored', [
            'user_id' => $user->getId(),
            'username' => $user->getUsername(),
            'email' => $user->getEmail()
        ]);
    }

    /**
     * Activate a user
     */
    public function activateUser(User $user): void
    {
        $user->setIsActive(true);
        $user->setUpdatedAt(new \DateTime());

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        $this->logger->info('User activated', [
            'user_id' => $user->getId(),
            'username' => $user->getUsername()
        ]);
    }

    /**
     * Deactivate a user
     */
    public function deactivateUser(User $user): void
    {
        $user->setIsActive(false);
        $user->setUpdatedAt(new \DateTime());

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        $this->logger->info('User deactivated', [
            'user_id' => $user->getId(),
            'username' => $user->getUsername()
        ]);
    }

    /**
     * Change user password
     */
    public function changePassword(User $user, string $newPassword): void
    {
        $hashedPassword = $this->passwordHasher->hashPassword($user, $newPassword);
        $user->setPassword($hashedPassword);
        $user->setUpdatedAt(new \DateTime());

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        $this->logger->info('User password changed', [
            'user_id' => $user->getId(),
            'username' => $user->getUsername()
        ]);
    }

    /**
     * Change user role
     */
    public function changeUserRole(User $user, int $newRole): void
    {
        $oldRole = $user->getRole();
        $user->setRole($newRole);
        $user->setUpdatedAt(new \DateTime());

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        $this->logger->info('User role changed', [
            'user_id' => $user->getId(),
            'username' => $user->getUsername(),
            'old_role' => $oldRole,
            'new_role' => $newRole
        ]);
    }

    /**
     * Get users with pagination and filters
     */
    public function getUsersWithFilters(array $filters = []): array
    {
        $page = $filters['page'] ?? 1;
        $limit = $filters['limit'] ?? 20;
        $search = $filters['search'] ?? null;
        $role = $filters['role'] ?? null;
        $isActive = $filters['is_active'] ?? null;
        $collegeId = $filters['college_id'] ?? null;
        $departmentIds = $filters['department_ids'] ?? null;
        $includeDeleted = (bool) ($filters['include_deleted'] ?? false);
        $sortField = $filters['sort_field'] ?? 'createdAt';
        $sortDirection = $filters['sort_direction'] ?? 'DESC';

        return $this->userRepository->findUsersWithFilters(
            $page,
            $limit,
            $search,
            $role,
            $isActive,
            $collegeId,
            $departmentIds,
            $includeDeleted,
            $sortField,
            $sortDirection
        );
    }

    /**
     * Find user by ID or throw exception
     */
    public function getUserById(int $id): User
    {
        $user = $this->userRepository->find($id);
        if (!$user) {
            throw new UserNotFoundException("User with ID {$id} not found");
        }
        return $user;
    }

    /**
     * Check if username is available
     */
    public function isUsernameAvailable(string $username, ?int $excludeUserId = null): bool
    {
        $qb = $this->userRepository->createQueryBuilder('u')
            ->where('LOWER(u.username) = LOWER(:username)')
            ->setParameter('username', $username);

        if ($excludeUserId) {
            $qb->andWhere('u.id != :excludeId')
               ->setParameter('excludeId', $excludeUserId);
        }

        return $qb->getQuery()->getOneOrNullResult() === null;
    }

    /**
     * Check if email is available
     */
    public function isEmailAvailable(string $email, ?int $excludeUserId = null): bool
    {
        $qb = $this->userRepository->createQueryBuilder('u')
            ->where('LOWER(u.email) = LOWER(:email)')
            ->setParameter('email', $email);

        if ($excludeUserId) {
            $qb->andWhere('u.id != :excludeId')
               ->setParameter('excludeId', $excludeUserId);
        }

        return $qb->getQuery()->getOneOrNullResult() === null;
    }

    /**
     * Check if employee ID is available
     */
    public function isEmployeeIdAvailable(string $employeeId, ?int $excludeUserId = null): bool
    {
        $qb = $this->userRepository->createQueryBuilder('u')
            ->where('u.employeeId = :employeeId')
            ->setParameter('employeeId', $employeeId);

        if ($excludeUserId) {
            $qb->andWhere('u.id != :excludeId')
               ->setParameter('excludeId', $excludeUserId);
        }

        return $qb->getQuery()->getOneOrNullResult() === null;
    }

    /**
     * Validate username safety and format.
     */
    public function validateUsernameSafety(string $username): ?string
    {
        $value = trim($username);

        if ($value === '') {
            return 'Username is required.';
        }

        $length = strlen($value);
        if ($length < 3 || $length > 30) {
            return 'Username must be between 3 and 30 characters.';
        }

        if (!preg_match('/^[A-Za-z0-9._-]+$/', $value)) {
            return 'Username can only contain letters, numbers, dots, underscores, and hyphens.';
        }

        return null;
    }

    /**
     * Validate employee ID safety and format.
     */
    public function validateEmployeeIdSafety(?string $employeeId): ?string
    {
        $value = trim((string) $employeeId);

        if ($value === '') {
            return null;
        }

        if (strlen($value) > 20) {
            return 'Employee ID must be 20 characters or fewer.';
        }

        if (!preg_match('/^[A-Za-z0-9-]+$/', $value)) {
            return 'Employee ID can only contain letters, numbers, and hyphens.';
        }

        return null;
    }

    /**
     * Get user statistics
     */
    public function getUserStatistics(): array
    {
        return $this->userRepository->getUserStatistics();
    }

    /**
     * Get college name by ID
     */
    public function getCollegeName(int $collegeId): string
    {
        $colleges = [
            1 => 'College of Computer Studies',
            2 => 'College of Engineering',
            3 => 'College of Business Administration',
            4 => 'College of Arts and Sciences',
            5 => 'Administrative Services',
        ];

        return $colleges[$collegeId] ?? 'Unknown College';
    }

    /**
     * Get department name by ID
     */
    public function getDepartmentName(int $departmentId): string
    {
        $departments = [
            1 => 'Computer Science Department',
            2 => 'Information Technology Department',
            3 => 'Engineering Department',
            4 => 'Mathematics Department',
            5 => 'Business Administration Department',
            6 => 'Human Resources Department',
            7 => 'Finance Department',
            8 => 'Marketing Department',
            9 => 'Operations Department',
            10 => 'Academic Affairs',
            11 => 'Student Services',
            12 => 'Library Services',
        ];

        return $departments[$departmentId] ?? 'Unknown Department';
    }

    /**
     * Get all colleges
     */
    public function getAllColleges(): array
    {
        return [
            1 => 'College of Computer Studies',
            2 => 'College of Engineering',
            3 => 'College of Business Administration',
            4 => 'College of Arts and Sciences',
            5 => 'Administrative Services',
        ];
    }

    /**
     * Bulk activate users
     */
    public function bulkActivateUsers(array $userIds): int
    {
        $count = 0;
        foreach ($userIds as $userId) {
            try {
                $user = $this->getUserById($userId);
                $this->activateUser($user);
                $count++;
            } catch (UserNotFoundException $e) {
                $this->logger->warning('User not found during bulk activation', ['user_id' => $userId]);
            }
        }

        $this->logger->info('Bulk user activation completed', ['activated_count' => $count]);
        return $count;
    }

    /**
     * Bulk deactivate users
     */
    public function bulkDeactivateUsers(array $userIds): int
    {
        $count = 0;
        foreach ($userIds as $userId) {
            try {
                $user = $this->getUserById($userId);
                $this->deactivateUser($user);
                $count++;
            } catch (UserNotFoundException $e) {
                $this->logger->warning('User not found during bulk deactivation', ['user_id' => $userId]);
            }
        }

        $this->logger->info('Bulk user deactivation completed', ['deactivated_count' => $count]);
        return $count;
    }

    /**
     * Bulk delete users
     */
    public function bulkDeleteUsers(array $userIds): int
    {
        $count = 0;
        foreach ($userIds as $userId) {
            try {
                $user = $this->getUserById($userId);
                $this->deleteUser($user);
                $count++;
            } catch (UserNotFoundException $e) {
                $this->logger->warning('User not found during bulk deletion', ['user_id' => $userId]);
            }
        }

        $this->logger->info('Bulk user deletion completed', ['deleted_count' => $count]);
        return $count;
    }

    /**
     * Update user's last login timestamp
     */
    public function updateLastLogin(User $user): void
    {
        $this->userRepository->updateLastLogin($user);
    }

    /**
     * Get recently active users
     */
    public function getRecentlyActiveUsers(int $days = 30): array
    {
        return $this->userRepository->findRecentlyActive($days);
    }

    /**
     * Generate a random password
     */
    public function generateRandomPassword(int $length = 12): string
    {
        $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        $password = '';
        
        for ($i = 0; $i < $length; $i++) {
            $password .= $characters[random_int(0, strlen($characters) - 1)];
        }
        
        return $password;
    }

    /**
     * Populate user data from array
     */
    private function populateUserData(User $user, array $data): void
    {
        if (isset($data['username'])) {
            $username = trim((string) $data['username']);
            $usernameError = $this->validateUsernameSafety($username);
            if ($usernameError) {
                throw new InvalidArgumentException($usernameError);
            }

            $user->setUsername($username);
        }

        if (isset($data['firstName'])) {
            $user->setFirstName($data['firstName']);
        }

        if (array_key_exists('middleName', $data)) {
            $user->setMiddleName($data['middleName']);
        }

        if (isset($data['lastName'])) {
            $user->setLastName($data['lastName']);
        }

        if (isset($data['email'])) {
            $user->setEmail($data['email']);
        }

        if (isset($data['employeeId'])) {
            $employeeId = trim((string) $data['employeeId']);

            $employeeIdError = $this->validateEmployeeIdSafety($employeeId);
            if ($employeeIdError) {
                throw new InvalidArgumentException($employeeIdError);
            }

            // Auto-pad numeric employee IDs with leading zeros to reach minimum 6 characters
            if ($employeeId !== '' && is_numeric($employeeId)) {
                $employeeId = str_pad($employeeId, 6, '0', STR_PAD_LEFT);
            }

            $user->setEmployeeId($employeeId === '' ? null : $employeeId);
        }

        if (isset($data['position'])) {
            $user->setPosition($data['position']);
        }

        if (isset($data['role'])) {
            $user->setRole($data['role']);
        }

        if (array_key_exists('collegeId', $data)) {
            $college = $data['collegeId'] ? $this->entityManager->getRepository(College::class)->find($data['collegeId']) : null;
            $user->setCollege($college);
        }

        if (array_key_exists('departmentId', $data)) {
            $department = $data['departmentId'] ? $this->entityManager->getRepository(Department::class)->find($data['departmentId']) : null;
            $user->setDepartment($department);
        }

        if (isset($data['isActive'])) {
            $user->setIsActive($data['isActive']);
        }

        if (array_key_exists('address', $data)) {
            $user->setAddress($data['address']);
        }

        if (array_key_exists('otherDesignation', $data)) {
            $user->setOtherDesignation($data['otherDesignation']);
        }
    }

    /**
     * Enforce organization mapping: non-admin users must belong to both a college and a department.
     */
    private function validateCollegeDepartmentRules(User $user): void
    {
        if ((int) $user->getRole() === 1) {
            return;
        }

        if (!$user->getCollege()) {
            throw new InvalidArgumentException('College is required for non-admin users.');
        }

        if (!$user->getDepartment()) {
            throw new InvalidArgumentException('Department is required for non-admin users.');
        }

        $departmentCollege = $user->getDepartment()->getCollege();
        if (!$departmentCollege || $departmentCollege->getId() !== $user->getCollege()->getId()) {
            throw new InvalidArgumentException('Selected department does not belong to the selected college.');
        }
    }
}