# =====================================================================
# 00_registro_expediente.ps1 - Auditoría del Sistema de Gestión Parroquial
# Genera tres evidencias del expediente:
#   EV-F01-001  Huella SHA-256 del ZIP del código entregado
#   EV-F01-002  Huella SHA-256 del dump de la base de datos
#   EV-F06-001  Registro de instalación desde el paquete entregado (npm install)
# Opcional: EV-F01-003, huella de la ficha técnica en PDF (-Ficha).
#
# Uso (PowerShell, desde la carpeta del kit):
#   .\00_registro_expediente.ps1 -Zip "..\SyS.zip" -Dump "..\SyS-Backup_2.0" -Ejecutor "Su nombre"
#   (agregue -Ficha "..\PROYECTO_HEMI1_IS1_FINAL.pdf" para la ficha y -Frontend para instalar también el frontend)
# Si PowerShell bloquea el script:
#   powershell -ExecutionPolicy Bypass -File .\00_registro_expediente.ps1 -Zip ... -Dump ... -Ejecutor ...
#
# La instalación se hace en una carpeta temporal NUEVA, descomprimida del ZIP,
# para demostrar que el producto se instala desde el paquete tal como se entregó.
# No sube ni muestra el contenido de backend\.env.
# =====================================================================
param(
  [Parameter(Mandatory = $true)][string]$Zip,
  [Parameter(Mandatory = $true)][string]$Dump,
  [Parameter(Mandatory = $true)][string]$Ejecutor,
  [string]$Ficha = "",
  [string]$Salida = ".\evidencias\expediente",
  [switch]$Frontend
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $Salida | Out-Null

# Huellas registradas en el informe (Tabla 11)
$ESPERADO_ZIP   = "D1CD257B1C7F461ACE63E955FCC6D441536E6635604417BC56643E40A3602BA1"
$ESPERADO_DUMP  = "5576DDE00E2558984DDA8966883244866F0E75F4A36C5A80C8F47083A552E4AE"
$ESPERADO_FICHA = "6C0B962463C89AB3C1B00E2EB8342D53B65363611AC4349B7CE1CE2A56B37A33"

function Ahora { (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") + " (UTC" + (Get-Date).ToString("zzz") + ")" }

function Registrar-Hash([string]$Archivo, [string]$Ev, [string]$Nombre, [string]$Esperado) {
  $f = Get-Item -LiteralPath $Archivo
  $h = Get-FileHash -Algorithm SHA256 -LiteralPath $Archivo
  if ($h.Hash -eq $Esperado) { $estado = "COINCIDE con el informe" } else { $estado = "NO COINCIDE con el informe (esperado $Esperado)" }
  $lineas = @(
    "$Ev | Huella SHA-256 de $Nombre",
    "Fecha y hora de ejecución: $(Ahora)",
    "Ejecutor: $Ejecutor | Equipo: $env:COMPUTERNAME",
    "Archivo: $($f.Name)",
    "Tamaño: $($f.Length) bytes",
    "Última modificación del archivo: $($f.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))",
    "Algoritmo: SHA256",
    "Hash: $($h.Hash)",
    "Resultado: $estado"
  )
  $destino = Join-Path $Salida ("{0}_hash_{1}.txt" -f $Ev, $Nombre)
  $lineas | Out-File -Encoding utf8 -FilePath $destino
  $lineas | ForEach-Object { Write-Host $_ }
  Write-Host ""
}

Write-Host "=== HUELLAS DEL EXPEDIENTE ===`n"
Registrar-Hash $Zip  "EV-F01-001" "ZIP_codigo" $ESPERADO_ZIP
Registrar-Hash $Dump "EV-F01-002" "dump_BD"    $ESPERADO_DUMP
if ($Ficha -ne "") { Registrar-Hash $Ficha "EV-F01-003" "ficha_tecnica_PDF" $ESPERADO_FICHA }

# ---------------- EV-F06-001: instalación desde el paquete ----------------
$log = Join-Path $Salida "EV-F06-001_instalacion.txt"
$destinoTemp = Join-Path $env:TEMP ("SyS_instalacion_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
$versionNode = (cmd /c "node -v 2>&1") -join " "
$versionNpm  = (cmd /c "npm -v 2>&1") -join " "
$so = (Get-CimInstance Win32_OperatingSystem)

$cabecera = @(
  "EV-F06-001 | Registro de instalación del entorno de pruebas desde el paquete entregado",
  "Fecha y hora de inicio: $(Ahora)",
  "Ejecutor: $Ejecutor | Equipo: $env:COMPUTERNAME",
  "Sistema: $($so.Caption) $($so.Version) | Node.js $versionNode | npm $versionNpm",
  "Paquete: $((Get-Item -LiteralPath $Zip).Name) | SHA-256 $((Get-FileHash -Algorithm SHA256 -LiteralPath $Zip).Hash)",
  "Carpeta temporal de instalación (nueva): $destinoTemp",
  ""
)
$cabecera | Out-File -Encoding utf8 -FilePath $log
$cabecera | ForEach-Object { Write-Host $_ }

Write-Host "Descomprimiendo el ZIP..."
Expand-Archive -LiteralPath $Zip -DestinationPath $destinoTemp

$paquetes = Get-ChildItem -Path $destinoTemp -Recurse -Filter package.json |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' }
$objetivos = @($paquetes | Where-Object { $_.DirectoryName -match '\\backend$' } | Select-Object -First 1)
if ($Frontend) { $objetivos += @($paquetes | Where-Object { $_.DirectoryName -match '\\frontend$' } | Select-Object -First 1) }
if ($objetivos.Count -eq 0 -or $null -eq $objetivos[0]) { throw "No se encontró backend\package.json dentro del ZIP." }

$ErrorActionPreference = "Continue"
foreach ($p in $objetivos) {
  $carpeta = $p.DirectoryName
  $relativa = $carpeta.Substring($destinoTemp.Length).TrimStart('\')
  $inicio = Get-Date
  $t = "=== npm install en $relativa | inicio $(Ahora) ==="
  Add-Content -Encoding utf8 -Path $log -Value $t; Write-Host $t
  Push-Location $carpeta
  $salidaNpm = cmd /c "npm install 2>&1"
  $codigo = $LASTEXITCODE
  Pop-Location
  Add-Content -Encoding utf8 -Path $log -Value $salidaNpm
  $salidaNpm | ForEach-Object { Write-Host $_ }
  $pie = "Código de salida: $codigo ({0}) | Duración: {1:N1} s | fin $(Ahora)" -f ($(if ($codigo -eq 0) { "instalación correcta" } else { "ERROR" }), ((Get-Date) - $inicio).TotalSeconds)
  Add-Content -Encoding utf8 -Path $log -Value @($pie, "")
  Write-Host $pie; Write-Host ""
}

Write-Host "Evidencias guardadas en: $((Resolve-Path $Salida).Path)"
Write-Host "Tome una captura de esta ventana con el reloj de Windows visible."
