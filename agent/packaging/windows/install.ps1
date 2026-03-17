#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Installs the IDMatr Agent as a Windows Service.
.PARAMETER ServerURL
    The URL of the IDMatr server (e.g. https://your-idmart-instance.com)
.PARAMETER APIToken
    The API token for agent authentication.
.EXAMPLE
    .\install.ps1 -ServerURL "https://idmart.example.com" -APIToken "tok_abc123"
#>
param(
    [string]$ServerURL = "https://your-idmart-instance.com",
    [string]$APIToken  = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$InstallDir  = "$env:ProgramData\IDMatr"
$LogDir      = "$env:ProgramData\IDMatr\logs"
$QueueDir    = "$env:ProgramData\IDMatr\queue"
$ConfigFile  = "$InstallDir\agent.yaml"
$BinaryDest  = "$InstallDir\idmart-agent.exe"
$ServiceName = "IDMatrAgent"

# Determine architecture.
$Arch = if ([System.Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Find the binary.
$BinarySrc = "$ScriptDir\idmart-agent.exe"
if (-not (Test-Path $BinarySrc)) {
    $BinarySrc = "$ScriptDir\..\..\dist\idmart-agent-windows-$Arch.exe"
    if (-not (Test-Path $BinarySrc)) {
        Write-Error "Cannot find agent binary. Expected at $BinarySrc"
        exit 1
    }
}

Write-Host "==> Creating installation directories..."
New-Item -ItemType Directory -Force -Path $InstallDir  | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir       | Out-Null
New-Item -ItemType Directory -Force -Path $QueueDir     | Out-Null

Write-Host "==> Installing agent binary to $BinaryDest..."
Copy-Item -Force $BinarySrc $BinaryDest

Write-Host "==> Writing configuration..."
if (-not (Test-Path $ConfigFile)) {
    @"
server_url: "$ServerURL"
api_token: "$APIToken"
device_id: ""
scan_interval: 300
log_level: "info"
log_file: "$($LogDir.Replace('\','\\'))\\agent.log"
queue_dir: "$($QueueDir.Replace('\','\\'))"
update_check_interval: 3600
tls_skip_verify: false
tags:
  environment: "production"
  team: ""
  location: ""
"@ | Set-Content -Encoding UTF8 $ConfigFile
    Write-Host "    Config written to $ConfigFile"
} else {
    Write-Host "    Config already exists — not overwriting."
}

# Restrict config file permissions to SYSTEM and Administrators only.
$acl = Get-Acl $ConfigFile
$acl.SetAccessRuleProtection($true, $false)
$sysRule   = New-Object System.Security.AccessControl.FileSystemAccessRule("SYSTEM","FullControl","Allow")
$adminRule = New-Object System.Security.AccessControl.FileSystemAccessRule("Administrators","FullControl","Allow")
$acl.AddAccessRule($sysRule)
$acl.AddAccessRule($adminRule)
Set-Acl $ConfigFile $acl

Write-Host "==> Installing Windows Service '$ServiceName'..."
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    Write-Host "    Stopping existing service..."
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

$binPath = "`"$BinaryDest`" -config `"$ConfigFile`""
sc.exe create $ServiceName `
    binPath= $binPath `
    start=   auto `
    obj=     LocalSystem `
    DisplayName= "IDMatr Identity Agent" | Out-Null

sc.exe description $ServiceName "IDMatr cross-platform identity and SaaS discovery agent." | Out-Null

Write-Host "==> Starting service..."
Start-Service -Name $ServiceName

$svcStatus = (Get-Service -Name $ServiceName).Status
Write-Host ""
Write-Host "IDMatr Agent installed and running."
Write-Host "  Binary:  $BinaryDest"
Write-Host "  Config:  $ConfigFile"
Write-Host "  Logs:    $LogDir\agent.log"
Write-Host "  Status:  $svcStatus"
Write-Host ""
Write-Host "Manage with:"
Write-Host "  Get-Service IDMatrAgent"
Write-Host "  Start-Service IDMatrAgent"
Write-Host "  Stop-Service IDMatrAgent"
