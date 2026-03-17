#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Uninstalls the IDMatr Agent Windows Service and removes all files.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$InstallDir  = "$env:ProgramData\IDMatr"
$ServiceName = "IDMatrAgent"

Write-Host "==> Stopping IDMatr Agent service..."
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    if ($svc.Status -eq "Running") {
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 2
    }
    Write-Host "==> Removing Windows Service..."
    sc.exe delete $ServiceName | Out-Null
    Write-Host "    Service removed."
} else {
    Write-Host "    Service '$ServiceName' not found — skipping."
}

Write-Host "==> Removing installation directory $InstallDir ..."
if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
    Write-Host "    Removed."
} else {
    Write-Host "    Directory not found — skipping."
}

# Remove Windows Event Log source if it exists.
try {
    Remove-EventLog -Source "IDMatrAgent" -ErrorAction SilentlyContinue
} catch {}

Write-Host ""
Write-Host "IDMatr Agent has been uninstalled."
