<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Create app_settings table for system-wide configuration settings
 */
final class Version20260402000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Creates app_settings table for storing system configuration like auto_activate_new_users';
    }

    public function up(Schema $schema): void
    {
        // Create app_settings table
        $this->addSql('CREATE TABLE IF NOT EXISTS app_settings (
            id INT AUTO_INCREMENT NOT NULL,
            setting_key VARCHAR(255) NOT NULL,
            setting_value LONGTEXT DEFAULT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            UNIQUE INDEX UNIQ_APP_SETTINGS_KEY (setting_key),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // Insert default value for auto_activate_new_users (default: false/0)
        $this->addSql('INSERT IGNORE INTO app_settings (setting_key, setting_value, created_at, updated_at) 
            VALUES (:key, :value, NOW(), NOW())', [
            'key' => 'auto_activate_new_users',
            'value' => '0'
        ]);
    }

    public function down(Schema $schema): void
    {
        // Drop app_settings table
        $this->addSql('DROP TABLE IF EXISTS app_settings');
    }
}
