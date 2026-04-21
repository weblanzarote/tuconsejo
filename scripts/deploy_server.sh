#!/bin/bash
# Server Deploy — Consejo Sinérgico (SQLite + Node) en tuconsejo.app
# Se ejecuta en el servidor vía SSH desde scripts/deploy.ps1

PROJECT_ROOT="/home/tuconsejo.app/public_html"

GIT_REPO_URL_SSH="git@github.com:weblanzarote/tuconsejo.git"
GIT_REPO_URL_HTTPS="https://github.com/weblanzarote/tuconsejo.git"

echo "Cambiando a $PROJECT_ROOT"
cd "$PROJECT_ROOT" || exit 1

if [ ! -f ~/.ssh/config ] || ! grep -q "Host github.com" ~/.ssh/config 2>/dev/null; then
    echo "Configurando SSH para GitHub..."
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
    if [ ! -f ~/.ssh/id_ed25519_github ]; then
        echo "Generando clave SSH para GitHub..."
        ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -N '' -C 'github-deploy-key' 2>/dev/null || true
    fi
    cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  StrictHostKeyChecking no
EOF
    chmod 600 ~/.ssh/config
    echo "Configuracion SSH completada"
fi

if [ ! -d ".git" ]; then
    echo "Repo no encontrado. Inicializando..."
    git init
    git branch -M main 2>/dev/null || true
    git remote add origin "$GIT_REPO_URL_SSH" 2>/dev/null || git remote set-url origin "$GIT_REPO_URL_SSH"

    echo "Intentando obtener codigo desde GitHub (SSH)..."
    git fetch origin main 2>&1 || {
        echo "Fallo con SSH, intentando HTTPS..."
        git remote set-url origin "$GIT_REPO_URL_HTTPS"
        GIT_TERMINAL_PROMPT=0 git fetch origin main 2>&1 | grep -v "Username" | grep -v "Password" | grep -v "Authentication failed" || true
    }

    if git rev-parse --verify origin/main >/dev/null 2>&1; then
        git reset --hard origin/main
        echo "Repositorio inicializado correctamente"
    else
        echo "No se pudo obtener el codigo desde GitHub."
        echo "Verifica que la Deploy Key este configurada en GitHub."
        echo "Continuando con archivos existentes..."
    fi
else
    echo "Haciendo Pull..."
    git remote set-url origin "$GIT_REPO_URL_SSH" 2>/dev/null || true

    echo "Intentando actualizar desde GitHub (SSH)..."
    git fetch origin main 2>&1 || {
        echo "Fallo con SSH, intentando HTTPS..."
        git remote set-url origin "$GIT_REPO_URL_HTTPS"
        GIT_TERMINAL_PROMPT=0 git fetch origin main 2>&1 | grep -v "Username" | grep -v "Password" | grep -v "Authentication failed" || true
    }

    if git rev-parse --verify origin/main >/dev/null 2>&1; then
        git reset --hard origin/main
        echo "Codigo actualizado desde GitHub"
    else
        echo "No se pudo actualizar desde GitHub."
        echo "Verifica que la Deploy Key este configurada en GitHub."
        echo "Continuando con codigo existente."
    fi
fi

echo "Asegurando carpeta data/ (SQLite)..."
mkdir -p data
chmod 755 data

echo "Ajustando permisos (excluyendo node_modules)..."
find . -type d -not -path "./node_modules*" -not -path "./.git*" -exec chmod 755 {} \;
find . -type f -not -path "./node_modules*" -not -path "./.git*" -exec chmod 644 {} \;
chmod +x scripts/*.sh 2>/dev/null || true

chmod +x node_modules/.bin/* 2>/dev/null || true
find node_modules -name "esbuild" -type f -exec chmod +x {} \; 2>/dev/null || true
find node_modules -name "vite" -type f -exec chmod +x {} \; 2>/dev/null || true

echo "Instalando dependencias con pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "pnpm no encontrado. Instalando en el home del usuario (sin root)..."
    if command -v corepack &> /dev/null; then
        corepack enable 2>/dev/null || true
        corepack prepare pnpm@latest --activate 2>/dev/null || true
    fi
    if ! command -v pnpm &> /dev/null; then
        NPM_PREFIX="$HOME/.npm-global"
        mkdir -p "$NPM_PREFIX"
        export npm_config_prefix="$NPM_PREFIX"
        export PATH="$NPM_PREFIX/bin:$PATH"
        npm install -g pnpm 2>/dev/null || true
    fi
fi
export PATH="$HOME/.local/share/pnpm:$HOME/.npm-global/bin:$PATH"
if ! command -v pnpm &> /dev/null; then
    echo "ERROR: No se pudo instalar pnpm. Instalalo manualmente por SSH:"
    echo "  corepack enable && corepack prepare pnpm@latest --activate"
    echo "  o: npm config set prefix ~/.npm-global && npm install -g pnpm"
    exit 1
fi

pnpm install

echo "Recompilando modulos nativos (better-sqlite3) para Linux..."
pnpm rebuild better-sqlite3 2>/dev/null || pnpm rebuild better-sqlite3

echo "Ajustando permisos de ejecutables..."
chmod +x node_modules/.bin/* 2>/dev/null || true

echo "Limpiando PM2 anteriores..."
npx pm2 delete tuconsejo 2>/dev/null || true

echo "Limpiando directorio dist..."
rm -rf dist 2>/dev/null || true

echo "Construyendo aplicacion..."
if [ -f ".env" ]; then
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
            if [[ "$line" =~ = ]]; then
                export "$line" 2>/dev/null || true
            fi
        fi
    done < .env
    set +a
    echo "Variables de entorno cargadas desde .env (build)"
fi

pnpm run build

# El esquema SQLite se crea/actualiza al arrancar (initializeDatabase en server/db.ts).
# No ejecutamos drizzle-kit migrate aqui (carpeta drizzle/*.sql legacy vs SQLite actual).

echo "Iniciando aplicacion con PM2..."
if [ -f ".env" ]; then
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
            if [[ "$line" =~ = ]]; then
                export "$line" 2>/dev/null || true
            fi
        fi
    done < .env
    set +a
    echo "Variables de entorno cargadas desde .env (runtime)"
fi

if [ -f "ecosystem.config.cjs" ]; then
    npx pm2 start ecosystem.config.cjs --update-env
elif [ -f "ecosystem.config.js" ]; then
    npx pm2 start ecosystem.config.js --update-env
else
    npx pm2 start dist/index.js --name "tuconsejo" --update-env
fi

npx pm2 save 2>/dev/null || true

echo "Despliegue en servidor completado."
echo ""
echo "Para ver los logs:"
echo "   ssh -i ~/.ssh/id_ed25519_consejo -p 2222 tucon4257@82.223.161.189"
echo "   cd /home/tuconsejo.app/public_html"
echo "   npx pm2 logs tuconsejo --lines 50"
