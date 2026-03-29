<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251027134743 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE class_assignments DROP FOREIGN KEY FK_8E49FEBAE80F5DF');
        $this->addSql('DROP INDEX IDX_8E49FEBAE80F5DF ON class_assignments');
        $this->addSql('ALTER TABLE class_assignments DROP department_id');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE class_assignments ADD department_id INT NOT NULL');
        $this->addSql('ALTER TABLE class_assignments ADD CONSTRAINT FK_8E49FEBAE80F5DF FOREIGN KEY (department_id) REFERENCES departments (id) ON UPDATE NO ACTION ON DELETE NO ACTION');
        $this->addSql('CREATE INDEX IDX_8E49FEBAE80F5DF ON class_assignments (department_id)');
    }
}
