<p align="center">
  🌐 简体中文 | <a href="./README.md">English</a>
</p>

<h1 align="center">dsh-antv-ava</h1>

<p align="center">
  使用 <a href="https://github.com/antvis/AVA">AntV AVA</a> 将文本中的量化事实转化为推荐图表和自动洞察，并直接渲染在 DeepSeek Harness（DSH）的模型回复中。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-antv-ava"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-antv-ava?logo=npm&color=cb3837"></a>
  <a href="https://github.com/HellowVirgil/dsh-antv-ava/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/HellowVirgil/dsh-antv-ava/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/dsh-antv-ava"><img alt="npm downloads" src="https://img.shields.io/npm/dm/dsh-antv-ava?logo=npm"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/npm/l/dsh-antv-ava"></a>
</p>

## 效果预览

<p align="center">
  <img src="https://raw.githubusercontent.com/HellowVirgil/dsh-antv-ava/main/docs/images/ava-preview.jpg" alt="dsh-antv-ava 在 DSH 中推荐并渲染季度收入趋势图" width="100%">
</p>

<p align="center">
  <sub>DSH 真实运行效果：AVA 推荐折线图，G2 完成渲染，同时模型给出文本解读。</sub>
</p>

DSH 模型先解读原始文本并输出流式 `ava` fence。插件在完整数据行到达时增量解析，调用 AVA 推荐图表并检测统计模式，最后使用 AntV G2 渲染。

````markdown
```ava
ava
title 季度收入趋势
purpose Trend
language zh-CN
fields
  - id quarter
    label 季度
    type temporal
    role dimension
  - id revenue
    label 收入（万元）
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

## 能力

- 使用 AVA Advisor 根据抽取数据和分析目的推荐图表
- 使用 AVA Insight 检测趋势、异常点、变化点、主要占比、相关性和低方差
- 模型流式输出时，针对已完成的数据行持续重新分析和渲染
- 使用 AntV G2 渲染推荐规范，并支持 PNG 导出
- 展示简洁的中英文洞察摘要和 AVA 推荐分数
- 新版 DSH 走 `fence-registry`，旧版自动使用 DOM fallback
- 约 1.6 MB 的 AVA/G2 引擎按需加载，不阻塞 DSH 首屏
- 限制字段数、数据行数和源码大小，并拦截可执行标记与私网资源
- 附带可选的 `antv-ava` Skill，提高复杂文本的事实抽取和 DSL 生成质量

## 安装

发布后可直接安装到 DSH profile：

```bash
dsh plugin --profile web add dsh-antv-ava
```

插件本身会注入必要的输出约定，不需要额外安装 Skill。安装完成后重启 `dsh web`，并在浏览器中执行硬刷新。

### 从源码安装

```bash
git clone https://github.com/HellowVirgil/dsh-antv-ava.git
cd dsh-antv-ava
pnpm install
pnpm run check
dsh plugin --profile web add "link:$PWD"
```

### 可选：安装 Skill

只有当 Agent 环境会读取 `~/.agents/skills`，并希望复杂文本获得更严格的维度、指标和事实抽取指导时，才需要安装 Skill。

```bash
mkdir -p ~/.agents/skills/antv-ava
cp SKILL.md ~/.agents/skills/antv-ava/SKILL.md
```

在新会话中输入：

```text
用 AVA 可视化并解读这组季度数据：Q1 收入 128 万，Q2 164 万，Q3 191 万，Q4 226 万。
```

浏览器控制台出现下面的日志表示客户端已激活：

```text
[dsh-antv-ava] client active; fence-channel=registry
```

## 工作原理

1. Node 端插件向模型注入受约束的行式 `ava` DSL。
2. 模型将文本中有依据的量化事实转换为字段和数据行，不得补造缺失数值。
3. 浏览器解析器增量接收完整数据行并执行安全校验。
4. AVA Advisor 推荐 G2 图表规范，AVA Insight 提取统计模式。
5. G2 渲染图表，插件展示洞察、推荐信息、PNG 导出和源码复制。

插件使用稳定版 `@antv/ava@3.4.1`。AVA 4 目前仍为 alpha，且采用不同的 AI-native 运行时；本插件将模型调用留在 DSH 内部，不需要额外配置模型密钥。

## 适用边界

适合包含真实数值的文本：趋势、对比、排名、占比、分布和相关性。

如果内容是没有有效数值的路线图、层级或流程，应使用信息图渲染器。插件会明确避免为了生成图表而虚构数字。

## 开发

```bash
pnpm test
pnpm build
pnpm run verify:pack
```

入口：

- `src/plugin/index.ts`：prompt 与资源路由
- `src/client/ava-source.ts`：流式 DSL 解析和安全校验
- `src/client/AvaBlock.tsx`：图表 UI、洞察和导出
- `src/client/asset-ava.ts`：按需加载的 AVA Advisor、Insight 和 G2 引擎包
- `src/client/dom-fence.tsx`：旧版 DSH fallback

## License

MIT。AntV AVA 和 AntV G2 也采用 MIT License。
