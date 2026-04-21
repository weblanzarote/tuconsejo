# Setup SSH Key — despliegue tuconsejo.app (Consejo Sinérgico)
$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519_consejo"
$SSH_KEY_PUB = "$SSH_KEY.pub"
$SERVER_USER = "tucon4257"
$SERVER_HOST = "82.223.161.189"
$SERVER_PORT = "2222"

Write-Host "Configuracion de Clave SSH para tuconsejo.app" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $SSH_KEY) {
    Write-Host "La clave SSH ya existe: $SSH_KEY" -ForegroundColor Green
    Write-Host ""
    Write-Host "Si te pide passphrase y no la recuerdas, puedes regenerar la clave (opcion 7a)." -ForegroundColor Yellow
    $useExisting = Read-Host "Quieres usar esta clave? (S/N - N para regenerar)"
    if ($useExisting -ne "S" -and $useExisting -ne "s") {
        Write-Host "Eliminando clave antigua..." -ForegroundColor Yellow
        Remove-Item $SSH_KEY -Force -ErrorAction SilentlyContinue
        Remove-Item $SSH_KEY_PUB -Force -ErrorAction SilentlyContinue
        Write-Host "Generando nueva clave SSH..." -ForegroundColor Yellow
    } else {
        $skipGeneration = $true
    }
}

if (-not $skipGeneration) {
    $sshDir = "$env:USERPROFILE\.ssh"
    if (-not (Test-Path $sshDir)) {
        New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
    }

    Write-Host "   (Generando clave SIN passphrase - presiona Enter si te la pide)" -ForegroundColor Gray
    ssh-keygen -t ed25519 -f $SSH_KEY -N '""' -C "tuconsejo-deploy"

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error al generar la clave SSH" -ForegroundColor Red
        exit 1
    }

    Write-Host "Clave SSH generada correctamente" -ForegroundColor Green
}

if (-not (Test-Path $SSH_KEY_PUB)) {
    Write-Host "No se encontro la clave publica: $SSH_KEY_PUB" -ForegroundColor Red
    exit 1
}

$pubKey = Get-Content $SSH_KEY_PUB -Raw

Write-Host ""
Write-Host "Copiando clave publica al servidor..." -ForegroundColor Yellow
Write-Host "   (Se te pedira la contrasena del servidor una vez)" -ForegroundColor Gray
Write-Host ""

$pubKey | ssh -p $SERVER_PORT "${SERVER_USER}@${SERVER_HOST}" "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Clave SSH configurada correctamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "Probando conexion sin contrasena..." -ForegroundColor Yellow

    ssh -i $SSH_KEY -p $SERVER_PORT -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "echo 'Conexion SSH exitosa!'"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Conexion SSH funcionando correctamente!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Ahora puedes usar la opcion 1 de manage.ps1 sin contrasena." -ForegroundColor Cyan
    } else {
        Write-Host "La conexion fallo. Verifica la configuracion." -ForegroundColor Yellow
    }
} else {
    Write-Host "Error al copiar la clave al servidor" -ForegroundColor Red
    Write-Host ""
    Write-Host "Puedes copiar manualmente la clave publica:" -ForegroundColor Yellow
    Write-Host $pubKey -ForegroundColor Gray
}
