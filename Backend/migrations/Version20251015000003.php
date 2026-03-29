<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251015000003 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add indexes to users table for better performance';
    }

    public function up(Schema $schema): void
    {
        // Add indexes to users table for better performance
        try {
            $this->addSql('ALTER TABLE users ADD INDEX idx_users_college (college_id)');
        } catch (\Exception $e) {
            // Index might already exist, ignore error
        }
        
        try {
            $this->addSql('ALTER TABLE users ADD INDEX idx_users_department (department_id)');
        } catch (\Exception $e) {
            // Index might already exist, ignore error
        }
        
        try {
            $this->addSql('ALTER TABLE users ADD INDEX idx_users_role (role)');
        } catch (\Exception $e) {
            // Index might already exist, ignore error
        }
        
        try {
            $this->addSql('ALTER TABLE users ADD INDEX idx_users_active (is_active)');
        } catch (\Exception $e) {
            // Index might already exist, ignore error
        }
        
        try {
            $this->addSql('ALTER TABLE users ADD INDEX idx_users_email (email)');
        } catch (\Exception $e) {
            // Index might already exist, ignore error
        }
    }

    public function down(Schema $schema): void
    {
        // Remove indexes (ignore errors if they don't exist)
        try {
            $this->addSql('ALTER TABLE users DROP INDEX idx_users_college');
        } catch (\Exception $e) {
            // Ignore if index doesn't exist
        }
        
        try {
            $this->addSql('ALTER TABLE users DROP INDEX idx_users_department');
        } catch (\Exception $e) {
            // Ignore if index doesn't exist
        }
        
        try {
            $this->addSql('ALTER TABLE users DROP INDEX idx_users_role');
        } catch (\Exception $e) {
            // Ignore if index doesn't exist
        }
        
        try {
            $this->addSql('ALTER TABLE users DROP INDEX idx_users_active');
        } catch (\Exception $e) {
            // Ignore if index doesn't exist
        }
        
        try {
            $this->addSql('ALTER TABLE users DROP INDEX idx_users_email');
        } catch (\Exception $e) {
            // Ignore if index doesn't exist
        }
    }
}