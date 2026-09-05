# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.1] - 2026-09-05

### Changed

- Changed the persisted playlist script editor to accept only `song <id>` lines.
- Added a separate append-command input that accepts `song <id>` or `album <id>`; album commands are expanded immediately into song lines and are never stored in the editor.
- Added clickable preview songs as insertion anchors; new commands are inserted after the selected song or at the end when no song is selected.
- Added automatic migration of previously saved album-based scripts by expanding them into song-only scripts when possible.
- Added position-aware `song` and `album` command-line commands and a `clear` command for empty playlist plans.
- Added `remove`, `move`, `swap`, and title/date/artist/heat `sort` commands, including range-limited sorting.
- Added random sorting in the function menu and as `sort random [start end]` in the playlist command line.
- Unified command-line and batch-move behavior for target insertion positions, including `0` for moving to the front.
- Split the playlist script protocol and playlist execution-plan modules while retaining the compatibility facade.
- Added a local Playwright browser regression suite for the real playlist-script dialog, using mocked playlist data without login or network access.

### Fixed

- Prevented malformed saved scripts, incomplete album data, partial playlist indexes, and incomplete song details from falling back to a writable current-playlist snapshot.
- Kept the active alignment marker synchronized immediately when a preview row is clicked or keyboard-selected.

## [0.9.0] - 2026-09-04

### Added

- Added v1 playlist orchestration scripts using `song <id>` and `album <id>` commands.
- Added per-playlist script storage, canonical song-only export, album expansion, preview, and external-change detection.
- Added a two-column live preview with full album expansion, change summary, synchronized scrolling, and active order markers.

### Changed

- Put “歌单编排脚本” first in the playlist tools menu.
- Canonical script output now starts directly with `song` or `album` commands; legacy `# ncm-playlist: 1` headers remain readable.
- Added recovery support for script operations that add and remove songs in one run.

### Fixed

- Fixed album responses with an empty nested `album.songs` array masking a non-empty top-level `songs` array.

## [0.8.0] - 2026-09-04

### Added

- Added manual playlist sorting with pointer-based drag-and-drop and keyboard arrow-key movement.
- Added song details, scroll support, drag placeholders, cancellation, and Escape-key handling to the manual sorting dialog.
- Added stable-sort regression coverage for original playlist order and missing ordering metadata.

### Changed

- Unified drag interactions for title-category, artist-category, and song-order lists.
- Unified stable ordering across title, date, artist, heat, and playlist data workflows.
- Optimized title comparison setup by reusing category-rank data for each comparator.
- Added recovery backups for manual sorting and documented manual sorting in the README.

### Fixed

- Fixed pointer dragging being interrupted when the dragged source was removed from the rendered layout.
- Fixed deterministic tie-breaking when multiple items share the same original index.

## [0.7.0] - 2026-08-31

### Added

- Added project Logo assets in SVG and PNG formats, and connected the PNG icon to the userscript metadata.

### Changed

- Extended order backups to batch moves and deletions, including re-adding deleted songs during recovery when possible.
- Unified title and artist text-comparison descriptions and made their separate text detection scopes explicit.
- Added the shared release-date direction and album tie-breaker controls to the artist sorting dialog.
- Reordered heat sorting metrics so song popularity appears before red-heart count.

## [0.6.1] - 2026-08-31

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
