<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251025150338 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE rooms ADD department_id INT NOT NULL');
        $this->addSql('ALTER TABLE rooms ADD CONSTRAINT FK_7CA11A96AE80F5DF FOREIGN KEY (department_id) REFERENCES departments (id)');
        $this->addSql('CREATE INDEX IDX_7CA11A96AE80F5DF ON rooms (department_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE rooms DROP FOREIGN KEY FK_7CA11A96AE80F5DF');
        $this->addSql('DROP INDEX IDX_7CA11A96AE80F5DF ON rooms');
        $this->addSql('ALTER TABLE rooms DROP department_id');
    }
}
