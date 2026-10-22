<#
.SYNOPSIS
    Starts the FlightBookingDemo API and React client for a demo.

.DESCRIPTION
    1. Checks for .NET, Node and SQL Server LocalDB, and starts LocalDB.
    2. Creates appsettings.Local.json (JWT signing key + demo users) on first run.
    3. Restores tools and client packages if needed.
    4. Opens the API (http://localhost:5130) and client (http://localhost:5173) in their own windows,
       waits for the API, then opens the app and Swagger in the browser.

.PARAMETER SetupOnly
    Do steps 1 to 3 and print the demo logins, without starting anything.

.EXAMPLE
    .\start-demo.ps1
#>
param([switch]$SetupOnly)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$localConfig = Join-Path $root 'appsettings.Local.json'

function Test-Command([string]$name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function New-RandomString([int]$bytes) {
    $buffer = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    # URL-safe Base64 without padding
    return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Test-PortInUse([int]$port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# 1. Prerequisites
foreach ($tool in 'dotnet', 'node', 'npm', 'sqllocaldb') {
    if (-not (Test-Command $tool)) {
        throw "'$tool' was not found. Install it first (see README.md)."
    }
}
Write-Host 'Starting SQL Server LocalDB...' -ForegroundColor Cyan
sqllocaldb start MSSQLLocalDB | Out-Null

# 2. Local secrets, generated once and kept out of git
if (-not (Test-Path $localConfig)) {
    Write-Host 'Creating appsettings.Local.json with a new signing key and demo users...' -ForegroundColor Cyan
    $config = [ordered]@{
        Jwt       = [ordered]@{ SigningKey = (New-RandomString 48) }
        DemoUsers = @(
            [ordered]@{ Username = 'agent'; Password = 'agent-' + (New-RandomString 6); Role = 'Agent' },
            [ordered]@{ Username = 'admin'; Password = 'admin-' + (New-RandomString 6); Role = 'Admin' }
        )
    }
    # WriteAllText with UTF8Encoding($false): Windows PowerShell 5.1's "-Encoding UTF8" adds a BOM.
    $json = $config | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($localConfig, $json, (New-Object System.Text.UTF8Encoding($false)))
}

$users = (Get-Content $localConfig -Raw | ConvertFrom-Json).DemoUsers
Write-Host ''
Write-Host 'Demo logins (from appsettings.Local.json):' -ForegroundColor Green
foreach ($u in $users) {
    Write-Host ("  {0,-6} {1,-20} role: {2}" -f $u.Username, $u.Password, $u.Role)
}
Write-Host ''

# 3. Tools and packages
Push-Location $root
try {
    dotnet tool restore | Out-Null
    if (-not (Test-Path (Join-Path $root 'client\node_modules'))) {
        Write-Host 'Installing client packages (first run only)...' -ForegroundColor Cyan
        Push-Location (Join-Path $root 'client')
        npm install
        Pop-Location
    }
}
finally {
    Pop-Location
}

if ($SetupOnly) {
    Write-Host 'Setup complete. Run .\start-demo.ps1 without -SetupOnly to start the app.' -ForegroundColor Green
    return
}

# 4. Start the API and client in their own windows
if (Test-PortInUse 5130) {
    Write-Host 'Port 5130 is already in use (is dotnet watch running?). Using that API.' -ForegroundColor Yellow
}
else {
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root'; dotnet run --launch-profile http"
}

if (Test-PortInUse 5173) {
    Write-Host 'Port 5173 is already in use. Using that client.' -ForegroundColor Yellow
}
else {
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\client'; npm run dev"
}

Write-Host 'Waiting for the API to answer (first build can take a minute)...' -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(120)
$ready = $false
while ((Get-Date) -lt $deadline) {
    try {
        Invoke-WebRequest -Uri 'http://localhost:5130/swagger/v1/swagger.json' -UseBasicParsing -TimeoutSec 3 | Out-Null
        $ready = $true
        break
    }
    catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Host 'The API did not start within 2 minutes. Check its window for errors.' -ForegroundColor Red
    return
}

Start-Process 'http://localhost:5173'
Start-Process 'http://localhost:5130/swagger'
Write-Host 'Ready: app at http://localhost:5173, Swagger at http://localhost:5130/swagger' -ForegroundColor Green
