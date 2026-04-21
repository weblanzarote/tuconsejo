#!/bin/bash
# ============================================================
# CONSEJO SINÉRGICO — Script de Instalación Automática
# ============================================================
# Uso: bash setup.sh
# ============================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}🔮 Consejo Sinérgico — Instalación automática${NC}"
echo "=============================================="
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js no está instalado.${NC}"
    echo "  Descárgalo desde: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js debe ser versión 18 o superior. Tienes: $(node --version)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Verificar pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠ pnpm no encontrado. Instalando...${NC}"
    npm install -g pnpm
fi
echo -e "${GREEN}✓ pnpm $(pnpm --version)${NC}"

# Instalar dependencias
echo ""
echo -e "${CYAN}→ Instalando dependencias...${NC}"
pnpm install

# Verificar archivo .env
echo ""
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ Archivo .env no encontrado.${NC}"
    echo ""
    echo "Necesitas crear un archivo .env con el siguiente contenido:"
    echo ""
    echo "  OPENAI_API_KEY=sk-proj-TU_API_KEY_AQUI"
    echo "  OPENAI_MODEL=gpt-4o-mini"
    echo "  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
    echo "  PORT=3000"
    echo "  NODE_ENV=production"
    echo ""
    echo -e "${YELLOW}Crea el archivo .env con esos valores y luego ejecuta: pnpm build && pnpm start${NC}"
else
    echo -e "${GREEN}✓ Archivo .env encontrado${NC}"

    # Verificar OPENAI_API_KEY
    if ! grep -q "OPENAI_API_KEY=sk-" .env; then
        echo -e "${YELLOW}⚠ OPENAI_API_KEY no parece estar configurada correctamente en .env${NC}"
    else
        echo -e "${GREEN}✓ OPENAI_API_KEY configurada${NC}"
    fi

    # Compilar
    echo ""
    echo -e "${CYAN}→ Compilando la aplicación...${NC}"
    pnpm build

    echo ""
    echo -e "${GREEN}✅ ¡Instalación completada!${NC}"
    echo ""
    echo "Para iniciar la aplicación ejecuta:"
    echo ""
    echo -e "  ${CYAN}pnpm start${NC}"
    echo ""
    echo "Luego abre tu navegador en: http://localhost:3000"
    echo ""
fi
