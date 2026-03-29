<?php

namespace App\Controller;

use App\Entity\User;
use App\Form\LoginFormType;
use App\Form\RegistrationFormType;
use App\Repository\CollegeRepository;
use App\Repository\DepartmentRepository;
use App\Repository\UserRepository;
use App\Service\ActivityLogService;
use App\Service\UserService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;

class SecurityController extends AbstractController
{
    #[Route('/api/logout', name: 'api_logout', methods: ['POST'])]
    public function apiLogout(ActivityLogService $activityLogService): JsonResponse
    {
        $user = $this->getUser();

        if (!$user instanceof User) {
            return new JsonResponse([
                'success' => false,
                'error' => ['code' => 401, 'message' => 'Authentication required.'],
            ], 401);
        }

        $activityLogService->logUserActivity('user.logout', $user, [
            'source' => 'api',
            'logout_time' => (new \DateTime())->format('Y-m-d H:i:s'),
            'role' => $user->getRoleDisplayName(),
        ]);

        return new JsonResponse([
            'success' => true,
            'data' => ['message' => 'Logout activity recorded.'],
        ]);
    }

    #[Route(path: '/login', name: 'app_login')]
    public function login(AuthenticationUtils $authenticationUtils, Request $request): Response
    {
        // Start session if not already started
        if (!$request->getSession()->isStarted()) {
            $request->getSession()->start();
        }

        // if ($this->getUser()) {
        //     return $this->redirectToRoute('target_path');
        // }

        // get the login error if there is one
        $error = $authenticationUtils->getLastAuthenticationError();
        
        // Check if this is a CSRF token error specifically
        if ($error && strpos($error->getMessage(), 'CSRF') !== false) {
            $this->addFlash('error', 'CSRF token error detected. Please try again.');
        }
        
        // last username entered by the user
        $lastUsername = $authenticationUtils->getLastUsername();

        $loginForm = $this->createForm(LoginFormType::class, [
            'email' => $lastUsername,
        ]);

        return $this->render('security/login.html.twig', [
            'loginForm' => $loginForm->createView(),
            'last_username' => $lastUsername,
            'error' => $error,
        ]);
    }

    #[Route(path: '/logout', name: 'app_logout')]
    public function logout(): void
    {
        throw new \LogicException('This method can be blank - it will be intercepted by the logout key on your firewall.');
    }

     #[Route('/register', name: 'app_register')]
    public function register(Request $request, UserPasswordHasherInterface $userPasswordHasher, EntityManagerInterface $entityManager, CollegeRepository $collegeRepository, DepartmentRepository $departmentRepository, UserRepository $userRepository, ActivityLogService $activityLogService): Response
    {
        $user = new User();
        
        // Set default role to faculty (role = 3)
        $user->setRole(3);
        
        $form = $this->createForm(RegistrationFormType::class, $user);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            // Check if username already exists
            $existingUsername = $userRepository->findOneBy(['username' => $user->getUsername()]);
            if ($existingUsername) {
                $this->addFlash('error', 'Username is already taken. Please choose a different username.');
                // Re-render the form with error
                goto render_form;
            }

            // Check if email already exists
            $existingEmail = $userRepository->findOneBy(['email' => $user->getEmail()]);
            if ($existingEmail) {
                $this->addFlash('error', 'Email address is already registered. Please use a different email or login if you already have an account.');
                // Re-render the form with error
                goto render_form;
            }

            // Check if employee ID already exists
            $existingEmployeeId = $userRepository->findOneBy(['employeeId' => $user->getEmployeeId()]);
            if ($existingEmployeeId) {
                $this->addFlash('error', 'Employee ID is already registered. Please contact the administrator if you believe this is an error.');
                // Re-render the form with error
                goto render_form;
            }

            // encode the plain password
            $user->setPassword(
                $userPasswordHasher->hashPassword(
                    $user,
                    $form->get('plainPassword')->getData()
                )
            );

            // Set updated timestamp
            $user->setUpdatedAt(new \DateTime());

            $entityManager->persist($user);
            $entityManager->flush();

            // Log the registration activity
            $activityLogService->logUserActivity('user.created', $user, [
                'source' => 'self-registration',
                'role' => 'Faculty'
            ]);

            // Add flash message
            $this->addFlash('success', 'Your account has been created successfully! You can now login.');

            return $this->redirectToRoute('app_login');
        }

        render_form:
        // Get all active colleges for the form
        $colleges = $collegeRepository->findBy(['isActive' => true]);
        
        // Get all active departments grouped by college for JavaScript
        $departments = $departmentRepository->findBy(['isActive' => true]);
        $departmentsByCollege = [];
        foreach ($departments as $department) {
            // Skip departments without a college assigned
            if ($department->getCollege() === null) {
                continue;
            }
            $collegeId = $department->getCollege()->getId();
            if (!isset($departmentsByCollege[$collegeId])) {
                $departmentsByCollege[$collegeId] = [];
            }
            $departmentsByCollege[$collegeId][] = [
                'id' => $department->getId(),
                'name' => $department->getName()
            ];
        }
        
        // Sort departments within each college by name
        foreach ($departmentsByCollege as &$depts) {
            usort($depts, function($a, $b) {
                return strcmp($a['name'], $b['name']);
            });
        }

        return $this->render('security/register.html.twig', [
            'registrationForm' => $form->createView(),
            'departments_by_college' => $departmentsByCollege,
        ], new Response('', $form->isSubmitted() ? Response::HTTP_UNPROCESSABLE_ENTITY : Response::HTTP_OK));
    }

    #[Route('/register/check-availability', name: 'app_register_check_availability', methods: ['POST'])]
    public function checkRegistrationAvailability(Request $request, UserService $userService): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $field = $data['field'] ?? null;
        $value = $data['value'] ?? null;

        if (!$field || !$value) {
            return new JsonResponse(['available' => false, 'message' => 'Missing field or value.']);
        }

        $available = false;
        $label = '';
        switch ($field) {
            case 'username':
                $available = $userService->isUsernameAvailable($value);
                $label = 'Username';
                break;
            case 'email':
                $available = $userService->isEmailAvailable($value);
                $label = 'Email';
                break;
            case 'employee_id':
                $available = $userService->isEmployeeIdAvailable($value);
                $label = 'Employee ID';
                break;
            default:
                return new JsonResponse(['available' => false, 'message' => 'Invalid field.']);
        }

        return new JsonResponse([
            'available' => $available,
            'message' => $available ? 'Available' : $label . ' is already taken.'
        ]);
    }
}