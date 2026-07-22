# Telecharge Python embeddable Windows (amd64), installe pip, pypdf et reportlab dans bundle-python/win.
# Requis pour `npm run dist:win` (installateur autonome sans Python systeme sur le poste cible).
$ErrorActionPreference = "Stop"
$AppDir = Split-Path -Parent $PSScriptRoot
$Target = Join-Path $AppDir "bundle-python\win"
$PyVer = "3.11.9"
$ZipName = "python-$PyVer-embed-amd64.zip"
$Url = "https://www.python.org/ftp/python/$PyVer/$ZipName"

New-Item -ItemType Directory -Force -Path $Target | Out-Null

$pythonExe = Join-Path $Target "python.exe"
if (-not (Test-Path $pythonExe)) {
  Write-Host "[bundle-python] Telechargement $Url"
  $zipPath = Join-Path $env:TEMP $ZipName
  Invoke-WebRequest -Uri $Url -OutFile $zipPath
  Write-Host "[bundle-python] Extraction vers $Target"
  Expand-Archive -Path $zipPath -DestinationPath $Target -Force
}

# python311._pth : import site + Lib\site-packages (indispensable pour pip avec l'embeddable)
$pthPath = Join-Path $Target "python311._pth"
$siteDir = Join-Path $Target "Lib\site-packages"
New-Item -ItemType Directory -Force -Path $siteDir | Out-Null
$pthLines = @(
  "python311.zip",
  ".",
  "Lib\site-packages",
  "import site"
)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($pthPath, $pthLines, $utf8NoBom)
Write-Host "[bundle-python] Ecrit $pthPath (UTF-8 sans BOM)"

$getPip = Join-Path $env:TEMP "get-pip.py"
if (-not (Test-Path $getPip)) {
  Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip
}

Push-Location $Target
try {
  Write-Host "[bundle-python] pip / dependances"
  & .\python.exe $getPip --no-warn-script-location
  & .\python.exe -m pip install --upgrade pip
  & .\python.exe -m pip install "pypdf>=4.0" "reportlab>=4.0" "jsonschema>=4.0"
} finally {
  Pop-Location
}

Write-Host "[bundle-python] Termine : $Target"
