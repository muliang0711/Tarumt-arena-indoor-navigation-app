$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$editorDir = Join-Path $root 'village_map_editor'
$serverScript = Join-Path $editorDir 'server.js'
$editorUrl = 'http://localhost:4173/'

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$editorDir'; node '$serverScript'"
)

$deadline = (Get-Date).AddSeconds(10)
do {
  Start-Sleep -Milliseconds 250
  try {
    Invoke-WebRequest -Uri $editorUrl -UseBasicParsing | Out-Null
    Start-Process $editorUrl
    exit 0
  } catch {
    # Keep polling until the local server is ready.
  }
} while ((Get-Date) -lt $deadline)

Write-Error "Village Map Editor server did not become ready at $editorUrl within 10 seconds."
