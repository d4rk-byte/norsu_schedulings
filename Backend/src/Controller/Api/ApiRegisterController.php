<?php

namespace App\Controller\Api;

use App\Service\ActivityLogService;
use App\Service\SystemSettingsService;
use App\Service\UserService;
use InvalidArgumentException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class ApiRegisterController extends AbstractController
{
    public function __construct(
        private UserService $userService,
        private ActivityLogService $activityLogService,
        private SystemSettingsService $systemSettingsService,
    ) {
    }

    #[Route('/api/register/check-availability', name: 'api_register_check_availability', methods: ['POST'])]
    public function checkAvailability(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $field = (string) ($data['field'] ?? '');
        $value = trim((string) ($data['value'] ?? ''));

        if ($field === '' || $value === '') {
            return $this->json(['available' => false, 'message' => 'Missing field or value.'], 400);
        }

        if ($field === 'username') {
            $formatError = $this->userService->validateUsernameSafety($value);
            if ($formatError) {
                return $this->json(['available' => false, 'message' => $formatError]);
            }

            $available = $this->userService->isUsernameAvailable($value);
            return $this->json([
                'available' => $available,
                'message' => $available ? 'Username is available.' : 'Username is already taken.',
            ]);
        }

        if ($field === 'employeeId') {
            $formatError = $this->userService->validateEmployeeIdSafety($value);
            if ($formatError) {
                return $this->json(['available' => false, 'message' => $formatError]);
            }

            $available = $this->userService->isEmployeeIdAvailable($value);
            return $this->json([
                'available' => $available,
                'message' => $available ? 'Employee ID is available.' : 'Employee ID is already in use.',
            ]);
        }

        return $this->json(['available' => false, 'message' => 'Invalid field.'], 422);
    }

    #[Route('/api/register', name: 'api_register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!$data) {
            return $this->json(['message' => 'Invalid JSON body.'], 400);
        }

        // Validate required fields
        $required = ['username', 'employeeId', 'email', 'password'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                return $this->json(['message' => "The field '$field' is required."], 422);
            }
        }

        $username = trim((string) $data['username']);
        $employeeId = trim((string) $data['employeeId']);
        $email = trim((string) $data['email']);
        $password = (string) $data['password'];

        $usernameSafetyError = $this->userService->validateUsernameSafety($username);
        if ($usernameSafetyError) {
            return $this->json(['message' => $usernameSafetyError], 422);
        }

        $employeeIdSafetyError = $this->userService->validateEmployeeIdSafety($employeeId);
        if ($employeeIdSafetyError) {
            return $this->json(['message' => $employeeIdSafetyError], 422);
        }

        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->json(['message' => 'Invalid email address.'], 422);
        }

        // Validate password length
        if (strlen($password) < 8) {
            return $this->json(['message' => 'Password must be at least 8 characters.'], 422);
        }

        if (!$this->userService->isUsernameAvailable($username)) {
            return $this->json(['message' => 'Username is already taken.'], 409);
        }

        if (!$this->userService->isEmployeeIdAvailable($employeeId)) {
            return $this->json(['message' => 'Employee ID is already in use.'], 409);
        }

        if (!$this->userService->isEmailAvailable($email)) {
            return $this->json(['message' => 'Email address is already registered.'], 409);
        }

        $autoActivateNewUsers = $this->systemSettingsService->isAutoActivateNewUsersEnabled();

        $userData = [
            'username'    => $username,
            'firstName'   => null,
            'lastName'    => null,
            'middleName'  => null,
            'email'       => $email,
            'role'        => 3, // Faculty (default for self-registration)
            'employeeId'  => $employeeId,
            'collegeId'   => null,
            'departmentId' => null,
            'position'    => null,
            'address'     => null,
            'otherDesignation' => null,
            'isActive'    => $autoActivateNewUsers,
        ];

        try {
            $user = $this->userService->createUser($userData, $password, false);

            $this->activityLogService->logUserActivity('user.created', $user, [
                'source' => 'self-registration',
                'role' => 'Faculty',
                'auto_activated' => $autoActivateNewUsers,
            ]);

            return $this->json([
                'message' => $autoActivateNewUsers
                    ? 'Registration successful. Your account is active and you can now log in.'
                    : 'Registration successful. Your account is pending admin approval.',
                'user' => [
                    'id'        => $user->getId(),
                    'email'     => $user->getEmail(),
                    'firstName' => $user->getFirstName(),
                    'lastName'  => $user->getLastName(),
                ],
            ], 201);
        } catch (InvalidArgumentException $e) {
            return $this->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            return $this->json(['message' => 'Registration failed. Please try again.'], 500);
        }
    }
}
