@echo off
title Order It Up - Desktop POS
cd /d "%~dp0"
echo Starting Order It Up Desktop POS...
set ELECTRON_RUN_AS_NODE=
start "" "node_modules\electron\dist\electron.exe" .
echo Order It Up is launching on your desktop!
