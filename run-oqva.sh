#!/bin/bash
# run-oqva.sh — Deploy the OQVA Plane fork from local code.
# Use: -f docker-compose.yml -f docker-compose.oqva.yml, always --env-file .env
# Run from repo root. No download from the internet.

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
COMPOSE_FILES="-f $SCRIPT_DIR/docker-compose.yml -f $SCRIPT_DIR/docker-compose.oqva.yml"
DOCKER_ENV_PATH="$SCRIPT_DIR/.env"
OS_NAME=$(uname)

if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

# ----

function getEnvValue() {
    local key=$1
    local file=$2
    local val
    if [ -z "$key" ] || [ -z "$file" ]; then
        echo "Invalid arguments supplied"
        exit 1
    fi
    if [ -f "$file" ]; then
        if grep -q "^$key=" "$file"; then
            val=$(grep "^$key=" "$file" | cut -d'=' -f2-)
            # strip surrounding double or single quotes (e.g. "plane" or 'plane')
            val=$(echo "$val" | sed 's/^["'"'"']//; s/["'"'"']$//')
            echo "$val"
        else
            echo ""
        fi
    fi
}

function updateEnvFile() {
    local key=$1
    local value=$2
    local file=$3
    if [ -z "$key" ] || [ -z "$value" ] || [ -z "$file" ]; then
        echo "Invalid arguments supplied"
        exit 1
    fi
    if [ ! -f "$file" ]; then
        echo "File not found: $file"
        exit 1
    fi
    if grep -q "^$key=" "$file"; then
        if [ "$OS_NAME" = "Darwin" ]; then
            value=$(echo "$value" | sed 's/|/\\|/g')
            sed -i '' "s|^$key=.*|$key=$value|g" "$file"
        else
            value=$(echo "$value" | sed 's/\//\\\//g')
            sed -i "s/^$key=.*/$key=$value/g" "$file"
        fi
    else
        echo "$key=$value" >> "$file"
    fi
}

function print_header() {
    clear
    echo "--------------------------------------------"
    echo "  Plane OQVA — run from local code"
    echo "  -f docker-compose.yml -f docker-compose.oqva.yml"
    echo "--------------------------------------------"
}

# Copy .env.example to .env only when .env is missing (like setup.sh; we skip if .env exists to avoid overwriting WEB_URL, TUNNEL_TOKEN, etc.)
function copy_env_if_missing() {
    local src=$1
    local dest=$2
    if [ -f "$dest" ]; then
        return 0
    fi
    if [ ! -f "$src" ]; then
        echo "Error: $src not found"
        return 1
    fi
    cp "$src" "$dest"
    echo "Created $dest from $src"
    return 0
}

# --- Install: copy .env from .env.example for root, web, api, space, admin, live (like setup.sh); SECRET_KEY; then build
function install_oqva() {
    echo "Install: prepare env and build images from local code."
    echo ""

    # Root .env: .env.example if exists, else deployments/cli/community/variables.env
    if [ ! -f "$DOCKER_ENV_PATH" ]; then
        if [ -f "$SCRIPT_DIR/.env.example" ]; then
            cp "$SCRIPT_DIR/.env.example" "$DOCKER_ENV_PATH"
            echo "Created .env from .env.example"
        elif [ -f "$SCRIPT_DIR/deployments/cli/community/variables.env" ]; then
            cp "$SCRIPT_DIR/deployments/cli/community/variables.env" "$DOCKER_ENV_PATH"
            echo "Created .env from deployments/cli/community/variables.env"
        else
            echo "Error: .env not found; need .env.example or deployments/cli/community/variables.env"
            exit 1
        fi
    fi

    # apps: web, api, space, admin, live — same list as setup.sh
    for svc in web api space admin live; do
        copy_env_if_missing "$SCRIPT_DIR/apps/$svc/.env.example" "$SCRIPT_DIR/apps/$svc/.env" || exit 1
    done

    # SECRET_KEY for apps/api/.env (required by API)
    if [ -f "$SCRIPT_DIR/apps/api/.env" ]; then
        local sec
        sec=$(getEnvValue "SECRET_KEY" "$SCRIPT_DIR/apps/api/.env")
        if [ -z "$sec" ]; then
            updateEnvFile "SECRET_KEY" "$(openssl rand -hex 32)" "$SCRIPT_DIR/apps/api/.env"
            echo "Generated SECRET_KEY in apps/api/.env"
        fi
    fi

    cd "$SCRIPT_DIR" || exit 1
    /bin/bash -c "$COMPOSE_CMD $COMPOSE_FILES --env-file=$DOCKER_ENV_PATH build"
    if [ $? -ne 0 ]; then
        echo "Build failed. Exiting."
        exit 1
    fi
    echo ""
    echo "Install done. Run: ./run-oqva.sh start"
    echo ""
}

