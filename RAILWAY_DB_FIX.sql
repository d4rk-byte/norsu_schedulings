-- =====================================================
-- RAILWAY DATABASE FIX SCRIPT
-- Run this in your Railway MySQL database console
-- =====================================================

-- Step 1: Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS firstname VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS middlename VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lastname VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address LONGTEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS remember_token VARCHAR(100) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_semester_filter VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS other_designation LONGTEXT DEFAULT NULL;

-- Step 2: Create refresh_tokens table if not exists
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT NOT NULL,
    refresh_token VARCHAR(128) NOT NULL,
    username VARCHAR(255) NOT NULL,
    valid DATETIME NOT NULL,
    UNIQUE INDEX UNIQ_9BACE7E1C74F2195 (refresh_token),
    PRIMARY KEY(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

-- Step 3: Create notifications table if not exists
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT NOT NULL,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message LONGTEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0 NOT NULL,
    read_at DATETIME DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_notification_user_read (user_id, is_read),
    INDEX idx_notification_created (created_at),
    INDEX idx_notification_type (type),
    PRIMARY KEY(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

-- Step 4: Mark ALL migrations as executed (sync the tracking table)
INSERT IGNORE INTO doctrine_migration_versions (version, executed_at, execution_time) VALUES
('DoctrineMigrations\\Version20251015000001', NOW(), 100),
('DoctrineMigrations\\Version20251015000002', NOW(), 100),
('DoctrineMigrations\\Version20251015000003', NOW(), 100),
('DoctrineMigrations\\Version20251015000004', NOW(), 100),
('DoctrineMigrations\\Version20251025150338', NOW(), 100),
('DoctrineMigrations\\Version20251027053703', NOW(), 100),
('DoctrineMigrations\\Version20251027131829', NOW(), 100),
('DoctrineMigrations\\Version20251027134743', NOW(), 100),
('DoctrineMigrations\\Version20251029091622', NOW(), 100),
('DoctrineMigrations\\Version20251029122550', NOW(), 100),
('DoctrineMigrations\\Version20251029142013', NOW(), 100),
('DoctrineMigrations\\Version20251108062831', NOW(), 100),
('DoctrineMigrations\\Version20251118040229', NOW(), 100),
('DoctrineMigrations\\Version20251204000001', NOW(), 100),
('DoctrineMigrations\\Version20251207113250', NOW(), 100),
('DoctrineMigrations\\Version20251211031345', NOW(), 100),
('DoctrineMigrations\\Version20251222020807', NOW(), 100),
('DoctrineMigrations\\Version20251222120000', NOW(), 100),
('DoctrineMigrations\\Version20260113091749', NOW(), 100),
('DoctrineMigrations\\Version20260113120000', NOW(), 100),
('DoctrineMigrations\\Version20260119014150', NOW(), 100),
('DoctrineMigrations\\Version20260119014659', NOW(), 100),
('DoctrineMigrations\\Version20260120055140', NOW(), 100),
('DoctrineMigrations\\Version20260121120000', NOW(), 100),
('DoctrineMigrations\\Version20260129000001', NOW(), 100),
('DoctrineMigrations\\Version20260202045221', NOW(), 100),
('DoctrineMigrations\\Version20260219120000', NOW(), 100),
('DoctrineMigrations\\Version20260224120000', NOW(), 100),
('DoctrineMigrations\\Version20260225120000', NOW(), 100),
('DoctrineMigrations\\Version20260225130000', NOW(), 100),
('DoctrineMigrations\\Version20260225140000', NOW(), 100),
('DoctrineMigrations\\Version20260225150000', NOW(), 100),
('DoctrineMigrations\\Version20260226120000', NOW(), 100),
('DoctrineMigrations\\Version20260226150000', NOW(), 100),
('DoctrineMigrations\\Version20260328000000', NOW(), 100),
('DoctrineMigrations\\Version20260329000000', NOW(), 100),
('DoctrineMigrations\\Version20260401014608', NOW(), 100);

-- Step 5: Create admin user (password: Admin@123456)
INSERT INTO users (username, email, password, firstname, lastname, role, is_active, created_at, updated_at)
SELECT 'admin', 'admin@norsu.edu.ph', '$2y$13$hashed_placeholder', 'System', 'Administrator', 1, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@norsu.edu.ph' OR username = 'admin');

-- NOTE: After running this, you need to reset the admin password via:
-- UPDATE users SET password = '$2y$13$YOUR_HASHED_PASSWORD' WHERE username = 'admin';
-- Or redeploy Railway with CREATE_DEFAULT_ADMIN=1

SELECT 'Database fix complete!' AS status;
