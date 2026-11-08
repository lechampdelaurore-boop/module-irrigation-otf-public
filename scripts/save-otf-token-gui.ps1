Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
. (Join-Path $PSScriptRoot 'otf-secret.ps1')

$form = [Windows.Forms.Form]::new()
$form.Text = 'Connexion en lecture à Ouvre ta ferme'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = [Drawing.Size]::new(560, 225)
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true

$title = [Windows.Forms.Label]::new()
$title.Text = 'Saisir la nouvelle clé API OTF'
$title.Font = [Drawing.Font]::new('Segoe UI Semibold', 13)
$title.AutoSize = $true
$title.Location = [Drawing.Point]::new(24, 22)
$form.Controls.Add($title)

$help = [Windows.Forms.Label]::new()
$help.Text = "La saisie est masquée. La clé sera gardée hors du projet et de OneDrive,`navec un accès limité à votre compte Windows."
$help.Font = [Drawing.Font]::new('Segoe UI', 9)
$help.AutoSize = $true
$help.Location = [Drawing.Point]::new(25, 58)
$form.Controls.Add($help)

$tokenBox = [Windows.Forms.TextBox]::new()
$tokenBox.Location = [Drawing.Point]::new(28, 108)
$tokenBox.Size = [Drawing.Size]::new(504, 27)
$tokenBox.UseSystemPasswordChar = $true
$tokenBox.Font = [Drawing.Font]::new('Consolas', 10)
$form.Controls.Add($tokenBox)

$saveButton = [Windows.Forms.Button]::new()
$saveButton.Text = 'Enregistrer et continuer'
$saveButton.Location = [Drawing.Point]::new(335, 165)
$saveButton.Size = [Drawing.Size]::new(197, 34)
$saveButton.DialogResult = [Windows.Forms.DialogResult]::OK
$form.Controls.Add($saveButton)
$form.AcceptButton = $saveButton

$cancelButton = [Windows.Forms.Button]::new()
$cancelButton.Text = 'Annuler'
$cancelButton.Location = [Drawing.Point]::new(225, 165)
$cancelButton.Size = [Drawing.Size]::new(98, 34)
$cancelButton.DialogResult = [Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancelButton)
$form.CancelButton = $cancelButton

$form.Add_Shown({ $tokenBox.Focus() })
$result = $form.ShowDialog()

if ($result -ne [Windows.Forms.DialogResult]::OK) {
  exit 2
}

$plainToken = $tokenBox.Text.Trim()
$tokenBox.Clear()

if ($plainToken.Length -lt 20) {
  [Windows.Forms.MessageBox]::Show(
    'La clé saisie semble vide ou trop courte.',
    'Clé non enregistrée',
    [Windows.Forms.MessageBoxButtons]::OK,
    [Windows.Forms.MessageBoxIcon]::Warning
  ) | Out-Null
  exit 3
}

$secureToken = ConvertTo-SecureString -String $plainToken -AsPlainText -Force
$plainToken = $null

try {
  Save-LocalOtfToken -SecureToken $secureToken
} finally {
  $secureToken.Dispose()
  $form.Dispose()
}

[Windows.Forms.MessageBox]::Show(
  'La clé est enregistrée dans les données locales Windows. Codex peut maintenant tester les lectures GET.',
  'Configuration terminée',
  [Windows.Forms.MessageBoxButtons]::OK,
  [Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
