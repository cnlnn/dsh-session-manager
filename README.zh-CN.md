# DSH 会话管理器

[English](README.md) | 简体中文

为 DeepSeek Harness 增加会话回收站。在 DSH 设置中查看本地会话、存储占用和运行状态，并完成移入回收站、恢复与永久删除。

这是社区集成项目，并非 DeepSeek 官方插件。

## 产品特性

- DSH `设置 → 会话管理` 原生管理页
- 工作区会话“…”菜单中的“删除会话”操作
- 按标题、工作目录、创建时间和存储占用展示会话
- 运行中与已打开会话保护
- 删除前确认
- 回收站恢复与永久删除
- Linux、macOS 和原生 Windows 支持

## 数据处理

移入回收站时，插件通过 DSH 持久化服务锁定目标会话，然后把该会话目录移动到 `$DSH_HOME/trash`，并同步移除 Workspace 记账、归档状态和投影缓存。操作不会读取或上传会话内容。

恢复会把会话目录移回原位置。永久删除只处理回收站中的目标目录。

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

1. 打开 DSH 设置。
2. 进入“会话管理”。
3. 在“会话”或“回收站”中选择操作。

运行中的会话需要先切换到其他会话。会话移动或恢复后，页面会自动刷新列表状态。

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
