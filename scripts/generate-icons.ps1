#!/usr/bin/env pwsh
# Programmatic icon generator for Shotday.
#
# Renders the brand icon (3 concentric rings + center dot on a teal
# gradient) at exact square dimensions, then writes:
#   - assets/icon.png            1024 x 1024 (iOS master)
#   - assets/adaptive-icon.png   1024 x 1024 (Android foreground)
#   - assets/splash-icon.png     1242 x 1242 (extra padding for splash)
#   - assets/favicon.png           96 x 96   (web)
#
# Why programmatic instead of an AI-generated PNG?  The AI image generator
# produces 1536x1024 outputs that aren't true squares, and Apple rejects
# any icon that isn't pixel-perfect 1024 x 1024 with 100% alpha (no
# transparency).  Drawing the artwork ourselves with System.Drawing gives
# deterministic, repeatable results and exact dimensions on every run.

param(
    [string]$AssetsDir = "$PSScriptRoot/../assets"
)

Add-Type -AssemblyName System.Drawing

# ───────────────────────────────────────────────────────────
# Brand tokens
# ───────────────────────────────────────────────────────────
$BrandTopLeft     = [System.Drawing.Color]::FromArgb(255, 13, 92, 90)    # #0D5C5A deep teal
$BrandBottomRight = [System.Drawing.Color]::FromArgb(255, 20, 184, 166)  # #14B8A6 mint
$RingColor        = [System.Drawing.Color]::White

# Drawing routine — renders the icon at any square size, scales rings.
function New-ShotdayIcon {
    param(
        [int]$Size,
        [string]$OutputPath,
        [bool]$Transparent = $false
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    if ($Transparent) {
        $g.Clear([System.Drawing.Color]::Transparent)
    } else {
        $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
        $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $BrandTopLeft, $BrandBottomRight, ([System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
        $g.FillRectangle($brush, $rect)
        $brush.Dispose()
    }

    $cx = $Size / 2.0
    $cy = $Size / 2.0

    # Ring radii are a fraction of the canvas so they scale uniformly.
    $r1 = $Size * 0.36   # outermost
    $r2 = $Size * 0.26
    $r3 = $Size * 0.16

    # Stroke width scales but never thinner than 6px so it doesn't disappear.
    $stroke = [Math]::Max(6, $Size * 0.02)

    $pen = New-Object System.Drawing.Pen $RingColor, $stroke
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    foreach ($r in $r1, $r2, $r3) {
        $g.DrawEllipse($pen, [float]($cx - $r), [float]($cy - $r), [float]($r * 2), [float]($r * 2))
    }
    $pen.Dispose()

    # Center dot.
    $dotR = $Size * 0.06
    $solidBrush = New-Object System.Drawing.SolidBrush $RingColor
    $g.FillEllipse($solidBrush, [float]($cx - $dotR), [float]($cy - $dotR), [float]($dotR * 2), [float]($dotR * 2))
    $solidBrush.Dispose()

    $g.Dispose()
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "Wrote $OutputPath ($Size x $Size)"
}

# ───────────────────────────────────────────────────────────
# Splash background — centred logo with extra padding.
# Apple HIG suggests roughly 50-60% of canvas occupied by logo.
# ───────────────────────────────────────────────────────────
function New-ShotdaySplash {
    param(
        [int]$Size,
        [string]$OutputPath
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Solid white background — splash bg is set in app.json to white.
    $g.Clear([System.Drawing.Color]::White)

    $cx = $Size / 2.0
    $cy = $Size / 2.0

    # Smaller rings so there's breathing room (≈40% of canvas).
    $r1 = $Size * 0.18
    $r2 = $Size * 0.12
    $r3 = $Size * 0.07
    $stroke = [Math]::Max(6, $Size * 0.014)

    $teal = [System.Drawing.Color]::FromArgb(255, 15, 118, 110)  # #0F766E
    $pen = New-Object System.Drawing.Pen $teal, $stroke

    foreach ($r in $r1, $r2, $r3) {
        $g.DrawEllipse($pen, [float]($cx - $r), [float]($cy - $r), [float]($r * 2), [float]($r * 2))
    }
    $pen.Dispose()

    $dotR = $Size * 0.025
    $solidBrush = New-Object System.Drawing.SolidBrush $teal
    $g.FillEllipse($solidBrush, [float]($cx - $dotR), [float]($cy - $dotR), [float]($dotR * 2), [float]($dotR * 2))
    $solidBrush.Dispose()

    $g.Dispose()
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "Wrote $OutputPath ($Size x $Size)"
}

# ───────────────────────────────────────────────────────────
# Outputs
# ───────────────────────────────────────────────────────────
if (-not (Test-Path $AssetsDir)) {
    New-Item -ItemType Directory -Path $AssetsDir -Force | Out-Null
}

$resolved = (Resolve-Path $AssetsDir).Path

New-ShotdayIcon -Size 1024 -OutputPath (Join-Path $resolved 'icon.png')
New-ShotdayIcon -Size 1024 -OutputPath (Join-Path $resolved 'adaptive-icon.png')
New-ShotdaySplash -Size 1242 -OutputPath (Join-Path $resolved 'splash-icon.png')
New-ShotdayIcon -Size 96 -OutputPath (Join-Path $resolved 'favicon.png')

Write-Host ""
Write-Host "All icons generated successfully."
