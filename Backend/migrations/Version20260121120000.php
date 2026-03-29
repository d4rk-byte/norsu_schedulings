<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260121120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add other_designation column to users table';
    }

    public function up(Schema $schema): void
    {
        // Add other_designation column to users table
        $this->addSql('ALTER TABLE users ADD other_designation LONGTEXT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // Remove other_designation column from users table
        $this->addSql('ALTER TABLE users DROP other_designation');
    }
}
