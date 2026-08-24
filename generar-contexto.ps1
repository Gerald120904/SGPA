# ============================================================
# SGPA - Generador de contexto completo del proyecto
# Ejecutar desde la raíz:
# C:\Users\Estudiantes\Desktop\SGPA
# ============================================================

$Root = Get-Location
$Output = Join-Path $Root "SGPA_CONTEXT_ACTUAL.txt"

# Carpetas que NO queremos incluir
$ExcludedFolders = @(
    "node_modules",
    ".git",
    "dist",
    "out",
    "coverage",
    ".next",
    ".cache",
    ".vite",
    "build"
)

# Archivos que NO queremos incluir por seguridad o ruido
$ExcludedFiles = @(
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "SGPA_CONTEXT_ACTUAL.txt"
)

# Extensiones útiles
$AllowedExtensions = @(
    ".ts",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".html",
    ".css",
    ".scss",
    ".sql",
    ".md",
    ".txt",
    ".yml",
    ".yaml"
)

# Archivos sin extensión que sí interesan
$AllowedNames = @(
    "Dockerfile"
)

# Limpiar archivo anterior
if (Test-Path $Output) {
    Remove-Item $Output -Force
}

function Add-Line {
    param(
        [string]$Text = ""
    )

    Add-Content `
        -Path $Output `
        -Value $Text `
        -Encoding UTF8
}

function Is-ExcludedPath {
    param(
        [System.IO.FileInfo]$File
    )

    $relative = $File.FullName.Substring($Root.Path.Length)

    foreach ($folder in $ExcludedFolders) {
        if (
            $relative -match (
                "[\\/]" +
                [regex]::Escape($folder) +
                "([\\/]|$)"
            )
        ) {
            return $true
        }
    }

    return $false
}

# ============================================================
# CABECERA
# ============================================================

Add-Line "============================================================"
Add-Line "SGPA - CONTEXTO ACTUAL DEL PROYECTO"
Add-Line "============================================================"
Add-Line ""
Add-Line "Generado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Line "Ruta: $($Root.Path)"
Add-Line ""

# ============================================================
# INFORMACIÓN DE GIT
# ============================================================

Add-Line "============================================================"
Add-Line "GIT"
Add-Line "============================================================"
Add-Line ""

try {
    $branch = git branch --show-current 2>$null

    if ($branch) {
        Add-Line "Rama actual: $branch"
        Add-Line ""
        Add-Line "git status:"
        Add-Line ""

        $gitStatus = git status --short 2>$null

        if ($gitStatus) {
            foreach ($line in $gitStatus) {
                Add-Line $line
            }
        }
        else {
            Add-Line "Sin cambios pendientes."
        }
    }
    else {
        Add-Line "No se pudo obtener información de Git."
    }
}
catch {
    Add-Line "Git no disponible."
}

Add-Line ""
Add-Line ""

# ============================================================
# VERSIONES
# ============================================================

Add-Line "============================================================"
Add-Line "VERSIONES DEL ENTORNO"
Add-Line "============================================================"
Add-Line ""

try {
    Add-Line "Node: $(node --version)"
}
catch {
    Add-Line "Node: no disponible"
}

try {
    Add-Line "npm: $(npm --version)"
}
catch {
    Add-Line "npm: no disponible"
}

try {
    Add-Line "Git: $(git --version)"
}
catch {
    Add-Line "Git: no disponible"
}

Add-Line ""
Add-Line ""

# ============================================================
# ESTRUCTURA DEL PROYECTO
# ============================================================

Add-Line "============================================================"
Add-Line "ESTRUCTURA DEL PROYECTO"
Add-Line "============================================================"
Add-Line ""

$AllFiles =
    Get-ChildItem `
        -Path $Root `
        -Recurse `
        -File `
        -Force |
    Where-Object {

        if (Is-ExcludedPath $_) {
            return $false
        }

        if ($ExcludedFiles -contains $_.Name) {
            return $false
        }

        return $true
    } |
    Sort-Object FullName

foreach ($file in $AllFiles) {

    $relative =
        $file.FullName.Substring(
            $Root.Path.Length + 1
        )

    Add-Line $relative
}

Add-Line ""
Add-Line ""

# ============================================================
# VARIABLES DE ENTORNO - SOLO NOMBRES, NUNCA VALORES
# ============================================================

Add-Line "============================================================"
Add-Line "VARIABLES DEFINIDAS EN .ENV (SIN MOSTRAR SECRETOS)"
Add-Line "============================================================"
Add-Line ""

$envFiles =
    Get-ChildItem `
        -Path $Root `
        -Recurse `
        -File `
        -Force |
    Where-Object {

        if (Is-ExcludedPath $_) {
            return $false
        }

        return $_.Name -like ".env*"
    }

if ($envFiles.Count -eq 0) {
    Add-Line "No se encontraron archivos .env."
}
else {

    foreach ($envFile in $envFiles) {

        $relative =
            $envFile.FullName.Substring(
                $Root.Path.Length + 1
            )

        Add-Line ""
        Add-Line "ENV: $relative"
        Add-Line "------------------------------------------------------------"

        Get-Content $envFile.FullName |
        ForEach-Object {

            $line = $_.Trim()

            if (
                $line -and
                !$line.StartsWith("#") -and
                $line.Contains("=")
            ) {

                $key =
                    $line.Split(
                        "=",
                        2
                    )[0].Trim()

                Add-Line "$key=<OCULTO>"
            }
        }
    }
}

Add-Line ""
Add-Line ""

# ============================================================
# CONTENIDO DE ARCHIVOS DE CÓDIGO
# ============================================================

Add-Line "============================================================"
Add-Line "CONTENIDO DE ARCHIVOS"
Add-Line "============================================================"
Add-Line ""

$CodeFiles =
    $AllFiles |
    Where-Object {

        ($AllowedExtensions -contains $_.Extension.ToLower()) -or
        ($AllowedNames -contains $_.Name)

    }

foreach ($file in $CodeFiles) {

    # Evitar meter archivos gigantes accidentalmente
    if ($file.Length -gt 1MB) {

        $relative =
            $file.FullName.Substring(
                $Root.Path.Length + 1
            )

        Add-Line ""
        Add-Line "============================================================"
        Add-Line "ARCHIVO: $relative"
        Add-Line "============================================================"
        Add-Line "[OMITIDO: archivo mayor a 1 MB]"
        Add-Line ""

        continue
    }

    $relative =
        $file.FullName.Substring(
            $Root.Path.Length + 1
        )

    Add-Line ""
    Add-Line "============================================================"
    Add-Line "ARCHIVO: $relative"
    Add-Line "============================================================"
    Add-Line ""

    try {
        $content =
            Get-Content `
                -Path $file.FullName `
                -Raw `
                -Encoding UTF8

        Add-Line $content
    }
    catch {
        Add-Line "[No se pudo leer este archivo]"
    }

    Add-Line ""
}

# ============================================================
# FIN
# ============================================================

Add-Line ""
Add-Line "============================================================"
Add-Line "FIN DEL CONTEXTO SGPA"
Add-Line "============================================================"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "CONTEXTO SGPA GENERADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Archivo:"
Write-Host $Output -ForegroundColor Cyan
Write-Host ""
Write-Host "SGPA_CONTEXT.txt." -ForegroundColor Yellow
Write-Host ""