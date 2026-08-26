# Changelog

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
