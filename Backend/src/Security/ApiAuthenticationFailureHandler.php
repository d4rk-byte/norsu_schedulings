<?php

namespace App\Security;

use App\Repository\UserRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAuthenticationException;
use Symfony\Component\Security\Core\Exception\DisabledException;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;

class ApiAuthenticationFailureHandler implements AuthenticationFailureHandlerInterface
{
    public function __construct(
        private UserRepository $userRepository,
    ) {
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): JsonResponse
    {
        $identifier = trim((string) $request->request->get('email', ''));
        if ($identifier === '') {
            $payload = json_decode((string) $request->getContent(), true);
            if (is_array($payload)) {
                $identifier = trim((string) ($payload['email'] ?? ''));
            }
        }

        if ($identifier !== '') {
            $user = $this->userRepository->findByEmailOrUsername($identifier);
            if ($user !== null && !$user->isActive()) {
                return new JsonResponse([
                    'code' => 401,
                    'message' => 'Your account is inactive or pending administrator approval. Please contact the administrator.',
                ], 401);
            }
        }

        $message = 'Invalid credentials.';

        if ($exception instanceof DisabledException || $exception instanceof CustomUserMessageAuthenticationException) {
            $message = $exception->getMessageKey();
        }

        return new JsonResponse([
            'code' => 401,
            'message' => $message,
        ], 401);
    }
}
