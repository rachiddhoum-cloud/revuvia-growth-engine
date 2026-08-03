param(
  [string]$CredentialsFile = "$PSScriptRoot\gsc-oauth-credentials.json"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path $CredentialsFile)) {
  Write-Error "Missing $CredentialsFile. Create OAuth client in GCP Console first."
}

$data = Get-Content $CredentialsFile -Raw | ConvertFrom-Json
if (-not $data.ok -or -not $data.clientId -or -not $data.clientSecret) {
  Write-Error "Invalid credentials file. Expected { ok: true, clientId, clientSecret }."
}

Write-Output "Setting Vercel production env vars..."
$data.clientId | vercel env add GSC_CLIENT_ID production --force
$data.clientSecret | vercel env add GSC_CLIENT_SECRET production --force

Write-Output "Redeploying..."
vercel deploy --prod --yes

Write-Output "Checking GSC status..."
Start-Sleep -Seconds 8
try {
  $status = Invoke-RestMethod -Uri "https://revuvia-growth-engine.vercel.app/api/gsc/status"
  $status | ConvertTo-Json -Depth 4
} catch {
  Write-Output $_.Exception.Message
}

Write-Output "Done. Connect GSC at https://revuvia-growth-engine.vercel.app/settings"
