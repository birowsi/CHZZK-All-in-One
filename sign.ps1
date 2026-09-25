$ErrorActionPreference = "Stop"

if (-not $env:WEB_EXT_API_KEY -or -not $env:WEB_EXT_API_SECRET) {
    throw "Mozilla AMO API credentials are required in WEB_EXT_API_KEY and WEB_EXT_API_SECRET."
}

$version = (Get-Content -Raw (Join-Path $PSScriptRoot "manifest.json") | ConvertFrom-Json).version
$dist = Join-Path $PSScriptRoot "dist"
$sourceZip = Join-Path $dist "chzzk-all-in-one-firefox-v$version.zip"
$signedDir = Join-Path $dist "signed-v$version"
$stage = Join-Path $dist ("sign-stage-" + [guid]::NewGuid().ToString("N"))
$distFull = [IO.Path]::GetFullPath($dist).TrimEnd([char]'\', [char]'/')
$stageFull = [IO.Path]::GetFullPath($stage)
if (-not $stageFull.StartsWith($distFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Signing stage must stay inside dist."
}
if (Test-Path -LiteralPath $signedDir) {
    if (Get-ChildItem -LiteralPath $signedDir -Filter "*.xpi" -File) {
        throw "A signed XPI already exists for version $version. Increase the version before signing changed source."
    }
}

& (Join-Path $PSScriptRoot "build.ps1") -ZipOnly | Out-Null
New-Item -ItemType Directory -Path $stage, $signedDir -Force | Out-Null
try {
    Expand-Archive -LiteralPath $sourceZip -DestinationPath $stage -Force
    & npx --yes --cache (Join-Path $dist "npm-cache") web-ext@10.6.0 --no-config-discovery sign --channel=unlisted --source-dir $stage --artifacts-dir $signedDir
    if ($LASTEXITCODE -ne 0) { throw "Mozilla signing failed (exit $LASTEXITCODE)." }

    $signedXpi = Get-ChildItem -LiteralPath $signedDir -Filter "*.xpi" -File |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $signedXpi) { throw "Mozilla did not return a signed XPI." }

    Add-Type -AssemblyName System.IO.Compression
    $zip = [IO.Compression.ZipFile]::OpenRead($signedXpi.FullName)
    try {
        $manifestEntry = $zip.GetEntry("manifest.json")
        if (-not $manifestEntry) { throw "Signed XPI has no manifest.json." }
        $reader = [IO.StreamReader]::new($manifestEntry.Open())
        try { $signedVersion = ($reader.ReadToEnd() | ConvertFrom-Json).version }
        finally { $reader.Dispose() }
        if ($signedVersion -ne $version) { throw "Signed XPI version differs from manifest.json." }
        if (-not ($zip.Entries | Where-Object FullName -Match '^META-INF/[^/]+\.rsa$')) {
            throw "Signed XPI has no Mozilla signature."
        }
    } finally { $zip.Dispose() }
    Write-Output $signedXpi.FullName
} finally {
    if (Test-Path -LiteralPath $stageFull) { Remove-Item -LiteralPath $stageFull -Recurse -Force }
}
