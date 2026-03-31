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

# Always define JWT paths
JWT_SECRET_KEY_PATH="/var/www/html/config/jwt/private.pem"
JWT_PUBLIC_KEY_PATH="/var/www/html/config/jwt/public.pem"
export JWT_SECRET_KEY_PATH
export JWT_PUBLIC_KEY_PATH

# Save original key contents BEFORE they get overwritten
JWT_SECRET_KEY_CONTENT="${JWT_SECRET_KEY}"
JWT_PUBLIC_KEY_CONTENT="${JWT_PUBLIC_KEY}"

echo "Port: ${PORT}"
echo "RUN_STARTUP_MAINTENANCE: ${RUN_STARTUP_MAINTENANCE}"
echo "CREATE_DEFAULT_ADMIN: ${CREATE_DEFAULT_ADMIN}"
echo "GENERATE_JWT_KEYS_IF_MISSING: ${GENERATE_JWT_KEYS_IF_MISSING}"

create_admin_user() {
    echo "Creating default admin user..."
    php bin/console app:create-admin \
        "${ADMIN_USERNAME}" \
        "${ADMIN_EMAIL}" \
        "${ADMIN_PASSWORD}" \
        --first-name="${ADMIN_FIRST_NAME}" \
        --last-name="${ADMIN_LAST_NAME}" \
        --no-interaction 2>&1 || true
    echo "Admin user creation complete."
}

resolve_jwt_path() {
    local raw_path="$1"
    if [ -z "${raw_path}" ]; then
        echo ""
        return
    fi
    echo "${raw_path//%kernel.project_dir%/\/var\/www\/html}"
}

ensure_jwt_material() {
    mkdir -p /var/www/html/config/jwt

    # If JWT_SECRET_KEY contains actual key content write it to file
    if echo "${JWT_SECRET_KEY_CONTENT}" | grep -q "BEGIN"; then
        printf '%s\n' "${JWT_SECRET_KEY_CONTENT}" > /var/www/html/config/jwt/private.pem
        echo "JWT private key written from environment variable."
    else
        echo "JWT_SECRET_KEY does not contain key content, skipping write."
    fi

    # If JWT_PUBLIC_KEY contains actual key content write it to file
    if echo "${JWT_PUBLIC_KEY_CONTENT}" | grep -q "BEGIN"; then
        printf '%s\n' "${JWT_PUBLIC_KEY_CONTENT}" > /var/www/html/config/jwt/public.pem
        echo "JWT public key written from environment variable."
    else
        echo "JWT_PUBLIC_KEY does not contain key content, skipping write."
    fi

    # Generate JWT keys if missing and flag is set
    if [ "${GENERATE_JWT_KEYS_IF_MISSING}" = "1" ]; then
        if [ ! -f "${JWT_SECRET_KEY_PATH}" ] || [ ! -f "${JWT_PUBLIC_KEY_PATH}" ]; then
            echo "Generating JWT keypair..."
            php bin/console lexik:jwt:generate-keypair --overwrite --no-interaction 2>&1 || true
        fi
    fi

    # Set correct permissions on JWT keys
    if [ -f "${JWT_SECRET_KEY_PATH}" ]; then
        chown www-data:www-data "${JWT_SECRET_KEY_PATH}" 2>/dev/null || true
        chmod 600 "${JWT_SECRET_KEY_PATH}" 2>/dev/null || true
        echo "JWT private key permissions set."
    else
        echo "WARNING: JWT private key not found at ${JWT_SECRET_KEY_PATH}"
    fi

    if [ -f "${JWT_PUBLIC_KEY_PATH}" ]; then
        chown www-data:www-data "${JWT_PUBLIC_KEY_PATH}" 2>/dev/null || true
        chmod 644 "${JWT_PUBLIC_KEY_PATH}" 2>/dev/null || true
        echo "JWT public key permissions set."
    else
        echo "WARNING: JWT public key not found at ${JWT_PUBLIC_KEY_PATH}"
    fi

    if [ -f "${JWT_SECRET_KEY_PATH}" ] && [ -f "${JWT_PUBLIC_KEY_PATH}" ]; then
        echo "JWT key check: OK"
    else
        echo "WARNING: JWT key files were not found at configured paths."
        echo "JWT_SECRET_KEY_PATH: ${JWT_SECRET_KEY_PATH}"
        echo "JWT_PUBLIC_KEY_PATH: ${JWT_PUBLIC_KEY_PATH}"
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

# Create required directories and fix permissions
mkdir -p /var/www/html/var/cache/prod \
         /var/www/html/var/cache/dev \
         /var/www/html/var/log \
         /var/www/html/var/sessions/prod \
         /var/www/html/var/sessions/dev
chown -R www-data:www-data /var/www/html/var
chmod -R 777 /var/www/html/var

# Ensure JWT keys are in place
ensure_jwt_material

# Override JWT env vars to use file paths for Symfony
export JWT_SECRET_KEY="${JWT_SECRET_KEY_PATH}"
export JWT_PUBLIC_KEY="${JWT_PUBLIC_KEY_PATH}"

# Optional maintenance work
if [ "${RUN_STARTUP_MAINTENANCE}" = "1" ]; then
    echo "Running optional startup maintenance tasks..."

    echo "Installing importmap assets..."
    php bin/console importmap:install --no-interaction 2>&1 || true

    echo "Warming up cache..."
    php bin/console cache:clear --no-interaction 2>&1 || true
    php bin/console cache:warmup --no-interaction 2>&1 || true
    chown -R www-data:www-data /var/www/html/var
    chmod -R 777 /var/www/html/var

    echo "Running database migrations..."
    php bin/console doctrine:migrations:migrate --no-interaction 2>&1 || true

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