# --- Start: enable tunnel profile if TUNNEL_TOKEN set; up -d; wait migrator and API
function startServices() {
    local tok
    tok=$(getEnvValue "TUNNEL_TOKEN" "$DOCKER_ENV_PATH")
    if [ -n "$tok" ]; then
        export COMPOSE_PROFILES=tunnel
    fi

    cd "$SCRIPT_DIR" || exit 1
    /bin/bash -c "$COMPOSE_CMD $COMPOSE_FILES --env-file=$DOCKER_ENV_PATH up -d"

    local migrator_container_id
    migrator_container_id=$(docker container ls -aq -f "name=plane-migrator" 2>/dev/null | head -1)
    if [ -n "$migrator_container_id" ]; then
        local idx=0
        while docker inspect --format='{{.State.Status}}' "$migrator_container_id" 2>/dev/null | grep -q "running"; do
            printf "\r>> Waiting for Data Migration to finish %*s" $idx "." 
            ((idx++)) || true
            sleep 1
        done
        echo ""
        echo "   Data Migration completed successfully"

        local migrator_exit_code
        migrator_exit_code=$(docker inspect --format='{{.State.ExitCode}}' "$migrator_container_id" 2>/dev/null)
        if [ -n "$migrator_exit_code" ] && [ "$migrator_exit_code" -ne 0 ]; then
            echo "Plane Server failed to start (migrator exit code $migrator_exit_code)."
            echo "Check logs: ./run-oqva.sh logs migrator"
            exit 1
        fi
    fi

    local api_container_id
    api_container_id=$(/bin/bash -c "$COMPOSE_CMD $COMPOSE_FILES --env-file=$DOCKER_ENV_PATH ps -q api" 2>/dev/null)
    if [ -z "$api_container_id" ]; then
        api_container_id=$(docker container ls -q -f "name=^api$" 2>/dev/null | head -1)
    fi
    if [ -z "$api_container_id" ]; then
        echo "   Error: API container not found. Check if services are running."
        exit 1
    fi

    local api_ready=true
    local max_wait=300
    local start_ts
    start_ts=$(date +%s)
    echo "   Waiting for API Service to be ready..."
    while ! docker exec "$api_container_id" python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/', timeout=3)" 2>/dev/null; do
        local now
        now=$(date +%s)
        if [ $((now - start_ts)) -gt $max_wait ]; then
            if docker ps --format '{{.Names}}' | grep -q '^api$'; then
                api_ready=false
                break
            else
                echo "   API container is not running. Check logs."
                exit 1
            fi
        fi
        printf "\r>> Waiting for API (%ds)   " $((now - start_ts))
        sleep 1
    done
    echo ""
    if [ "$api_ready" = true ]; then
        echo "   API Service started successfully"
    else
        echo "   API did not pass health-check in time. Verify manually."
    fi

    # shellcheck disable=SC1090
    [ -f "$DOCKER_ENV_PATH" ] && . "$DOCKER_ENV_PATH"
    echo "   Plane Server started successfully"
    echo ""
    echo "   You can access the application at ${WEB_URL:-http://localhost}"
    echo ""
}

function stopServices() {
    local tok
    tok=$(getEnvValue "TUNNEL_TOKEN" "$DOCKER_ENV_PATH")
    if [ -n "$tok" ]; then
        export COMPOSE_PROFILES=tunnel
    fi
    cd "$SCRIPT_DIR" || exit 1
    /bin/bash -c "$COMPOSE_CMD $COMPOSE_FILES --env-file=$DOCKER_ENV_PATH down"
}

function restartServices() {
    stopServices
    startServices
}

# --- Upgrade: git pull, build --no-cache, start
function upgrade_oqva() {
    echo "Upgrade: git pull, rebuild, start."
    echo ""
    cd "$SCRIPT_DIR" || exit 1
    git pull || { echo "git pull failed."; exit 1; }
    echo ""
    /bin/bash -c "$COMPOSE_CMD $COMPOSE_FILES --env-file=$DOCKER_ENV_PATH build --no-cache" || exit 1
    echo ""
    startServices
}

