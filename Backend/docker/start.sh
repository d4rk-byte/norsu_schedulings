#!/bin/bash
set -e

cd /var/www/html

echo "=== Smart Scheduling System Starting ==="

# Use PORT env variable or default to 80
PORT=${PORT:-80}
RUN_STARTUP_MAINTENANCE=${RUN_STARTUP_MAINTENANCE:-0}
CREATE_DEFAULT_ADMIN=${CREATE_DEFAULT_ADMIN:-0}
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@norsu.edu.ph}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-Admin@123456}
ADMIN_FIRST_NAME=${ADMIN_FIRST_NAME:-System}
ADMIN_LAST_NAME=${ADMIN_LAST_NAME:-Administrator}
GENERATE_JWT_KEYS_IF_MISSING=${GENERATE_JWT_KEYS_IF_MISSING:-0}

resolve_jwt_path() {
    local raw_path="$1"
    if [ -z "${raw_path}" ]; then
        echo ""
        return
    fi

    # Convert Symfony placeholder paths to container absolute paths.
    echo "${raw_path//%kernel.project_dir%/\/var\/www\/html}"
}

JWT_SECRET_KEY_PATH=$(resolve_jwt_path "${JWT_SECRET_KEY:-%kernel.project_dir%/config/jwt/private.pem}")
JWT_PUBLIC_KEY_PATH=$(resolve_jwt_path "${JWT_PUBLIC_KEY:-%kernel.project_dir%/config/jwt/public.pem}")

echo "Port: ${PORT}"
echo "RUN_STARTUP_MAINTENANCE: ${RUN_STARTUP_MAINTENANCE}"
echo "CREATE_DEFAULT_ADMIN: ${CREATE_DEFAULT_ADMIN}"
echo "GENERATE_JWT_KEYS_IF_MISSING: ${GENERATE_JWT_KEYS_IF_MISSING}"

create_admin_user() {
    echo "Creating/updating admin user..."
    php bin/console app:create-admin "${ADMIN_USERNAME}" "${ADMIN_EMAIL}" "${ADMIN_PASSWORD}" --first-name="${ADMIN_FIRST_NAME}" --last-name="${ADMIN_LAST_NAME}" --no-interaction 2>&1 || echo "Admin user provisioning failed, skipping..."
}

ensure_jwt_material() {
    if [ ! -f "${JWT_SECRET_KEY_PATH}" ] || [ ! -f "${JWT_PUBLIC_KEY_PATH}" ]; then
        if [ "${GENERATE_JWT_KEYS_IF_MISSING}" = "1" ]; then
            echo "JWT key files are missing. Attempting to generate keypair..."
            mkdir -p /var/www/html/config/jwt
            php bin/console lexik:jwt:generate-keypair --skip-if-exists --no-interaction 2>&1 || true
        fi
    fi

    if [ -f "${JWT_SECRET_KEY_PATH}" ]; then
        chown www-data:www-data "${JWT_SECRET_KEY_PATH}" 2>/dev/null || true
        chmod 600 "${JWT_SECRET_KEY_PATH}" 2>/dev/null || true
    fi

    if [ -f "${JWT_PUBLIC_KEY_PATH}" ]; then
        chown www-data:www-data "${JWT_PUBLIC_KEY_PATH}" 2>/dev/null || true
        chmod 644 "${JWT_PUBLIC_KEY_PATH}" 2>/dev/null || true
    fi

    if [ ! -f "${JWT_SECRET_KEY_PATH}" ] || [ ! -f "${JWT_PUBLIC_KEY_PATH}" ]; then
        echo "WARNING: JWT key files were not found at configured paths."
        echo "JWT_SECRET_KEY_PATH: ${JWT_SECRET_KEY_PATH}"
        echo "JWT_PUBLIC_KEY_PATH: ${JWT_PUBLIC_KEY_PATH}"
        return
    fi

    if [ -z "${JWT_PASSPHRASE}" ]; then
        echo "WARNING: JWT_PASSPHRASE is empty; JWT token signing may fail."
        return
    fi

    if php -r '$path=$argv[1]; $pass=getenv("JWT_PASSPHRASE") ?: ""; $key=@openssl_pkey_get_private(@file_get_contents($path), $pass); exit($key ? 0 : 1);' "${JWT_SECRET_KEY_PATH}"; then
        echo "JWT private key check: OK"
    else
        echo "WARNING: JWT private key check failed. Verify JWT_PASSPHRASE and key files."
    fi
}

# Generate nginx config with correct port
cat > /etc/nginx/sites-available/default << EOF
server {
    listen ${PORT};
    server_name localhost;
    root /var/www/html/public;

    index index.php;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    location / {
        try_files \$uri /index.php\$is_args\$args;
    }

    location ~ ^/index\.php(/|\$) {
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_split_path_info ^(.+\.php)(/.*)$;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT \$realpath_root;
        fastcgi_read_timeout 60s;
        fastcgi_buffer_size 128k;
        fastcgi_buffers 4 256k;
        fastcgi_busy_buffers_size 256k;
        internal;
    }

    location ~ \.php$ {
        return 404;
    }

    # Cache static assets
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Deny access to sensitive files
    location ~ /(\.env|composer\.|config|src|var|vendor|migrations|tests) {
        deny all;
        return 404;
    }

    # Increase upload size
    client_max_body_size 50M;

    error_log /var/log/nginx/error.log;
    access_log /var/log/nginx/access.log;
}
EOF

# Ensure symlink exists
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Create required directories
mkdir -p /var/www/html/var/cache /var/www/html/var/log /var/www/html/var/sessions/prod
chown -R www-data:www-data /var/www/html/var
chmod -R 777 /var/www/html/var

ensure_jwt_material

# Optional maintenance work (can delay startup and healthchecks on PaaS).
if [ "${RUN_STARTUP_MAINTENANCE}" = "1" ]; then
    echo "Running optional startup maintenance tasks..."

    echo "Installing importmap assets..."
    php bin/console importmap:install --no-interaction 2>&1 || true

    echo "Warming up cache..."
    php bin/console cache:clear --no-interaction 2>&1 || true
    php bin/console cache:warmup --no-interaction 2>&1 || true
    chown -R www-data:www-data /var/www/html/var
    chmod -R 777 /var/www/html/var

    echo "Running database schema update..."
    php bin/console doctrine:schema:update --force --no-interaction 2>&1 || true
    php bin/console doctrine:migrations:sync-metadata-storage --no-interaction 2>&1 || true
    php bin/console doctrine:migrations:version --add --all --no-interaction 2>&1 || true

    create_admin_user
else
    echo "Skipping startup maintenance tasks. Set RUN_STARTUP_MAINTENANCE=1 to enable."
fi

# Optionally create/update admin account without running full startup maintenance.
if [ "${CREATE_DEFAULT_ADMIN}" = "1" ] && [ "${RUN_STARTUP_MAINTENANCE}" != "1" ]; then
    create_admin_user
fi

echo "Starting PHP-FPM and Nginx via Supervisor..."

# Start supervisor (manages both PHP-FPM and Nginx)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
