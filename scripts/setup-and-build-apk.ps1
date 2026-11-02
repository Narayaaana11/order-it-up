# Compatibility entry point for the real, signed Flutter APK build.
param(
  [string]$OutputDir = "$PSScriptRoot/../release/mobile",
  [string]$ApkName = "order-it-up.apk"
)

$ErrorActionPreference = "Stop"
$Builder = Join-Path $PSScriptRoot "package-release-apk.ps1"
& $Builder -OutputDir $OutputDir -ApkName $ApkName
