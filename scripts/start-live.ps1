param(
  [Parameter(Mandatory = $true)]
  [string] $NodePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'otf-secret.ps1')

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$vinextCli = Join-Path $projectRoot 'node_modules\vinext\dist\cli.js'

if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) {
  throw 'Exécutable Node.js introuvable.'
}
if (-not (Test-Path -LiteralPath $vinextCli -PathType Leaf)) {
  throw 'Vinext est absent. Installez les dépendances du projet.'
}

Set-LocalOtfEnvironment
try {
  Push-Location $projectRoot
  try {
    & $NodePath --use-system-ca $vinextCli dev
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
} finally {
  Clear-LocalOtfEnvironment
}
