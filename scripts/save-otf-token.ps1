Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'otf-secret.ps1')

Write-Host ''
Write-Host 'Configuration locale de la lecture OTF'
Write-Host 'La clé sera conservée hors du projet avec un accès limité à votre compte Windows.'
Write-Host ''

$secureToken = Read-Host 'Collez la nouvelle clé OTF puis appuyez sur Entrée' -AsSecureString

try {
  if ($secureToken.Length -lt 20) {
    throw 'La clé saisie semble vide ou trop courte.'
  }

  Save-LocalOtfToken -SecureToken $secureToken

  Write-Host ''
  Write-Host 'Clé enregistrée dans les données locales Windows.' -ForegroundColor Green
} finally {
  $secureToken.Dispose()
}
