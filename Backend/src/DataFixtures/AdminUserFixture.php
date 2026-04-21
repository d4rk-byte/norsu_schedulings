<?php

namespace App\DataFixtures;

use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class AdminUserFixture extends Fixture
{
    public function __construct(
        private UserPasswordHasherInterface $passwordHasher
    ) {}

    public function load(ObjectManager $manager): void
    {
        $email    = $_ENV['ADMIN_EMAIL']    ?? null;
        $password = $_ENV['ADMIN_PASSWORD'] ?? null;
        $username = $_ENV['ADMIN_USERNAME'] ?? 'admin';

        if (!$email || !$password) {
            echo "⚠️  Skipping admin fixture: ADMIN_EMAIL and ADMIN_PASSWORD env vars are required.\n";
            return;
        }

        // Check if admin already exists
        $existingAdmin = $manager->getRepository(User::class)->findOneBy(['email' => $email]);

        if ($existingAdmin) {
            return;
        }

        $admin = new User();
        $admin->setUsername($username);
        $admin->setEmail($email);
        $admin->setFirstName('System');
        $admin->setLastName('Administrator');
        $admin->setRole(1); // 1 = Administrator
        $admin->setIsActive(true);

        $hashedPassword = $this->passwordHasher->hashPassword($admin, $password);
        $admin->setPassword($hashedPassword);

        $manager->persist($admin);
        $manager->flush();

        echo "✅ Admin user created: {$email}\n";
    }
}
