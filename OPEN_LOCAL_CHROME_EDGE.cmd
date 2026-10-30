@echo off
setlocal
cd /d "%~dp0"
title EventQA - Chrome / Edge tren may cua ban
where node >nul 2>nul
if errorlevel 1 (
  echo Can cai Node.js 24 tro len tu https://nodejs.org/ roi mo lai file nay.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo Can Node.js 24 tro len. Phien ban hien tai:
  node --version
  pause
  exit /b 1
)
node --input-type=module -e "await import('ajv'); await import('exceljs'); await import('json5');" >nul 2>nul
if errorlevel 1 (
  echo Dang cai dependency theo package-lock.json...
  call npm.cmd ci --ignore-scripts --no-audit --no-fund
  if errorlevel 1 (
    echo Cai dependency that bai. Kiem tra ket noi mang va thu lai.
    pause
    exit /b 1
  )
)
echo Chon Chrome hoac Edge trong giao dien, nhap URL roi bam Mo trinh duyet test.
echo Giu cua so nay mo trong khi test. Dung: Ctrl+C.
node src\cli.mjs serve --mode cdp --open
if errorlevel 1 pause