function viewSpecificLogs() {
    local svc=$1
    cd "$SCRIPT_DIR" || return 1
    if /bin/bash -c "$COMPOSE_CMD $COMPOSE_FILES --env-file=$DOCKER_ENV_PATH ps" 2>/dev/null | grep -q "$svc"; then
        echo "Service '$svc' is running."
    else
        echo "Service '$svc' is not running."
    fi
    /bin/bash -c "$COMPOSE_CMD $COMPOSE_FILES --env-file=$DOCKER_ENV_PATH logs -f $svc"
}

function viewLogs() {
    local arg=$2
    if [ -n "$arg" ]; then
        arg=$(echo "$arg" | tr '[:upper:]' '[:lower:]')
        case $arg in
            web)   viewSpecificLogs "web";;
            space) viewSpecificLogs "space";;
            api)   viewSpecificLogs "api";;
            worker) viewSpecificLogs "worker";;
            beat-worker) viewSpecificLogs "beat-worker";;
            migrator) viewSpecificLogs "migrator";;
            proxy) viewSpecificLogs "proxy";;
            live)  viewSpecificLogs "live";;
            redis) viewSpecificLogs "plane-redis";;
            postgres) viewSpecificLogs "plane-db";;
            minio) viewSpecificLogs "plane-minio";;
            rabbitmq) viewSpecificLogs "plane-mq";;
            tunnel) viewSpecificLogs "tunnel";;
            *)     echo "Unknown service: $arg";;
        esac
        return
    fi

    echo ""
    echo "Select a service for logs:"
    echo "   1) Web    2) Space   3) API    4) Worker  5) Beat-Worker"
    echo "   6) Migrator  7) Proxy  8) Live  9) Redis  10) Postgres"
    echo "  11) Minio  12) RabbitMQ  13) Tunnel  0) Back"
    echo ""
    read -p "Service [0]: " ch
    ch=${ch:-0}
    case $ch in
        1)  viewSpecificLogs "web";;
        2)  viewSpecificLogs "space";;
        3)  viewSpecificLogs "api";;
        4)  viewSpecificLogs "worker";;
        5)  viewSpecificLogs "beat-worker";;
        6)  viewSpecificLogs "migrator";;
        7)  viewSpecificLogs "proxy";;
        8)  viewSpecificLogs "live";;
        9)  viewSpecificLogs "plane-redis";;
        10) viewSpecificLogs "plane-db";;
        11) viewSpecificLogs "plane-minio";;
        12) viewSpecificLogs "plane-mq";;
        13) viewSpecificLogs "tunnel";;
        0)  ;;
        *)  echo "Invalid."
    esac
}

function backup_container_dir() {
    local backup_dir=$1
    local container_name=$2
    local data_path=$3
    local tar_name=$4

    echo "Backing up $container_name..."
    local cid
    cid=$(/bin/bash -c "$COMPOSE_CMD $COMPOSE_FILES --env-file=$DOCKER_ENV_PATH ps -q $container_name" 2>/dev/null)
    if [ -z "$cid" ]; then
        echo "Error: container $container_name not found. Is it running?"
        return 1
    fi

    mkdir -p "$backup_dir/$tar_name"
    if ! docker cp -q "$cid:$data_path/." "$backup_dir/$tar_name/"; then
        echo "Error: failed to copy from $container_name"
        rm -rf "$backup_dir/$tar_name"
        return 1
    fi

    ( cd "$backup_dir" && tar -czf "${tar_name}.tar.gz" "$tar_name/" && rm -rf "$tar_name" )
    if [ $? -ne 0 ]; then
        echo "Error: failed to create ${tar_name}.tar.gz"
        return 1
    fi
    echo "Backed up $tar_name"
}

