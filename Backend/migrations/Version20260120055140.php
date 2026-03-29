<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260120055140 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add is_overload column to schedules table';
    }

    public function up(Schema $schema): void
    {
        // Add is_overload column to schedules table
        $this->addSql('ALTER TABLE schedules ADD is_overload TINYINT(1) DEFAULT 0 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // Remove is_overload column from schedules table
        $this->addSql('ALTER TABLE schedules DROP is_overload');
    }
}
