# Primera vez: Git + remoto GitHub (weblanzarote/tuconsejo)
$ErrorActionPreference = "Stop"

$repoUrl = "https://github.com/weblanzarote/tuconsejo.git"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Inicializacion Git (primera vez)" -ForegroundColor Cyan
Write-Host "Directorio: $root" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
    Write-Host "Repositorio git inicializado (rama main)." -ForegroundColor Green
} else {
    Write-Host "Ya existe .git — se mantiene el historial actual." -ForegroundColor Yellow
}

$hasOrigin = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Remote 'origin' actual: $hasOrigin" -ForegroundColor Gray
    $change = Read-Host "¿Sustituir origin por $repoUrl ? (S/N)"
    if ($change -eq "S" -or $change -eq "s") {
        git remote remove origin
        git remote add origin $repoUrl
    }
} else {
    git remote add origin $repoUrl
}

Write-Host ""
Write-Host "Remote origin -> $repoUrl" -ForegroundColor Green
Write-Host ""
Write-Host "Siguientes pasos (PowerShell: el mensaje del commit va entre comillas DOBLES):" -ForegroundColor Cyan
Write-Host "  1. Copia tu .env a la raiz (no se sube a Git por .gitignore)" -ForegroundColor Gray
Write-Host "  2. git add ." -ForegroundColor Gray
Write-Host '  3. git commit -m "Initial: Consejo Sinergico"' -ForegroundColor Gray
Write-Host "  4. git push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "Luego en el servidor: opcion 7b de manage.ps1 (Deploy Key) y opcion 1 (despliegue completo)." -ForegroundColor Gray
