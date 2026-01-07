param(
    [string]$ServerHost = "194.28.226.156",
    [string]$User = "root",
    [string]$AppDir = "/opt/cognibook",
    [switch]$NoBuild  # Добавить флаг для пропуска пересборки
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repoRoot "package.json"))) {
    throw "Run this script from the repository (package.json not found)."
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw "ssh not found in PATH."
}
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    throw "scp not found in PATH."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git not found in PATH."
}

$target = "$User@$ServerHost"

Write-Host "Checking git on server..."
$gitCheck = ssh $target "which git" 2>$null
if (-not $gitCheck) {
    throw "git not found on server. Install it with: apt-get install -y git"
}

Write-Host "Preparing server directory $AppDir on $target..."
ssh $target "mkdir -p $AppDir"

Write-Host "Creating git bundle..."
$bundlePath = Join-Path $env:TEMP ("cognibook-deploy-" + [Guid]::NewGuid().ToString("N") + ".bundle")
Push-Location $repoRoot
try {
    git bundle create $bundlePath HEAD
} finally {
    Pop-Location
}

Write-Host "Uploading bundle..."
scp $bundlePath "${target}:/tmp/cognibook-deploy.bundle"

Write-Host "Deploying bundle on server..."
ssh $target @"
    set -e
    mkdir -p $AppDir
    cd $AppDir

    # Check if it's a valid git repository
    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo 'Updating existing repository from bundle...'
        git fetch /tmp/cognibook-deploy.bundle HEAD
        git checkout -f FETCH_HEAD
        git clean -fd -e .env -e .env.local -e data -e uploads
    else
        echo 'Initializing new repository from bundle...'
        git init
        git config --local advice.detachedHead false
        git fetch /tmp/cognibook-deploy.bundle HEAD
        git checkout -f FETCH_HEAD
    fi
    rm -f /tmp/cognibook-deploy.bundle
"@

Remove-Item -Force $bundlePath

if ($NoBuild) {
    Write-Host "Restarting containers without rebuild..."
    ssh $target "cd $AppDir && docker-compose up -d"
} else {
    Write-Host "Building and starting containers..."
    ssh $target "cd $AppDir && docker-compose up -d --build"

    Write-Host "Cleaning up old Docker images..."
    ssh $target "docker image prune -f && docker container prune -f"
}

Write-Host "`nChecking disk space on server..."
ssh $target "echo '=== Disk Usage ===' && df -h / && echo '' && echo '=== Docker Space Usage ===' && docker system df"

Write-Host "`nDeploy completed."
