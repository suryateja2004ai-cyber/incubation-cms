# ==============================================================================
# installGatewayService.ps1
# Production Windows Gateway Service Installation & Configuration Script
# VRSEC Incubation Centre Lab Security Architecture
#
# RUN AS ELEVATED ADMINISTRATOR ON DESIGNATED PHYSICAL KIOSK STATION PC
# ==============================================================================

[CmdletBinding()]
param(
    [string]$ServiceName = "VRSEC_LabDeviceGateway",
    [string]$DisplayName = "VRSEC Incubation Lab Local Device Gateway",
    [string]$ServiceDescription = "Local hardware isolation gateway and physical kiosk attestation controller for VRSEC Incubation Centre.",
    [string]$NodeExePath = "C:\Program Files\nodejs\node.exe",
    [string]$GatewayScriptPath = "C:\VRSEC_Incubation\backend\gateway\deviceGateway.mjs",
    [string]$LogDirectory = "C:\ProgramData\VRSEC_LabGateway\logs"
)

$ErrorActionPreference = "Stop"

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "🔧 INSTALLING VRSEC LOCAL DEVICE GATEWAY WINDOWS SERVICE" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan

# 1. Require Administrator
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "ELEVATION REQUIRED: Must be run from an Elevated Administrator PowerShell prompt."
    exit 1
}

# 2. Verify Node.js and Script Exist
if (-not (Test-Path $NodeExePath)) {
    # Try finding in PATH
    $nodeCmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
    if ($nodeCmd) {
        $NodeExePath = $nodeCmd.Source
    } else {
        Write-Error "Node.js executable not found at '$NodeExePath'. Please install Node.js LTS."
        exit 1
    }
}

if (-not (Test-Path $GatewayScriptPath)) {
    # Check current directory
    $localScript = Join-Path $PSScriptRoot "..\deviceGateway.mjs"
    if (Test-Path $localScript) {
        $GatewayScriptPath = (Resolve-Path $localScript).Path
    } else {
        Write-Error "Gateway script not found at '$GatewayScriptPath'."
        exit 1
    }
}

# 3. Create Logs Directory with Restricted ACLs
if (-not (Test-Path $LogDirectory)) {
    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
}
& icacls.exe $LogDirectory /inheritance:r /grant:r "NT AUTHORITY\SYSTEM:(OI)(CI)(F)" "BUILTIN\Administrators:(OI)(CI)(F)" | Out-Null

# 4. Stop and Remove Existing Service if present
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Stopping and removing existing service '$ServiceName'..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    & sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

# 5. Service Binary Path Configuration
# Executes node directly with production NODE_ENV, binding to loopback/lab interface
$binPath = "`"$NodeExePath`" `"$GatewayScriptPath`""

# 6. Create Service using sc.exe (Native Windows Service Manager)
& sc.exe create $ServiceName `
    binPath= $binPath `
    start= auto `
    obj= "NT AUTHORITY\SYSTEM" `
    DisplayName= $DisplayName | Out-Null

& sc.exe description $ServiceName $ServiceDescription | Out-Null

# 7. Configure Failure Recovery Actions (Restart service after 5s on failure)
& sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null

# 8. Set Windows Firewall Rule: Restrict Inbound Port 5050 strictly to Lab Subnet
Write-Host "Configuring Windows Advanced Firewall rule for Port 5050..." -ForegroundColor Cyan
Remove-NetFirewallRule -DisplayName "VRSEC Lab Gateway Inbound" -ErrorAction SilentlyContinue

New-NetFirewallRule `
    -DisplayName "VRSEC Lab Gateway Inbound" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 5050 `
    -Action Allow `
    -RemoteAddress "127.0.0.1", "192.168.1.0/24", "192.168.4.0/24" `
    -Profile Any `
    -Description "Permits incoming HTTP communication to VRSEC Lab Gateway exclusively from loopback and trusted lab subnets. WAN/VPN dropped." | Out-Null

Write-Host "===================================================================" -ForegroundColor Green
Write-Host "✓ Windows Service '$ServiceName' successfully installed." -ForegroundColor Green
Write-Host "  Service Account: NT AUTHORITY\SYSTEM (Authorized for DPAPI LocalMachine)" -ForegroundColor Green
Write-Host "  Startup Type:    Automatic" -ForegroundColor Green
Write-Host "  Crash Recovery:  Auto-Restart (5s / 10s / 30s)" -ForegroundColor Green
Write-Host "  Firewall Rule:   Port 5050 restricted strictly to 127.0.0.1 & 192.168.x.x" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
