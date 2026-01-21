---
name: github
description: |
  Git 和 GitHub 操作技能。用于：初始化仓库、提交代码、创建/推送分支、创建 PR、查看 issues、创建 GitHub 仓库等。
  当用户要求进行 git 操作、提交代码到 GitHub、创建 PR、管理 issues 时使用此技能。
  触发词：git、github、提交、commit、push、pull request、PR、issue、仓库、repo
---

# GitHub 操作技能

## 常用命令速查

### 初始化仓库
```bash
git init
git add -A
git commit -m "Initial commit"
```

### 提交代码
```bash
git add -A
git status
git commit -m "$(cat <<'EOF'
提交信息标题

详细描述

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### 推送到远程
```bash
git push origin main
# 或设置上游并推送
git push -u origin main
```

### 创建 GitHub 仓库并推送
```bash
# 需要先安装 gh: brew install gh
# 首次使用需要登录: gh auth login --web

# 创建公开仓库并推送
gh repo create <repo-name> --public --source=. --remote=origin --push --description "描述"

# 创建私有仓库
gh repo create <repo-name> --private --source=. --remote=origin --push
```

### 创建 Pull Request
```bash
# 先推送分支
git push -u origin <branch-name>

# 创建 PR
gh pr create --title "标题" --body "$(cat <<'EOF'
## Summary
- 变更点1
- 变更点2

## Test plan
- [ ] 测试项1
- [ ] 测试项2
EOF
)"
```

### 查看 Issues
```bash
gh issue list                      # 列出 issues
gh issue view <number>             # 查看特定 issue
gh issue create --title "标题"     # 创建 issue
```

### 查看 PR
```bash
gh pr list                         # 列出 PR
gh pr view <number>                # 查看特定 PR
gh pr checkout <number>            # 检出 PR 分支
```

## 工作流程

### 1. 新项目推送到 GitHub

```bash
# 1. 创建 .gitignore
# 2. 初始化并提交
git init && git add -A && git commit -m "Initial commit"
# 3. 创建仓库并推送
gh repo create <name> --public --source=. --remote=origin --push
```

### 2. 日常提交流程

```bash
git status                         # 查看变更
git add -A && git commit -m "msg"  # 暂存并提交
git push                           # 推送
```

### 3. 功能分支流程

```bash
git checkout -b feature/xxx        # 创建分支
# 开发并提交...
git push -u origin feature/xxx     # 推送
gh pr create --title "feat: xxx"   # 创建 PR
```

## 提交信息规范

格式：`<type>: <description>`

| Type | 用途 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档更新 |
| refactor | 重构 |
| chore | 构建/工具 |

## 常见 .gitignore

```gitignore
node_modules/
dist/
target/
.vscode/
.idea/
.DS_Store
.env
*.log
```

## 注意事项

- 提交前 `git status` 确认变更
- 敏感信息不要提交（.env、credentials）
- 大文件用 Git LFS
