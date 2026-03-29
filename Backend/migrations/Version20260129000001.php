<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Add year_level and semester to subjects table for direct conflict detection
 */
final class Version20260129000001 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add year_level and semester columns to subjects table';
    }

    public function up(Schema $schema): void
    {
        // Add year_level column (1-4 for undergraduate)
        $this->addSql('ALTER TABLE subjects ADD year_level INT DEFAULT NULL');
        
        // Add semester column (First, Second, Summer)
        $this->addSql('ALTER TABLE subjects ADD semester VARCHAR(20) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE subjects DROP year_level');
        $this->addSql('ALTER TABLE subjects DROP semester');
    }
}
