<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260226150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Standardize subject semester values to 1st/2nd/Summer';
    }

    public function up(Schema $schema): void
    {
        // Standardize existing values
        $this->addSql("UPDATE subjects SET semester = '1st' WHERE semester = 'First'");
        $this->addSql("UPDATE subjects SET semester = '2nd' WHERE semester = 'Second'");

        // Backfill semester and year_level from curriculum terms for subjects that have NULL values
        $this->addSql("
            UPDATE subjects s
            JOIN (
                SELECT cs.subject_id,
                       MIN(ct.year_level) AS year_level,
                       SUBSTRING_INDEX(GROUP_CONCAT(ct.semester ORDER BY ct.year_level, ct.semester), ',', 1) AS semester
                FROM curriculum_subjects cs
                JOIN curriculum_terms ct ON cs.curriculum_term_id = ct.id
                GROUP BY cs.subject_id
            ) t ON s.id = t.subject_id
            SET s.year_level = COALESCE(s.year_level, t.year_level),
                s.semester = COALESCE(s.semester, t.semester)
            WHERE s.semester IS NULL OR s.year_level IS NULL
        ");
    }

    public function down(Schema $schema): void
    {
        $this->addSql("UPDATE subjects SET semester = 'First' WHERE semester = '1st'");
        $this->addSql("UPDATE subjects SET semester = 'Second' WHERE semester = '2nd'");
    }
}
