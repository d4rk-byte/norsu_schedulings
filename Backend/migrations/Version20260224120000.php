<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Normalize Department.head_name and College.dean to FK references to users table.
 * - departments: Replace head_name (varchar) with head_id (FK → users.id)
 * - colleges: Replace dean (varchar) with dean_id (FK → users.id)
 */
final class Version20260224120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Normalize department head and college dean fields from strings to user FK references (3NF compliance)';
    }

    public function up(Schema $schema): void
    {
        // Add head_id column to departments
        $this->addSql('ALTER TABLE departments ADD head_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE departments ADD CONSTRAINT FK_16AEB8D4528B5227 FOREIGN KEY (head_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_16AEB8D4528B5227 ON departments (head_id)');

        // Migrate existing head_name data: try to match by full name
        $this->addSql("
            UPDATE departments d 
            SET d.head_id = (
                SELECT u.id FROM users u 
                WHERE CONCAT(u.firstname, ' ', u.lastname) = d.head_name 
                AND u.deleted_at IS NULL 
                LIMIT 1
            ) 
            WHERE d.head_name IS NOT NULL AND d.head_name != ''
        ");

        // Drop old head_name column
        $this->addSql('ALTER TABLE departments DROP COLUMN head_name');

        // Add dean_id column to colleges
        $this->addSql('ALTER TABLE colleges ADD dean_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE colleges ADD CONSTRAINT FK_A9928EDCEB436DC FOREIGN KEY (dean_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_A9928EDCEB436DC ON colleges (dean_id)');

        // Migrate existing dean data: try to match by full name
        $this->addSql("
            UPDATE colleges c 
            SET c.dean_id = (
                SELECT u.id FROM users u 
                WHERE CONCAT(u.firstname, ' ', u.lastname) = c.dean 
                AND u.deleted_at IS NULL 
                LIMIT 1
            ) 
            WHERE c.dean IS NOT NULL AND c.dean != ''
        ");

        // Drop old dean column
        $this->addSql('ALTER TABLE colleges DROP COLUMN dean');
    }

    public function down(Schema $schema): void
    {
        // Restore head_name column on departments
        $this->addSql('ALTER TABLE departments ADD head_name VARCHAR(255) DEFAULT NULL');

        // Migrate data back
        $this->addSql("
            UPDATE departments d 
            SET d.head_name = (
                SELECT CONCAT(u.firstname, ' ', u.lastname) FROM users u WHERE u.id = d.head_id
            ) 
            WHERE d.head_id IS NOT NULL
        ");

        // Drop FK and column
        $this->addSql('ALTER TABLE departments DROP FOREIGN KEY FK_16AEB8D4528B5227');
        $this->addSql('DROP INDEX IDX_16AEB8D4528B5227 ON departments');
        $this->addSql('ALTER TABLE departments DROP COLUMN head_id');

        // Restore dean column on colleges
        $this->addSql('ALTER TABLE colleges ADD dean VARCHAR(255) DEFAULT NULL');

        // Migrate data back
        $this->addSql("
            UPDATE colleges c 
            SET c.dean = (
                SELECT CONCAT(u.firstname, ' ', u.lastname) FROM users u WHERE u.id = c.dean_id
            ) 
            WHERE c.dean_id IS NOT NULL
        ");

        // Drop FK and column
        $this->addSql('ALTER TABLE colleges DROP FOREIGN KEY FK_A9928EDCEB436DC');
        $this->addSql('DROP INDEX IDX_A9928EDCEB436DC ON colleges');
        $this->addSql('ALTER TABLE colleges DROP COLUMN dean_id');
    }
}
