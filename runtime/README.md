# dsh-antv-ava-runtime

可选的 DSH 宿主分析插件，使用 AVA `4.0.0-beta.2` 和独立 DuckDB 进程。主插件负责展示；不安装本包时，旧围栏和 JSON 图表仍能使用。

本包独立发布到 npm，同时保留 `v0.3.2` GitHub Release 安装附件。版本为 `0.1.2`，依赖主包 `0.3.2`。运行要求 Node.js ≥22.13。无需额外模型密钥：DSH Agent 编写查询，AVA 执行确定性计算。

独立 npm Trusted Publisher 已配置；`publish.yml` 使用同一 Release，先发布主包，再通过 runtime 自己的 OIDC 关系发布运行时。维护步骤见 [runtime 可信发布配置](https://github.com/HellowVirgil/dsh-antv-ava/blob/main/docs/release/runtime-trusted-publisher.md)。

## 安装与配置

安装发布版本：

```bash
dsh plugin --profile web add dsh-antv-ava@0.3.2 --ignore-scripts
dsh plugin --profile web add dsh-antv-ava-runtime@0.1.2 --ignore-scripts
```

两个包已经预编译，使用 `--ignore-scripts` 跳过当前运行时不使用的 SSH 原生优化脚本。两个包分别启用。Release 同时提供 SHA256SUMS；压缩包由 `publish.yml` 从发布 tag 构建。

从源码开发时，在仓库根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm run check
# 如果尚未安装主插件：
dsh plugin --profile web add "link:$PWD"
dsh plugin --profile web add "link:$PWD/runtime"
```

在 DSH 配置的 `dsh-antv-ava-runtime` 插件条目中按实际需要设置：

```yaml
config:
  roots:
    - /absolute/path/to/authorized-data
  storageDir: /absolute/path/to/private-ava-store
  idleMs: 1800000
```

`roots` 默认是 DSH 宿主启动时的工作目录，是额外共享的数据目录白名单。每次工具调用还会从宿主的 `exec.agent.session.header.cwd` 获取当前会话工作区；相对路径按该工作区解析。解析符号链接后再次检查范围；单文件上限 20 MiB。运行时私有快照不能作为数据源重新打开。

粘贴/上传文件通过当前会话的正式 `file` 附件记录授权，再由 DSH 附件服务读取、核验和导入快照。使用 `path`（原附件路径或唯一文件名），或者单独使用 `attachmentId`。普通文本里提到的路径、工具输出和其他会话的文件记录不会授予附件访问权。托管附件目录不会整体加入白名单。

同名附件有歧义时需提供明确的附件 ID 或原路径；`./sales.xlsx` 明确指工作区文件。文件名匹配的唯一附件优先于工作区同名文件。读取流仍受大小、摘要和取消检查约束。

上传功能需要 DSH 的文件附件能力（已验证 0.2.1-rc.2）。支持时使用异步历史观察读取原始用户附件记录，因此恢复会话或上下文压缩后仍可识别；缺少历史观察服务的旧宿主只从当前派生用户消息中识别附件。

`storageDir` 默认为当前用户的 `~/.local/share/dsh-antv-ava`。目录权限 0700，快照文件权限 0600。每份输入复制到独立目录，防止原文件修改影响已打开的数据集。Excel 首次使用需要下载 DuckDB 官方 excel 扩展。

重启 `dsh web` 并重新加载页面后使用。工具需要 DSH 的 `tools`、`systemPrompt` 服务；`webServer` 可稍后加载。

## 工具与边界

- `ava_dataset_open`：打开当前会话附件或工作区文件，返回 datasetId 和真实字段结构；`path` 与 `attachmentId` 二选一。
- `ava_dataset_inspect`：查询 schema、profile 和业务定义。
- `ava_dataset_semantics`：设置 AVA semantic 定义。它不会自动改写 Agent 提交的 SQL。
- `ava_query`：执行只读 SELECT，保存结果；模型最多收到前 20 行预览与明确的截断标记。
- `ava_result_present`：将保存的结果列绑定到图表字段，返回可直接输出的 `ava result <id>` 围栏。
- `ava_dataset_close`：释放数据集进程，保留已经保存的展示快照。

工具从 `exec.agent.id` 获取所属会话，模型不能传 owner 冒用其他会话。视图只绑定已有列，不能重新填造数值。数值短语使用 resultId、rowKey、columnId 引用结果；完整结构参见主包的 `dsh-antv-ava/protocol`。

同时最多打开 8 个数据集，同数据集操作串行。每个进程的 DuckDB 限制为 256 MiB 内存、1 个线程、128 MiB spill、20 秒查询时限；宿主对普通操作另设 30 秒期限，源加载为 60 秒。取消会终止子进程并等待退出，不保留被取消的结果。继续分析需要重新打开源。

空闲数据集默认 30 分钟后释放；Agent 释放、插件卸载时也清理进程。历史展示从持久化快照读取，不要求源会话继续存活。

## 展示快照的读取权限

`ava_result_present` 产生随机 256-bit capability ID。展示端通过同源 GET `/plugins/dsh-antv-ava/results/<id>` 读取快照。服务不提供枚举，拒绝跨站读取，并设置 `private, no-store` 与 `no-referrer`。

该 ID 本身授予读取该份展示快照的能力；分享包含它的聊天记录也会分享读取能力。它不是面向互联网多租户的登录认证。结果文件在显式清理存储目录前保留；删除文件会使对应历史展示不可读。

## 验证

仓库根目录的 `pnpm run check` 同时编译本包并执行真实 CSV/JSON/XLSX 查询、会话隔离、只读访问、精度、截断、取消和回放测试。`pnpm dev` 运行真实组件与 AVA 计算结果的本地预览。

已验证 DSH `0.1.0-rc.8` 和 `0.2.1-rc.2`。安装其中一个版本后，可在仓库根目录运行 `pnpm run verify:dsh`：它使用真实 DSH 工具注册器创建隔离测试上下文，验证注册、查询、叙事引用、会话归属、路由延迟加载、卸载和回放，不修改现有 profile。

`pnpm run verify:dsh-uploads` 使用真实 DSH 附件存储、会话和历史观察服务，验证上传 Excel 无需复制即可查询、会话相对路径和跨会话拒绝。可通过 `AVA_TEST_DSH_BINARY` 指定支持附件的 DSH 可执行文件。

当前实现默认的 Agent 编排路径。自主 `analyze/recommend/suggest`、模型桥接、远程数据库、Python 和跨端实时事件传输仍属于后续扩展；不会隐式发起第二套模型调用。
