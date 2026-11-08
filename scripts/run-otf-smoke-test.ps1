param(
  [Parameter(Mandatory = $true)]
  [string] $NodePath,

  [ValidateRange(1900, 2200)]
  [int] $Season,

  [switch] $VerifyErrorStates
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'otf-secret.ps1')

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testScript = Join-Path $PSScriptRoot 'otf-smoke-test.ts'

if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) {
  throw 'Exécutable Node.js introuvable.'
}

Set-LocalOtfEnvironment
try {
  Push-Location $projectRoot
  try {
    $nodeArguments = @('--use-system-ca', '--experimental-strip-types', $testScript)
    if ($PSBoundParameters.ContainsKey('Season')) {
      $nodeArguments += @('--season', [string]$Season)
    }
    if ($VerifyErrorStates) {
      $nodeArguments += '--verify-errors'
    }

    & $NodePath @nodeArguments
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
} finally {
  Clear-LocalOtfEnvironment
}
