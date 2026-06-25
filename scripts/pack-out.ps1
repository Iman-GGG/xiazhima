param(
  [string]$OutDir = "$PSScriptRoot\..\out",
  [string]$ZipPath = "$PSScriptRoot\..\out.zip"
)

if (-Not (Test-Path $OutDir)) {
  Write-Error "Out directory not found: $OutDir"
  exit 1
}

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

Compress-Archive -Path "$OutDir\*" -DestinationPath $ZipPath
Write-Host "Created $ZipPath"
