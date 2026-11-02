# Build and validate the real Flutter Android release APK.
param(
  [string]$OutputDir = "$PSScriptRoot/../release/mobile",
  [string]$ApkName = "order-it-up.apk"
)

$ErrorActionPreference = "Stop"
$MobileDir = (Resolve-Path (Join-Path $PSScriptRoot "../mobile")).Path
$KeyProperties = Join-Path $PSScriptRoot "../mobile/android/key.properties"
$Flutter = Get-Command flutter -ErrorAction SilentlyContinue
if (-not $Flutter) {
  throw "Flutter is required. Install the Flutter SDK and add flutter to PATH."
}
if (-not (Test-Path -LiteralPath $KeyProperties)) {
  throw "A dedicated Android release keystore is required. Create mobile/android/key.properties; debug signing is not accepted."
}

Push-Location $MobileDir
try {
  & $Flutter.Source pub get
  if ($LASTEXITCODE -ne 0) { throw "flutter pub get failed with exit code $LASTEXITCODE" }

  & $Flutter.Source build apk --release
  if ($LASTEXITCODE -ne 0) { throw "Flutter release build failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$BuiltApk = Join-Path $MobileDir "build/app/outputs/flutter-apk/app-release.apk"
if (-not (Test-Path -LiteralPath $BuiltApk)) {
  throw "Flutter completed without producing the expected APK: $BuiltApk"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$Archive = [System.IO.Compression.ZipFile]::OpenRead($BuiltApk)
try {
  $EntryNames = @($Archive.Entries | ForEach-Object FullName)
  if ($EntryNames -notcontains "classes.dex" -or
      -not ($EntryNames | Where-Object { $_ -like "assets/flutter_assets/*" })) {
    throw "The generated APK is missing compiled Android or Flutter application assets."
  }
} finally {
  $Archive.Dispose()
}

$AndroidSdk = $env:ANDROID_SDK_ROOT
if (-not $AndroidSdk) { $AndroidSdk = $env:ANDROID_HOME }
if (-not $AndroidSdk) { throw "ANDROID_SDK_ROOT or ANDROID_HOME is required to verify the APK signature." }
$BuildToolsDir = Join-Path $AndroidSdk "build-tools"
$ApkSigner = Get-ChildItem -LiteralPath $BuildToolsDir -Filter "apksigner.bat" -Recurse -File -ErrorAction SilentlyContinue |
  Sort-Object { try { [version]$_.Directory.Name } catch { [version]"0.0" } } -Descending |
  Select-Object -First 1
if (-not $ApkSigner) { throw "Android build-tools apksigner.bat was not found under $BuildToolsDir" }
& $ApkSigner.FullName verify --verbose $BuiltApk
if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed with exit code $LASTEXITCODE" }

$ResolvedOutputDir = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null
$DestinationApk = Join-Path $ResolvedOutputDir $ApkName
Copy-Item -LiteralPath $BuiltApk -Destination $DestinationApk -Force
Write-Host "Verified signed Flutter release APK: $DestinationApk"
Write-Host "Size: $([math]::Round((Get-Item -LiteralPath $DestinationApk).Length / 1MB, 2)) MB"
