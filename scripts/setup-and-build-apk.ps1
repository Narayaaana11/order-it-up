# Setup toolchain and build production release APK
param(
    [string]$ToolsDir = "D:\tools",
    [string]$ProjectDir = "d:\narayana\order-it-up"
)

$ErrorActionPreference = "Stop"
Write-Host "=== Order It Up: Production APK Build Pipeline ===" -ForegroundColor Cyan
Write-Host "Tools directory: $ToolsDir"
Write-Host "Project directory: $ProjectDir"

if (-not (Test-Path $ToolsDir)) {
    New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null
}

# -------------------------------------------------------------
# 1. Setup OpenJDK 17
# -------------------------------------------------------------
$JdkZip = Join-Path $ToolsDir "jdk17.zip"
$JdkUrl = "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
$JavaHomeDir = Get-ChildItem -Path $ToolsDir -Directory -Filter "jdk-17*" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName

if (-not $JavaHomeDir -or -not (Test-Path (Join-Path $JavaHomeDir "bin\java.exe"))) {
    Write-Host "`n[1/5] Downloading Adoptium OpenJDK 17..." -ForegroundColor Yellow
    if (-not (Test-Path $JdkZip) -or ((Get-Item $JdkZip).Length -lt 150000000)) {
        & curl.exe -L -C - -o $JdkZip $JdkUrl
    }
    Write-Host "Extracting JDK 17..." -ForegroundColor Yellow
    & tar.exe -xf $JdkZip -C $ToolsDir
    $JavaHomeDir = Get-ChildItem -Path $ToolsDir -Directory -Filter "jdk-17*" | Select-Object -First 1 -ExpandProperty FullName
}

$env:JAVA_HOME = $JavaHomeDir
$env:PATH = "$JavaHomeDir\bin;$env:PATH"
Write-Host "Java 17 configured at: $env:JAVA_HOME" -ForegroundColor Green
& java -version

# -------------------------------------------------------------
# 2. Setup Android Command-Line Tools & SDK
# -------------------------------------------------------------
$AndroidHome = Join-Path $ToolsDir "android-sdk"
$CmdlineZip = Join-Path $ToolsDir "cmdline-tools.zip"
$CmdlineUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
$LatestCmdlineDir = Join-Path $AndroidHome "cmdline-tools\latest"

if (-not (Test-Path (Join-Path $LatestCmdlineDir "bin\sdkmanager.bat"))) {
    Write-Host "`n[2/5] Downloading Android Command-Line Tools..." -ForegroundColor Yellow
    if (-not (Test-Path $CmdlineZip) -or ((Get-Item $CmdlineZip).Length -lt 100000000)) {
        & curl.exe -L -C - -o $CmdlineZip $CmdlineUrl
    }
    Write-Host "Extracting Command-Line Tools..." -ForegroundColor Yellow
    $TempCmdline = Join-Path $ToolsDir "cmdline-temp"
    if (Test-Path $TempCmdline) { Remove-Item -Recurse -Force $TempCmdline }
    New-Item -ItemType Directory -Path $TempCmdline -Force | Out-Null
    & tar.exe -xf $CmdlineZip -C $TempCmdline
    
    if (-not (Test-Path (Join-Path $AndroidHome "cmdline-tools"))) {
        New-Item -ItemType Directory -Path (Join-Path $AndroidHome "cmdline-tools") -Force | Out-Null
    }
    if (Test-Path $LatestCmdlineDir) { Remove-Item -Recurse -Force $LatestCmdlineDir }
    Move-Item (Join-Path $TempCmdline "cmdline-tools") $LatestCmdlineDir -Force
    Remove-Item -Recurse -Force $TempCmdline
}

$env:ANDROID_HOME = $AndroidHome
$env:ANDROID_SDK_ROOT = $AndroidHome
$env:PATH = "$LatestCmdlineDir\bin;$AndroidHome\platform-tools;$env:PATH"

$SdkManager = Join-Path $LatestCmdlineDir "bin\sdkmanager.bat"
$Platform34 = Join-Path $AndroidHome "platforms\android-34"
if (-not (Test-Path $Platform34)) {
    Write-Host "Installing Android platform 34 and build-tools..." -ForegroundColor Yellow
    cmd.exe /c "echo y | `"$SdkManager`" --sdk_root=`"$AndroidHome`" `"platforms;android-34`" `"build-tools;34.0.0`" `"platform-tools`""
}

# -------------------------------------------------------------
# 3. Setup Flutter SDK
# -------------------------------------------------------------
$FlutterDir = Join-Path $ToolsDir "flutter"
$FlutterZip = Join-Path $ToolsDir "flutter.zip"
$FlutterUrl = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.3-stable.zip"

if (-not (Test-Path (Join-Path $FlutterDir "bin\flutter.bat"))) {
    Write-Host "`n[3/5] Downloading Flutter SDK 3.24.3..." -ForegroundColor Yellow
    if (-not (Test-Path $FlutterZip) -or ((Get-Item $FlutterZip).Length -lt 1000000000)) {
        & curl.exe -L -C - -o $FlutterZip $FlutterUrl
    }
    Write-Host "Extracting Flutter SDK (this may take 2-3 minutes)..." -ForegroundColor Yellow
    & tar.exe -xf $FlutterZip -C $ToolsDir
}

$env:PATH = "$FlutterDir\bin;$env:PATH"
Write-Host "Configuring Flutter..." -ForegroundColor Yellow
& flutter.bat config --no-analytics
& flutter.bat config --android-sdk "$AndroidHome"
cmd.exe /c "echo y | `"$FlutterDir\bin\flutter.bat`" doctor --android-licenses"

# -------------------------------------------------------------
# 4. Build Release APK
# -------------------------------------------------------------
Write-Host "`n[4/5] Building Release APK for Order It Up..." -ForegroundColor Yellow
$MobileDir = Join-Path $ProjectDir "mobile"
Set-Location $MobileDir

& flutter.bat pub get
& flutter.bat build apk --release --split-per-abi=false

# -------------------------------------------------------------
# 5. Copy to Release Folder
# -------------------------------------------------------------
Write-Host "`n[5/5] Deploying Release Deliverable..." -ForegroundColor Yellow
$BuiltApk = Join-Path $MobileDir "build\app\outputs\flutter-apk\app-release.apk"
$ReleaseDestDir = Join-Path $ProjectDir "release\mobile"
$ReleaseDestFile = Join-Path $ReleaseDestDir "order-it-up.apk"

if (-not (Test-Path $ReleaseDestDir)) {
    New-Item -ItemType Directory -Path $ReleaseDestDir -Force | Out-Null
}

if (Test-Path $BuiltApk) {
    Copy-Item $BuiltApk $ReleaseDestFile -Force
    $ApkSize = (Get-Item $ReleaseDestFile).Length
    $ApkSizeMB = [math]::Round($ApkSize / 1MB, 2)
    Write-Host "`nSUCCESS! Production APK deployed at: $ReleaseDestFile ($ApkSizeMB MB)" -ForegroundColor Green
} else {
    Write-Error "Build finished but app-release.apk not found at $BuiltApk"
}
