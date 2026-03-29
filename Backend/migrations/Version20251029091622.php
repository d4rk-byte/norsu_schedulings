<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251029091622 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE schedules ADD faculty_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE schedules ADD CONSTRAINT FK_313BDC8E680CAB68 FOREIGN KEY (faculty_id) REFERENCES users (id)');
        $this->addSql('CREATE INDEX IDX_313BDC8E680CAB68 ON schedules (faculty_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE schedules DROP FOREIGN KEY FK_313BDC8E680CAB68');
        $this->addSql('DROP INDEX IDX_313BDC8E680CAB68 ON schedules');
        $this->addSql('ALTER TABLE schedules DROP faculty_id');
    }
}
