<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Drop prerequisite column from subjects table (not needed for scheduling system)
 */
final class Version20260225140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Drop prerequisite column from subjects table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE subjects DROP COLUMN prerequisite');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE subjects ADD COLUMN prerequisite VARCHAR(255) DEFAULT NULL');
    }
}
