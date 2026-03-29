<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251015000001 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create users table for authentication';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE users (
            id INT AUTO_INCREMENT NOT NULL, 
            username VARCHAR(100) NOT NULL, 
            email VARCHAR(255) NOT NULL, 
            password VARCHAR(255) NOT NULL, 
            first_name VARCHAR(100) NOT NULL, 
            last_name VARCHAR(100) NOT NULL, 
            role VARCHAR(20) NOT NULL, 
            department_id INT DEFAULT NULL, 
            is_active TINYINT(1) NOT NULL, 
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', 
            updated_at DATETIME DEFAULT NULL COMMENT \'(DC2Type:datetime_immutable)\', 
            UNIQUE INDEX UNIQ_1483A5E9F85E0677 (username), 
            UNIQUE INDEX UNIQ_1483A5E9E7927C74 (email), 
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP TABLE users');
    }
}