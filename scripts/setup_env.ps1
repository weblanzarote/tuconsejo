# Setup .env — Consejo Sinérgico (SQLite, sin MySQL en servidor)
$envPath = Join-Path $PSScriptRoot ".." ".env"
$envPath = [System.IO.Path]::GetFullPath($envPath)

Write-Host "Configuracion de variables de entorno (.env)" -ForegroundColor Cyan
Write-Host "Base de datos: SQLite (archivo data/consejo.db). No necesitas crear BD en CyberPanel." -ForegroundColor Gray
Write-Host ""

if (Test-Path $envPath) {
    Write-Host "Ya existe .env. No se sobrescribira." -ForegroundColor Yellow
    Write-Host "Edita manualmente: $envPath" -ForegroundColor Gray
    $overwrite = Read-Host "Sobrescribir plantilla? (s/N)"
    if ($overwrite -ne "s" -and $overwrite -ne "S") {
        exit 0
    }
}

$jwtSecret = Read-Host "JWT_SECRET (Enter = valor aleatorio)"
if (-not $jwtSecret) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $jwtSecret = [Convert]::ToBase64String($bytes)
}

$openai = Read-Host "OPENAI_API_KEY (opcional en local si ya la tienes en otro sitio)"
$port = Read-Host "PORT (Enter = 3000)"
if (-not $port) { $port = "3000" }

$content = @"
# Consejo Sinergico — variables de entorno (NO subir a Git)
NODE_ENV=development
PORT=$port

# Seguridad (cookies / sesion)
JWT_SECRET=$jwtSecret

# IA
OPENAI_API_KEY=$openai
# OPENAI_MODEL=gpt-4o
# OPENAI_BASE_URL=https://api.openai.com

# SQLite (por defecto ./data/consejo.db). En servidor puedes fijar ruta absoluta:
# DATABASE_PATH=/home/tuconsejo.app/public_html/data/consejo.db

# OAuth correo — en PRODUCCION sustituye localhost por https://tuconsejo.app
# GOOGLE_REDIRECT_URI=https://tuconsejo.app/api/auth/google/callback
# MICROSOFT_REDIRECT_URI=https://tuconsejo.app/api/auth/microsoft/callback

# Opcionales Manus / Forge (si los usas)
# VITE_APP_ID=
# OAUTH_SERVER_URL=
# OWNER_OPEN_ID=
"@

Set-Content -Path $envPath -Value $content -Encoding UTF8
Write-Host ""
Write-Host "Archivo creado: $envPath" -ForegroundColor Green
Write-Host ""
Write-Host "En el SERVIDOR, el .env ya lo tienes en public_html; revisa PORT=3000 y URLs OAuth para tu dominio." -ForegroundColor Cyan
