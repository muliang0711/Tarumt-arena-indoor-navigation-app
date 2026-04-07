$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$editorDir = Join-Path $root 'village_map_editor'
$serverScript = Join-Path $editorDir 'server.js'

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$editorDir'; node '$serverScript'"
)

Start-Sleep -Milliseconds 800
Start-Process 'http://localhost:4173'
