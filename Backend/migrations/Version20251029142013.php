<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251029142013 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE rooms ADD department_group_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE rooms ADD CONSTRAINT FK_7CA11A96C7EAC36D FOREIGN KEY (department_group_id) REFERENCES department_groups (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_7CA11A96C7EAC36D ON rooms (department_group_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE rooms DROP FOREIGN KEY FK_7CA11A96C7EAC36D');
        $this->addSql('DROP INDEX IDX_7CA11A96C7EAC36D ON rooms');
        $this->addSql('ALTER TABLE rooms DROP department_group_id');
    }
}
