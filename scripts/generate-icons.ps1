Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\resources\icon.png"
if (-not (Test-Path $srcPath)) {
    $srcPath = Join-Path $PSScriptRoot "..\public\app-icon.png"
}

Write-Output "Source icon: $srcPath"
$srcImg = [System.Drawing.Image]::FromFile($srcPath)

$densities = @(
    @{ Name = "mipmap-mdpi";    Launcher = 48;  Foreground = 108 },
    @{ Name = "mipmap-hdpi";    Launcher = 72;  Foreground = 162 },
    @{ Name = "mipmap-xhdpi";   Launcher = 96;  Foreground = 216 },
    @{ Name = "mipmap-xxhdpi";  Launcher = 144; Foreground = 324 },
    @{ Name = "mipmap-xxxhdpi"; Launcher = 192; Foreground = 432 }
)

foreach ($d in $densities) {
    $dir = Join-Path $PSScriptRoot "..\android\app\src\main\res\$($d.Name)"
    if (-not (Test-Path $dir)) { 
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    # 1. ic_launcher.png (Full Square Icon)
    $bmp = New-Object System.Drawing.Bitmap($d.Launcher, $d.Launcher)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcImg, 0, 0, $d.Launcher, $d.Launcher)
    $g.Dispose()
    
    $launcherPath = Join-Path $dir "ic_launcher.png"
    $bmp.Save($launcherPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $roundPath = Join-Path $dir "ic_launcher_round.png"
    $bmp.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    # 2. ic_launcher_foreground.png (Adaptive Foreground with ~70% safe zone padding)
    $fgBmp = New-Object System.Drawing.Bitmap($d.Foreground, $d.Foreground)
    $fgG = [System.Drawing.Graphics]::FromImage($fgBmp)
    $fgG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $fgG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $fgG.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $iconSize = [int]($d.Foreground * 0.72)
    $offset = [int](($d.Foreground - $iconSize) / 2)
    $fgG.DrawImage($srcImg, $offset, $offset, $iconSize, $iconSize)
    $fgG.Dispose()
    
    $fgPath = Join-Path $dir "ic_launcher_foreground.png"
    $fgBmp.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $fgBmp.Dispose()

    Write-Output "Generated for $($d.Name): Launcher=$($d.Launcher)x$($d.Launcher), Foreground=$($d.Foreground)x$($d.Foreground)"
}

$srcImg.Dispose()
Write-Output "SUCCESS: All Android icons generated!"
