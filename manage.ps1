# Consejo Sinérgico — gestión de despliegue (tuconsejo.app)
# Repo: https://github.com/weblanzarote/tuconsejo.git
# Servidor: tucon4257@82.223.161.189:2222 → /home/tuconsejo.app/public_html

function Show-Menu {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   CONSEJO SINERGICO — DEPLOY tuconsejo.app " -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Desplegar a GitHub y Servidor (completo)"
    Write-Host "2. Subir cambios a GitHub (solo push)"
    Write-Host "3. Actualizar desde GitHub (pull local)"
    Write-Host "4. Sincronizar desde servidor (respaldo .env / SQLite opcional)"
    Write-Host "5. Configurar variables de entorno locales (scripts/setup_env.ps1)"
    Write-Host "6. Ver estado de Git"
    Write-Host "7. Configurar clave SSH (acceso servidor sin contrasena)"
    Write-Host "7a. Regenerar clave SSH (sin passphrase)"
    Write-Host "7b. Configurar Deploy Key GitHub (servidor hace git pull)"
    Write-Host "8. Ejecutar en local (pnpm run dev)"
    Write-Host "9. Verificar estado del servidor (PM2, logs, puerto)"
    Write-Host "10. Inicializar Git y remoto GitHub (solo primera vez)"
    Write-Host "0. Salir"
    Write-Host ""
}

function Deploy-Full {
    Write-Host "Iniciando despliegue completo..." -ForegroundColor Yellow
    $msg = Read-Host "Mensaje del commit (Enter para default)"
    if (-not $msg) { $msg = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }

    & .\scripts\sync_from_server.ps1 -NonInteractive

    if (-not (Test-Path "scripts/deploy.ps1")) {
        Write-Host "Error: No se encuentra scripts/deploy.ps1" -ForegroundColor Red
        return
    }
    & .\scripts\deploy.ps1 -Message $msg
}

function Git-Push {
    Write-Host "Subiendo solo a GitHub..." -ForegroundColor Yellow
    $msg = Read-Host "Mensaje del commit (Enter para default)"
    if (-not $msg) { $msg = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
    git add .
    git commit -m $msg
    git push origin main
}

function Git-Pull {
    Write-Host "Actualizando desde GitHub..." -ForegroundColor Yellow
    git pull origin main
}

function Sync-From-Server {
    if (Test-Path "scripts/sync_from_server.ps1") {
        & .\scripts\sync_from_server.ps1
    } else {
        Write-Host "Script sync_from_server.ps1 no encontrado" -ForegroundColor Yellow
    }
}

function Setup-Env {
    if (Test-Path "scripts/setup_env.ps1") {
        & .\scripts\setup_env.ps1
    } else {
        Write-Host "Script setup_env.ps1 no encontrado" -ForegroundColor Yellow
    }
}

function Setup-SSH {
    if (Test-Path "scripts/setup_ssh.ps1") {
        & .\scripts\setup_ssh.ps1
    } else {
        Write-Host "Script setup_ssh.ps1 no encontrado" -ForegroundColor Yellow
    }
}

function Regenerate-SSH {
    if (Test-Path "scripts/regenerate_ssh_key.ps1") {
        & .\scripts\regenerate_ssh_key.ps1
    } else {
        Write-Host "Script regenerate_ssh_key.ps1 no encontrado" -ForegroundColor Yellow
    }
}

function Setup-GitHub-DeployKey {
    if (Test-Path "scripts/setup_github_deploy_key.ps1") {
        & .\scripts\setup_github_deploy_key.ps1
    } else {
        Write-Host "Script setup_github_deploy_key.ps1 no encontrado" -ForegroundColor Yellow
    }
}

function Check-ServerStatus {
    if (Test-Path "scripts/check_server_status.ps1") {
        & .\scripts\check_server_status.ps1
    } else {
        Write-Host "Script check_server_status.ps1 no encontrado" -ForegroundColor Yellow
    }
}

function Run-Local {
    Write-Host "Iniciando servidor local..." -ForegroundColor Yellow
    pnpm run dev
}

function Git-Status {
    Write-Host "Estado del repositorio:" -ForegroundColor Yellow
    git status
}

function Init-Git-FirstTime {
    if (Test-Path "scripts/init_git_first_time.ps1") {
        & .\scripts\init_git_first_time.ps1
    } else {
        Write-Host "Script init_git_first_time.ps1 no encontrado" -ForegroundColor Yellow
    }
}

function Pause {
    Write-Host ""
    Read-Host "Pulsa Enter para continuar"
}

do {
    Show-Menu
    $input = Read-Host "Selecciona opcion"
    switch ($input) {
        '1' { Deploy-Full; Pause }
        '2' { Git-Push; Pause }
        '3' { Git-Pull; Pause }
        '4' { Sync-From-Server; Pause }
        '5' { Setup-Env; Pause }
        '6' { Git-Status; Pause }
        '7' { Setup-SSH; Pause }
        '7a' { Regenerate-SSH; Pause }
        '7b' { Setup-GitHub-DeployKey; Pause }
        '8' { Run-Local; Pause }
        '9' { Check-ServerStatus; Pause }
        '10' { Init-Git-FirstTime; Pause }
        '0' { exit }
    }
} while ($true)
