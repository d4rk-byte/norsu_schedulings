<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260328000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create app_settings table and add auto-activation setting for new registrations';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE app_settings (id INT AUTO_INCREMENT NOT NULL, setting_key VARCHAR(100) NOT NULL, setting_value LONGTEXT NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, UNIQUE INDEX UNIQ_APP_SETTINGS_KEY (setting_key), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql("INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at) VALUES ('auto_activate_new_users', '0', NOW(), NOW())");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE app_settings');
    }
}
