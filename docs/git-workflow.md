# Git Workflow

本文档记录本仓库的 Git 同步与推送规则，供后续 Codex 会话和人工操作参考。

## Remote Layout

- `upstream`: 原始上游项目，`https://github.com/labring/aiproxy.git`
- `origin`: 本地/定制开发仓库，`https://github.com/doomnaiad-320/litemhub.git`

## Branch Policy

- `main` 只用于同步上游原项目更新。
- `local-dev` 用于本地定制开发。
- 不要直接在 `main` 上开发业务功能。
- 默认只推送 `local-dev` 到 `origin`。
- 不要默认推送 `main` 到 `origin`，除非用户明确要求。

## Check Current Setup

```bash
git remote -v
git branch -vv
git status --short --branch
```

期望状态：

```text
upstream  -> https://github.com/labring/aiproxy.git
origin    -> https://github.com/doomnaiad-320/litemhub.git
main      -> tracks upstream/main
local-dev -> local/custom development branch
```

## Sync Upstream Into Local Development

从上游同步更新到本地开发分支：

```bash
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git checkout local-dev
git merge main
```

如果 `git merge --ff-only upstream/main` 失败，说明本地 `main` 有额外提交。不要强行 reset，先向用户确认处理方式。

## Push Local Development

首次设置 `local-dev` 的 upstream：

```bash
git push -u origin local-dev
```

之后推送本地开发分支：

```bash
git push origin local-dev
```

## GitHub Auth

如果推送时报错：

```text
fatal: could not read Username for 'https://github.com': Device not configured
```

通常是 GitHub HTTPS 凭据未配置。可以先登录 GitHub CLI：

```bash
gh auth login
```

登录完成后重试：

```bash
git push -u origin local-dev
```

## Files Not To Commit

- `aiproxy.db`
- 本地运行时数据库文件
- 临时文件
- 未确认用途的本地文件，例如 `t.md`

提交前先检查：

```bash
git status --short
git diff --stat
```
