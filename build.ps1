param([switch]$ZipOnly, [ValidateSet('Firefox', 'Chrome')][string]$Browser = 'Firefox')

$ErrorActionPreference = "Stop"
$version = (Get-Content -Raw "$PSScriptRoot\manifest.json" | ConvertFrom-Json).version
$dist = Join-Path $PSScriptRoot "dist"
$browserName = $Browser.ToLowerInvariant()
$archive = Join-Path $dist "chzzk-all-in-one-$browserName-v$version.zip"
$xpi = Join-Path $dist "chzzk-all-in-one-firefox-v$version.xpi"
$files = @(
    "manifest.json", "following-logic.js", "grid-bypass.js", "log-store.js", "recording-store.js", "recording-transport.js", "background.js", "rules.json", "page.js", "timeshift.js",
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
$buildRoot = $PSScriptRoot
if ($Browser -eq 'Chrome') {
    $buildRoot = Join-Path $dist "chzzk-all-in-one-chrome-v$version"
    New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
    $files += @('chrome-worker.js', 'chrome-grid.js')
    foreach ($file in $files) {
        $targetFile = Join-Path $buildRoot $file
        New-Item -ItemType Directory -Force -Path (Split-Path $targetFile -Parent) | Out-Null
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $targetFile -Force
    }
    $chromeManifest = Get-Content -Raw "$PSScriptRoot\manifest.json" | ConvertFrom-Json -AsHashtable
    [void]$chromeManifest.Remove('browser_specific_settings')
    $chromeManifest['minimum_chrome_version'] = '120'
    $chromeManifest['permissions'] = @($chromeManifest.permissions | Where-Object { $_ -ne 'webRequestBlocking' }) + @('alarms')
    $chromeManifest['background'] = @{ service_worker = 'chrome-worker.js' }
    $chromeManifest.content_security_policy.extension_pages = $chromeManifest.content_security_policy.extension_pages.Replace("worker-src 'self' blob:", "worker-src 'self'")
    $chromeManifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $buildRoot 'manifest.json') -Encoding utf8
}
Push-Location $buildRoot
try {
    tar.exe --format=zip -c -f $archive $files
    if ($LASTEXITCODE -ne 0) { throw "ZIP 생성 실패 (tar exit $LASTEXITCODE)" }
} finally { Pop-Location }
# Some tar implementations accept .zip filenames but still emit TAR. Firefox
# requires a real ZIP; validate it before publishing the local XPI copy.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$package = [IO.Compression.ZipFile]::OpenRead($archive)
try {
    if ($package.Entries.Count -ne $files.Count) { throw "ZIP 파일 수 불일치" }
    foreach ($file in $files) {
        if (-not $package.GetEntry($file)) { throw "ZIP 누락 파일: $file" }
    }
    $reader = [IO.StreamReader]::new($package.GetEntry("manifest.json").Open())
    try { $builtVersion = ($reader.ReadToEnd() | ConvertFrom-Json).version } finally { $reader.Dispose() }
    if ($builtVersion -ne $version) { throw "ZIP 버전 불일치: $builtVersion / $version" }
} finally { $package.Dispose() }
if ($Browser -eq 'Chrome') {
    Write-Output $buildRoot, $archive
} elseif ($ZipOnly) {
    Write-Output $archive
} else {
    Copy-Item -LiteralPath $archive -Destination $xpi -Force
    Write-Output $archive, $xpi
}
