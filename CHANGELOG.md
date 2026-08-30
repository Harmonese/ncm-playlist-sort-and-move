# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.1] - 2026-08-31

### Changed

- Unified title and artist text-comparison descriptions and made their separate text detection scopes explicit.
- Added the shared release-date direction and album tie-breaker controls to the artist sorting dialog.
- Reordered heat sorting metrics so song popularity appears before red-heart count.

## [0.6.0] - 2026-08-31

### Added

- Added heat sorting by red-heart count, song popularity, or comment count, each with ascending and descending modes.
- Added persistent recovery of the last pre-sort playlist order.
- Added explicit original playlist indexes for stable tie-breaking.

### Changed

- Unified title and artist sorting under one shared text-comparison configuration shown in both sorting dialogs.
- Removed the separate artist-only text configuration to keep text ordering consistent across sorting modes.

## [0.5.5] - 2026-08-31

### Added

- Added artist sorting with reusable title writing-system rules and optional release-date sorting within each artist.
- Added independent artist text-sorting settings, with an explicit option to follow or separate from title sorting settings.
- Added shared persistent release-date settings for date sorting and artist sorting.

### Changed

- Changed release-date sorting to require an explicit “开始排序” confirmation after selecting the direction and optional album ordering.
- Changed artist sorting so artist group order and within-artist song order can be configured independently.
- Changed artist sorting labels to describe full artist-name comparison instead of implying that only the first character is compared.

## [0.5.4] - 2026-08-30

### Added

- Added persistent title sorting settings using userscript storage, with a local storage fallback.
- Added optional date-sort tie-breakers for album name and album track order.
- Added tests for persistent settings, date sorting, and album track metadata.

### Changed

- Improved date sorting controls with a dependent switch for album track order.
- Preserved album disc and track numbers during song data normalization.

## [0.5.3] - 2026-08-30

### Added

- Added current-playlist writing-system detection so the title sorting dialog only shows categories present in the playlist.
- Added deterministic categories for Han characters, Japanese kana, Hangul, Cyrillic, Greek, and Arabic writing systems.
- Added tests for writing-system classification and empty-title handling.

### Changed

- Improved title sorting setup feedback and responsive layout for dynamic category lists.
- Moved title sorting data loading before the settings dialog so the detected categories and sorted data use the same playlist snapshot.

## [0.5.2] - 2026-08-30

### Added

- Added current-playlist writing-system detection so the title sorting dialog only shows categories present in the playlist.
- Added configurable priority ordering for Latin letters, Han characters, Japanese kana, Hangul, Cyrillic, Greek, Arabic, numbers, and other characters.
- Added selectable Han character ordering: pinyin, stroke, or Unicode.
- Added a direct string comparison mode that disables character category priorities.
- Added title sorting tests, including writing-system classification and pinyin tie handling.

### Changed

- Improved title sorting setup feedback and responsive layout for dynamic category lists.
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
