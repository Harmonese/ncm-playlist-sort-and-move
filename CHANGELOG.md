# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.2] - 2026-08-30

### Added

- Added configurable priority ordering for Latin letters, Han characters, Japanese kana, Hangul, Cyrillic, Greek, Arabic, numbers, and other characters.
- Added selectable Han character ordering: pinyin, stroke, or Unicode.
- Added a direct string comparison mode that disables character category priorities.
- Added title sorting tests, including writing-system classification and pinyin tie handling.

### Changed

- Reworked title sorting into a unified character-by-character comparator.
- Removed automatic title prefix cleanup and whole-title category grouping.
- Made pinyin ties continue to later characters before using raw Unicode as a final tie-breaker.
- Expanded the former English category to cover Latin-script characters such as accented letters.

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
