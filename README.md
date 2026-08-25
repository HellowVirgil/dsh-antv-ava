<p align="center">
  🌐 <a href="./README.zh-CN.md">简体中文</a> | English
</p>

<h1 align="center">dsh-antv-ava</h1>

<p align="center">
  Turn quantitative facts in text into recommended charts and automatic insights with <a href="https://github.com/antvis/AVA">AntV AVA</a>, directly inside DeepSeek Harness (DSH) replies.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-antv-ava"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-antv-ava?logo=npm&color=cb3837"></a>
  <a href="https://github.com/HellowVirgil/dsh-antv-ava/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/HellowVirgil/dsh-antv-ava/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/dsh-antv-ava"><img alt="npm downloads" src="https://img.shields.io/npm/dm/dsh-antv-ava?logo=npm"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/npm/l/dsh-antv-ava"></a>
</p>

## Preview

<p align="center">
  <img src="https://raw.githubusercontent.com/HellowVirgil/dsh-antv-ava/main/docs/images/ava-preview.jpg" alt="dsh-antv-ava recommending and rendering a quarterly revenue trend chart inside DSH" width="100%">
</p>

<p align="center">
  <sub>Actual DSH rendering: AVA recommends a line chart and G2 renders it while the model provides a text interpretation.</sub>
</p>

The DSH model interprets the source text and emits a streaming `ava` fence. The plugin parses complete rows as they arrive, asks AVA to recommend a chart and detect statistical patterns, then renders the result with AntV G2.

````markdown
```ava
ava
title Quarterly revenue trend
purpose Trend
language en-US
fields
  - id quarter
    label Quarter
    type temporal
    role dimension
  - id revenue
    label Revenue ($k)
    type quantitative
    role measure
data
  - quarter Q1
    revenue 128
  - quarter Q2
    revenue 164
  - quarter Q3
    revenue 191
```
````

## Features

- Uses AVA Advisor to recommend a chart from the extracted data and analysis purpose
- Uses AVA Insight to detect trends, outliers, change points, majority, correlation, and low variance
- Progressively re-analyzes and renders complete data rows while the model streams
- Renders the recommended specification with AntV G2 and supports PNG export
- Displays concise bilingual insight summaries and the AVA recommendation score
- Uses the DSH `fence-registry` when available, with a DOM fallback for older hosts
- Lazy-loads the 1.6 MB AVA/G2 engine without blocking the initial DSH page load
- Limits fields, rows, source size, and blocks executable markup and private-network resources
- Includes an optional `antv-ava` Skill for more reliable fact extraction and DSL generation

## Installation

Once published, install the package directly into a DSH profile:

```bash
dsh plugin --profile web add dsh-antv-ava
```

The plugin itself injects the required output contract, so a separate Skill installation is not required. Restart `dsh web` and hard-refresh the browser after installation.

### Install from source

```bash
git clone https://github.com/HellowVirgil/dsh-antv-ava.git
cd dsh-antv-ava
pnpm install
pnpm run check
dsh plugin --profile web add "link:$PWD"
```

### Optional: Install the Skill

Install the Skill only when the agent environment discovers `~/.agents/skills` and you want stronger guidance for extracting dimensions, measures, and supported facts from complex text.

```bash
mkdir -p ~/.agents/skills/antv-ava
cp SKILL.md ~/.agents/skills/antv-ava/SKILL.md
```

Try this prompt in a new session:

```text
Use AVA to visualize and interpret these quarterly results: Q1 revenue was 128, Q2 was 164, Q3 was 191, and Q4 was 226.
```

The following browser console message confirms that the client is active:

```text
[dsh-antv-ava] client active; fence-channel=registry
```

## How it works

1. The host plugin teaches the model a constrained, line-based `ava` DSL.
2. The model converts supported quantitative statements into fields and rows; it must not invent missing values.
3. The browser parser incrementally accepts complete rows and validates the source.
4. AVA Advisor recommends a G2 specification, while AVA Insight extracts statistical patterns.
5. G2 renders the chart; the plugin displays summaries, recommendation metadata, PNG export, and source copying.

The plugin uses stable `@antv/ava@3.4.1`. AVA 4 is currently alpha and includes a different AI-native runtime; this plugin keeps LLM access inside DSH and does not require a separate model key.

## Scope

Best for text containing real quantities: trends, comparisons, rankings, proportions, distributions, and correlations.

For qualitative roadmaps, hierarchies, or process diagrams without meaningful numbers, use an infographic renderer instead. The plugin deliberately refuses to invent numbers merely to make text chartable.

## Development

```bash
pnpm test
pnpm build
pnpm run verify:pack
```

Main entry points:

- `src/plugin/index.ts`: prompt injection and asset route
- `src/client/ava-source.ts`: streaming DSL parser and validation
- `src/client/AvaBlock.tsx`: chart UI, insights, and export
- `src/client/asset-ava.ts`: lazy AVA Advisor, Insight, and G2 bundle
- `src/client/dom-fence.tsx`: fallback for older DSH hosts

## License

MIT. AntV AVA and AntV G2 are also licensed under MIT.
