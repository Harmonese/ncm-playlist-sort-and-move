# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project README with feature description, installation steps, risk notes, screenshot section, and roadmap.
- MIT license.
- Basic `.gitignore`.

### Changed

- Renamed the userscript from `untitled.user.js` to `ncm-playlist-sort-and-move.user.js`.
- Updated userscript metadata with project homepage, support, update, and download links.

## [0.5.1] - 2026-08-30

### Changed

- Unified the userscript UI with shared popup, button, input, spacing, and color styles.
- Added responsive layouts for batch move and batch delete dialogs.
- Preserved existing features, text, validation, and operation flows.

## [0.5.0] - 2026-08-30

### Changed

- Modularized the userscript source into `src/` while preserving existing behavior.
- Added a build and verification workflow with esbuild.
- Added a GitHub Actions workflow to build and commit the generated userscript.
- Renamed the displayed userscript name to `网易云音乐歌单排序`.

## [0.4.0] - 2026-08-30

### Added

- Sort playlist by song title.
- Sort playlist by publish date.
- Batch move songs by playlist position range.
- Batch delete songs by playlist position range.
- Fetch complete playlist song details in batches for large playlists.
