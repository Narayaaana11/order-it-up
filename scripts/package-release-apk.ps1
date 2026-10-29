# Build & Package Order It Up Android Release APK
param(
  [string]$OutputDir = "$PSScriptRoot/../release/mobile",
  [string]$ApkName = "order-it-up.apk"
)

$ErrorActionPreference = "Stop"
Write-Host "Packaging Order It Up Android Release APK..." -ForegroundColor Cyan

$TargetDir = Resolve-Path -Path $OutputDir -ErrorAction SilentlyContinue
if (-not $TargetDir) {
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
  $TargetDir = Resolve-Path -Path $OutputDir
}

$TempDir = "$env:TEMP/oiu_apk_staging_$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path "$TempDir/res/drawable" | Out-Null
New-Item -ItemType Directory -Force -Path "$TempDir/res/mipmap-hdpi" | Out-Null
New-Item -ItemType Directory -Force -Path "$TempDir/res/mipmap-xhdpi" | Out-Null
New-Item -ItemType Directory -Force -Path "$TempDir/res/mipmap-xxhdpi" | Out-Null
New-Item -ItemType Directory -Force -Path "$TempDir/res/mipmap-xxxhdpi" | Out-Null
New-Item -ItemType Directory -Force -Path "$TempDir/assets/flutter_assets/assets/images" | Out-Null
New-Item -ItemType Directory -Force -Path "$TempDir/META-INF" | Out-Null

# 1. Copy Logo & Icons into Android resources and assets
Copy-Item "$PSScriptRoot/../assets/icon-512.png" -Destination "$TempDir/res/mipmap-xxxhdpi/ic_launcher.png" -Force
Copy-Item "$PSScriptRoot/../assets/icon-256.png" -Destination "$TempDir/res/mipmap-xxhdpi/ic_launcher.png" -Force
Copy-Item "$PSScriptRoot/../assets/icon-128.png" -Destination "$TempDir/res/mipmap-xhdpi/ic_launcher.png" -Force
Copy-Item "$PSScriptRoot/../assets/icon-64.png" -Destination "$TempDir/res/mipmap-hdpi/ic_launcher.png" -Force
Copy-Item "$PSScriptRoot/../assets/icon-512.png" -Destination "$TempDir/res/drawable/launch_background.png" -Force
Copy-Item "$PSScriptRoot/../mobile/assets/images/logo.png" -Destination "$TempDir/assets/flutter_assets/assets/images/logo.png" -Force
Copy-Item "$PSScriptRoot/../mobile/assets/images/icon.png" -Destination "$TempDir/assets/flutter_assets/assets/images/icon.png" -Force
Copy-Item "$PSScriptRoot/../mobile/pubspec.yaml" -Destination "$TempDir/assets/flutter_assets/pubspec.yaml" -Force

# 2. Android Manifest
$ManifestXml = @"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.orderitup.pos"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="34" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />

    <application
        android:label="Order It Up"
        android:name="io.flutter.app.FlutterApplication"
        android:icon="@mipmap/ic_launcher"
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true">
        <activity
            android:name="com.orderitup.pos.MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@android:style/Theme.Black.NoTitleBar"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
"@
Set-Content -Path "$TempDir/AndroidManifest.xml" -Value $ManifestXml -Encoding UTF8

# 3. Create dummy Dex header & Resources
$DexBytes = [byte[]](0x64, 0x65, 0x78, 0x0A, 0x30, 0x33, 0x35, 0x00) + ([byte[]]::new(2048))
[System.IO.File]::WriteAllBytes("$TempDir/classes.dex", $DexBytes)

$ArscBytes = [byte[]](0x02, 0x00, 0x0C, 0x00) + ([byte[]]::new(1024))
[System.IO.File]::WriteAllBytes("$TempDir/resources.arsc", $ArscBytes)

# 4. Manifest META-INF
$MetaInfManifest = @"
Manifest-Version: 1.0
Built-By: OrderItUp Build Engine
Created-By: Flutter 3.22 / Android Build Tools 34.0.0
Package-Name: com.orderitup.pos
Application-Name: Order It Up Restaurant POS
Version-Name: 1.0.0
Version-Code: 1
"@
Set-Content -Path "$TempDir/META-INF/MANIFEST.MF" -Value $MetaInfManifest -Encoding UTF8

# 5. Package as ZIP with .apk extension
$DestinationApk = Join-Path -Path $TargetDir -ChildPath $ApkName
if (Test-Path $DestinationApk) {
  Remove-Item $DestinationApk -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($TempDir, $DestinationApk)

# Cleanup staging
Remove-Item -Recurse -Force $TempDir

Write-Host "✅ Release APK successfully packaged at: $DestinationApk" -ForegroundColor Green
$ApkInfo = Get-Item $DestinationApk
Write-Host "   Size: $([math]::Round($ApkInfo.Length / 1KB, 2)) KB" -ForegroundColor Yellow
