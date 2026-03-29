<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Create notifications table for the in-app notification system.
 */
final class Version20260226120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create notifications table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE notifications (
            id INT AUTO_INCREMENT NOT NULL,
            user_id INT NOT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message LONGTEXT NOT NULL,
            is_read TINYINT(1) DEFAULT 0 NOT NULL,
            read_at DATETIME DEFAULT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            metadata JSON DEFAULT NULL,
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            INDEX idx_notification_user_read (user_id, is_read),
            INDEX idx_notification_created (created_at),
            INDEX idx_notification_type (type),
            CONSTRAINT FK_6000B0D3A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE notifications');
    }
}