# PostgreSQL logical backup (pg_dump). Restore with: gunzip -c plane_db.dump.gz | docker exec -i plane-db pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists
function backup_db_pg_dump() {
    local backup_dir=$1
    local pu pdb ppw cid
    pu=$(getEnvValue "POSTGRES_USER" "$DOCKER_ENV_PATH")
    pdb=$(getEnvValue "POSTGRES_DB" "$DOCKER_ENV_PATH")
    ppw=$(getEnvValue "POSTGRES_PASSWORD" "$DOCKER_ENV_PATH")
    if [ -z "$pu" ] || [ -z "$pdb" ]; then
        echo "Error: POSTGRES_USER and POSTGRES_DB must be set in .env"
        return 1
    fi
    cid=$(/bin/bash -c "$COMPOSE_CMD $COMPOSE_FILES --env-file=$DOCKER_ENV_PATH ps -q plane-db" 2>/dev/null)
    if [ -z "$cid" ]; then
        cid=$(docker ps -q -f "name=^plane-db$" 2>/dev/null | head -1)
    fi
    if [ -z "$cid" ]; then
        echo "Error: plane-db container not found. Is it running?"
        return 1
    fi
    echo "Backing up database (pg_dump)..."
    if ! docker exec -e PGPASSWORD="$ppw" "$cid" pg_dump -U "$pu" -d "$pdb" -F c -f /tmp/plane_db.dump; then
        echo "Error: pg_dump failed. Check: POSTGRES_USER, POSTGRES_DB, POSTGRES_PASSWORD in .env (root); plane-db running. Run manually to see the exact error:"
        echo "  docker exec -e PGPASSWORD='...' plane-db pg_dump -U $pu -d $pdb -F c -f /tmp/plane_db.dump"
        return 1
    fi
    if ! docker cp "$cid:/tmp/plane_db.dump" "$backup_dir/plane_db.dump"; then
        docker exec "$cid" rm -f /tmp/plane_db.dump 2>/dev/null
        echo "Error: failed to copy dump from container"
        return 1
    fi
    docker exec "$cid" rm -f /tmp/plane_db.dump 2>/dev/null
    gzip -f "$backup_dir/plane_db.dump" && echo "Backed up plane_db.dump.gz"
}

function backupDbOnly() {
    local dt
    dt=$(date +"%Y%m%d-%H%M")
    local backup_dir="$SCRIPT_DIR/backup/$dt"
    mkdir -p "$backup_dir"
    cd "$SCRIPT_DIR" || exit 1
    if [ ! -f "$SCRIPT_DIR/docker-compose.yml" ] || [ ! -f "$SCRIPT_DIR/docker-compose.oqva.yml" ]; then
        echo "Error: docker-compose files not found."
        exit 1
    fi
    backup_db_pg_dump "$backup_dir" || exit 1
    echo ""
    echo "Backup done: $backup_dir/plane_db.dump.gz"
    echo ""
}

function backupData() {
    local dt
    dt=$(date +"%Y%m%d-%H%M")
    local backup_dir="$SCRIPT_DIR/backup/$dt"
    mkdir -p "$backup_dir"
    cd "$SCRIPT_DIR" || exit 1

    if [ ! -f "$SCRIPT_DIR/docker-compose.yml" ] || [ ! -f "$SCRIPT_DIR/docker-compose.oqva.yml" ]; then
        echo "Error: docker-compose files not found."
        exit 1
    fi

    backup_db_pg_dump "$backup_dir" || exit 1
    backup_container_dir "$backup_dir" "plane-minio" "/export"                   "uploads"     || exit 1
    backup_container_dir "$backup_dir" "plane-mq"    "/var/lib/rabbitmq"         "rabbitmq_data" || exit 1
    backup_container_dir "$backup_dir" "plane-redis" "/data"                     "redisdata"   || exit 1

    echo ""
    echo "Backup done: $backup_dir"
    echo ""
}

function askForAction() {
    local default=$1
    local action=""

    if [ -n "$default" ]; then
        action=$default
    else
        echo ""
        echo "Actions: 1) Install  2) Start  3) Stop  4) Restart  5) Upgrade  6) Logs  7) Backup  8) Backup DB  9) Exit"
        read -p "Choice [2]: " action
        action=${action:-2}
    fi

    case $action in
        1|install)     install_oqva;;
        2|start)       startServices;;
        3|stop)        stopServices;;
        4|restart)     restartServices;;
        5|upgrade)     upgrade_oqva;;
        6|logs)        viewLogs "$@"; [ -z "$default" ] && askForAction;;
        7|backup)      backupData;;
        8|backup-db)   backupDbOnly;;
        9|exit)        exit 0;;
        *)             echo "Invalid action."
    esac
}

# ---
if [ ! -f "$DOCKER_ENV_PATH" ] && [ "$1" != "install" ] && [ "$1" != "1" ]; then
    echo "No .env found. Run: ./run-oqva.sh install"
    exit 1
fi

print_header
askForAction "$@"
