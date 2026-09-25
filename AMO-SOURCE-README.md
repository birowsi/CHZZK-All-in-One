# AMO reviewer source and build notes — CHZZK All-in-One 1.1.10

This archive contains the readable extension source, the packaged third-party files, `package-lock.json`, tests, and the packaging script. The submitted add-on ZIP is `chzzk-all-in-one-firefox-v1.1.10.zip`. No first-party JavaScript is transpiled, bundled, or minified during packaging. `build.ps1` copies the listed files into a ZIP without changing their contents.

## Reproduce the submitted package

On Windows 10/11 with PowerShell and the built-in `tar.exe`, extract this source archive and run from its top-level directory:

```powershell
.\build.ps1 -ZipOnly
```

The result is `dist/chzzk-all-in-one-firefox-v1.1.10.zip`. Compare the contents of each ZIP entry to the uploaded extension; ZIP container metadata may differ. Node.js 22+ and `npm ci` are needed only to run `npm run test:all`, not to package the extension.

## Included third-party code

- `vendor/hls.light.min.mjs`: hls.js 1.7.3 release distribution, used for the following-channel hover video preview. [Release source](https://github.com/video-dev/hls.js/tree/v1.7.3), [npm release containing the distributed file](https://www.npmjs.com/package/hls.js/v/1.7.3).
- `vendor/ffmpeg/core/ffmpeg-core.js` and `.wasm`: unmodified `@ffmpeg/core` 0.12.10 ESM distribution, used for local recording conversion. [Release source](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10/packages/core).
- `vendor/ffmpeg/wrapper/`: based on the readable `@ffmpeg/ffmpeg` 0.12.15 ESM distribution. The `worker.js` file is adapted to import the packaged core module directly; this avoids a dynamic remote import. The other wrapper JavaScript files match the npm distribution. [Release source](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.15/packages/ffmpeg).
- `timeshift.js`, `content.js`, and `rules.json` include credited adaptations described in `NOTICE` and the GPL/MIT notices in the extension package.

The only generated/minified JavaScript in the extension is the vendored hls.js distribution and the upstream FFmpeg core; no build step regenerates either one. The FFmpeg WebAssembly binary is the unmodified npm release file. All third-party assets execute from the extension package. The extension does not fetch remote executable code.

## Validation warnings

`manifest.json` permits `'wasm-unsafe-eval'` so Firefox can compile the **packaged** FFmpeg WebAssembly binary for MP4/GIF/WebP conversion. The policy keeps `script-src 'self'` and does not enable JavaScript `eval` or remote scripts. The dynamic `import()` in `tools.js` uses `browser.runtime.getURL("vendor/hls.light.min.mjs")`, a fixed path to a **packaged** module, loaded only when the user hovers a following channel. No page input or network URL reaches the import argument.
