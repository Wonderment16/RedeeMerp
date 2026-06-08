$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-Canvas {
  param([int]$Size)

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::FromArgb(250, 250, 250))

  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Add-MapBackdrop {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size,
    [bool]$Transparent = $false
  )

  $darkRed = [System.Drawing.Color]::FromArgb(139, 0, 0)
  $deepRed = [System.Drawing.Color]::FromArgb(78, 0, 0)
  $gold = [System.Drawing.Color]::FromArgb(255, 215, 0)
  $softGold = [System.Drawing.Color]::FromArgb(85, 255, 215, 0)
  $road = [System.Drawing.Color]::FromArgb(65, 255, 255, 255)

  if (-not $Transparent) {
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      (New-Object System.Drawing.Rectangle 0, 0, $Size, $Size),
      $deepRed,
      $darkRed,
      45
    )
    $Graphics.FillRectangle($brush, 0, 0, $Size, $Size)
    $brush.Dispose()
  }

  $roadPen = New-Object System.Drawing.Pen $road, ([Math]::Max(3, $Size / 74))
  $roadPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $roadPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $roadPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $goldPen = New-Object System.Drawing.Pen $softGold, ([Math]::Max(2, $Size / 96))
  $goldPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $goldPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $goldPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $roads = @(
    @(@(0.05, 0.28), @(0.24, 0.21), @(0.47, 0.35), @(0.69, 0.29), @(0.95, 0.40)),
    @(@(0.00, 0.70), @(0.22, 0.61), @(0.43, 0.67), @(0.61, 0.55), @(1.00, 0.62)),
    @(@(0.20, 0.00), @(0.34, 0.24), @(0.30, 0.49), @(0.40, 0.78), @(0.33, 1.00)),
    @(@(0.78, 0.00), @(0.68, 0.22), @(0.75, 0.44), @(0.66, 0.73), @(0.84, 1.00)),
    @(@(0.02, 0.48), @(0.25, 0.45), @(0.48, 0.48), @(0.70, 0.45), @(0.98, 0.49))
  )

  foreach ($roadPoints in $roads) {
    $points = New-Object System.Drawing.PointF[] $roadPoints.Count
    for ($i = 0; $i -lt $roadPoints.Count; $i++) {
      $points[$i] = New-Object System.Drawing.PointF(
        [float]($roadPoints[$i][0] * $Size),
        [float]($roadPoints[$i][1] * $Size)
      )
    }
    $Graphics.DrawCurve($roadPen, $points, 0.52)
  }

  $route = New-Object System.Drawing.PointF[] 5
  $route[0] = New-Object System.Drawing.PointF ([float]($Size * 0.18)), ([float]($Size * 0.76))
  $route[1] = New-Object System.Drawing.PointF ([float]($Size * 0.34)), ([float]($Size * 0.56))
  $route[2] = New-Object System.Drawing.PointF ([float]($Size * 0.47)), ([float]($Size * 0.62))
  $route[3] = New-Object System.Drawing.PointF ([float]($Size * 0.60)), ([float]($Size * 0.42))
  $route[4] = New-Object System.Drawing.PointF ([float]($Size * 0.78)), ([float]($Size * 0.36))
  $Graphics.DrawCurve($goldPen, $route, 0.45)

  $roadPen.Dispose()
  $goldPen.Dispose()
}

