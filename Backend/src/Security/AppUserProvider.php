<?php

namespace App\Security;

use App\Repository\UserRepository;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

class AppUserProvider implements UserProviderInterface
{
    public function __construct(private UserRepository $userRepository)
    {
    }

    /**
     * Symfony calls this method if you use features like switch_user
     * or remember_me. If you're not using these features, you do not
     * need to implement this method.
     *
     * @throws UserNotFoundException if the user is not found
     */
    public function loadUserByIdentifier(string $identifier): UserInterface
    {
        // Load user by email or username
        $user = $this->userRepository->findByEmailOrUsername($identifier);

        if (!$user) {
            throw new UserNotFoundException(sprintf('User "%s" not found.', $identifier));
        }

        return $user;
    }

    /**
     * Refreshes the user after being reloaded from the session.
     *
     * When a user is logged in, at the beginning of each request, the
     * User object is loaded from the session and then this method is
     * called to give you a chance to refresh the data (e.g. refresh the roles).
     *
     * If you don't need to do anything, just return $user.
     *
     * @throws UnsupportedUserException if the user class is not supported
     */
    public function refreshUser(UserInterface $user): UserInterface
    {
        if (!$user instanceof \App\Entity\User) {
            throw new UnsupportedUserException(sprintf('Invalid user class "%s".', get_class($user)));
        }

        // Return a fresh instance of the user from the database
        return $this->loadUserByIdentifier($user->getUserIdentifier());
    }

    /**
     * Tells Symfony to use this provider for this User class.
     */
    public function supportsClass(string $class): bool
    {
        return \App\Entity\User::class === $class || is_subclass_of($class, \App\Entity\User::class);
    }
}