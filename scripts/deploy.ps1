param(
    [string]$ServerHost = "194.28.226.156",
    [string]$User = "root",
    [string]$AppDir = "/opt/cognibook"
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

$target = "$User@$ServerHost"

Write-Host "Preparing server directory $AppDir on $target..."
ssh $target "mkdir -p $AppDir"

Write-Host "Uploading project files..."
Push-Location $repoRoot
try {
    tar --exclude='node_modules' `
        --exclude='.next' `
        --exclude='.git' `
        --exclude='dev.db' `
        --exclude='uploads' `
        -cvf - . | ssh $target "cd $AppDir && tar -xvf -"
} finally {
    Pop-Location
}

Write-Host "Building and starting containers..."
ssh $target "cd $AppDir && docker-compose up -d --build"

Write-Host "Deploy completed."
