<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Complete initial schema - creates all tables in correct dependency order
 */
final class Version20240101000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Complete initial schema for Smart Scheduling System';
    }

    public function up(Schema $schema): void
    {
        // 1. Independent tables (no foreign keys)
        $this->addSql('CREATE TABLE academic_years (id BIGINT AUTO_INCREMENT NOT NULL, year VARCHAR(255) NOT NULL, start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL, is_current TINYINT(1) DEFAULT NULL, current_semester VARCHAR(20) DEFAULT NULL, is_active TINYINT(1) DEFAULT NULL, created_at DATETIME DEFAULT NULL, updated_at DATETIME DEFAULT NULL, deleted_at DATETIME DEFAULT NULL, first_sem_start DATE DEFAULT NULL, first_sem_end DATE DEFAULT NULL, second_sem_start DATE DEFAULT NULL, second_sem_end DATE DEFAULT NULL, summer_start DATE DEFAULT NULL, summer_end DATE DEFAULT NULL, PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        
        $this->addSql('CREATE TABLE colleges (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(10) NOT NULL, name VARCHAR(255) NOT NULL, description LONGTEXT DEFAULT NULL, dean VARCHAR(255) DEFAULT NULL, logo VARCHAR(255) DEFAULT NULL, is_active TINYINT(1) DEFAULT 1 NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME DEFAULT NULL, deleted_at DATETIME DEFAULT NULL, UNIQUE INDEX UNIQ_F5AA74A077153098 (code), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        
        $this->addSql('CREATE TABLE department_groups (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(255) NOT NULL, description VARCHAR(500) DEFAULT NULL, color VARCHAR(7) DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        
        $this->addSql('CREATE TABLE refresh_tokens (id INT AUTO_INCREMENT NOT NULL, refresh_token VARCHAR(128) NOT NULL, username VARCHAR(255) NOT NULL, valid DATETIME NOT NULL, UNIQUE INDEX UNIQ_9BACE7E1C74F2195 (refresh_token), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        
        $this->addSql('CREATE TABLE messenger_messages (id BIGINT AUTO_INCREMENT NOT NULL, body LONGTEXT NOT NULL, headers LONGTEXT NOT NULL, queue_name VARCHAR(190) NOT NULL, created_at DATETIME NOT NULL, available_at DATETIME NOT NULL, delivered_at DATETIME DEFAULT NULL, INDEX IDX_75EA56E0FB7336F0E3BD61CE16BA31DBBF396750 (queue_name, available_at, delivered_at, id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 2. Users table (references colleges, but we add FK later)
        $this->addSql('CREATE TABLE users (id INT AUTO_INCREMENT NOT NULL, college_id INT DEFAULT NULL, department_id INT DEFAULT NULL, username VARCHAR(255) NOT NULL, firstname VARCHAR(255) DEFAULT NULL, middlename VARCHAR(255) DEFAULT NULL, lastname VARCHAR(255) DEFAULT NULL, email VARCHAR(255) NOT NULL, email_verified_at DATETIME DEFAULT NULL, password VARCHAR(255) NOT NULL, role INT NOT NULL, employee_id VARCHAR(255) DEFAULT NULL, position VARCHAR(255) DEFAULT NULL, address LONGTEXT DEFAULT NULL, is_active TINYINT(1) DEFAULT NULL, last_login DATETIME DEFAULT NULL, remember_token VARCHAR(100) DEFAULT NULL, created_at DATETIME DEFAULT NULL, updated_at DATETIME DEFAULT NULL, deleted_at DATETIME DEFAULT NULL, preferred_semester_filter VARCHAR(20) DEFAULT NULL, other_designation LONGTEXT DEFAULT NULL, INDEX IDX_1483A5E9770124B2 (college_id), INDEX IDX_1483A5E9AE80F5DF (department_id), UNIQUE INDEX UNIQ_email (email), UNIQUE INDEX UNIQ_username (username), UNIQUE INDEX UNIQ_employee_id (employee_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 3. Departments (references colleges, department_groups, users)
        $this->addSql('CREATE TABLE departments (id INT AUTO_INCREMENT NOT NULL, head_id INT DEFAULT NULL, college_id INT DEFAULT NULL, department_group_id INT DEFAULT NULL, code VARCHAR(10) NOT NULL, name VARCHAR(255) NOT NULL, description LONGTEXT DEFAULT NULL, contact_email VARCHAR(255) DEFAULT NULL, is_active TINYINT(1) DEFAULT 1 NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, UNIQUE INDEX UNIQ_16AEB8D477153098 (code), INDEX IDX_16AEB8D4F41A619E (head_id), INDEX IDX_16AEB8D4C7EAC36D (department_group_id), INDEX idx_department_college (college_id), INDEX idx_department_active (is_active), INDEX idx_department_deleted (deleted_at), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 4. Subjects (references departments)
        $this->addSql('CREATE TABLE subjects (id BIGINT AUTO_INCREMENT NOT NULL, department_id INT NOT NULL, code VARCHAR(255) NOT NULL, title VARCHAR(255) NOT NULL, description LONGTEXT DEFAULT NULL, units INT NOT NULL, lecture_hours INT DEFAULT NULL, lab_hours INT DEFAULT NULL, type VARCHAR(50) NOT NULL, is_active TINYINT(1) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME DEFAULT NULL, year_level INT DEFAULT NULL, semester VARCHAR(20) DEFAULT NULL, INDEX IDX_AB259917AE80F5DF (department_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 5. Rooms (references departments, department_groups)
        $this->addSql('CREATE TABLE rooms (id BIGINT AUTO_INCREMENT NOT NULL, department_id INT NOT NULL, department_group_id INT DEFAULT NULL, code VARCHAR(255) NOT NULL, name VARCHAR(255) DEFAULT NULL, type VARCHAR(50) DEFAULT NULL, capacity INT DEFAULT NULL, building VARCHAR(255) DEFAULT NULL, floor VARCHAR(255) DEFAULT NULL, equipment LONGTEXT DEFAULT NULL, is_active TINYINT(1) DEFAULT NULL, created_at DATETIME DEFAULT NULL, updated_at DATETIME DEFAULT NULL, deleted_at DATETIME DEFAULT NULL, INDEX IDX_7CA11A96AE80F5DF (department_id), INDEX IDX_7CA11A96C7EAC36D (department_group_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 6. Curricula (references departments)
        $this->addSql('CREATE TABLE curricula (id BIGINT AUTO_INCREMENT NOT NULL, department_id INT NOT NULL, name VARCHAR(255) NOT NULL, version INT DEFAULT NULL, is_published TINYINT(1) DEFAULT NULL, effective_year_id BIGINT DEFAULT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME DEFAULT NULL, updated_at DATETIME DEFAULT NULL, deleted_at DATETIME DEFAULT NULL, INDEX IDX_463CC9FCAE80F5DF (department_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 7. Curriculum terms (references curricula)
        $this->addSql('CREATE TABLE curriculum_terms (id INT AUTO_INCREMENT NOT NULL, curriculum_id BIGINT NOT NULL, year_level INT NOT NULL, semester VARCHAR(10) NOT NULL, term_name VARCHAR(100) DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX IDX_7333F2735AEA4428 (curriculum_id), INDEX idx_curriculum_term (curriculum_id, year_level, semester), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 8. Curriculum subjects (references curriculum_terms, subjects)
        $this->addSql('CREATE TABLE curriculum_subjects (id INT AUTO_INCREMENT NOT NULL, curriculum_term_id INT NOT NULL, subject_id BIGINT NOT NULL, sections_mapping JSON DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX IDX_51FD4753D9CF12E2 (curriculum_term_id), INDEX IDX_51FD475323EDC87 (subject_id), UNIQUE INDEX unique_term_subject (curriculum_term_id, subject_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 9. Schedules (references academic_years, subjects, rooms, users)
        $this->addSql('CREATE TABLE schedules (id BIGINT UNSIGNED AUTO_INCREMENT NOT NULL, academic_year_id BIGINT NOT NULL, subject_id BIGINT NOT NULL, room_id BIGINT NOT NULL, faculty_id INT DEFAULT NULL, semester VARCHAR(10) NOT NULL, day_pattern VARCHAR(255) DEFAULT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, section VARCHAR(255) DEFAULT NULL, enrolled_students INT DEFAULT 0 NOT NULL, is_conflicted TINYINT(1) DEFAULT 0 NOT NULL, is_overload TINYINT(1) DEFAULT 0 NOT NULL, status VARCHAR(20) DEFAULT \'active\' NOT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME DEFAULT NULL, updated_at DATETIME DEFAULT NULL, INDEX IDX_313BDC8EC54F3401 (academic_year_id), INDEX IDX_313BDC8E23EDC87 (subject_id), INDEX IDX_313BDC8E54177093 (room_id), INDEX IDX_313BDC8E680CAB68 (faculty_id), INDEX schedules_conflict_check_index (room_id, day_pattern, start_time, end_time), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 10. Schedule change requests
        $this->addSql('CREATE TABLE schedule_change_requests (id BIGINT AUTO_INCREMENT NOT NULL, schedule_id BIGINT UNSIGNED NOT NULL, requester_id INT NOT NULL, subject_department_id INT DEFAULT NULL, admin_approver_id INT DEFAULT NULL, department_head_approver_id INT DEFAULT NULL, admin_reviewer_id INT DEFAULT NULL, department_head_reviewer_id INT DEFAULT NULL, proposed_room_id BIGINT DEFAULT NULL, proposed_day_pattern VARCHAR(255) NOT NULL, proposed_start_time TIME NOT NULL, proposed_end_time TIME NOT NULL, proposed_section VARCHAR(255) DEFAULT NULL, request_reason LONGTEXT DEFAULT NULL, requested_changes JSON NOT NULL, conflict_snapshot JSON DEFAULT NULL, status VARCHAR(20) DEFAULT \'pending\' NOT NULL, admin_status VARCHAR(20) DEFAULT \'pending\' NOT NULL, department_head_status VARCHAR(20) DEFAULT \'pending\' NOT NULL, admin_comment LONGTEXT DEFAULT NULL, department_head_comment LONGTEXT DEFAULT NULL, submitted_at DATETIME NOT NULL, admin_reviewed_at DATETIME DEFAULT NULL, department_head_reviewed_at DATETIME DEFAULT NULL, cancelled_at DATETIME DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME DEFAULT NULL, INDEX IDX_26271771A40BC2D5 (schedule_id), INDEX IDX_26271771ED442CF4 (requester_id), INDEX IDX_26271771D760D696 (subject_department_id), INDEX IDX_2627177126393F65 (admin_approver_id), INDEX IDX_26271771ED4D0F1F (admin_reviewer_id), INDEX IDX_262717717A1E5B09 (department_head_reviewer_id), INDEX IDX_26271771B38042BA (proposed_room_id), INDEX idx_scr_status (status), INDEX idx_scr_requester_submitted (requester_id, submitted_at), INDEX idx_scr_admin_status (admin_status), INDEX idx_scr_department_head_status (department_head_status), INDEX idx_scr_department_head_approver (department_head_approver_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 11. Activity logs (references users)
        $this->addSql('CREATE TABLE activity_logs (id INT AUTO_INCREMENT NOT NULL, user_id INT DEFAULT NULL, action VARCHAR(100) NOT NULL, description VARCHAR(255) NOT NULL, entity_type VARCHAR(100) DEFAULT NULL, entity_id INT DEFAULT NULL, metadata JSON DEFAULT NULL, ip_address VARCHAR(45) DEFAULT NULL, user_agent VARCHAR(255) DEFAULT NULL, created_at DATETIME NOT NULL, INDEX idx_activity_user (user_id), INDEX idx_activity_action (action), INDEX idx_activity_created (created_at), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // 12. Notifications (references users)
        $this->addSql('CREATE TABLE notifications (id INT AUTO_INCREMENT NOT NULL, user_id INT NOT NULL, type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, message LONGTEXT NOT NULL, is_read TINYINT(1) DEFAULT 0 NOT NULL, read_at DATETIME DEFAULT NULL, metadata JSON DEFAULT NULL, created_at DATETIME NOT NULL, INDEX IDX_6000B0D3A76ED395 (user_id), INDEX idx_notification_user_read (user_id, is_read), INDEX idx_notification_created (created_at), INDEX idx_notification_type (type), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        // Add all foreign key constraints
        $this->addSql('ALTER TABLE activity_logs ADD CONSTRAINT FK_F34B1DCEA76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE curricula ADD CONSTRAINT FK_463CC9FCAE80F5DF FOREIGN KEY (department_id) REFERENCES departments (id)');
        $this->addSql('ALTER TABLE curriculum_subjects ADD CONSTRAINT FK_51FD4753D9CF12E2 FOREIGN KEY (curriculum_term_id) REFERENCES curriculum_terms (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE curriculum_subjects ADD CONSTRAINT FK_51FD475323EDC87 FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE curriculum_terms ADD CONSTRAINT FK_7333F2735AEA4428 FOREIGN KEY (curriculum_id) REFERENCES curricula (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE departments ADD CONSTRAINT FK_16AEB8D4F41A619E FOREIGN KEY (head_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE departments ADD CONSTRAINT FK_16AEB8D4770124B2 FOREIGN KEY (college_id) REFERENCES colleges (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE departments ADD CONSTRAINT FK_16AEB8D4C7EAC36D FOREIGN KEY (department_group_id) REFERENCES department_groups (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE notifications ADD CONSTRAINT FK_6000B0D3A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE rooms ADD CONSTRAINT FK_7CA11A96AE80F5DF FOREIGN KEY (department_id) REFERENCES departments (id)');
        $this->addSql('ALTER TABLE rooms ADD CONSTRAINT FK_7CA11A96C7EAC36D FOREIGN KEY (department_group_id) REFERENCES department_groups (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedules ADD CONSTRAINT FK_313BDC8EC54F3401 FOREIGN KEY (academic_year_id) REFERENCES academic_years (id)');
        $this->addSql('ALTER TABLE schedules ADD CONSTRAINT FK_313BDC8E23EDC87 FOREIGN KEY (subject_id) REFERENCES subjects (id)');
        $this->addSql('ALTER TABLE schedules ADD CONSTRAINT FK_313BDC8E54177093 FOREIGN KEY (room_id) REFERENCES rooms (id)');
        $this->addSql('ALTER TABLE schedules ADD CONSTRAINT FK_313BDC8E680CAB68 FOREIGN KEY (faculty_id) REFERENCES users (id)');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771A40BC2D5 FOREIGN KEY (schedule_id) REFERENCES schedules (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771ED442CF4 FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771D760D696 FOREIGN KEY (subject_department_id) REFERENCES departments (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_2627177126393F65 FOREIGN KEY (admin_approver_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771B16A6B73 FOREIGN KEY (department_head_approver_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771ED4D0F1F FOREIGN KEY (admin_reviewer_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_262717717A1E5B09 FOREIGN KEY (department_head_reviewer_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE schedule_change_requests ADD CONSTRAINT FK_26271771B38042BA FOREIGN KEY (proposed_room_id) REFERENCES rooms (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE subjects ADD CONSTRAINT FK_AB259917AE80F5DF FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE RESTRICT');
        $this->addSql('ALTER TABLE users ADD CONSTRAINT FK_1483A5E9770124B2 FOREIGN KEY (college_id) REFERENCES colleges (id)');
        $this->addSql('ALTER TABLE users ADD CONSTRAINT FK_1483A5E9AE80F5DF FOREIGN KEY (department_id) REFERENCES departments (id)');
    }

    public function down(Schema $schema): void
    {
        // Drop foreign keys first
        $this->addSql('ALTER TABLE activity_logs DROP FOREIGN KEY FK_F34B1DCEA76ED395');
        $this->addSql('ALTER TABLE curricula DROP FOREIGN KEY FK_463CC9FCAE80F5DF');
        $this->addSql('ALTER TABLE curriculum_subjects DROP FOREIGN KEY FK_51FD4753D9CF12E2');
        $this->addSql('ALTER TABLE curriculum_subjects DROP FOREIGN KEY FK_51FD475323EDC87');
        $this->addSql('ALTER TABLE curriculum_terms DROP FOREIGN KEY FK_7333F2735AEA4428');
        $this->addSql('ALTER TABLE departments DROP FOREIGN KEY FK_16AEB8D4F41A619E');
        $this->addSql('ALTER TABLE departments DROP FOREIGN KEY FK_16AEB8D4770124B2');
        $this->addSql('ALTER TABLE departments DROP FOREIGN KEY FK_16AEB8D4C7EAC36D');
        $this->addSql('ALTER TABLE notifications DROP FOREIGN KEY FK_6000B0D3A76ED395');
        $this->addSql('ALTER TABLE rooms DROP FOREIGN KEY FK_7CA11A96AE80F5DF');
        $this->addSql('ALTER TABLE rooms DROP FOREIGN KEY FK_7CA11A96C7EAC36D');
        $this->addSql('ALTER TABLE schedules DROP FOREIGN KEY FK_313BDC8EC54F3401');
        $this->addSql('ALTER TABLE schedules DROP FOREIGN KEY FK_313BDC8E23EDC87');
        $this->addSql('ALTER TABLE schedules DROP FOREIGN KEY FK_313BDC8E54177093');
        $this->addSql('ALTER TABLE schedules DROP FOREIGN KEY FK_313BDC8E680CAB68');
        $this->addSql('ALTER TABLE schedule_change_requests DROP FOREIGN KEY FK_26271771A40BC2D5');
        $this->addSql('ALTER TABLE schedule_change_requests DROP FOREIGN KEY FK_26271771ED442CF4');
        $this->addSql('ALTER TABLE schedule_change_requests DROP FOREIGN KEY FK_26271771D760D696');
        $this->addSql('ALTER TABLE schedule_change_requests DROP FOREIGN KEY FK_2627177126393F65');
        $this->addSql('ALTER TABLE schedule_change_requests DROP FOREIGN KEY FK_26271771B16A6B73');
        $this->addSql('ALTER TABLE schedule_change_requests DROP FOREIGN KEY FK_26271771ED4D0F1F');
        $this->addSql('ALTER TABLE schedule_change_requests DROP FOREIGN KEY FK_262717717A1E5B09');
        $this->addSql('ALTER TABLE schedule_change_requests DROP FOREIGN KEY FK_26271771B38042BA');
        $this->addSql('ALTER TABLE subjects DROP FOREIGN KEY FK_AB259917AE80F5DF');
        $this->addSql('ALTER TABLE users DROP FOREIGN KEY FK_1483A5E9770124B2');
        $this->addSql('ALTER TABLE users DROP FOREIGN KEY FK_1483A5E9AE80F5DF');

        // Drop tables
        $this->addSql('DROP TABLE activity_logs');
        $this->addSql('DROP TABLE notifications');
        $this->addSql('DROP TABLE schedule_change_requests');
        $this->addSql('DROP TABLE schedules');
        $this->addSql('DROP TABLE curriculum_subjects');
        $this->addSql('DROP TABLE curriculum_terms');
        $this->addSql('DROP TABLE curricula');
        $this->addSql('DROP TABLE rooms');
        $this->addSql('DROP TABLE subjects');
        $this->addSql('DROP TABLE departments');
        $this->addSql('DROP TABLE users');
        $this->addSql('DROP TABLE department_groups');
        $this->addSql('DROP TABLE colleges');
        $this->addSql('DROP TABLE academic_years');
        $this->addSql('DROP TABLE refresh_tokens');
        $this->addSql('DROP TABLE messenger_messages');
    }
}
