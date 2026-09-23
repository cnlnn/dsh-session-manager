# DSH Session Manager

English | [简体中文](README.zh-CN.md)

Add a session trash to DeepSeek Harness. Review local sessions, storage use, and live state from DSH settings, then move sessions to trash, restore them, or delete them permanently.

This is a community integration and is not an official DeepSeek plugin.

## Highlights

- Native `Settings → Session Manager` page in DSH
- Optional sidebar Trash entry with the pending-session count
- Move to Trash and Delete Permanently actions in each session's ellipsis menu
- Search by title, path, or session ID; filter by state; sort by time, title, or storage use
- Session title, workspace, creation time, storage use, running or idle state, archive state, blank-session state, and unassigned state
- Protection for running sessions; attached idle sessions can be handled directly
- Optional automatic recovery for recent interrupted cold sessions, with a 24-hour safety window
- Confirmation before removal
- Restore, permanent deletion, and Empty Trash actions
- Trash directories on a different disk or filesystem
- Linux, macOS, and native Windows support

## Data Handling

Moving a session to trash first closes it when it is attached and idle, reserves it through the DSH persistence service, moves its directory to `$DSH_HOME/trash`, and updates its Workspace and archive records. Title projections are preserved and rebuilt during restore, so the original title appears immediately. The plugin does not upload conversation content.

Restore moves the directory back to its original location. Permanent deletion can remove a cold session directly or remove one or every entry from Trash; a directly deleted session never enters Trash.

## Compatibility

| Component | Version |
| --- | --- |
| DeepSeek Harness | `0.1.1-rc.2`, `0.1.5-rc.3`, `0.1.7-rc.1` |
| Node.js | 22.19+ |
| Platforms | Linux, macOS, Windows |

Supports the official local JSONL backend through both legacy APIs and newer per-session handles, snapshot listings, projection caches, and settings APIs. Backends without a movable session directory refuse deletion rather than guessing storage paths. Newer hosts use native session-menu slots; older hosts retain the menu adapter.

The compatibility matrix installs each version in isolation and checks real JSONL inventory, write-lock protection, trash, restore, content integrity, and permanent deletion without reading existing DSH sessions. Backward plugin compatibility does not imply that older DSH versions can read newer session formats.

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

Each Workspace session's ellipsis menu offers Move to Trash and Delete Permanently. The Trash entry at the bottom of the sidebar opens restore, permanent-delete, and empty-trash controls. The complete inventory remains available under `Settings → Session Manager`.

`Settings → Plugins → Plugin Configuration → Session Manager` includes Show Trash Below Workspaces and Automatically Recover Interrupted Tasks options. Automatic recovery only handles cold sessions interrupted within the last 24 hours: startup checks them under an inter-process lease and never takes over a running session. A durable claim is recorded only when a goal is created or explicitly resumed while this option is enabled, so historical active goals are not revived after an upgrade. It does not replay old user messages or tool calls; an unknown tool outcome fail-closes automatic continuation until external state is verified. All feature settings are available in the UI; editing `settings.yaml` is not required.

Wait for a running session to become idle before removing it. An attached idle session can be moved to Trash or deleted permanently without switching away first. Session lists reconcile in place after move, restore, and delete operations without reloading the page.

## Remove

```sh
dsh plugin --profile web remove @local/dsh-session-manager
```

Removal leaves `$DSH_HOME/trash` untouched. Reinstall the plugin to restore or permanently remove existing trash entries.

## Development

```sh
npm ci
npm test
npm run test:compat -- 0.1.7-rc.1
```
