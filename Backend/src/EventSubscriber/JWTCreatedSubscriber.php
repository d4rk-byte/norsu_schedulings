<?php

namespace App\EventSubscriber;

use App\Entity\User;
use Lexik\Bundle\JWTAuthenticationBundle\Event\JWTCreatedEvent;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Adds custom claims (role integer, username) to the JWT payload
 * so the Next.js frontend can decode them without an API call.
 */
class JWTCreatedSubscriber implements EventSubscriberInterface
{
    public static function getSubscribedEvents(): array
    {
        return [
            'lexik_jwt_authentication.on_jwt_created' => 'onJWTCreated',
        ];
    }

    public function onJWTCreated(JWTCreatedEvent $event): void
    {
        $user = $event->getUser();

        if (!$user instanceof User) {
            return;
        }

        $payload = $event->getData();
        $payload['role'] = $user->getRole();       // integer: 1, 2, or 3
        $payload['username'] = $user->getUsername();
        $payload['user_id'] = $user->getId();

        $event->setData($payload);
    }
}
