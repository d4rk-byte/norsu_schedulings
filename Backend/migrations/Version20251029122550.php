<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251029122550 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE department_groups (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(255) NOT NULL, description VARCHAR(500) DEFAULT NULL, color VARCHAR(7) DEFAULT NULL, created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', updated_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE departments ADD department_group_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE departments ADD CONSTRAINT FK_16AEB8D4C7EAC36D FOREIGN KEY (department_group_id) REFERENCES department_groups (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_16AEB8D4C7EAC36D ON departments (department_group_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE departments DROP FOREIGN KEY FK_16AEB8D4C7EAC36D');
        $this->addSql('DROP TABLE department_groups');
        $this->addSql('DROP INDEX IDX_16AEB8D4C7EAC36D ON departments');
        $this->addSql('ALTER TABLE departments DROP department_group_id');
    }
}