function Add-BrandMark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size,
    [bool]$IconOnly = $false
  )

  $primary = [System.Drawing.Color]::FromArgb(139, 0, 0)
  $gold = [System.Drawing.Color]::FromArgb(255, 215, 0)
  $white = [System.Drawing.Color]::FromArgb(255, 255, 255)
  $shadow = [System.Drawing.Color]::FromArgb(70, 0, 0, 0)

  $centerX = $Size / 2
  $centerY = if ($IconOnly) { $Size * 0.48 } else { $Size * 0.39 }
  $logoSize = if ($IconOnly) { $Size * 0.60 } else { $Size * 0.48 }
  $pinHeight = if ($IconOnly) { $Size * 0.32 } else { $Size * 0.25 }
  $pinWidth = $pinHeight * 0.68
  $logoPath = "C:\Users\Admin\Downloads\rccg-logo.gif"

  if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile($logoPath)
    $logoRect = New-Object System.Drawing.RectangleF(
      [float]($centerX - $logoSize / 2),
      [float]($centerY - $logoSize / 2),
      [float]$logoSize,
      [float]$logoSize
    )
    $Graphics.FillEllipse((New-Object System.Drawing.SolidBrush $white), $logoRect)
    $clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $clipPath.AddEllipse($logoRect)
    $oldClip = $Graphics.Clip
    $Graphics.SetClip($clipPath)
    $Graphics.DrawImage($logo, $logoRect)
    $Graphics.Clip = $oldClip
    $Graphics.DrawEllipse((New-Object System.Drawing.Pen $gold, ([Math]::Max(4, $Size / 110))), $logoRect)
    $oldClip.Dispose()
    $clipPath.Dispose()
    $logo.Dispose()
  }

  $pinCenterX = $centerX + ($Size * 0.17)
  $pinCenterY = $centerY + ($Size * 0.13)

  $shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $shadowRect = New-Object System.Drawing.RectangleF(
    [float]($pinCenterX - $pinWidth / 2 + $Size * 0.018),
    [float]($pinCenterY - $pinHeight * 0.52 + $Size * 0.018),
    [float]$pinWidth,
    [float]($pinHeight * 0.70)
  )
  $shadowPath.AddEllipse($shadowRect)
  $shadowPath.AddPolygon(@(
    (New-Object System.Drawing.PointF ([float]($pinCenterX - $pinWidth * 0.26 + $Size * 0.018)), ([float]($pinCenterY + $pinHeight * 0.08 + $Size * 0.018))),
    (New-Object System.Drawing.PointF ([float]($pinCenterX + $pinWidth * 0.26 + $Size * 0.018)), ([float]($pinCenterY + $pinHeight * 0.08 + $Size * 0.018))),
    (New-Object System.Drawing.PointF ([float]($pinCenterX + $Size * 0.018)), ([float]($pinCenterY + $pinHeight * 0.50 + $Size * 0.018)))
  ))
  $Graphics.FillPath((New-Object System.Drawing.SolidBrush $shadow), $shadowPath)
  $shadowPath.Dispose()

  $pinPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $pinRect = New-Object System.Drawing.RectangleF(
    [float]($pinCenterX - $pinWidth / 2),
    [float]($pinCenterY - $pinHeight * 0.52),
    [float]$pinWidth,
    [float]($pinHeight * 0.70)
  )
  $pinPath.AddEllipse($pinRect)
  $pinPath.AddPolygon(@(
    (New-Object System.Drawing.PointF ([float]($pinCenterX - $pinWidth * 0.26)), ([float]($pinCenterY + $pinHeight * 0.08))),
    (New-Object System.Drawing.PointF ([float]($pinCenterX + $pinWidth * 0.26)), ([float]($pinCenterY + $pinHeight * 0.08))),
    (New-Object System.Drawing.PointF ([float]$pinCenterX), ([float]($pinCenterY + $pinHeight * 0.50)))
  ))
  $Graphics.FillPath((New-Object System.Drawing.SolidBrush $primary), $pinPath)
  $Graphics.DrawPath((New-Object System.Drawing.Pen $gold, ([Math]::Max(3, $Size / 94))), $pinPath)
  $pinPath.Dispose()

  $holeRadius = $pinWidth * 0.15
  $holeRect = New-Object System.Drawing.RectangleF(
    [float]($pinCenterX - $holeRadius),
    [float]($pinCenterY - $holeRadius * 1.24),
    [float]($holeRadius * 2),
    [float]($holeRadius * 2)
  )
  $Graphics.FillEllipse((New-Object System.Drawing.SolidBrush $gold), $holeRect)

  if (-not $IconOnly) {
    $fontSize = [Math]::Max(24, $Size * 0.095)
    $font = New-Object System.Drawing.Font "Segoe UI", $fontSize, ([System.Drawing.FontStyle]::Bold)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textRect = New-Object System.Drawing.RectangleF(
      [float]($Size * 0.08),
      [float]($Size * 0.68),
      [float]($Size * 0.84),
      [float]($Size * 0.16)
    )
    $Graphics.DrawString("RedeeMERP", $font, (New-Object System.Drawing.SolidBrush $white), $textRect, $format)

    $smallFont = New-Object System.Drawing.Font "Segoe UI", ([Math]::Max(10, $Size * 0.034)), ([System.Drawing.FontStyle]::Regular)
    $smallRect = New-Object System.Drawing.RectangleF(
      [float]($Size * 0.08),
      [float]($Size * 0.79),
      [float]($Size * 0.84),
      [float]($Size * 0.08)
    )
    $Graphics.DrawString("VOICE-LED CAMP NAVIGATION", $smallFont, (New-Object System.Drawing.SolidBrush $gold), $smallRect, $format)
    $font.Dispose()
    $smallFont.Dispose()
    $format.Dispose()
  }
}

function Save-Png {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $fullPath = Join-Path (Get-Location) $Path
  $directory = Split-Path $fullPath
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }
  $Bitmap.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-AppIcon {
  param([int]$Size, [string]$Path)

  $canvas = New-Canvas $Size
  Add-MapBackdrop -Graphics $canvas.Graphics -Size $Size
  Add-BrandMark -Graphics $canvas.Graphics -Size $Size -IconOnly $true
  Save-Png -Bitmap $canvas.Bitmap -Path $Path
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

function New-SplashIcon {
  param([int]$Size, [string]$Path)

  $canvas = New-Canvas $Size
  Add-MapBackdrop -Graphics $canvas.Graphics -Size $Size
  Add-BrandMark -Graphics $canvas.Graphics -Size $Size -IconOnly $false
  Save-Png -Bitmap $canvas.Bitmap -Path $Path
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

function New-Background {
  param([int]$Size, [string]$Path)

  $canvas = New-Canvas $Size
  Add-MapBackdrop -Graphics $canvas.Graphics -Size $Size
  Save-Png -Bitmap $canvas.Bitmap -Path $Path
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

function New-Monochrome {
  param([int]$Size, [string]$Path)

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)
  Add-BrandMark -Graphics $graphics -Size $Size -IconOnly $true
  Save-Png -Bitmap $bitmap -Path $Path
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-AppIcon -Size 1024 -Path "assets/icon.png"
New-SplashIcon -Size 1024 -Path "assets/splash-icon.png"
New-Background -Size 432 -Path "assets/android-icon-background.png"
New-AppIcon -Size 432 -Path "assets/android-icon-foreground.png"
New-Monochrome -Size 432 -Path "assets/android-icon-monochrome.png"
New-AppIcon -Size 256 -Path "assets/favicon.png"
New-AppIcon -Size 512 -Path "assets/redeemerp-logo.png"

Write-Host "Generated RedeeMERP brand assets."
