# Kuran Teyit - Ekler gorsellerini orijinal quran-tft deposundan indirir.
$ErrorActionPreference = "Stop"
$SourceRoot = "https://raw.githubusercontent.com/SubmitterTech/quran-tft/main/app/src/assets/pictures"
$TargetDir = $PSScriptRoot
$Files = @(
  "4.jpg"
  "5.jpg"
  "9.jpg"
  "10.jpg"
  "13.jpg"
  "14.jpg"
  "15.jpg"
  "16.jpg"
  "17.jpg"
  "18.jpg"
  "19.jpg"
  "20.jpg"
  "21.jpg"
  "22.jpg"
  "22-1.jpg"
  "22-2.jpg"
  "22-3.jpg"
  "22-4.jpg"
  "22-5.jpg"
  "22-6.jpg"
  "22-7.jpg"
  "23.jpg"
  "24.jpg"
  "25.jpg"
  "26.jpg"
  "27.jpg"
)

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
foreach ($File in $Files) {
  $Url = "$SourceRoot/$File"
  $Out = Join-Path $TargetDir $File
  Write-Host "Indiriliyor: $File"
  Invoke-WebRequest -Uri $Url -OutFile $Out
}
Write-Host "Tamamlandi. $($Files.Count) gorsel indirildi."
