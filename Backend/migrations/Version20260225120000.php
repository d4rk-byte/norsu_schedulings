<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Re-add dean (varchar) column to colleges table so the dean name can be
 * entered manually when the dean is not a registered system user.
 * The dean_id FK is kept for when the dean IS a system user.
 */
final class Version20260225120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Re-add dean varchar column to colleges table for manual dean name entry';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE colleges ADD dean VARCHAR(255) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE colleges DROP COLUMN dean');
    }
}
