<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Backfills critical auth and scheduling tables when migration history
 * was marked as executed without creating physical tables.
 */
final class Version20260411000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Creates refresh_tokens and schedule_change_requests tables if missing and re-applies required foreign keys';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INT AUTO_INCREMENT NOT NULL,
            refresh_token VARCHAR(128) NOT NULL,
            username VARCHAR(255) NOT NULL,
            valid DATETIME NOT NULL,
            UNIQUE INDEX UNIQ_9BACE7E1C74F2195 (refresh_token),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");

        $this->addSql("CREATE TABLE IF NOT EXISTS schedule_change_requests (
            id BIGINT AUTO_INCREMENT NOT NULL,
            schedule_id BIGINT UNSIGNED NOT NULL,
            requester_id INT NOT NULL,
            subject_department_id INT DEFAULT NULL,
            admin_approver_id INT DEFAULT NULL,
            department_head_approver_id INT DEFAULT NULL,
            admin_reviewer_id INT DEFAULT NULL,
            department_head_reviewer_id INT DEFAULT NULL,
            proposed_room_id BIGINT DEFAULT NULL,
            proposed_day_pattern VARCHAR(255) NOT NULL,
            proposed_start_time TIME NOT NULL,
            proposed_end_time TIME NOT NULL,
            proposed_section VARCHAR(255) DEFAULT NULL,
            request_reason LONGTEXT DEFAULT NULL,
            requested_changes JSON NOT NULL,
            conflict_snapshot JSON DEFAULT NULL,
            status VARCHAR(20) DEFAULT 'pending' NOT NULL,
            admin_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
            department_head_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
            admin_comment LONGTEXT DEFAULT NULL,
            department_head_comment LONGTEXT DEFAULT NULL,
            submitted_at DATETIME NOT NULL,
            admin_reviewed_at DATETIME DEFAULT NULL,
            department_head_reviewed_at DATETIME DEFAULT NULL,
            cancelled_at DATETIME DEFAULT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME DEFAULT NULL,
            INDEX IDX_26271771A40BC2D5 (schedule_id),
            INDEX IDX_26271771ED442CF4 (requester_id),
            INDEX IDX_26271771D760D696 (subject_department_id),
            INDEX IDX_2627177126393F65 (admin_approver_id),
            INDEX IDX_26271771ED4D0F1F (admin_reviewer_id),
            INDEX IDX_262717717A1E5B09 (department_head_reviewer_id),
            INDEX IDX_26271771B38042BA (proposed_room_id),
            INDEX idx_scr_status (status),
            INDEX idx_scr_requester_submitted (requester_id, submitted_at),
            INDEX idx_scr_admin_status (admin_status),
            INDEX idx_scr_department_head_status (department_head_status),
            INDEX idx_scr_department_head_approver (department_head_approver_id),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");

        $this->addForeignKeyIfMissing(
            'FK_26271771A40BC2D5',
            'ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771A40BC2D5 FOREIGN KEY (schedule_id) REFERENCES schedules (id) ON DELETE CASCADE'
        );
        $this->addForeignKeyIfMissing(
            'FK_26271771ED442CF4',
            'ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771ED442CF4 FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE CASCADE'
        );
        $this->addForeignKeyIfMissing(
            'FK_26271771D760D696',
            'ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771D760D696 FOREIGN KEY (subject_department_id) REFERENCES departments (id) ON DELETE SET NULL'
        );
        $this->addForeignKeyIfMissing(
            'FK_2627177126393F65',
            'ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_2627177126393F65 FOREIGN KEY (admin_approver_id) REFERENCES users (id) ON DELETE SET NULL'
        );
        $this->addForeignKeyIfMissing(
            'FK_26271771B16A6B73',
            'ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771B16A6B73 FOREIGN KEY (department_head_approver_id) REFERENCES users (id) ON DELETE SET NULL'
        );
        $this->addForeignKeyIfMissing(
            'FK_26271771ED4D0F1F',
            'ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771ED4D0F1F FOREIGN KEY (admin_reviewer_id) REFERENCES users (id) ON DELETE SET NULL'
        );
        $this->addForeignKeyIfMissing(
            'FK_262717717A1E5B09',
            'ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_262717717A1E5B09 FOREIGN KEY (department_head_reviewer_id) REFERENCES users (id) ON DELETE SET NULL'
        );
        $this->addForeignKeyIfMissing(
            'FK_26271771B38042BA',
            'ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771B38042BA FOREIGN KEY (proposed_room_id) REFERENCES rooms (id) ON DELETE SET NULL'
        );
    }

    public function down(Schema $schema): void
    {
        // This backfill migration is intentionally non-destructive on rollback.
    }

    private function addForeignKeyIfMissing(string $constraintName, string $alterSql): void
    {
        $exists = (int) $this->connection->fetchOne(
            'SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?',
            [$constraintName]
        );

        if ($exists === 0) {
            $this->addSql($alterSql);
        }
    }
}
