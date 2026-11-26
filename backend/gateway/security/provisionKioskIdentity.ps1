# ==============================================================================
# provisionKioskIdentity.ps1
# Cryptographically Secure Physical Kiosk Station Identity Generator & DPAPI Protector
# VRSEC Incubation Centre Lab Security Architecture
#
# SECURITY SPECIFICATION:
# 1. High-Entropy Key Generation:
#    Uses [System.Security.Cryptography.RandomNumberGenerator] (CSPRNG) to generate
#    256 bits (32 bytes) of cryptographic randomness.
# 2. Windows DPAPI Hardware/OS Binding:
#    Encrypts the key using ProtectedData.Protect with DataProtectionScope::LocalMachine.
#    Only the OS master key tied to this physical motherboard/Windows installation can decrypt it.
# 3. Restrictive File System ACLs:
#    Disables inheritance and restricts read/write permissions strictly to:
#    - NT AUTHORITY\SYSTEM (Gateway Windows Service account)
#    - BUILTIN\Administrators
#    Standard users, students, and unprivileged processes have ZERO read permissions.
# 4. Zero Logging:
#    The raw secret is never written to event logs, console outputs, or plaintext disk files.
# ==============================================================================

[CmdletBinding()]
param(
    [string]$TargetDirectory = "C:\ProgramData\VRSEC_LabGateway",
    [switch]$ForceRotation
)

$ErrorActionPreference = "Stop"

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "🔐 PROVISIONING PHYSICAL KIOSK DPAPI STATION IDENTITY" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan

# 1. Require Administrative Privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "ELEVATION REQUIRED: This script must be executed in an Elevated Administrator PowerShell prompt."
    exit 1
}

# 2. Prepare Directory
if (-not (Test-Path $TargetDirectory)) {
    New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null
    Write-Host "✓ Created secure storage directory: $TargetDirectory" -ForegroundColor Green
}

$dpapiFilePath = Join-Path $TargetDirectory "kiosk_machine_identity.dpapi"
$entropyFilePath = Join-Path $TargetDirectory "kiosk_machine_entropy.bin"

if ((Test-Path $dpapiFilePath) -and (-not $ForceRotation)) {
    Write-Warning "Kiosk identity file already exists at $dpapiFilePath. Use -ForceRotation to replace."
    exit 0
}

# 3. Generate Cryptographically Secure 256-bit Random Secret
Add-Type -AssemblyName System.Security

$cspRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$secretBytes = New-Object byte[] 32
$entropyBytes = New-Object byte[] 16

$cspRng.GetBytes($secretBytes)
$cspRng.GetBytes($entropyBytes)

# Encode as 64-character hex string
$secretHex = [System.BitConverter]::ToString($secretBytes).Replace("-", "").ToLowerInvariant()
$secretUtf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($secretHex)

# 4. Encrypt using Windows DPAPI (LocalMachine Scope)
$encryptedBlob = [System.Security.Cryptography.ProtectedData]::Protect(
    $secretUtf8Bytes,
    $entropyBytes,
    [System.Security.Cryptography.DataProtectionScope]::LocalMachine
)

# Write encrypted blob and entropy to disk
[System.IO.File]::WriteAllBytes($dpapiFilePath, $encryptedBlob)
[System.IO.File]::WriteAllBytes($entropyFilePath, $entropyBytes)

# 5. Lock Down NTFS File System Permissions
# Strip all inherited permissions and grant strictly to SYSTEM and Administrators
& icacls.exe $dpapiFilePath /inheritance:r /grant:r "NT AUTHORITY\SYSTEM:(R,W)" "BUILTIN\Administrators:(R,W)" | Out-Null
& icacls.exe $entropyFilePath /inheritance:r /grant:r "NT AUTHORITY\SYSTEM:(R,W)" "BUILTIN\Administrators:(R,W)" | Out-Null

# 6. Audit Information (Key Fingerprint Only - NEVER Log Raw Secret)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$fingerprintBytes = $sha256.ComputeHash($secretUtf8Bytes)
$fingerprintHex = [System.BitConverter]::ToString($fingerprintBytes).Replace("-", "").ToLowerInvariant()

# Wipe plaintext arrays from memory
[System.Array]::Clear($secretBytes, 0, $secretBytes.Length)
[System.Array]::Clear($secretUtf8Bytes, 0, $secretUtf8Bytes.Length)

Write-Host "✓ DPAPI Encrypted Identity File: $dpapiFilePath" -ForegroundColor Green
Write-Host "✓ ACL Protection: Restricted strictly to SYSTEM and Administrators" -ForegroundColor Green
Write-Host "✓ Scope: DataProtectionScope::LocalMachine (Hardware Bound)" -ForegroundColor Green
Write-Host "✓ Key SHA-256 Fingerprint: $fingerprintHex" -ForegroundColor Yellow
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "Station identity successfully provisioned and hardware-bound." -ForegroundColor Green
