# AVA v4 首期实现状态

2026-10-27。实现遵循两条输入路径共用展示层的设计。主展示插件仍可独立安装，可选 runtime workspace 尚未发布。

| 设计部分 | 状态 | 入口 |
| --- | --- | --- |
| P0 自有 NTV 类型与旧围栏兼容 | 完成 | `src/protocol/narrative.ts`、`src/compatibility/fence.ts` |
| P0 图表/统计/主题解耦 | 完成 | `ChartView`、`runtime/theme`、独立 insights 资源 |
| P1 结果与引用协议、JSON 图表 | 完成 | `src/protocol`、`AnswerView` |
| P1 数据表、CSV、截断、依据、局部失败 | 完成 | `components/ResultTable.tsx`、`ChartView.tsx` |
| P1 序号去重、缺口恢复、终态隔离 | reducer 已完成；未新增跨端实时传输 | `src/protocol/events.ts` |
| P2 DSH 工具接入与会话归属 | 已通过真实 rc.8 与 0.2.1-rc.2 工具注册器验证 | `runtime/src/index.ts` |
| P2 CSV/JSON/XLSX、真实查询、取消与回放 | 完成真实引擎测试 | `runtime/src/service.ts`、独立 worker 进程 |
| P3 业务语义 | 已提供 setter 与 inspect；Agent 必须按口径编写 SQL | `ava_dataset_semantics` |
| P3 自主分析、模型桥接、远程/多数据源、Python | 保留为设计中的后续扩展 | 当前不注册额外模型调用工具 |

## 协议入口

- 旧的 `ava`、`ava ntv`、`ava chart` 原样兼容。
- `ava json` 接受 GPT-Vis config 或官方 `{ chartType, config }` 包装。HTML 字段不会交给渲染器。
- `ava answer` 接受插件自有 schemaVersion 1 文档；执行来源显示为未验证。
- `ava result <64 位十六进制 ID>` 从宿主保存的展示快照读取。

结构化图表入口首期支持 line、bar、column、pie、scatter、histogram、waterfall、table，属性采用白名单。它有意只开放已验证的数据映射和标题/坐标标题；高级样式与其他图类型继续使用原有围栏路径，后续按图类型增加。

统计能力保留为按需操作：展开“可选统计模式”并点击计算。加载消息、主题切换、resize 和回放不会自动启动统计。旧的统计未运行、数据形态不支持、计算失败和无显著模式有不同状态。

## 与原提案相比已确定的实现选择

1. DSH 的 tools.register、ToolRunContext.signal 和 agent.id 已从 rc.8 发布声明核实。工具从实际执行上下文读取 owner，拒绝模型传入 owner。
2. v4 没有通用 AbortSignal，因此以独立子进程隔离每个数据集。取消/期限结束会终止进程并等待退出；用户可重新打开数据源。
3. 浏览器读取使用随机 256-bit capability；只有宿主 present 工具能为当前会话的结果生成能力 ID。持有 ID 即可读取对应快照，此机制适用于本地 DSH，不等同于公网多租户认证。
4. 快照持久化与运行时会话分离。关闭数据集、重建运行时后仍可回放，删除存储文件后不可恢复。
5. 首期进度使用 DSH 自身工具执行界面；事件 reducer 已提供稳定协议，但没有假设不存在的 SSE/RPC 服务。
6. JSON 图表采用更严格的安全子集；不能无损绘制的数值保持为字符串，并以表格呈现。

## 验证与运行

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run verify:pack
# 已安装 DSH rc.8 时：
pnpm run verify:dsh
pnpm dev
```

测试覆盖真实文件查询、只读 SQL、授权目录/符号链接、会话隔离、精度、截断、取消、保存后回放、旧围栏、图表故障、主题切换和迟到响应。

`pnpm dev` 使用合成数据执行 AVA 查询后关闭数据集，再在新组件中回放保存的结果。它不是静态原型。设计原型仍保存在 `ava-v4-prototype.html` 供对照。

测试包含库、组件、真实 AVA 引擎，以及隔离 Context 中的实际 DSH 工具注册与执行管线，没有改动用户的 DSH web profile，也没有触发远程发布。首次 XLSX 加载需要网络安装官方 DuckDB excel 扩展。

补充接入验证覆盖：插件卸载后工具与资源路由移除；运行时重新加载后读取旧快照；Agent 释放后清理数据集；取消写入时不保留不完整快照；禁止通过数据源接口读取运行时私有存储。

本地启动补充：全局 rc.8 无法读取新版带 `version/refs/records` 的凭据格式时，可使用 `npm exec --yes --package @deepseek-ai/dsh@0.2.1-rc.2 -- dsh web --host 127.0.0.1 --port 0 --no-open`。保持凭据文件原样；其他旧插件仍由 DSH 自身的兼容规则决定是否加载。

真实对话渲染验证：DSH 0.2 将未知语法的标题显示为“代码块”，不再保留可见的 ava 语言标签。DOM 兼容层增加通用标题下的严格 AVA 内容识别，明确的其他语言仍优先。已对出现问题的既有对话回放验证：原代码块隐藏，结果组件和 Canvas 各挂载一次；未重跑分析。

会话文件接入：`ava_dataset_open` 支持当前会话工作区相对路径、已上传附件原路径、唯一文件名和附件 ID；附件读取通过宿主 AttachmentStore 完成，核对大小与 SHA-256，保留取消和会话归属边界。`verify:dsh-uploads` 使用实际 DSH 附件和会话查询服务验证，无需模型请求。
