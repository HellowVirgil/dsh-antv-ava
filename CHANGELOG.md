# Changelog

## 0.3.0 — 2026-10-27

### Added

- AVA v4 JSON/result contracts, value references, paginated data tables, CSV export, truncation notices and source/query evidence.
- Optional runtime 0.1.0 distributed as a GitHub Release asset, using AVA 4.0.0-beta.2 for CSV/JSON/XLSX, DuckDB queries, semantic metadata, cancellation and durable result replay.
- Current-session workspace paths and admitted file attachments, including streamed byte/digest verification without copying uploads into the workspace.
- A live implementation preview and isolated DSH integration checks.

### Changed

- Own the narrative types and retain legacy fences through a compatibility adapter.
- Separate chart rendering, theme updates and explicitly requested AVA 3 statistics; failed chart assets can be retried independently.
- Verify DSH 0.2.1-rc.2 alongside 0.1.0-rc.8 and document the two-component installation.

### Fixed

- Recognize validated AVA content under DSH 0.2 generic code-block banners; preserve explicit language hints and ignore renderer-owned code blocks.
- Keep old/duplicate stream events from overwriting newer or terminal results.
- Prevent private runtime storage and other-session attachments from being treated as authorized analysis inputs.

## 0.2.0

### Changed

- Render chart sections with official GPT-Vis syntax instead of generating G2 specifications through AVA Advisor.
- Stream complete chart data lines into one mounted GPT-Vis instance while the model response is still generating.
- Keep live DSH light/dark theme adaptation and run AVA statistical insight extraction only after chart data settles.
- Expand chart coverage through GPT-Vis while retaining AVA narrative text visualization and the unified conversation-flow output.

## 0.1.0

First public release of `dsh-antv-ava`.

### Added

- Automatically present data-heavy DSH answers as AVA narrative text, an AntV chart, or both.
- Stream narrative phrases as they are generated, including metrics, changes, rates, shares, dimensions, headings, and lists.
- Recommend charts with AVA Advisor / Insight and render them with AntV G2.
- Export rendered charts as PNG and inspect or copy the generated AVA source.

### User experience

- Render narrative and charts directly in the conversation flow without a separate card or toolbar.
- Inherit DSH typography, spacing, message width, and foreground colors.
- Support light and dark themes, including live chart-theme updates without refreshing the page.
- Load the AVA/G2 chart engine only when an answer contains a chart.

### Compatibility and safety

- Support both current DSH fence rendering and the DOM fallback used by older hosts.
- Validate source structure and enforce limits for source size, phrases, paragraphs, fields, and data rows.
- Reject executable markup, dangerous URLs, and localhost or private-network resources.
