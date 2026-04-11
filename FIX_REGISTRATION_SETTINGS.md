# Fix for User Registration Settings 500 Error

## Problem
When toggling the "Auto-activate newly registered faculty" setting in the admin settings page (production environment), the application returns a **500 Internal Server Error**.

## Root Cause
The `app_settings` database table is **missing** from the production database. The backend code in `SystemSettingsService.php` attempts to insert/query this table when updating the auto-activation setting, but the table doesn't exist, causing a SQL error.

### Affected Code Locations:
1. **Backend**: `Backend/src/Service/SystemSettingsService.php` (lines 236-246)
   - Method: `setAutoActivateNewUsersEnabled(bool $enabled)`
   - Executes SQL: `INSERT INTO app_settings ... ON DUPLICATE KEY UPDATE ...`

2. **Frontend**: `Frontend/src/app/admin/settings/page.tsx` (line 51)
   - Calls: `settingsApi.update({ auto_activate_new_users: enabled })`

3. **API Controller**: `Backend/src/Controller/Api/ApiAdminController.php` (line 4458)
   - Calls: `$this->systemSettingsService->setAutoActivateNewUsersEnabled($enabled)`

## Solution

### Files Created/Modified:

1. **NEW Migration File**: `Backend/migrations/Version20260402000000.php`
   - Creates the `app_settings` table with proper schema
   - Inserts default value for `auto_activate_new_users` setting (default: `0` / OFF)

2. **Updated**: `RAILWAY_DB_FIX.sql`
   - Added Step 4: Creates `app_settings` table
   - Added default setting value
   - Updated migration version tracking to include the new migration

## Deployment Instructions

### For Local Development:
```bash
# Navigate to Backend directory
cd Backend

# Run the migration
php bin/console doctrine:migrations:migrate --no-interaction

# Verify the table was created
php bin/console dbal:run-sql "SHOW TABLES LIKE 'app_settings'"
```

### For Railway/Production:

#### Option 1: Run the Updated SQL Fix Script (Recommended)
1. Open your Railway MySQL database console
2. Copy and paste the **entire content** of `RAILWAY_DB_FIX.sql`
3. Execute the script
4. Verify with: `SELECT * FROM app_settings;`

#### Option 2: Run Only the New Table Creation
If you've already run the previous fix script, you can run just the new parts:

```sql
-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id INT AUTO_INCREMENT NOT NULL,
    setting_key VARCHAR(255) NOT NULL,
    setting_value LONGTEXT DEFAULT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE INDEX UNIQ_APP_SETTINGS_KEY (setting_key),
    PRIMARY KEY(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

-- Insert default value
INSERT IGNORE INTO app_settings (setting_key, setting_value, created_at, updated_at)
VALUES ('auto_activate_new_users', '0', NOW(), NOW());

-- Mark migration as executed
INSERT IGNORE INTO doctrine_migration_versions (version, executed_at, execution_time) 
VALUES ('DoctrineMigrations\\Version20260402000000', NOW(), 100);
```

## Testing After Fix

1. **Login to Admin Panel** in your production environment
2. **Navigate to Settings** (`/admin/settings`)
3. **Toggle the "Auto-activate newly registered faculty" switch**
4. **Verify**:
   - No 500 error appears
   - Success message: "Auto-activation for newly registered users is now ON/OFF"
   - The toggle state persists after page refresh

5. **Test Registration** (if needed):
   - Create a new user account via registration
   - With setting ON: User should be active immediately
   - With setting OFF: User should be inactive (requires manual admin activation)

## Table Schema

The `app_settings` table structure:
```sql
app_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value LONGTEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
)
```

**Current Setting:**
- `setting_key`: `'auto_activate_new_users'`
- `setting_value`: `'0'` (OFF) or `'1'` (ON)

## Additional Notes

- The setting defaults to **OFF** (`'0'`), meaning new users require manual activation
- The backend uses `ON DUPLICATE KEY UPDATE` to safely update settings
- Frontend normalizes boolean values to handle various formats (boolean, int, string)
- The fix is backward-compatible and won't affect existing functionality

## Rollback (if needed)

If you need to rollback the migration:
```bash
# Local
php bin/console doctrine:migrations:migrate prev

# Production (manual SQL)
DROP TABLE IF EXISTS app_settings;
DELETE FROM doctrine_migration_versions WHERE version = 'DoctrineMigrations\\Version20260402000000';
```
