@echo off
setlocal
cd /d "%~dp0"

set "CLASS_NODE="
for /f "delims=" %%N in ('where.exe node.exe 2^>nul') do if not defined CLASS_NODE set "CLASS_NODE=%%N"
if not defined CLASS_NODE (
  for /d %%D in ("%ProgramFiles%\WindowsApps\OpenAI.CodexPrimaryRuntime.*") do (
    if exist "%%~fD\dependencies\node\bin\node.exe" set "CLASS_NODE=%%~fD\dependencies\node\bin\node.exe"
  )
)
if not defined CLASS_NODE (
  echo Node.js 18 or newer is required. Install Node.js or open this project in the Codex terminal.
  pause
  exit /b 1
)

"%CLASS_NODE%" server.js
if errorlevel 1 pause
