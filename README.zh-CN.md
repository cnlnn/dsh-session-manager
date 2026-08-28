# DSH 会话管理器

[English](README.md) | 简体中文

为 DeepSeek Harness 增加会话回收站。在 DSH 设置中查看本地会话、存储占用和运行状态，并完成移入回收站、恢复与永久删除。

这是社区集成项目，并非 DeepSeek 官方插件。

## 产品特性

- DSH `设置 → 会话管理` 原生管理页
- 侧边栏回收站入口，显示待处理会话数量
- 工作区会话“…”菜单中的“移到回收站”和“永久删除会话”
- 按标题、工作目录、创建时间和存储占用展示会话
- 运行中会话保护；已打开但空闲的会话可直接处理
- 删除前确认
- 回收站恢复、永久删除与一键清空
- Linux、macOS 和原生 Windows 支持

## 数据处理

移入回收站时，插件先关闭已打开但空闲的会话，通过 DSH 持久化服务锁定目标，再把会话目录移动到 `$DSH_HOME/trash`，并同步更新 Workspace 记账和归档状态。标题投影会保留并在恢复时重建，因此恢复后的列表会立即显示原会话标题。操作不会上传会话内容。

恢复会把会话目录移回原位置。永久删除可以直接移除活动列表中的冷会话，也可以移除回收站中的单个或全部会话；直接永久删除的会话不会进入回收站。

## 兼容性

| 项目 | 版本 |
| --- | --- |
| DeepSeek Harness | `0.1.1-rc.2` |
| Node.js | 22.19+ |
| 平台 | Linux、macOS、Windows |

当前版本适用于每个会话拥有独立本地文件目录的 DSH 持久化后端，并按 `0.1.1-rc.2` 的会话、Workspace 和投影缓存接口实现。

## 安装

macOS/Linux：

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-session-manager
dsh --profile web --dump-config
dsh web
```

Windows PowerShell：

```powershell
dsh plugin --profile web add "link:C:/absolute/path/to/dsh-session-manager"
dsh --profile web --dump-config
dsh web
```

未全局安装 DSH 时，可以用固定版本的 `npx @deepseek-ai/dsh` 执行相同命令。

## 使用

工作区会话的“…”菜单提供“移到回收站”和“永久删除会话”。侧边栏底部的“回收站”可直接恢复、永久删除或清空全部项目；完整会话清单仍位于 `设置 → 会话管理`。

运行中的会话需要等待任务结束；已打开但空闲的会话可以直接移入回收站或永久删除。会话移动、恢复或删除后，列表会原地同步，不会刷新整个页面。

## 卸载

```sh
dsh plugin --profile web remove @local/dsh-session-manager
```

卸载不会删除 `$DSH_HOME/trash` 中的内容。恢复或永久删除已有回收站项目时，可重新安装插件后继续处理。

## 开发

```sh
npm ci
npm test
```
