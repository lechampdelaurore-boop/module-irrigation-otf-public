Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-LocalOtfSecretPath {
  $localDataRoot = [IO.Path]::GetFullPath(
    [Environment]::GetFolderPath('LocalApplicationData')
  )
  if ([string]::IsNullOrWhiteSpace($localDataRoot)) {
    throw 'Le dossier de données locales Windows est indisponible.'
  }

  return Join-Path $localDataRoot 'OuvreTaFermeIrrigation\otf-token.secret'
}

function Save-LocalOtfToken {
  param(
    [Parameter(Mandatory = $true)]
    [Security.SecureString] $SecureToken
  )

  $secretPath = Get-LocalOtfSecretPath
  $secretDirectory = Split-Path -Parent $secretPath
  New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null

  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $directoryAcl = [Security.AccessControl.DirectorySecurity]::new()
  $directoryAcl.SetAccessRuleProtection($true, $false)
  $directoryRule = [Security.AccessControl.FileSystemAccessRule]::new(
    $identity,
    [Security.AccessControl.FileSystemRights]::FullControl,
    [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit',
    [Security.AccessControl.PropagationFlags]::None,
    [Security.AccessControl.AccessControlType]::Allow
  )
  $directoryAcl.AddAccessRule($directoryRule)
  Set-Acl -LiteralPath $secretDirectory -AclObject $directoryAcl

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
  try {
    $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    [IO.File]::WriteAllText(
      $secretPath,
      $plainToken,
      [Text.UTF8Encoding]::new($false)
    )
  } finally {
    $plainToken = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Get-LocalOtfToken {
  $secretPath = Get-LocalOtfSecretPath

  if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) {
    throw 'Clé OTF locale absente. Lancez le formulaire de configuration.'
  }

  $token = [IO.File]::ReadAllText($secretPath).Trim()
  if ($token.Length -lt 20) {
    throw 'La clé OTF locale est invalide.'
  }
  return $token
}

function Set-LocalOtfEnvironment {
  $env:OTF_DATA_SOURCE = 'live'
  $env:OTF_API_BASE_URL = 'https://api.ouvretaferme.org/0.1beta'
  $env:OTF_API_TOKEN = Get-LocalOtfToken
  $env:LOCAL_DEMO_USER = 'true'
}

function Clear-LocalOtfEnvironment {
  Remove-Item Env:OTF_API_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:OTF_API_BASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:OTF_DATA_SOURCE -ErrorAction SilentlyContinue
  Remove-Item Env:LOCAL_DEMO_USER -ErrorAction SilentlyContinue
}
