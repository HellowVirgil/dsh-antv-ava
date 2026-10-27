<p align="center">
  🌐 <a href="./README.zh-CN.md">简体中文</a> | English
</p>

<h1 align="center">dsh-antv-ava</h1>

<p align="center">
  Present data conclusions and charts in DeepSeek Harness, with optional file uploads and computed analysis.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-antv-ava"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-antv-ava?logo=npm&color=cb3837"></a>
  <a href="https://github.com/HellowVirgil/dsh-antv-ava/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/HellowVirgil/dsh-antv-ava/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/dsh-antv-ava"><img alt="npm downloads" src="https://img.shields.io/npm/dm/dsh-antv-ava?logo=npm"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/npm/l/dsh-antv-ava"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AVA_Runtime-4.0.0--beta.2-1677ff" alt="Optional AVA 4.0.0-beta.2 runtime">
  <img src="https://img.shields.io/badge/AntV_GPT--Vis-1.0.0-1677ff" alt="AntV GPT-Vis 1.0.0">
  <img src="https://img.shields.io/badge/streaming-supported-16a34a" alt="Streaming supported">
  <img src="https://img.shields.io/badge/theme-light%20%7C%20dark-8b5cf6" alt="Light and dark themes">
</p>

## Preview

<p align="center">
  <img src="https://raw.githubusercontent.com/HellowVirgil/dsh-antv-ava/main/docs/images/ava-preview.jpg" alt="Narrative text and AntV charts inside a DSH conversation" width="100%">
</p>

Text and charts flow with the conversation. Supplied figures render progressively; file analysis executes queries first, then presents saved results, a data table, and calculation evidence.

## Installation

| Component | Responsibility | Runtime |
| --- | --- | --- |
| `dsh-antv-ava` | Narrative, charts, tables and result replay | Node.js ≥20.11 |
| Optional `dsh-antv-ava-runtime` | Session uploads, workspace files, AVA v4 / DuckDB queries and snapshots | Node.js ≥22.13 |

For visualization of supplied numbers, install the base plugin:

```bash
dsh plugin --profile web add dsh-antv-ava@0.3.1 --ignore-scripts
```

To analyze pasted/uploaded files, also install the runtime:

```bash
dsh plugin --profile web add https://github.com/HellowVirgil/dsh-antv-ava/releases/download/v0.3.1/dsh-antv-ava-runtime-0.1.1.tgz --ignore-scripts
```

Both distributions are prebuilt. `--ignore-scripts` skips unused optional SSH accelerator builds pulled in by AVA and avoids pnpm 11 refusing an undeclared build.

The base package is published to npm. This runtime version is distributed as an asset of the same [GitHub Release](https://github.com/HellowVirgil/dsh-antv-ava/releases/tag/v0.3.1), not as a separate npm publication. It depends on the exact base protocol version; both plugins are enabled separately in the web profile.

Tested with DSH `0.1.0-rc.8` and `0.2.1-rc.2`. Use `0.2.1-rc.2` for file upload support. Restart `dsh web` and refresh the browser after installation. On first access, open the complete login URL printed by DSH. AVA needs no additional model key: the existing DSH model plans the analysis.

## Usage

**Supplied figures:**

> Analyze quarterly revenue and plot the trend: Q1 128, Q2 164, Q3 191, Q4 226, all in thousands of USD.

**Pasted or uploaded Excel:**

> Use AVA to analyze the sales.xlsx I uploaded. Sum revenue by product, create a column chart, and explain the result.

**A file in the current workspace:**

> Use AVA to analyze tests/fixtures/sales.xlsx and sum revenue by product.

Relative paths resolve against the current DSH session workspace. Uploads are read directly without copying them into the project or a temporary directory. Only admitted file references from that conversation grant attachment access; ambiguous filenames require an explicit selection.

The model chooses narrative, charts, or both. Ask for a chart only when desired. Normal users do not need to write the output protocol or install a separate skill.

## Capabilities

- **Streaming presentation:** complete narrative phrases appear progressively; inline charts update as complete data lines arrive.
- **File analysis:** the optional runtime supports CSV, JSON and XLSX, schema/profile inspection, and read-only DuckDB SQL.
- **Consistent results:** narrative values and charts bind to the same query result. Tables, pagination, CSV export and query inspection do not rerun analysis.
- **History replay:** host snapshots survive dataset closure and runtime restarts.
- **Themes and recovery:** DSH typography, light/dark themes, table fallback on chart failure, and independent chart retry.
- **Optional statistics:** legacy inline charts retain explicit AVA 3.4.1 pattern computation. Loading, resizing and theme changes never automatically run it.
- **Bounded execution:** isolated processes, cancellation/deadlines, input/result limits, and explicit truncation notices.

Charts use GPT-Vis 1.0.0. Legacy inline syntax retains its existing chart coverage; the new JSON/result-binding path supports line, bar, column, pie, scatter, histogram, waterfall and table. See the [runtime guide](https://github.com/HellowVirgil/dsh-antv-ava/blob/v0.3.1/runtime/README.md) for limits, configuration, storage and access rules.

The current execution path uses the DSH Agent to write queries and AVA to compute them. Additional model-driven `analyze/recommend/suggest`, remote databases, multiple sources and Python execution are not integrated yet.

## Output protocol and compatibility

Existing `ava`, `ava ntv`, and `ava chart` fences remain supported:

````markdown
```ava
ava
language en-US
narrative
  headline Quarterly revenue increased
  paragraph
    text Q4 revenue reached
    metric-value 226k USD
chart
  vis column
  data
    - category Q1
      value 128
    - category Q4
      value 226
  title "Quarterly revenue"
  axisYTitle "Revenue (thousand USD)"
```
````

Additional entry points:

| Content | Purpose |
| --- | --- |
| `ava json` followed by JSON | GPT-Vis config or AVA v4 `{ chartType, config }`; HTML is never executed |
| `ava answer` followed by JSON | Plugin-owned `schemaVersion: 1` document with results, value references and views |
| `ava result <id>` | Replay a host-generated presentation snapshot; normally emitted directly from a tool result |

Inline supplied snapshots are marked as having unverified execution provenance. When DSH 0.2 hides unknown language names behind a generic code-block banner, the compatibility adapter validates the AVA content before taking over. Explicit non-AVA language hints remain authoritative.

## Source development

```bash
git clone https://github.com/HellowVirgil/dsh-antv-ava.git
cd dsh-antv-ava
pnpm install --frozen-lockfile
pnpm run check
dsh plugin --profile web add "link:$PWD"
dsh plugin --profile web add "link:$PWD/runtime"
pnpm dev
```

The preview executes real AVA queries on synthetic data, closes the dataset, and replays the saved result.

```bash
pnpm run verify:pack
pnpm run pack:runtime
pnpm run verify:dsh
pnpm run verify:dsh-uploads
```

The last two checks require an installed DSH; upload verification requires its file-attachment capability. Set `AVA_TEST_DSH_BINARY` to select a DSH executable. Checks use isolated contexts and leave the existing web profile unchanged. The bundled [SKILL.md](./SKILL.md) is optional for skill-aware agents.

## Publishing

GitHub Release is the entry point. `publish.yml` installs, checks and packs the immutable release tag, attaches the runtime archive and SHA256SUMS, then publishes the base package through npm Trusted Publishing. See [AGENTS.md](https://github.com/HellowVirgil/dsh-antv-ava/blob/main/AGENTS.md).

## License

MIT. AntV AVA and AntV GPT-Vis are also MIT licensed.
