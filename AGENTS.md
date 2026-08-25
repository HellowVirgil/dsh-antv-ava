# Repository Guidelines

## npm 发版流程

本仓库使用 npm Trusted Publishing（OIDC）发版，必须严格遵循 **GitHub Release → GitHub Actions → npm publish** 的顺序。GitHub Release 是发版入口，npm 包必须由 `.github/workflows/publish.yml` 从同一个不可变的 Git tag 和 commit 自动发布。

不要在本地执行 `npm publish`，也不要创建或使用长期 `NPM_TOKEN`。

### 一次性 Trusted Publisher 配置

在 npm 包 `dsh-antv-ava` 的 Trusted Publisher 设置中配置 GitHub Actions：

- Organization or user：`HellowVirgil`
- Repository：`dsh-antv-ava`
- Workflow filename：`publish.yml`
- Environment：`npm`
- Allowed actions：`npm publish`

Workflow 文件名或 Environment 如有变更，必须同步更新 npm 设置。GitHub 仓库中的 `npm` Environment 可按需要配置 required reviewers，OIDC 发布不需要 npm token 或 OTP。

### 1. 准备版本

从最新的 `main` 开始，确认目标版本尚未发布：

```bash
git switch main
git pull --ff-only origin main
npm view dsh-antv-ava@X.Y.Z version
```

若 npm 已返回该版本，不得复用；选择新的版本号。然后更新版本和变更记录：

```bash
pnpm version patch --no-git-tag-version
# 按实际改动更新 CHANGELOG.md
```

`patch` 可按语义化版本规则替换为 `minor`、`major` 或明确的版本号。

### 2. 本地验证

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run verify:pack
```

检查打包清单和元数据，确保不包含本地绝对路径、凭据、临时文件或未预期的内容。

### 3. 提交并等待 CI

```bash
git add package.json pnpm-lock.yaml CHANGELOG.md
git commit -m "chore(release): vX.Y.Z"
git push origin main
```

等待 `main` 分支 CI 全部通过。CI 未通过时不得创建 tag、GitHub Release 或发布 npm 包。

### 4. 创建不可变 tag 和 GitHub Release

确认当前 `main` 的 HEAD 就是已通过 CI 的发版 commit，再创建 annotated tag：

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
gh release create vX.Y.Z --verify-tag --title "vX.Y.Z" --generate-notes
```

必须先成功创建 GitHub Release，之后才能执行 `npm publish`。

发布 Release 后，`.github/workflows/publish.yml` 会自动：

- 检出 Release 对应的精确 tag。
- 验证 `vX.Y.Z` 与 `package.json` 版本完全一致。
- 验证 GitHub prerelease 状态与 SemVer 预发布版本一致。
- 重新执行安装、检查和打包验证。
- 使用 npm Trusted Publishing（OIDC）发布带 provenance 的包。
- 正式版本发布到 `latest`；预发布版本发布到 `next`。

### 5. 监控自动发布

不要在本地补发。查看并等待 `Publish to npm` Workflow：

```bash
gh run list --workflow publish.yml --limit 5
gh run watch RUN_ID --exit-status
```

鉴权、网络或 npm 服务故障时，从 GitHub Actions 重跑同一个 Release 对应的失败任务。不得创建替代 tag，也不得改为本地 token 发布。

### 6. 发布后验证

```bash
npm view dsh-antv-ava@X.Y.Z version dist-tags dist.tarball
dsh plugin --profile web add dsh-antv-ava@X.Y.Z
```

确认 npm 元数据正确，并验证 DSH 能安装指定版本。

## 发版约束

- 不得移动、覆盖或强推已经发布的 tag。
- 不得复用已经存在的 npm 版本号。
- 不得绕过 GitHub Release 和 `publish.yml` 执行 `npm publish`。
- 鉴权、网络或 npm 服务故障时，重跑同一个 GitHub Actions 任务，不要重新生成 tag。
- 如果包内容错误，修复后发布新的 patch 版本；不要修改既有 tag 或 Release。
- 不把 `npm unpublish` 作为常规纠错流程；确需撤回时必须由维护者明确决定。
- token、OTP、密码等凭据不得写入文件、命令参数、日志或 commit。
- 创建 tag 和 GitHub Release 时必须使用 `HellowVirgil` 对应的 GitHub 账号，并在执行前确认当前登录身份。
- 不得重命名 `publish.yml` 或更改 `npm` Environment，除非同时更新 npm Trusted Publisher 配置。
