<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAuthenticationException;
use Symfony\Component\Security\Core\Exception\DisabledException;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;

class ApiAuthenticationFailureHandler implements AuthenticationFailureHandlerInterface
{
    public function __construct()
    {
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): JsonResponse
    {
        $statusCode = 401;
        $message = 'Invalid credentials.';

        if ($exception instanceof TooManyLoginAttemptsAuthenticationException) {
            $statusCode = 429;
            $message = 'Too many failed login attempts. Please try again later.';
        } elseif ($exception instanceof DisabledException || $exception instanceof CustomUserMessageAuthenticationException) {
            $message = $exception->getMessageKey();
        }

        return new JsonResponse([
            'code' => $statusCode,
            'message' => $message,
        ], $statusCode);
    }
}
