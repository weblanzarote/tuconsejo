# Deploy — Consejo Sinérgico → tuconsejo.app
param([string]$Message = "Auto Deploy")

$SERVER_USER = "tucon4257"
$SERVER_HOST = "82.223.161.189"
$SERVER_PORT = "2222"
$SERVER_PATH = "/home/tuconsejo.app/public_html"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519_consejo"

if (-not (Test-Path $SSH_KEY)) {
    Write-Host "No se encontro la clave SSH: $SSH_KEY" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para evitar que te pida la contrasena, ejecuta primero:" -ForegroundColor Cyan
    Write-Host "   .\scripts\setup_ssh.ps1" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continuar sin clave SSH? (S/N - se pedira contrasena varias veces)"
    if ($continue -ne "S" -and $continue -ne "s") {
        Write-Host "Operacion cancelada. Configura la clave SSH primero." -ForegroundColor Red
        exit
    }
    $SSH_ARGS = @("-p", $SERVER_PORT, "-o", "StrictHostKeyChecking=no")
} else {
    $SSH_ARGS = @("-i", $SSH_KEY, "-p", $SERVER_PORT, "-o", "StrictHostKeyChecking=no")
}

Write-Host "--- Paso 1: Git Push ---" -ForegroundColor Cyan
git add .
git commit -m $Message
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "Hubo un problema con git push. Continuando si es posible..." -ForegroundColor Yellow
}

Write-Host "--- Paso 2: Server Update ---" -ForegroundColor Cyan

$scriptContent = Get-Content "scripts/deploy_server.sh" -Raw
$scriptContent = $scriptContent -replace "`r`n", "`n" -replace "`r", "`n"
if ($scriptContent.StartsWith([char]0xFEFF)) {
    $scriptContent = $scriptContent.Substring(1)
}

$remoteCmd = "mkdir -p $SERVER_PATH/scripts && cat > $SERVER_PATH/scripts/deploy_server.sh && sed -i 's/\r$//' $SERVER_PATH/scripts/deploy_server.sh && chmod +x $SERVER_PATH/scripts/deploy_server.sh && bash $SERVER_PATH/scripts/deploy_server.sh"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$scriptContent | & ssh @SSH_ARGS "${SERVER_USER}@${SERVER_HOST}" $remoteCmd

Write-Host "Despliegue finalizado." -ForegroundColor Green
Write-Host ""
Write-Host "Para ver los logs del servidor:" -ForegroundColor Cyan
Write-Host "   1. Conectate: ssh -p $SERVER_PORT ${SERVER_USER}@${SERVER_HOST}" -ForegroundColor Gray
Write-Host "   2. Cambia al directorio: cd $SERVER_PATH" -ForegroundColor Gray
Write-Host "   3. Ver logs: npx pm2 logs tuconsejo --lines 50" -ForegroundColor Gray
