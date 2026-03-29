<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251027131829 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE class_assignments (id BIGINT AUTO_INCREMENT NOT NULL, subject_id BIGINT NOT NULL, faculty_id INT NOT NULL, department_id INT NOT NULL, section VARCHAR(10) NOT NULL, year_level VARCHAR(20) NOT NULL, semester VARCHAR(20) NOT NULL, academic_year VARCHAR(20) NOT NULL, max_students INT NOT NULL, enrolled_students INT NOT NULL, status VARCHAR(20) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME DEFAULT NULL, INDEX IDX_8E49FEB23EDC87 (subject_id), INDEX IDX_8E49FEB680CAB68 (faculty_id), INDEX IDX_8E49FEBAE80F5DF (department_id), UNIQUE INDEX unique_class_section (subject_id, section, year_level, semester, academic_year), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE schedules (id BIGINT AUTO_INCREMENT NOT NULL, class_assignment_id BIGINT NOT NULL, room_id BIGINT NOT NULL, created_by INT NOT NULL, day_pattern VARCHAR(20) NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, status VARCHAR(20) NOT NULL, notes LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME DEFAULT NULL, INDEX IDX_313BDC8E535474C2 (class_assignment_id), INDEX IDX_313BDC8E54177093 (room_id), INDEX IDX_313BDC8EDE12AB56 (created_by), INDEX idx_schedule_pattern (day_pattern), INDEX idx_schedule_time (start_time, end_time), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE class_assignments ADD CONSTRAINT FK_8E49FEB23EDC87 FOREIGN KEY (subject_id) REFERENCES subjects (id)');
        $this->addSql('ALTER TABLE class_assignments ADD CONSTRAINT FK_8E49FEB680CAB68 FOREIGN KEY (faculty_id) REFERENCES users (id)');
        $this->addSql('ALTER TABLE class_assignments ADD CONSTRAINT FK_8E49FEBAE80F5DF FOREIGN KEY (department_id) REFERENCES departments (id)');
        $this->addSql('ALTER TABLE schedules ADD CONSTRAINT FK_313BDC8E535474C2 FOREIGN KEY (class_assignment_id) REFERENCES class_assignments (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE schedules ADD CONSTRAINT FK_313BDC8E54177093 FOREIGN KEY (room_id) REFERENCES rooms (id)');
        $this->addSql('ALTER TABLE schedules ADD CONSTRAINT FK_313BDC8EDE12AB56 FOREIGN KEY (created_by) REFERENCES users (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE class_assignments DROP FOREIGN KEY FK_8E49FEB23EDC87');
        $this->addSql('ALTER TABLE class_assignments DROP FOREIGN KEY FK_8E49FEB680CAB68');
        $this->addSql('ALTER TABLE class_assignments DROP FOREIGN KEY FK_8E49FEBAE80F5DF');
        $this->addSql('ALTER TABLE schedules DROP FOREIGN KEY FK_313BDC8E535474C2');
        $this->addSql('ALTER TABLE schedules DROP FOREIGN KEY FK_313BDC8E54177093');
        $this->addSql('ALTER TABLE schedules DROP FOREIGN KEY FK_313BDC8EDE12AB56');
        $this->addSql('DROP TABLE class_assignments');
        $this->addSql('DROP TABLE schedules');
    }
}
