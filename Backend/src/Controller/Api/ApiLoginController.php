<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class ApiLoginController extends AbstractController
{
    #[Route('/api/login', name: 'api_login', methods: ['POST'])]
    public function login(): JsonResponse
    {
        // This method is never actually reached — the json_login
        // authenticator intercepts the request before it gets here.
        // If we DO get here, something is misconfigured.
        return $this->json([
            'message' => 'Missing credentials.',
        ], 401);
    }
}
