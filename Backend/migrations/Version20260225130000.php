<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Remove dean_id FK from colleges table — dean is now a plain string column only.
 */
final class Version20260225130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Drop dean_id FK from colleges, keep dean varchar column only';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE colleges DROP FOREIGN KEY FK_A9928EDCEB436DC');
        $this->addSql('DROP INDEX IDX_A9928EDCEB436DC ON colleges');

        // Copy dean names from linked users into the dean string column where not already set
        $this->addSql("
            UPDATE colleges c
            JOIN users u ON u.id = c.dean_id
            SET c.dean = CONCAT(u.firstname, ' ', u.lastname)
            WHERE c.dean IS NULL AND c.dean_id IS NOT NULL
        ");

        $this->addSql('ALTER TABLE colleges DROP COLUMN dean_id');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE colleges ADD dean_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE colleges ADD CONSTRAINT FK_A9928EDCEB436DC FOREIGN KEY (dean_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_A9928EDCEB436DC ON colleges (dean_id)');
    }
}
