# Sync from Server — respaldo opcional de .env y SQLite
param(
    [switch]$NonInteractive
)

$SERVER_USER = "tucon4257"
$SERVER_HOST = "82.223.161.189"
$SERVER_PORT = "2222"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519_consejo"
$SERVER_PATH = "/home/tuconsejo.app/public_html"

$SCP_ARGS = @()
if (Test-Path $SSH_KEY) {
    $SCP_ARGS += @("-i", $SSH_KEY)
}
$SCP_ARGS += @("-P", $SERVER_PORT, "-o", "StrictHostKeyChecking=no")

if ($NonInteractive) {
    Write-Host "Sincronizacion omitida (despliegue). El servidor actualiza el codigo con git pull desde GitHub." -ForegroundColor Gray
    Write-Host "Para descargar .env o la base SQLite, ejecuta la opcion 4 del menu sin automatizar." -ForegroundColor Gray
    return
}

Write-Host "Sincronizacion desde servidor (Consejo Sinergico)" -ForegroundColor Cyan
Write-Host "SQLite: data/consejo.db en el servidor." -ForegroundColor Gray
Write-Host ""
Write-Host "Opciones:" -ForegroundColor Yellow
Write-Host "  1 = Solo informacion"
Write-Host "  2 = Descargar .env -> .env.server-backup"
Write-Host "  3 = Descargar data/consejo.db -> data/consejo.server-backup.db"
Write-Host ""
$opt = Read-Host "Elige (1/2/3)"

switch ($opt) {
    "2" {
        Write-Host "Descargando .env como .env.server-backup ..." -ForegroundColor Yellow
        & scp @SCP_ARGS "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/.env" "./.env.server-backup"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Guardado: .env.server-backup" -ForegroundColor Green
        } else {
            Write-Host "Fallo la descarga." -ForegroundColor Red
        }
    }
    "3" {
        Write-Host "Descargando base SQLite..." -ForegroundColor Yellow
        if (-not (Test-Path "data")) { New-Item -ItemType Directory -Path "data" | Out-Null }
        & scp @SCP_ARGS "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/data/consejo.db" "./data/consejo.server-backup.db"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Guardado: data/consejo.server-backup.db" -ForegroundColor Green
        } else {
            Write-Host "Fallo (puede que aun no exista consejo.db en el servidor)." -ForegroundColor Red
        }
    }
    default {
        Write-Host "Nada que sincronizar. La fuente de verdad del codigo es GitHub + tu repo local." -ForegroundColor Gray
    }
}

Write-Host "Listo." -ForegroundColor Green
