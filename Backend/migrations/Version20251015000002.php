<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251015000002 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add college_id column to users table';
    }

    public function up(Schema $schema): void
    {
        // Add college_id column to users table
        $this->addSql('ALTER TABLE users ADD COLUMN college_id INT NULL AFTER role');
    }

    public function down(Schema $schema): void
    {
        // Remove college_id column from users table
        $this->addSql('ALTER TABLE users DROP COLUMN college_id');
    }
}