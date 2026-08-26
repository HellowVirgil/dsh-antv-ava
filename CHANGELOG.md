# Changelog

## Unreleased

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
