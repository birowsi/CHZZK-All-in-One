param([switch]$ZipOnly)

$ErrorActionPreference = "Stop"
$version = (Get-Content -Raw "$PSScriptRoot\manifest.json" | ConvertFrom-Json).version
$dist = Join-Path $PSScriptRoot "dist"
$archive = Join-Path $dist "chzzk-all-in-one-firefox-v$version.zip"
$xpi = Join-Path $dist "chzzk-all-in-one-firefox-v$version.xpi"
$files = @(
    "manifest.json", "following-logic.js", "grid-bypass.js", "log-store.js", "recording-store.js", "background.js", "rules.json", "page.js", "timeshift.js",
    "playback-settings.js", "content.js", "tools.js", "tools.css", "index.html", "popup.js",
    "log.html", "log.js", "record-result.html", "record-result.css", "record-result-logic.js", "record-result.js",
    "vendor/ffmpeg/wrapper/classes.js", "vendor/ffmpeg/wrapper/const.js", "vendor/ffmpeg/wrapper/errors.js",
    "vendor/ffmpeg/wrapper/index.js", "vendor/ffmpeg/wrapper/types.js", "vendor/ffmpeg/wrapper/utils.js",
    "vendor/ffmpeg/wrapper/worker.js", "vendor/ffmpeg/core/ffmpeg-core.js", "vendor/ffmpeg/core/ffmpeg-core.wasm",
    "vendor/hls.light.min.mjs", "vendor/hls.js.LICENSE",
    "icon.png", "icons/icon-16.png", "icons/icon-32.png",
    "icons/icon-48.png", "icons/icon-96.png", "icons/icon-128.png", "LICENSE", "NOTICE"
)

New-Item -ItemType Directory -Force -Path $dist | Out-Null
Push-Location $PSScriptRoot
try { tar.exe -a -c -f $archive $files } finally { Pop-Location }
if ($ZipOnly) {
    Write-Output $archive
} else {
    Copy-Item -LiteralPath $archive -Destination $xpi -Force
    Write-Output $archive, $xpi
}
