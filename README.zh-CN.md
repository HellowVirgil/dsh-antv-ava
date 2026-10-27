<p align="center">
  🌐 简体中文 | <a href="./README.md">English</a>
</p>

<h1 align="center">dsh-antv-ava</h1>

<p align="center">
  在 DeepSeek Harness 中展示数据结论与图表，按需读取上传文件并执行真实分析。
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
  <img src="https://img.shields.io/badge/streaming-supported-16a34a" alt="支持流式渲染">
  <img src="https://img.shields.io/badge/theme-light%20%7C%20dark-8b5cf6" alt="支持亮色与暗色主题">
</p>

## 效果预览

<p align="center">
  <img src="https://raw.githubusercontent.com/HellowVirgil/dsh-antv-ava/main/docs/images/ava-preview.jpg" alt="DSH 对话中的叙事文本与 AntV 图表" width="100%">
</p>

文字和图表直接融入对话。已有数字可以逐句、逐行呈现；文件分析则先执行查询，再展示保存的结果、数据表与计算依据。

## 安装

| 组件 | 作用 | 运行要求 |
| --- | --- | --- |
| `dsh-antv-ava` | 叙事、图表、数据表、结果快照展示 | Node.js ≥20.11 |
| `dsh-antv-ava-runtime`（可选） | 上传附件与工作区文件、AVA v4 / DuckDB 查询、结果保存 | Node.js ≥22.13 |

只需要把已有数字画成图表时，安装主插件：

```bash
dsh plugin --profile web add dsh-antv-ava@0.3.2 --ignore-scripts
```

需要粘贴/上传文件并实际分析时，再安装运行时：

```bash
dsh plugin --profile web add dsh-antv-ava-runtime@0.1.2 --ignore-scripts
```

两个分发包都已完成构建。`--ignore-scripts` 跳过 AVA 间接依赖中未使用的 SSH 原生优化构建，避免 pnpm 11 因未声明的构建脚本中止安装。

两个包都通过 npm 分发，由同一 [GitHub Release](https://github.com/HellowVirgil/dsh-antv-ava/releases/tag/v0.3.2) 触发，分别使用自己的 Trusted Publisher。runtime 依赖同版本主包的协议；两个插件分别在 web profile 中启用。Release 同时保留 runtime 压缩包和 SHA256SUMS，供需要时使用。

已验证 DSH `0.1.0-rc.8` 和 `0.2.1-rc.2`；粘贴/上传文件使用已具备文件附件能力的 `0.2.1-rc.2`。安装后重启 `dsh web` 并刷新页面。首次访问请使用启动时打印的完整登录地址。AVA 不需要额外模型密钥，分析规划使用 DSH 已配置的模型。

## 使用方式

**已有数字：**

> 分析 Q1 到 Q4 的收入变化，并画出趋势：Q1 128 万、Q2 164 万、Q3 191 万、Q4 226 万。

**粘贴或上传 Excel：**

> 使用 AVA 分析刚上传的 sales.xlsx，按产品汇总 revenue，生成柱状图并解释结果。

**当前工作区中的文件：**

> 使用 AVA 分析 tests/fixtures/sales.xlsx，按产品汇总 revenue。

相对路径以当前 DSH 会话的工作区为准。上传文件可直接读取，无需复制到项目或临时目录。插件仅接纳当前会话的正式附件记录；同名附件有歧义时会要求明确选择。

模型根据内容选择叙事文本、图表或两者组合。只想要图表时直接说明，无需手写输出协议或额外安装 Skill。

## 当前能力

- **流式表达**：指标、同比环比、占比和结论按完整短语出现；旧内联图表随完整数据行更新。
- **文件分析**：可选运行时支持 CSV、JSON、XLSX，读取结构与统计概况，执行只读 DuckDB SQL。
- **结果一致性**：叙事数值和图表绑定到同一份查询结果；查看数据、分页、下载 CSV 和复查查询均不重新计算。
- **历史回放**：结果快照保存在宿主，关闭数据集或重启运行时后仍可展示。
- **主题与降级**：继承 DSH 排版，支持亮暗主题；图表失败时保留数据表，并可单独重试。
- **可选统计**：旧内联图表保留 AVA 3.4.1 的统计模式计算，需手动触发；主题切换、缩放和消息加载不会自动分析。
- **资源控制**：独立计算进程、取消与超时清理、输入大小和查询结果限制；截断结果明确标识。

图表使用 GPT-Vis 1.0.0。旧内联格式保留已有图类型；新的 JSON/结果绑定入口先支持 line、bar、column、pie、scatter、histogram、waterfall、table。上传支持与限制、目录配置、存储和权限说明见 [runtime 文档](https://github.com/HellowVirgil/dsh-antv-ava/blob/v0.3.2/runtime/README.md)。

当前采用 DSH Agent 组织查询、AVA 执行计算的方式。额外模型驱动的 `analyze/recommend/suggest`、远程数据库、多数据源和 Python 引擎尚未接入。

## 输出协议与兼容

保留 `ava`、`ava ntv`、`ava chart` 格式。例如：

````markdown
```ava
ava
language zh-CN
narrative
  headline 季度收入增长
  paragraph
    text Q4 收入达到
    metric-value 226万
chart
  vis column
  data
    - category Q1
      value 128
    - category Q4
      value 226
  title 季度收入
  axisYTitle 收入（万元）
```
````

新增入口：

| 内容 | 用途 |
| --- | --- |
| `ava json` 后跟 JSON | GPT-Vis 配置或 AVA v4 的 `{ chartType, config }`；不执行其中的 HTML |
| `ava answer` 后跟 JSON | 插件 `schemaVersion: 1` 文档，包含结果、数值引用和视图 |
| `ava result <id>` | 读取宿主工具生成的展示快照，通常由模型直接使用工具返回内容 |

由回答直接提供的快照会注明执行来源未验证。DSH 0.2 将未知语法显示为通用“代码块”时，兼容层通过严格的 AVA 内容校验识别；明确标注为其他语言的代码不接管。

## 从源码开发

```bash
git clone https://github.com/HellowVirgil/dsh-antv-ava.git
cd dsh-antv-ava
pnpm install --frozen-lockfile
pnpm run check
dsh plugin --profile web add "link:$PWD"
dsh plugin --profile web add "link:$PWD/runtime"
pnpm dev
```

`pnpm dev` 启动实现预览：使用合成数据执行真实 AVA 查询，关闭数据集后回放快照。

```bash
pnpm run verify:pack
pnpm run pack:runtime
pnpm run verify:dsh
pnpm run verify:dsh-uploads
```

后两个检查需要已安装的 DSH；上传检查需要文件附件能力。可用 `AVA_TEST_DSH_BINARY` 指定目标 DSH 可执行文件。测试使用隔离上下文，不改动现有 web profile。附带的 [SKILL.md](./SKILL.md) 可供支持 Skill 的 Agent 使用，普通插件用户无需额外安装。

## 发布

GitHub Release 是入口。`publish.yml` 从同一个不可变 tag 安装、检查和打包，附加 runtime 压缩包与 SHA256SUMS，再按主包、runtime 的顺序通过各自的 npm Trusted Publisher 发布。流程见 [AGENTS.md](https://github.com/HellowVirgil/dsh-antv-ava/blob/main/AGENTS.md)。

## License

MIT。AntV AVA 和 AntV GPT-Vis 同样采用 MIT License。
