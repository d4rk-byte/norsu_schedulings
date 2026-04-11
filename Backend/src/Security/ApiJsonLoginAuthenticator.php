<?php

namespace App\Security;

use Lexik\Bundle\JWTAuthenticationBundle\Security\Http\Authentication\AuthenticationSuccessHandler;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\Authenticator\InteractiveAuthenticatorInterface;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\RememberMeBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Credentials\PasswordCredentials;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\HttpUtils;

class ApiJsonLoginAuthenticator implements InteractiveAuthenticatorInterface
{
    public function __construct(
        private readonly HttpUtils $httpUtils,
        private readonly AppUserProvider $userProvider,
        private readonly AuthenticationSuccessHandler $successHandler,
        private readonly ApiAuthenticationFailureHandler $failureHandler,
    ) {
    }

    public function supports(Request $request): ?bool
    {
        if (!$request->isMethod('POST')) {
            return false;
        }

        return $this->httpUtils->checkRequestPath($request, 'api_login');
    }

    public function authenticate(Request $request): Passport
    {
        $payload = $this->extractPayload($request);

        $identifier = trim((string) ($payload['email'] ?? $payload['username'] ?? $payload['identifier'] ?? ''));
        if ($identifier === '') {
            throw new BadRequestHttpException('The request must include "email", "username", or "identifier".');
        }

        $password = (string) ($payload['password'] ?? '');
        if ($password === '') {
            throw new BadRequestHttpException('The key "password" must be a non-empty string.');
        }

        return new Passport(
            new UserBadge($identifier, $this->userProvider->loadUserByIdentifier(...)),
            new PasswordCredentials($password),
            [new RememberMeBadge($payload)],
        );
    }

    public function createToken(Passport $passport, string $firewallName): TokenInterface
    {
        return new UsernamePasswordToken($passport->getUser(), $firewallName, $passport->getUser()->getRoles());
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        return $this->successHandler->onAuthenticationSuccess($request, $token);
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        return $this->failureHandler->onAuthenticationFailure($request, $exception);
    }

    public function isInteractive(): bool
    {
        return true;
    }

    private function extractPayload(Request $request): array
    {
        $content = trim((string) $request->getContent());
        if ($content !== '') {
            try {
                $data = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException $e) {
                throw new BadRequestHttpException('Invalid JSON.', $e);
            }

            if (!is_array($data)) {
                throw new BadRequestHttpException('Invalid JSON.');
            }

            return $data;
        }

        $data = $request->request->all();

        return is_array($data) ? $data : [];
    }
}