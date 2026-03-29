<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260119014150 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE INDEX idx_employee_id ON users (employee_id)');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_email ON users (email)');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_username ON users (username)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP INDEX idx_employee_id ON users');
        $this->addSql('DROP INDEX UNIQ_email ON users');
        $this->addSql('DROP INDEX UNIQ_username ON users');
    }
}
