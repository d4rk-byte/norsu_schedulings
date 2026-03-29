<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260329000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create schedule_change_requests table for faculty schedule change approval workflow';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE schedule_change_requests (id BIGINT AUTO_INCREMENT NOT NULL, schedule_id BIGINT UNSIGNED NOT NULL, requester_id INT NOT NULL, subject_department_id INT DEFAULT NULL, admin_approver_id INT DEFAULT NULL, department_head_approver_id INT DEFAULT NULL, admin_reviewer_id INT DEFAULT NULL, department_head_reviewer_id INT DEFAULT NULL, proposed_room_id BIGINT DEFAULT NULL, proposed_day_pattern VARCHAR(255) NOT NULL, proposed_start_time TIME NOT NULL, proposed_end_time TIME NOT NULL, proposed_section VARCHAR(255) DEFAULT NULL, request_reason LONGTEXT DEFAULT NULL, requested_changes JSON NOT NULL, conflict_snapshot JSON DEFAULT NULL, status VARCHAR(20) DEFAULT 'pending' NOT NULL, admin_status VARCHAR(20) DEFAULT 'pending' NOT NULL, department_head_status VARCHAR(20) DEFAULT 'pending' NOT NULL, admin_comment LONGTEXT DEFAULT NULL, department_head_comment LONGTEXT DEFAULT NULL, submitted_at DATETIME NOT NULL, admin_reviewed_at DATETIME DEFAULT NULL, department_head_reviewed_at DATETIME DEFAULT NULL, cancelled_at DATETIME DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME DEFAULT NULL, INDEX idx_scr_schedule (schedule_id), INDEX idx_scr_requester_submitted (requester_id, submitted_at), INDEX idx_scr_status (status), INDEX idx_scr_admin_status (admin_status), INDEX idx_scr_department_head_status (department_head_status), INDEX idx_scr_department_head_approver (department_head_approver_id), INDEX idx_scr_subject_department (subject_department_id), INDEX idx_scr_admin_approver (admin_approver_id), INDEX idx_scr_admin_reviewer (admin_reviewer_id), INDEX idx_scr_department_head_reviewer (department_head_reviewer_id), INDEX idx_scr_proposed_room (proposed_room_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");

        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_SCR_SCHEDULE FOREIGN KEY (schedule_id) REFERENCES schedules (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_SCR_REQUESTER FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_SCR_SUBJECT_DEPARTMENT FOREIGN KEY (subject_department_id) REFERENCES departments (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_SCR_ADMIN_APPROVER FOREIGN KEY (admin_approver_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_SCR_DEPARTMENT_HEAD_APPROVER FOREIGN KEY (department_head_approver_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_SCR_ADMIN_REVIEWER FOREIGN KEY (admin_reviewer_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_SCR_DEPARTMENT_HEAD_REVIEWER FOREIGN KEY (department_head_reviewer_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_SCR_PROPOSED_ROOM FOREIGN KEY (proposed_room_id) REFERENCES rooms (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE schedule_change_requests');
    }
}