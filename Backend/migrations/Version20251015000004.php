<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251015000004 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create departments table and add foreign key relationships';
    }

    public function up(Schema $schema): void
    {
        // Create departments table
        $this->addSql('CREATE TABLE departments (
            id INT AUTO_INCREMENT NOT NULL,
            code VARCHAR(10) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            head VARCHAR(255) DEFAULT NULL,
            college_id INT DEFAULT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            deleted_at DATETIME DEFAULT NULL,
            PRIMARY KEY(id),
            INDEX idx_department_college (college_id),
            INDEX idx_department_active (is_active),
            INDEX idx_department_deleted (deleted_at)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB');

        // Add foreign key constraints
        $this->addSql('ALTER TABLE users ADD CONSTRAINT FK_1483A5E9770124B2 FOREIGN KEY (college_id) REFERENCES colleges (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE users ADD CONSTRAINT FK_1483A5E9AE80F5DF FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE departments ADD CONSTRAINT FK_16AEB8D4770124B2 FOREIGN KEY (college_id) REFERENCES colleges (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        // Remove foreign key constraints
        $this->addSql('ALTER TABLE users DROP FOREIGN KEY FK_1483A5E9770124B2');
        $this->addSql('ALTER TABLE users DROP FOREIGN KEY FK_1483A5E9AE80F5DF');
        $this->addSql('ALTER TABLE departments DROP FOREIGN KEY FK_16AEB8D4770124B2');
        
        // Drop departments table
        $this->addSql('DROP TABLE departments');
    }
}