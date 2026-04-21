# Check Server Status — tuconsejo.app
$SERVER_USER = "tucon4257"
$SERVER_HOST = "82.223.161.189"
$SERVER_PORT = "2222"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519_consejo"
$SERVER_PATH = "/home/tuconsejo.app/public_html"

if (-not (Test-Path $SSH_KEY)) {
    Write-Host "No se encontro la clave SSH: $SSH_KEY" -ForegroundColor Red
    exit 1
}

$SSH_ARGS = @("-i", $SSH_KEY, "-p", $SERVER_PORT, "-o", "StrictHostKeyChecking=no")

Write-Host "Verificando estado del servidor..." -ForegroundColor Cyan
Write-Host ""

Write-Host "Estado de PM2:" -ForegroundColor Yellow
& ssh @SSH_ARGS "${SERVER_USER}@${SERVER_HOST}" "cd $SERVER_PATH && npx pm2 list"

Write-Host ""
Write-Host "Ultimos logs de la aplicacion (50 lineas):" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Gray
& ssh @SSH_ARGS "${SERVER_USER}@${SERVER_HOST}" "cd $SERVER_PATH && npx pm2 logs tuconsejo --lines 50 --nostream"
Write-Host "===============================================" -ForegroundColor Gray

Write-Host ""
Write-Host "Verificando si la aplicacion esta escuchando en el puerto..." -ForegroundColor Yellow
& ssh @SSH_ARGS "${SERVER_USER}@${SERVER_HOST}" "netstat -tlnp 2>/dev/null | grep :3000 || ss -tlnp 2>/dev/null | grep :3000 || echo 'No se encontro proceso en puerto 3000'"

Write-Host ""
Write-Host "Variables relevantes en .env (sin valores):" -ForegroundColor Yellow
& ssh @SSH_ARGS "${SERVER_USER}@${SERVER_HOST}" "cd $SERVER_PATH && (test -f .env && grep -E '^(PORT|DATABASE_PATH|OPENAI_API_KEY|JWT_SECRET|GOOGLE_REDIRECT_URI|MICROSOFT_REDIRECT_URI)=' .env 2>/dev/null | sed 's/=.*/=***/' || echo 'No se pudo leer .env')"

Write-Host ""
Write-Host "SQLite (data/consejo.db):" -ForegroundColor Yellow
& ssh @SSH_ARGS "${SERVER_USER}@${SERVER_HOST}" "ls -la $SERVER_PATH/data/consejo.db 2>/dev/null || echo 'Aun no existe data/consejo.db (se crea al primer arranque)'"

Write-Host ""
Write-Host "Para ver logs en tiempo real:" -ForegroundColor Cyan
Write-Host "   ssh -i $SSH_KEY -p $SERVER_PORT ${SERVER_USER}@${SERVER_HOST}" -ForegroundColor Gray
Write-Host "   cd $SERVER_PATH" -ForegroundColor Gray
Write-Host "   npx pm2 logs tuconsejo --lines 20 --raw" -ForegroundColor Gray
