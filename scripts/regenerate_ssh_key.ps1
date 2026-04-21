# Regenerate SSH Key — sin passphrase (tuconsejo.app)
$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519_consejo"
$SSH_KEY_PUB = "$SSH_KEY.pub"
$SERVER_USER = "tucon4257"
$SERVER_HOST = "82.223.161.189"
$SERVER_PORT = "2222"

Write-Host "Regenerando Clave SSH (SIN passphrase)" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $SSH_KEY) {
    $backupKey = "$SSH_KEY.old_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Write-Host "Creando backup de clave antigua..." -ForegroundColor Yellow
    Copy-Item $SSH_KEY $backupKey -Force -ErrorAction SilentlyContinue
    Copy-Item $SSH_KEY_PUB "$backupKey.pub" -Force -ErrorAction SilentlyContinue
    Write-Host "   Backup: $backupKey" -ForegroundColor Gray
    Write-Host ""
}

Remove-Item $SSH_KEY -Force -ErrorAction SilentlyContinue
Remove-Item $SSH_KEY_PUB -Force -ErrorAction SilentlyContinue

$sshDir = "$env:USERPROFILE\.ssh"
if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
}

Write-Host "Generando nueva clave SSH (SIN passphrase)..." -ForegroundColor Green
Write-Host "   (Presiona Enter si te pide passphrase - dejala vacia)" -ForegroundColor Gray
Write-Host ""

$process = Start-Process -FilePath "ssh-keygen" -ArgumentList @(
    "-t", "ed25519",
    "-f", $SSH_KEY,
    "-N", '""',
    "-C", "tuconsejo-deploy"
) -NoNewWindow -Wait -PassThru

if ($process.ExitCode -ne 0) {
    Write-Host "Error al generar la clave SSH" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Clave SSH generada correctamente" -ForegroundColor Green
Write-Host ""

if (Test-Path $SSH_KEY_PUB) {
    $pubKey = Get-Content $SSH_KEY_PUB -Raw
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "CLAVE PUBLICA (copiala y pegala en CyberPanel):" -ForegroundColor Yellow
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host $pubKey.Trim() -ForegroundColor White
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""

    try {
        $pubKey.Trim() | Set-Clipboard
        Write-Host "Clave publica copiada al portapapeles" -ForegroundColor Green
    } catch {
        Write-Host "No se pudo copiar al portapapeles, copiala manualmente" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Instrucciones:" -ForegroundColor Cyan
    Write-Host "   1. Ve a CyberPanel > SSH Keys" -ForegroundColor Gray
    Write-Host "   2. Pega la clave publica mostrada arriba" -ForegroundColor Gray
    Write-Host "   3. Guarda la clave" -ForegroundColor Gray
    Write-Host ""

    $continue = Read-Host "Ya pegaste la clave en CyberPanel? (S/N)"
    if ($continue -eq "S" -or $continue -eq "s") {
        Write-Host ""
        Write-Host "Probando conexion..." -ForegroundColor Yellow

        $testResult = ssh -i $SSH_KEY -p $SERVER_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${SERVER_USER}@${SERVER_HOST}" "echo 'Conexion SSH exitosa!'" 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "Conexion SSH funcionando correctamente!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Ahora puedes usar la opcion 1 de manage.ps1 sin contrasena." -ForegroundColor Cyan
        } else {
            Write-Host "La conexion fallo. Verifica que la clave este en CyberPanel y el usuario sea $SERVER_USER" -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        Write-Host "Recuerda pegar la clave en CyberPanel antes del proximo despliegue" -ForegroundColor Yellow
    }
} else {
    Write-Host "No se encontro la clave publica generada" -ForegroundColor Red
    exit 1
}
