<?php

namespace App\Controller;

use App\Entity\User;
use App\Form\ProfileType;
use App\Repository\CollegeRepository;
use App\Repository\DepartmentRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[Route('/profile')]
#[IsGranted('ROLE_USER')]
class ProfileController extends AbstractController
{
    #[Route('', name: 'app_profile', methods: ['GET'])]
    public function index(): Response
    {
        $user = $this->getUser();
        
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException('You must be logged in to view this page.');
        }

        return $this->render('profile/index.html.twig', [
            'user' => $user,
        ]);
    }

    #[Route('/edit', name: 'app_profile_edit', methods: ['GET', 'POST'])]
    public function edit(
        Request $request,
        EntityManagerInterface $entityManager,
        CollegeRepository $collegeRepository,
        DepartmentRepository $departmentRepository
    ): Response {
        $user = $this->getUser();
        
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException('You must be logged in to edit your profile.');
        }

        $form = $this->createForm(ProfileType::class, $user);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            try {
                $user->setUpdatedAt(new \DateTime());
                $entityManager->flush();

                $this->addFlash('success', 'Your profile has been updated successfully.');
                
                return $this->redirectToRoute('app_profile');
            } catch (\Exception $e) {
                $this->addFlash('error', 'An error occurred while updating your profile: ' . $e->getMessage());
            }
        }

        return $this->render('profile/edit.html.twig', [
            'user' => $user,
            'form' => $form,
            'colleges' => $collegeRepository->findAll(),
            'departments' => $departmentRepository->findAll(),
        ], new Response('', $form->isSubmitted() ? Response::HTTP_UNPROCESSABLE_ENTITY : Response::HTTP_OK));
    }

    #[Route('/edit-ajax', name: 'app_profile_edit_ajax', methods: ['POST'])]
    public function editAjax(
        Request $request,
        EntityManagerInterface $entityManager
    ): Response {
        $user = $this->getUser();
        
        if (!$user instanceof User) {
            return $this->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $data = json_decode($request->getContent(), true);

        try {
            if (isset($data['firstName'])) {
                $user->setFirstName($data['firstName']);
            }
            if (isset($data['middleName'])) {
                $user->setMiddleName($data['middleName']);
            }
            if (isset($data['lastName'])) {
                $user->setLastName($data['lastName']);
            }
            if (isset($data['email']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                $user->setEmail($data['email']);
            }
            if (isset($data['position'])) {
                $user->setPosition($data['position']);
            }
            if (isset($data['address'])) {
                $user->setAddress($data['address']);
            }

            $user->setUpdatedAt(new \DateTime());
            $entityManager->flush();

            return $this->json([
                'success' => true,
                'message' => 'Profile updated successfully!'
            ]);
        } catch (\Exception $e) {
            return $this->json([
                'success' => false,
                'message' => 'Error updating profile: ' . $e->getMessage()
            ], 500);
        }
    }

    #[Route('/change-password', name: 'app_profile_change_password', methods: ['GET', 'POST'])]
    public function changePassword(
        Request $request,
        UserPasswordHasherInterface $passwordHasher,
        EntityManagerInterface $entityManager
    ): Response {
        $user = $this->getUser();
        
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException('You must be logged in to change your password.');
        }

        if ($request->isMethod('POST')) {
            $currentPassword = $request->request->get('current_password');
            $newPassword = $request->request->get('new_password');
            $confirmPassword = $request->request->get('confirm_password');

            // Validate current password
            if (!$passwordHasher->isPasswordValid($user, $currentPassword)) {
                $this->addFlash('error', 'Current password is incorrect.');
                return $this->redirectToRoute('app_profile_change_password');
            }

            // Validate new password
            if (strlen($newPassword) < 6) {
                $this->addFlash('error', 'New password must be at least 6 characters long.');
                return $this->redirectToRoute('app_profile_change_password');
            }

            // Validate password confirmation
            if ($newPassword !== $confirmPassword) {
                $this->addFlash('error', 'New password and confirmation do not match.');
                return $this->redirectToRoute('app_profile_change_password');
            }

            try {
                $hashedPassword = $passwordHasher->hashPassword($user, $newPassword);
                $user->setPassword($hashedPassword);
                $user->setUpdatedAt(new \DateTime());
                
                $entityManager->flush();

                $this->addFlash('success', 'Your password has been changed successfully.');
                return $this->redirectToRoute('app_profile');
            } catch (\Exception $e) {
                $this->addFlash('error', 'An error occurred while changing your password: ' . $e->getMessage());
            }
        }

        return $this->render('profile/change_password.html.twig', [
            'user' => $user,
        ]);
    }

    #[Route('/change-password-ajax', name: 'app_profile_change_password_ajax', methods: ['POST'])]
    public function changePasswordAjax(
        Request $request,
        UserPasswordHasherInterface $passwordHasher,
        EntityManagerInterface $entityManager
    ): Response {
        $user = $this->getUser();
        
        if (!$user instanceof User) {
            return $this->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $data = json_decode($request->getContent(), true);

        try {
            // Validate current password
            if (!isset($data['currentPassword']) || !$passwordHasher->isPasswordValid($user, $data['currentPassword'])) {
                return $this->json([
                    'success' => false,
                    'message' => 'Current password is incorrect.'
                ]);
            }

            // Validate new password
            if (!isset($data['newPassword']) || strlen($data['newPassword']) < 6) {
                return $this->json([
                    'success' => false,
                    'message' => 'New password must be at least 6 characters long.'
                ]);
            }

            // Validate confirmation
            if (!isset($data['confirmPassword']) || $data['newPassword'] !== $data['confirmPassword']) {
                return $this->json([
                    'success' => false,
                    'message' => 'New password and confirmation do not match.'
                ]);
            }

            $hashedPassword = $passwordHasher->hashPassword($user, $data['newPassword']);
            $user->setPassword($hashedPassword);
            $user->setUpdatedAt(new \DateTime());
            
            $entityManager->flush();

            return $this->json([
                'success' => true,
                'message' => 'Password changed successfully!'
            ]);
        } catch (\Exception $e) {
            return $this->json([
                'success' => false,
                'message' => 'Error changing password: ' . $e->getMessage()
            ], 500);
        }
    }
}
