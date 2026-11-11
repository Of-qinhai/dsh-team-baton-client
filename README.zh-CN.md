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

插件包自带一个**安全的占位** `cordis.patch.yml`（`serverUrl` 为空），所以可以先安装、
再通过 DSH profile 配置，不会因为缺少 patch 文件安装失败。

### 1. 放团队密钥

```sh
mkdir -p ~/.config/baton
printf '%s\n' '<团队密钥>' > ~/.config/baton/secret
chmod 700 ~/.config/baton
chmod 600 ~/.config/baton/secret
```

`secretFile` 默认读这个路径；环境变量 `BATON_SECRET` 非空时优先。

### 2. 安装插件

在插件管理器的 Git 仓库输入框粘贴仓库地址（就是截图里显示「Git 仓库」的弹窗），
或 clone 后安装本地目录：

```sh
git clone https://github.com/Of-qinhai/dsh-team-baton-client.git
# 然后在 DSH 里：
plugin_manager install_bundle target=/绝对路径/dsh-team-baton-client
```

安装需要批准。

### 3. 在 profile patch 里配置

打开 profile 的 `cordis.patch.yml`：

- macOS/Linux：`~/.dsh/profiles/<profile>/cordis.patch.yml`
- Windows：`%USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml`

加一条**完整覆盖行**（同 id 会替换整个 config，所以 `serverUrl` 必须一起写）：

```yaml
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

不要修改 `node_modules` 下的那份 patch，它会在重装时被替换。

### 4. 重启并刷新

重启 DSH，再刷新页面。侧边栏入口在「自动化任务」下面。

非 localhost 的 `serverUrl` 必须用 `wss://`；`secretFile` 必须是绝对路径且权限 0600。
永远不要提交服务地址、密钥或本机路径。

## 执行环境

每个安装自己可视化配置目录：点面板顶部的文件夹按钮打开「本机执行环境」，
为每个环境填写 key、显示名称和本机绝对目录。配置保存在
`~/.dsh/baton/environments.json`（0600）。

只有 key 和名称会暴露给同房间成员，绝对路径不会离开本机。因此发送方是从
**对方的**已公开环境列表里选择，接收方仍映射到自己的目录。profile 配置里的
`environments` 只是新安装的初始种子；可视化编辑器保存后，以本机文件为准。

保存时会验证目录存在并转换为规范化绝对路径。断线时可以保存，重连后上报；
如果本机保存成功但上报失败，面板会明确提示，避免把“已保存”误认为“对方已收到”。

## 任务删除与列表

- 收件箱和已发出的任务均可首次删除，移入“已删除”；对方的列表和关联会话不受影响。
- 在“已删除”中可以恢复，也可以二次确认永久删除。你确认后无法再恢复或审批该任务。
- 只有双方都确认永久删除，服务端才清理在线数据库中的任务正文；保留最小的任务 ID/有效期，
  避免网络重试重新创建已删除任务。原有七天过期策略继续生效，已有备份按保留周期过期。
- 删除或恢复任务始终不会删除 DSH 会话，也不会重新提交消息。
- 左侧导航支持折叠/展开，任务列表在收件箱、已发出的和已删除三个标签中独立滚动。

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
