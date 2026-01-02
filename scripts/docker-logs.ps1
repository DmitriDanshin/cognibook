param(
    [string]$ServerHost = "194.28.226.156",
    [string]$User = "root",
    [string]$Container = "cognibook",
    [int]$Tail = 200,
    [switch]$List
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

if ($List) {
    Write-Host "Available containers on ${target}:"
    ssh $target "docker ps --format '{{.Names}}\t{{.Image}}'"
    return
}

if ([string]::IsNullOrWhiteSpace($Container)) {
    throw "Container name is required. Use -List to see available containers."
}

Write-Host "Streaming logs for '$Container' on ${target}..."
ssh $target "docker logs -f --tail $Tail $Container"
