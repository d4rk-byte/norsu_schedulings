<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Remove redundant curriculum_id from curriculum_subjects (derivable via curriculum_term → curriculum)
 */
final class Version20260225150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Drop redundant curriculum_id FK from curriculum_subjects table (3NF fix)';
    }

    public function up(Schema $schema): void
    {
        // Drop the foreign key constraint first, then the index, then the column
        $this->addSql('ALTER TABLE curriculum_subjects DROP FOREIGN KEY FK_51FD47535AEA4428');
        $this->addSql('DROP INDEX idx_curriculum_subject ON curriculum_subjects');
        $this->addSql('ALTER TABLE curriculum_subjects DROP COLUMN curriculum_id');
    }

    public function down(Schema $schema): void
    {
        // Re-add the column
        $this->addSql('ALTER TABLE curriculum_subjects ADD COLUMN curriculum_id INT NOT NULL');
        
        // Populate curriculum_id from curriculum_term → curriculum
        $this->addSql('UPDATE curriculum_subjects cs 
            INNER JOIN curriculum_terms ct ON cs.curriculum_term_id = ct.id 
            SET cs.curriculum_id = ct.curriculum_id');
        
        // Re-add the index and foreign key
        $this->addSql('CREATE INDEX idx_curriculum_subject ON curriculum_subjects (curriculum_id)');
        $this->addSql('ALTER TABLE curriculum_subjects ADD CONSTRAINT FK_51FD47535AEA4428 FOREIGN KEY (curriculum_id) REFERENCES curricula (id) ON DELETE CASCADE');
    }
}
