Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $root "build"
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

function New-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-LogoBitmap([int]$size) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $bgPath = New-RoundedRectPath 0 0 $size $size ([Math]::Round($size * 0.23))
  $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new($size, $size),
    [System.Drawing.Color]::FromArgb(255, 40, 227, 155),
    [System.Drawing.Color]::FromArgb(255, 8, 124, 104)
  )
  $g.FillPath($bgBrush, $bgPath)

  $white = [System.Drawing.Color]::White
  $pen = [System.Drawing.Pen]::new($white, [Math]::Max(2, $size * 0.066))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $bubble = [System.Drawing.RectangleF]::new($size * 0.25, $size * 0.22, $size * 0.54, $size * 0.54)
  $g.DrawEllipse($pen, $bubble)
  $tailPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $tailPath.AddLines(@(
    [System.Drawing.PointF]::new($size * 0.32, $size * 0.67),
    [System.Drawing.PointF]::new($size * 0.25, $size * 0.80),
    [System.Drawing.PointF]::new($size * 0.40, $size * 0.75)
  ))
  $g.DrawPath($pen, $tailPath)

  $brush = [System.Drawing.SolidBrush]::new($white)
  $phone = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $phone.AddBezier($size * 0.39, $size * 0.35, $size * 0.35, $size * 0.44, $size * 0.48, $size * 0.61, $size * 0.62, $size * 0.65)
  $phone.AddBezier($size * 0.66, $size * 0.66, $size * 0.72, $size * 0.62, $size * 0.70, $size * 0.58, $size * 0.65, $size * 0.56)
  $phone.AddLine($size * 0.58, $size * 0.53, $size * 0.52, $size * 0.59)
  $phone.AddBezier($size * 0.48, $size * 0.57, $size * 0.43, $size * 0.52, $size * 0.41, $size * 0.47, $size * 0.45, $size * 0.42)
  $phone.AddLine($size * 0.42, $size * 0.35, $size * 0.39, $size * 0.35)
  $phone.CloseFigure()
  $g.FillPath($brush, $phone)

  $plane = @(
    [System.Drawing.PointF]::new($size * 0.57, $size * 0.23),
    [System.Drawing.PointF]::new($size * 0.79, $size * 0.23),
    [System.Drawing.PointF]::new($size * 0.56, $size * 0.46),
    [System.Drawing.PointF]::new($size * 0.61, $size * 0.33),
    [System.Drawing.PointF]::new($size * 0.48, $size * 0.37)
  )
  $g.FillPolygon($brush, $plane)

  $g.Dispose()
  $bgBrush.Dispose()
  $bgPath.Dispose()
  $pen.Dispose()
  $brush.Dispose()
  $tailPath.Dispose()
  $phone.Dispose()
  return $bmp
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngEntries = @()
foreach ($size in $sizes) {
  $bmp = New-LogoBitmap $size
  if ($size -eq 256) {
    $bmp.Save((Join-Path $buildDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $stream = [System.IO.MemoryStream]::new()
  $bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngEntries += [pscustomobject]@{ Size = $size; Bytes = $stream.ToArray() }
  $stream.Dispose()
  $bmp.Dispose()
}

$icoPath = Join-Path $buildDir "icon.ico"
$fs = [System.IO.File]::Create($icoPath)
$bw = [System.IO.BinaryWriter]::new($fs)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$pngEntries.Count)
$offset = 6 + (16 * $pngEntries.Count)
foreach ($entry in $pngEntries) {
  $dim = if ($entry.Size -eq 256) { 0 } else { $entry.Size }
  $bw.Write([byte]$dim)
  $bw.Write([byte]$dim)
  $bw.Write([byte]0)
  $bw.Write([byte]0)
  $bw.Write([UInt16]1)
  $bw.Write([UInt16]32)
  $bw.Write([UInt32]$entry.Bytes.Length)
  $bw.Write([UInt32]$offset)
  $offset += $entry.Bytes.Length
}
foreach ($entry in $pngEntries) {
  $bw.Write($entry.Bytes)
}
$bw.Dispose()
$fs.Dispose()

$header = [System.Drawing.Bitmap]::new(150, 57, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$hg = [System.Drawing.Graphics]::FromImage($header)
$hg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$hg.Clear([System.Drawing.Color]::White)
$small = New-LogoBitmap 48
$hg.DrawImage($small, 95, 4, 48, 48)
$header.Save((Join-Path $buildDir "installerHeader.bmp"), [System.Drawing.Imaging.ImageFormat]::Bmp)
$small.Dispose()
$hg.Dispose()
$header.Dispose()

Get-ChildItem $buildDir | Select-Object Name, Length
