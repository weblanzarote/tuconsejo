# Setup GitHub Deploy Key — repositorio weblanzarote/tuconsejo
$SERVER_USER = "tucon4257"
$SERVER_HOST = "82.223.161.189"
$SERVER_PORT = "2222"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519_consejo"
$GIT_REPO_SSH = "git@github.com:weblanzarote/tuconsejo.git"

Write-Host "Configuracion de Deploy Key para GitHub (tuconsejo)" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $SSH_KEY)) {
    Write-Host "No se encontro la clave SSH local: $SSH_KEY" -ForegroundColor Red
    Write-Host "   Ejecuta primero la opcion 7 (setup_ssh) o 7a (regenerar)" -ForegroundColor Yellow
    exit 1
}

Write-Host "Paso 1: Generando clave SSH en el servidor..." -ForegroundColor Yellow
Write-Host ""

$generateKeyCmd = @"
if [ ! -f ~/.ssh/id_ed25519_github ]; then
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -N '' -C 'github-deploy-key'
    echo 'Clave generada en servidor'
else
    echo 'Clave ya existe en servidor'
fi
"@

& ssh -i $SSH_KEY -p $SERVER_PORT -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" $generateKeyCmd

Write-Host ""
Write-Host "Paso 2: Obteniendo clave publica del servidor..." -ForegroundColor Yellow

$pubKey = & ssh -i $SSH_KEY -p $SERVER_PORT -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "cat ~/.ssh/id_ed25519_github.pub"

if ($LASTEXITCODE -ne 0 -or -not $pubKey) {
    Write-Host "Error al obtener la clave publica del servidor" -ForegroundColor Red
    exit 1
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "CLAVE PUBLICA DEL SERVIDOR (Deploy Key):" -ForegroundColor Yellow
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
Write-Host "Instrucciones para agregar en GitHub:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   1. Ve a: https://github.com/weblanzarote/tuconsejo/settings/keys" -ForegroundColor Gray
Write-Host "   2. Settings > Security > Deploy keys" -ForegroundColor Gray
Write-Host "   3. Add deploy key" -ForegroundColor Gray
Write-Host "   4. Titulo: Servidor tuconsejo.app" -ForegroundColor Gray
Write-Host "   5. Pega la clave publica mostrada arriba" -ForegroundColor Gray
Write-Host "   6. NO marques 'Allow write access' (solo lectura)" -ForegroundColor Gray
Write-Host "   7. Add key" -ForegroundColor Gray
Write-Host ""

$continue = Read-Host "Ya agregaste la Deploy Key en GitHub? (S/N)"
if ($continue -eq "S" -or $continue -eq "s") {
    Write-Host ""
    Write-Host "Paso 3: Configurando Git en el servidor..." -ForegroundColor Yellow

    $configureGitCmd = @"
cd /home/tuconsejo.app/public_html
git remote set-url origin $GIT_REPO_SSH 2>/dev/null || git remote add origin $GIT_REPO_SSH
echo 'Git configurado para usar SSH'
"@

    & ssh -i $SSH_KEY -p $SERVER_PORT -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" $configureGitCmd

    Write-Host ""
    Write-Host "Paso 4: Configurando SSH para GitHub en el servidor..." -ForegroundColor Yellow

    $sshConfigCmd = @"
mkdir -p ~/.ssh
chmod 700 ~/.ssh
if ! grep -q "Host github.com" ~/.ssh/config 2>/dev/null; then
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  StrictHostKeyChecking no
EOF
fi
chmod 600 ~/.ssh/config
echo 'Configuracion SSH completada'
"@

    & ssh -i $SSH_KEY -p $SERVER_PORT -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" $sshConfigCmd

    Write-Host ""
    Write-Host "Probando conexion a GitHub..." -ForegroundColor Yellow

    $testCmd = "ssh -T git@github.com 2>&1 | head -1"
    $testResult = & ssh -i $SSH_KEY -p $SERVER_PORT -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" $testCmd

    if ($testResult -match "successfully authenticated" -or $testResult -match "Hi") {
        Write-Host "Conexion a GitHub funcionando!" -ForegroundColor Green
        Write-Host ""
        Write-Host "El servidor podra hacer pull desde GitHub automaticamente." -ForegroundColor Cyan
    } else {
        Write-Host "Verifica que la Deploy Key este agregada en GitHub. Resultado: $testResult" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Recuerda agregar la Deploy Key en GitHub antes del proximo despliegue" -ForegroundColor Yellow
}
