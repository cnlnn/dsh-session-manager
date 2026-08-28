# DSH Session Manager

English | [简体中文](README.zh-CN.md)

Add a session trash to DeepSeek Harness. Review local sessions, storage use, and live state from DSH settings, then move sessions to trash, restore them, or delete them permanently.

This is a community integration and is not an official DeepSeek plugin.

## Highlights

- Native `Settings → Session Manager` page in DSH
- Delete Session action in each Workspace session's ellipsis menu
- Session title, workspace, creation time, and storage use
- Protection for running and attached sessions
- Confirmation before removal
- Restore and permanent deletion from trash
- Linux, macOS, and native Windows support

## Data Handling

Moving a session to trash reserves it through the DSH persistence service, moves its directory to `$DSH_HOME/trash`, and removes its Workspace account, archive state, and projection cache. The plugin does not read or upload conversation content.

Restore moves the directory back to its original location. Permanent deletion operates only on the selected trash directory.

## Compatibility

| Component | Version |
| --- | --- |
| DeepSeek Harness | `0.1.1-rc.2` |
| Node.js | 22.19+ |
| Platforms | Linux, macOS, Windows |

This release supports DSH persistence backends that expose one local artifact directory per session and targets the session, Workspace, and projection-cache interfaces in `0.1.1-rc.2`.

## Install

macOS/Linux:

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-session-manager
dsh --profile web --dump-config
dsh web
```

Windows PowerShell:

```powershell
dsh plugin --profile web add "link:C:/absolute/path/to/dsh-session-manager"
dsh --profile web --dump-config
dsh web
```

The same commands work with a pinned `npx @deepseek-ai/dsh` launcher when DSH is not installed globally.

## Use

1. Open DSH Settings.
2. Select Session Manager.
3. Choose an action under Sessions or Trash.

Switch away from a live session before moving it. DSH refreshes after move and restore operations.

## Remove

```sh
dsh plugin --profile web remove @local/dsh-session-manager
```

Removal leaves `$DSH_HOME/trash` untouched. Reinstall the plugin to restore or permanently remove existing trash entries.

## Development

```sh
npm ci
npm test
```
