# Claude Code 调试命令

## 命令名称
`/debug`

## 目的
一键启动 DeskLab 的前端 + Tauri 后端调试环境（避免 `::1:5173` 权限问题）。

## 执行步骤
1. 安装依赖（仅首次）
   ```bash
   pnpm install
   ```
2. 启动开发模式（含 Tauri）
   ```bash
   pnpm tauri dev
   ```

## 说明
- 当前调试端口固定为 `127.0.0.1:5174`，配置在 `src-tauri/tauri.conf.json`。
- 前端单独调试可使用：
  ```bash
  pnpm dev -- --host 127.0.0.1 --port 5174
  ```
- 后端日志可通过：
  ```bash
  RUST_LOG=debug pnpm tauri dev
  ```
