# Runtime npm Trusted Publisher

当前状态：仓库侧已准备双包发布流程；npm 端的 runtime 包和信任关系仍需建立。现有已发布版本继续使用 README 中的 GitHub Release 安装包。两个插件的依赖和使用方式保持不变。

## npm 端配置

这是 `dsh-antv-ava-runtime` 自己的包级授权，主包的授权不会覆盖它。

| 字段 | 值 |
| --- | --- |
| Package | `dsh-antv-ava-runtime` |
| Provider | GitHub Actions |
| Organization or user | `HellowVirgil` |
| Repository | `dsh-antv-ava` |
| Workflow filename | `publish.yml` |
| Environment | `npm` |
| Allowed action | `npm publish` |

管理账户应为具有该包写权限的 npm 账户。当前主包维护者是 `hellowvirgil`；GitHub 登录名为 `HellowVirgil`。保存配置需要账户开启 2FA，并完成 npm 的交互验证。

网页入口：[runtime 包设置](https://www.npmjs.com/package/dsh-antv-ava-runtime/access)。

如果使用 CLI，需要 npm ≥11.15.0。以下命令只配置授权，不发布代码；在包已存在且维护者已登录后执行：

```bash
npm exec --yes --package npm@11.21.1 -- npm trust github dsh-antv-ava-runtime \
  --repo HellowVirgil/dsh-antv-ava \
  --file publish.yml \
  --environment npm \
  --allow-publish --yes
```

随后读取并核对设置：

```bash
npm exec --yes --package npm@11.21.1 -- npm trust list dsh-antv-ava-runtime --json
```

密码、OTP 和 token 由维护者在 npm 的交互流程中处理，不写入脚本、命令参数、日志或 commit。

## 首次建包前置条件

npm 官方的 `npm trust` 文档明确要求包已存在。当前 runtime 在 npm 上返回 404，因此直接创建 Trusted Publisher 的条件尚未满足；GitHub Release 附件不会创建 npm 包。

官方 staged publishing 可以为新包建立公开的 `0.0.0-stage` 占位版本，但这也是一次注册表写入，且需要有效 npm 身份。它不等于已验证的 OIDC 发布，也不能被当作绕过本仓库发布规则的办法。

仓库 AGENTS.md 要求发布从 GitHub Release 进入，禁止本地 `npm publish` 和长期 NPM_TOKEN。首次建包如果需要例外，必须先取得维护者明确授权；不要自行使用旧 token、本地补发或创建替代 tag。

## GitHub 侧启用

`publish.yml` 保留现有主包发布，并增加独立的 `publish-runtime` job：

1. 两个 job 使用同一个 Release tag 和 `npm` Environment。
2. 主包 job 完成安装、检查、打包与发布。
3. runtime job 下载该 Release 已生成的压缩包，验证 SHA-256、包名、版本、精确主包依赖和公开仓库元数据，再通过自己的 OIDC 关系发布。
4. runtime job 失败时仅重跑失败 job，避免重复执行已成功的主包发布。

仓库变量 `NPM_RUNTIME_TRUSTED_PUBLISHER` 控制启用状态。只有值为 `enabled` 时才执行 runtime npm 发布；其他值或缺失均保留当前 Release 附件交付方式。

在 npm 设置已保存并读取核对后再启用：

```bash
gh variable set NPM_RUNTIME_TRUSTED_PUBLISHER --body enabled --repo HellowVirgil/dsh-antv-ava
```

新信任配置需要在两天内完成首次成功发布以绑定仓库身份。应先准备下一个未使用的主包/runtime 版本，等 CI 通过后创建新的 Release；不要修改已发布 tag、重打已有 runtime 附件版本或只修改远端设置后无限期闲置。

首次 OIDC 发布成功后，再把 README 的 runtime 安装说明切换到 npm 包名。配置未完成时不要声称 runtime 已在 npm 可用。

## 官方依据

- [npm trust：前置条件与命令](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
- [Trusted publishing：GitHub 字段、权限与两天验证期限](https://docs.npmjs.com/trusted-publishers/)
- [Staged publishing：新包占位版本](https://docs.npmjs.com/staged-publishing/)
