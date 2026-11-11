# Baton DSH 插件

[English](README.md) | 中文

Baton 的 DSH 侧：接收队友的任务、人工确认后在你配置的目录里启动会话。
中继服务端在独立仓库：[dsh-team-baton](https://github.com/Of-qinhai/dsh-team-baton)。

公开源码默认不连接任何服务器。你需要自己部署服务端，或向团队管理员获取服务地址和共享密钥。

## 要求

- DSH Desktop。已在 Electron 44 / Node 24 验证；其他版本可能改变
  `sessionController` / `workspaceRegistry` / `uiWorkspace` 的接口。
- 一个运行中的 `baton-server`，或团队的服务地址和密钥。
- Node 22+ 仅用于开发测试和预览；安装版复用 DSH 的 React，不需要构建。

## 安装

```sh
git clone https://github.com/Of-qinhai/dsh-team-baton-client.git
cd dsh-team-baton-client
cp cordis.patch.example.yml cordis.patch.yml
```

编辑 `cordis.patch.yml`：

```yaml
- insert:
    - id: baton
      name: '@token-team/dsh-baton'
      config:
        serverUrl: wss://baton.example.com/ws
        # secretFile: /绝对路径/secret   # 默认 ~/.config/baton/secret
        displayName: 你的名字
        environments:
          - { key: frontend, label: 前端, cwd: /绝对路径/前端 }
          - { key: backend,  label: 后端, cwd: /绝对路径/后端 }
```

把团队密钥放到 `~/.config/baton/secret`（目录 0700、文件 0600），或设置环境变量
`BATON_SECRET`：

```sh
mkdir -p ~/.config/baton
printf '%s\n' '<团队密钥>' > ~/.config/baton/secret
chmod 700 ~/.config/baton
chmod 600 ~/.config/baton/secret
```

在**本仓库根目录**安装（不是服务端仓库）：

```text
plugin_manager install_bundle target=/绝对路径/dsh-team-baton-client
```

安装需要批准；完成后重启 DSH 并刷新页面。

`cordis.patch.yml` 被 Git 忽略，永远不要提交服务地址、密钥或本机路径。
非 localhost 的 `serverUrl` 必须用 `wss://`；`secretFile` 必须是绝对路径且权限 0600。

## 面板

侧边栏入口在「自动化任务」下面。点开后右侧主区域显示收件箱：左侧房间、中间任务、
右侧详情。只有「接受并启动」才创建会话并提交 brief；拒绝只更新状态。
`需核对` 只能人工确认后收起。

发送方选择环境 key，本机把它映射到自己的绝对 `cwd`；不传远端路径，也没有默认回退目录。

## Agent 工具

只注册三个工具：`team_rooms`、`team_task_send`、`team_tasks`。
审批入口不暴露给 Agent，远端标题、brief 和显示名不会进入当前 Agent 上下文。

## 开发

```sh
npm ci
npm test          # 51 个单元测试
npm run preview   # http://127.0.0.1:4371，内存示例数据
```

`npm run test:flow` / `npm run test:integration` 还需要 Rust 服务端源码；
浏览器回归 `npm run test:client` 需要单独安装 `playwright/test` 和 Chromium。

## 许可证

[MIT](LICENSE)
