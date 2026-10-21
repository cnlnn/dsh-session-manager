window.__ModuleLoader__.load({
	id: "@local/dsh-session-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const ReactDOMClient = require("react-dom/client");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const IconChevronDownOutline14 = primitives.IconChevronDownOutline14 ?? primitives.IconChevronDownOutlineRegular;
		const IconCloseOutline16 = primitives.IconCloseOutline16 ?? primitives.IconCloseOutlineRegular;
		const IconTrashOutline16 = primitives.IconTrashOutline16 ?? primitives.IconTrashOutlineRegular;
		const IconRefresh = primitives.IconRefreshOutlineMedium ?? primitives.IconRefreshOutlineRegular ?? primitives.IconRefreshOutline16 ?? primitives.IconRefreshOutline14;
		const IconNav = primitives.IconFlatListOutlineMedium ?? primitives.IconFlatListOutlineRegular ?? primitives.IconListPenOutlineMedium ?? primitives.IconListPenOutline16 ?? primitives.IconChecklistOutline14;
		const IconSearch = primitives.IconSearchOutlineMedium ?? primitives.IconSearchOutlineRegular ?? primitives.IconSearchOutline16;
		const { MenuItemButton } = primitives;
		const h = React.createElement;
		const API_ROOT = "/plugins/@local/dsh-session-manager/api";
		const SETTINGS_NAMESPACE = "session-manager";

		const css = `

.dsm-root{box-sizing:border-box;width:100%;margin:0;padding:0 0 8px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);display:flex;flex-direction:column;gap:12px}
.dsm-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.dsm-heading{min-width:0;flex:1}
.dsm-header-tools{display:flex;flex:none;align-items:center;gap:4px}
.dsm-title{margin:0;font:var(--dsw-font-base-strong-16)}
.dsm-intro{margin:2px 0 0;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-s-14)}
.dsm-action,.dsm-tab{box-sizing:border-box;appearance:none;font:var(--dsw-font-xs-13);cursor:pointer}
.dsm-tabs{display:flex;align-items:flex-end;gap:22px;min-width:0;margin:0;padding:0;border:0;border-bottom:.5px solid var(--dsw-alias-border-l2);border-radius:0;background:transparent}
.dsm-tab{position:relative;height:auto;padding:7px 1px 9px;border:0;border-radius:0;color:var(--dsw-alias-label-tertiary);background:transparent;font:var(--dsw-font-xs-13)}
.dsm-tab:hover{color:var(--dsw-alias-label-primary);background:transparent}
.dsm-tab-active{color:var(--dsw-alias-label-primary);background:transparent;box-shadow:none}
.dsm-tab-active:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px 2px 0 0;background:var(--dsw-alias-label-primary)}
.dsm-list{display:flex;flex-direction:column;gap:8px}
.dsm-controls{display:flex;align-items:center;gap:8px;margin:0}
.dsm-search{position:relative;flex:1;min-width:0;color:var(--dsw-alias-label-tertiary)}
.dsm-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none}
.dsm-input,.dsm-select{box-sizing:border-box;width:100%;height:36px;min-width:0;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,12px);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font:var(--dsw-font-xs-13)}
.dsm-search .dsm-input{padding-left:36px}
.dsm-search:not(:has(svg)) .dsm-input{padding-left:12px}
.dsm-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.dsm-input:focus,.dsm-select:focus{border-color:var(--dsw-alias-state-business-primary);outline:none}
.dsm-select{appearance:none;flex:none;width:auto;max-width:148px;padding-right:28px;background-color:var(--dsw-alias-bg-layer-1);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;background-size:12px 12px;cursor:pointer}
.dsm-result-count{margin:0;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12)}
.dsm-inventory{display:flex;flex-direction:column;gap:6px}
.dsm-list-head{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;column-gap:12px;min-height:28px;padding:0 calc(14px + .5px)}
.dsm-list-head-text{display:flex;align-items:center;gap:10px;min-width:0}
.dsm-row{box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-height:0;padding:12px 14px;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l4));border-radius:var(--dsw-radius-xl,20px);background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-2))}
.dsm-row-selectable{grid-template-columns:16px minmax(0,1fr) auto}
.dsm-check-cell{display:flex;align-items:center;justify-content:center;width:16px;height:16px}
.dsm-check{display:block;width:16px;height:16px;margin:0;padding:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.dsm-check:disabled{cursor:default}
.dsm-batch-all{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);cursor:pointer}
.dsm-invert{appearance:none;margin:0;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);cursor:pointer}
.dsm-invert:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.dsm-invert:disabled{cursor:default;opacity:.4}
.dsm-batch-actions{display:flex;flex:none;align-items:center;gap:2px;justify-self:end}
.dsm-main{min-width:0}
.dsm-title-line{display:flex;align-items:center;gap:6px;min-width:0}
.dsm-row-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--dsw-font-s-strong-14)}
.dsm-state-list{display:flex;flex:none;align-items:center;gap:4px}
.dsm-meta{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;margin-top:4px;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12)}
.dsm-path{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-actions{display:flex;flex:none;align-items:center;gap:4px}
.dsm-session-actions{gap:2px}
.dsm-action{box-sizing:border-box;display:inline-flex;flex:none;align-items:center;justify-content:center;height:32px;padding:0 12px;border:0;border-radius:var(--dsw-radius-sm,8px);color:var(--dsw-alias-label-primary);background:transparent;font:var(--dsw-font-xs-13);white-space:nowrap}
.dsm-action:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsm-action:disabled{cursor:default;opacity:.4}
.dsm-dialog .dsm-action:not(.dsm-danger):not(.dsm-primary){border:.5px solid var(--dsw-alias-border-l3)}
.dsm-danger{color:var(--dsw-alias-state-error-primary)}
.dsm-action.dsm-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.dsm-tag{display:inline-flex;align-items:center;height:18px;padding:0 6px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs,4px);font:var(--dsw-font-xxxs-11);white-space:nowrap}
.dsm-live{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-secondary);border-color:transparent}
.dsm-muted{color:var(--dsw-alias-label-secondary);background:transparent}
.dsm-empty,.dsm-status{margin:0;padding:24px 2px;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xs-13)}
.dsm-error{margin:0;padding:8px 10px;border-radius:var(--dsw-radius-lg,16px);color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);font:var(--dsw-font-xxs-12)}
.dsm-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px}.dsm-overlay-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.42));backdrop-filter:var(--dsw-mask-blur)}
.dsm-dialog{position:relative;z-index:1;box-sizing:border-box;width:min(480px,100%);padding:20px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,16px);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent,0 18px 48px rgba(0,0,0,.24));font:var(--dsw-font-s-14)}
.dsm-dialog-title{margin:0;font:var(--dsw-font-base-strong-16)}
.dsm-dialog-body{margin:8px 0 16px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);overflow-wrap:anywhere}
.dsm-dialog-actions{display:flex;justify-content:flex-end;gap:8px}
.dsm-primary{color:var(--dsw-alias-label-primary-foreground,#fff);border-color:transparent;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-state-business-primary))}
.dsm-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-state-business-primary))}
.dsm-menu-delete,.dsm-menu-delete svg{color:var(--dsw-alias-state-error-primary)!important}
.dsm-menu-delete:hover{background:var(--dsw-alias-interactive-bg-hover-danger)!important}
.dsm-sidebar-trigger{box-sizing:border-box;flex:none;display:flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:4px -2px;padding:0 10px 0 8px;border:0;border-radius:12px;color:var(--dsw-alias-label-primary);background:transparent;cursor:pointer;font:var(--dsw-font-s-14);overflow:hidden}
.dsm-sidebar-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsm-sidebar-trigger-rail{width:36px;height:36px;margin:8px 0 2px;padding:0;justify-content:center;gap:0;border-radius:50%}
.dsm-sidebar-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-sidebar-count{display:inline-flex;flex:none;align-items:center;justify-content:center;min-width:18px;margin-left:auto;padding:1px 6px;border-radius:999px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform);font:var(--dsw-font-xxxs-strong-11);font-variant-numeric:tabular-nums;line-height:17px}
.dsm-icon-source{display:none}
.dsm-panel{position:relative;z-index:1;box-sizing:border-box;display:flex;flex-direction:column;width:min(800px,calc(100vw - 48px));height:min(800px,calc(100vh - 48px));border:0;border-radius:var(--dsw-radius-panel,28px);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent,0 18px 48px rgba(0,0,0,.24));overflow:hidden;font:var(--dsw-font-s-14)}
.dsm-panel-header{box-sizing:border-box;display:flex;align-items:center;gap:8px;min-height:54px;padding:20px 16px 8px 24px}
.dsm-panel-heading{min-width:0;flex:1}
.dsm-panel-title{margin:0;font:var(--dsw-font-base-strong-16)}
.dsm-panel-summary{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12)}
.dsm-icon-button{box-sizing:border-box;display:inline-flex;flex:none;align-items:center;justify-content:center;width:28px;height:28px;min-width:28px;max-width:28px;aspect-ratio:1;padding:0;border:0;border-radius:var(--dsw-radius-sm,8px);color:var(--dsw-alias-label-secondary);background:transparent;cursor:pointer;font:var(--dsw-font-xxs-12)}
.dsm-icon-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsm-icon-button:disabled{cursor:default;opacity:.4}
.dsm-icon-button:focus-visible,.dsm-action:focus-visible,.dsm-tab:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dsm-undo-icon{display:block;width:16px;height:16px;font:16px/16px var(--dsw-font-family);text-align:center}
.dsm-icon-button.dsm-danger,.dsm-icon-button.dsm-danger svg{color:var(--dsw-alias-state-error-primary)!important}
.dsm-icon-button.dsm-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.dsm-panel-body{min-height:0;flex:1;padding:8px 24px 24px;overflow-y:auto}
.dsm-plugin-card{overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-3);list-style:none;font:var(--dsw-font-s-14);transition:border-color .16s,background .16s}
.dsm-plugin-card:hover{border-color:var(--dsw-alias-label-dimmed)}
.dsm-plugin-card-open{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
.dsm-plugin-head{box-sizing:border-box;appearance:none;display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border:0;border-radius:12px;color:inherit;background:transparent;text-align:left;cursor:pointer;font:var(--dsw-font-s-14)}
.dsm-plugin-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dsm-plugin-head-text{display:flex;min-width:0;flex:1;flex-direction:column;gap:4px}
.dsm-plugin-name{color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:15px;font-weight:600;line-height:1.4}
.dsm-plugin-description{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xs-13);line-height:1.5}
.dsm-plugin-pending{flex:none;padding:1px 8px;border-radius:999px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform);font:var(--dsw-font-xxxs-strong-11);line-height:17px;white-space:nowrap}
.dsm-plugin-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s}
.dsm-plugin-chevron-open{transform:rotate(180deg)}
.dsm-plugin-body{margin:0 16px;padding-bottom:8px;border-top:1px solid var(--dsw-alias-border-l2)}
.dsm-plugin-readonly,.dsm-plugin-hint,.dsm-plugin-failed{margin:12px 0 0;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12)}
.dsm-plugin-failed{min-width:0;flex:1;color:var(--dsw-alias-label-error)}
.dsm-plugin-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}
.dsm-plugin-toggle{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xs-strong-13);line-height:1.5;cursor:pointer}
.dsm-plugin-toggle input{width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-brand-primary)}
.dsm-plugin-hint{margin:0}
.dsm-plugin-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 0 4px;border-top:1px solid var(--dsw-alias-border-l2)}
.dsm-plugin-discard,.dsm-plugin-save{appearance:none;padding:5px 14px;border:1px solid transparent;border-radius:8px;font:var(--dsw-font-xs-13);cursor:pointer}
.dsm-plugin-discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:transparent}
.dsm-plugin-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}
.dsm-plugin-save{color:var(--dsw-alias-bg-layer-3);background:var(--dsw-alias-label-primary)}
.dsm-plugin-discard:disabled,.dsm-plugin-save:disabled{cursor:default;opacity:.4}
.dsm-plugin-discard:focus-visible,.dsm-plugin-save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
@media(max-width:520px){.dsm-controls{flex-wrap:wrap}.dsm-search{flex-basis:100%}.dsm-select{max-width:none;flex:1}.dsm-title-line{flex-wrap:wrap}.dsm-meta{grid-template-columns:minmax(0,1fr);gap:2px}.dsm-icon-button{width:28px;height:28px;min-width:28px;max-width:28px}.dsm-dialog{padding:16px}}}`;
		if (document.querySelector('style[data-dsh-session-manager]') === null) {
			const style = document.createElement("style");
			style.dataset.dshSessionManager = "";
			style.textContent = css;
			document.head.appendChild(style);
		}

		function formatBytes(value) {
			if (!Number.isFinite(value) || value <= 0) return "0 B";
			const units = ["B", "KB", "MB", "GB"];
			const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
			const number = value / (1024 ** index);
			return `${number >= 10 || index === 0 ? number.toFixed(0) : number.toFixed(1)} ${units[index]}`;
		}

		function formatTime(value) {
			const date = new Date(value);
			return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("zh-CN", {
				year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
			}).format(date);
		}

		async function api(route, body) {
			const response = await fetch(`${API_ROOT}/${route}`, body === undefined ? {
				method: "GET",
				cache: "no-store",
			} : {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			});
			const text = await response.text();
			if (text.length === 0) throw new Error(`服务没有返回结果（HTTP ${response.status}）`);
			let value;
			try { value = JSON.parse(text); }
			catch { throw new Error(`服务返回了无法读取的结果（HTTP ${response.status}）`); }
			if (!response.ok || value.ok !== true) throw new Error(value.error || `HTTP ${response.status}`);
			return value.value;
		}

		async function runBatch(op, ids) {
			const key = op === "restore" || op === "purge" ? "trashId" : "sessionId";
			const failed = [];
			let succeeded = 0;
			for (const id of ids) {
				try {
					await api(op, { [key]: id });
					succeeded += 1;
				} catch (error) {
					failed.push({ id, error: error instanceof Error ? error.message : String(error) });
				}
			}
			return { succeeded, failed };
		}

		function signalChanged() {
			window.dispatchEvent(new Event("dsm:changed"));
		}

		function filteredRows(rows, view, query, state, sort) {
			const needle = query.trim().toLocaleLowerCase();
			const result = rows.filter(item => {
				if (needle.length > 0 && ![item.title, item.cwd, item.id, item.sessionId]
					.some(value => typeof value === "string" && value.toLocaleLowerCase().includes(needle))) return false;
				if (view !== "sessions" || state === "all") return true;
				if (state === "idle") return !item.running;
				if (state === "running") return item.running;
				if (state === "archived") return item.archived;
				if (state === "blank") return item.blank;
				if (state === "unassigned") return Array.isArray(item.workspaceIds) && item.workspaceIds.length === 0;
				return true;
			});
			return result.sort((left, right) => {
				if (sort === "oldest") return new Date(left.createdAt || left.trashedAt) - new Date(right.createdAt || right.trashedAt);
				if (sort === "largest") return right.size - left.size;
				if (sort === "title") return left.title.localeCompare(right.title, "zh-CN");
				return new Date(right.createdAt || right.trashedAt) - new Date(left.createdAt || left.trashedAt);
			});
		}

		function batchCopy(kind, item) {
			const count = item.count;
			const size = formatBytes(item.size);
			if (kind === "batch-trash") return [`批量移到回收站`, `将把选中的 ${count} 个会话移到回收站，共 ${size}。`, "移到回收站"];
			if (kind === "batch-delete") return [`批量永久删除`, `将永久删除选中的 ${count} 个会话，共 ${size}。这些会话不会进入回收站。`, "永久删除"];
			if (kind === "batch-restore") return [`批量恢复`, `将恢复选中的 ${count} 个会话，共 ${size}。`, "恢复"];
			if (kind === "batch-purge") return [`批量永久删除`, `将从回收站永久删除选中的 ${count} 个会话，共 ${size}。此操作无法恢复。`, "永久删除"];
			return null;
		}

		const dialogOpenedAt = new WeakMap();
		function ConfirmDialog({ action, busy, failure = "", onCancel, onConfirm }) {
			if (action === null) return null;
			if (!dialogOpenedAt.has(action)) dialogOpenedAt.set(action, Date.now());
			const batch = batchCopy(action.kind, action.item);
			const permanent = action.kind === "delete" || action.kind === "purge" || action.kind === "empty" || action.kind === "batch-delete" || action.kind === "batch-purge";
			const title = batch !== null
				? batch[0]
				: action.kind === "empty"
					? "清空回收站"
					: permanent ? "永久删除会话" : "移到回收站";
			const body = batch !== null
				? batch[1]
				: action.kind === "empty"
					? `将永久删除回收站中的 ${action.item.count} 个会话，共 ${formatBytes(action.item.size)}。此操作无法恢复。`
					: action.kind === "delete"
						? `“${action.item.title}”将被永久删除，不会进入回收站，无法恢复。`
						: action.kind === "purge"
							? `“${action.item.title}”将从回收站中永久删除，无法恢复。`
							: `“${action.item.title}”将从会话列表移除，并保留在回收站中。`;
			const confirmLabel = batch !== null ? batch[2] : action.kind === "empty" ? "清空回收站" : permanent ? "永久删除" : "移到回收站";
			return h("div", { className: "dsm-overlay", role: "presentation" },
				h("div", { className: "dsm-overlay-mask", onMouseDown: () => {
					if (busy || Date.now() - dialogOpenedAt.get(action) < 400) return;
					onCancel();
				} }),
				h("div", { className: "dsm-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "dsm-dialog-title", onMouseDown: event => event.stopPropagation() },
				h("h3", { id: "dsm-dialog-title", className: "dsm-dialog-title" }, title),
				h("p", { className: "dsm-dialog-body" }, body),
				failure.length === 0 ? null : h("div", { className: "dsm-error", role: "alert" }, failure),
				h("div", { className: "dsm-dialog-actions" },
					h("button", { className: "dsm-action", type: "button", disabled: busy, onClick: onCancel }, "取消"),
					h("button", { className: `dsm-action ${permanent ? "dsm-danger" : "dsm-primary"}`, type: "button", disabled: busy, onClick: onConfirm }, busy ? "处理中…" : confirmLabel),
				),
			));
		}

		function SelectionBox({ checked, disabled, label, indeterminate = false, id, onChange }) {
			return h("span", { className: "dsm-check-cell" }, h("input", {
				className: "dsm-check",
				type: "checkbox",
				checked,
				disabled,
				id,
				"aria-label": label,
				ref: node => { if (node) node.indeterminate = indeterminate; },
				onChange: event => onChange(event.target.checked),
			}));
		}

		function SessionRow({ item, selected, onToggle, onTrash, onDelete }) {
			const tags = [];
			if (item.archived) tags.push(h("span", { className: "dsm-tag dsm-muted", key: "archived" }, "已归档"));
			if (item.blank) tags.push(h("span", { className: "dsm-tag dsm-muted", key: "blank" }, "空会话"));
			if (Array.isArray(item.workspaceIds) && item.workspaceIds.length === 0) tags.push(h("span", { className: "dsm-tag dsm-muted", key: "unassigned" }, "未加入工作区"));
			if (item.running) tags.push(h("span", { className: "dsm-tag dsm-live", key: "status" }, "运行中"));
			else tags.push(h("span", { className: "dsm-tag dsm-muted", key: "status" }, "空闲"));
			return h("div", { className: onToggle === undefined ? "dsm-row" : "dsm-row dsm-row-selectable" },
				onToggle === undefined ? null : h(SelectionBox, {
					checked: selected, disabled: item.running, label: `选择“${item.title}”`,
					onChange: checked => onToggle(item.id, checked),
				}),
				h("div", { className: "dsm-main" },
					h("div", { className: "dsm-title-line" },
						h("div", { className: "dsm-row-title", title: item.title }, item.title),
						h("div", { className: "dsm-state-list" }, ...tags),
					),
					h("div", { className: "dsm-meta" },
						h("span", { className: "dsm-path", title: item.cwd }, item.cwd),
						h("span", null, formatTime(item.createdAt)),
						h("span", null, formatBytes(item.size)),
					),
				),
				h("div", { className: "dsm-actions dsm-session-actions" },
					h("button", { className: "dsm-icon-button dsm-row-action", type: "button", title: "移到回收站", "aria-label": `将“${item.title}”移到回收站`, disabled: item.running, onClick: () => onTrash(item) }, h(IconCloseOutline16, { size: 16 })),
					h("button", { className: "dsm-icon-button dsm-row-action dsm-danger", type: "button", title: "永久删除", "aria-label": `永久删除“${item.title}”`, disabled: item.running, onClick: () => onDelete(item) }, h(IconTrashOutline16, { size: 16 })),
				),
			);
		}

		function MenuActionController({ refreshRuntime }) {
			const [action, setAction] = React.useState(null);
			const [busy, setBusy] = React.useState(false);
			const [failure, setFailure] = React.useState("");

			React.useEffect(() => {
				const confirm = event => {
					setFailure("");
					setAction(event.detail);
				};
				const report = event => {
					setAction({ kind: "trash", item: { id: "", title: "会话" } });
					setFailure(event.detail);
				};
				window.addEventListener("dsm:confirm-action", confirm);
				window.addEventListener("dsm:action-error", report);
				return () => {
					window.removeEventListener("dsm:confirm-action", confirm);
					window.removeEventListener("dsm:action-error", report);
				};
			}, []);

			const confirm = async () => {
				if (action === null || action.item.id.length === 0) return;
				setBusy(true);
				setFailure("");
				try {
					await api(action.kind, { sessionId: action.item.id });
					signalChanged();
					setAction(null);
					setBusy(false);
					void refreshRuntime();
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
					setBusy(false);
				}
			};

			return h(ConfirmDialog, {
				action,
				busy,
				failure,
				onCancel: () => { if (!busy) setAction(null); },
				onConfirm: () => void confirm(),
			});
		}

		function sessionIdFromRow(row) {
			if (typeof DataTransfer !== "function" || typeof DragEvent !== "function") return "";
			const transfer = new DataTransfer();
			row.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: transfer }));
			row.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: transfer }));
			return transfer.getData("text/plain");
		}

		function installSessionMenuActions(useNative = () => false) {
			let activeRow = null;
			let activeTrigger = null;
			let scheduled = false;

			const addDeleteItems = () => {
				scheduled = false;
				if (useNative()) return;
				if (activeRow === null || activeTrigger === null) return;
				const menus = [...document.querySelectorAll('[role="menu"]')].reverse();
				for (const menu of menus) {
					if (menu.querySelector('[data-dsm-session-action]') !== null) return;
					const archive = [...menu.querySelectorAll('[role="menuitem"]')].find(button => /^(归档会话|Archive session)$/iu.test(button.textContent.trim()));
					if (archive === undefined) continue;
					const createItem = (kind, text, danger) => {
						const wrapper = archive.parentElement.cloneNode(true);
						const button = wrapper.querySelector('[role="menuitem"]');
						const label = button?.querySelector("span:last-child");
						if (button === null || label === null) return null;
						button.dataset.dsmSessionAction = kind;
						if (danger) button.classList.add("dsm-menu-delete");
						label.textContent = text;
						const sourceIcon = document.querySelector(kind === "trash" ? ".dsm-move-icon-source svg" : ".dsm-trash-icon-source");
						const targetIcon = button.querySelector("svg");
						if (sourceIcon !== null && targetIcon !== null) targetIcon.replaceWith(sourceIcon.cloneNode(true));
						button.addEventListener("click", event => {
							event.preventDefault();
							event.stopPropagation();
							const id = sessionIdFromRow(activeRow);
							const title = activeRow.querySelector('[class*="_title"]')?.textContent?.trim() || id;
							activeTrigger.click();
							window.setTimeout(() => {
								if (id.length === 0) {
									window.dispatchEvent(new CustomEvent("dsm:action-error", { detail: "无法识别该会话，请刷新页面后重试" }));
									return;
								}
								window.dispatchEvent(new CustomEvent("dsm:confirm-action", { detail: { kind, item: { id, title } } }));
							}, 0);
						});
						return wrapper;
					};
					const trash = createItem("trash", "移到回收站", false);
					const permanent = createItem("delete", "永久删除会话", true);
					if (trash === null || permanent === null) return;
					archive.parentElement.after(trash);
					trash.after(permanent);
					return;
				}
			};

			const schedule = (force = false) => {
				if (activeRow === null) return;
				if (!force && document.querySelector('[role="menu"]') === null) return;
				if (scheduled) return;
				scheduled = true;
				window.setTimeout(addDeleteItems, 0);
			};
			const onClick = event => {
				const trigger = event.target instanceof Element ? event.target.closest("button") : null;
				const row = trigger?.closest('[role="treeitem"]');
				if (trigger === null || row === null || row.getAttribute("draggable") !== "true") return;
				const aria = trigger.getAttribute("aria-label") || "";
				if (!aria.includes("操作") && !aria.startsWith("Session actions for ")) return;
				activeRow = row;
				activeTrigger = trigger;
				schedule(true);
			};
			document.addEventListener("click", onClick, true);
			const observer = new MutationObserver(() => schedule());
			observer.observe(document.body, { childList: true, subtree: true });
			return () => {
				document.removeEventListener("click", onClick, true);
				observer.disconnect();
			};
		}

		function TrashRow({ item, selected, busy, onToggle, onRestore, onPurge }) {
			return h("div", { className: onToggle === undefined ? "dsm-row" : "dsm-row dsm-row-selectable" },
				onToggle === undefined ? null : h(SelectionBox, {
					checked: selected, disabled: busy, label: `选择“${item.title}”`,
					onChange: checked => onToggle(item.trashId, checked),
				}),
				h("div", { className: "dsm-main" },
					h("div", { className: "dsm-title-line" },
						h("div", { className: "dsm-row-title", title: item.title }, item.title),
					),
					h("div", { className: "dsm-meta" },
						h("span", { className: "dsm-path", title: item.cwd }, item.cwd),
						h("span", null, formatTime(item.trashedAt)),
						h("span", null, formatBytes(item.size)),
					),
				),
				h("div", { className: "dsm-actions dsm-session-actions" },
					h("button", { className: "dsm-icon-button dsm-row-action", type: "button", title: "恢复", "aria-label": `恢复“${item.title}”`, disabled: busy, onClick: () => onRestore(item) }, h("span", { className: "dsm-undo-icon", "aria-hidden": "true" }, "↶")),
					h("button", { className: "dsm-icon-button dsm-row-action dsm-danger", type: "button", title: "永久删除", "aria-label": `从回收站永久删除“${item.title}”`, disabled: busy, onClick: () => onPurge(item) }, h(IconTrashOutline16, { size: 16 })),
				),
			);
		}

		function TrashSidebarAction({ wide, refreshRuntime }) {
			const [open, setOpen] = React.useState(false);
			const [data, setData] = React.useState(null);
			const [loading, setLoading] = React.useState(true);
			const [busy, setBusy] = React.useState(false);
			const [failure, setFailure] = React.useState("");
			const [confirm, setConfirm] = React.useState(null);

			const load = React.useCallback(async () => {
				setLoading(true);
				try {
					setData(await api("sessions"));
					setFailure("");
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				} finally { setLoading(false); }
			}, []);

			React.useEffect(() => {
				const changed = () => { void load(); };
				window.addEventListener("dsm:changed", changed);
				void load();
				return () => window.removeEventListener("dsm:changed", changed);
			}, [load]);

			const mutate = async (route, body, refreshClient) => {
				setBusy(true);
				setFailure("");
				try {
					await api(route, body);
					setConfirm(null);
					signalChanged();
					if (refreshClient) await refreshRuntime();
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				} finally { setBusy(false); }
			};

			if (data?.showSidebarTrash === false) return null;
			const trash = data?.trash || [];
			const totalSize = trash.reduce((sum, item) => sum + item.size, 0);
			return h(React.Fragment, null,
				h("button", {
					className: `dsm-sidebar-trigger ${wide ? "" : "dsm-sidebar-trigger-rail"}`,
					type: "button",
					title: wide ? undefined : "回收站",
					"aria-label": "打开回收站",
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					onClick: () => { setOpen(true); void load(); },
				},
					h(IconTrashOutline16, { className: "dsm-trash-icon-source", size: wide ? 16 : 18 }),
					h("span", { className: "dsm-icon-source dsm-move-icon-source", "aria-hidden": "true" }, h(IconCloseOutline16, { size: 16 })),
					wide ? h("span", { className: "dsm-sidebar-label" }, "回收站") : null,
					wide && trash.length > 0 ? h("span", { className: "dsm-sidebar-count" }, trash.length) : null,
				),
				open ? h("div", { className: "dsm-overlay", role: "presentation" },
					h("div", { className: "dsm-overlay-mask", onMouseDown: () => { if (!busy) setOpen(false); } }),
					h("section", { className: "dsm-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "dsm-trash-title" },
					h("header", { className: "dsm-panel-header" },
						h("div", { className: "dsm-panel-heading" },
							h("h2", { id: "dsm-trash-title", className: "dsm-panel-title" }, "回收站"),
							h("div", { className: "dsm-panel-summary" }, `${trash.length} 个会话 · ${formatBytes(totalSize)}`),
						),
						trash.length === 0 ? null : h("button", {
							className: "dsm-action dsm-danger", type: "button", disabled: busy,
							onClick: () => setConfirm({ kind: "empty", item: { count: trash.length, size: totalSize } }),
						}, "清空回收站"),
						h("button", { className: "dsm-icon-button", type: "button", title: "关闭", "aria-label": "关闭回收站", disabled: busy, onClick: () => setOpen(false) }, h(IconCloseOutline16, { size: 16 })),
					),
					h("div", { className: "dsm-panel-body" },
						failure.length === 0 ? null : h("div", { className: "dsm-error", role: "alert" }, failure),
						loading && data === null
							? h("div", { className: "dsm-status", role: "status" }, "加载中…")
							: trash.length === 0
								? h("div", { className: "dsm-empty" }, "回收站为空")
								: h("div", { className: "dsm-list" }, trash.map(item => h(TrashRow, {
									key: item.trashId, item, busy,
									onRestore: value => void mutate("restore", { trashId: value.trashId }, true),
									onPurge: value => setConfirm({ kind: "purge", item: value }),
								}))),
					),
				), h(ConfirmDialog, {
					action: confirm,
					busy,
					onCancel: () => setConfirm(null),
					onConfirm: () => confirm === null ? undefined : void mutate(
						confirm.kind,
						confirm.kind === "empty" ? {} : { trashId: confirm.item.trashId },
						false,
					),
				})) : null,
			);
		}


		function RefreshIcon() {
			if (IconRefresh !== undefined) return h(IconRefresh, { size: 16 });
			return h("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
				h("path", { d: "M13.2 8a5.2 5.2 0 1 1-1.52-3.64", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
				h("path", { d: "M13.5 2.8v2.6h-2.6", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }),
			);
		}

		function SessionManagerSection({ refreshRuntime }) {
			const [view, setView] = React.useState("sessions");
			const [data, setData] = React.useState(null);
			const [loading, setLoading] = React.useState(true);
			const [busy, setBusy] = React.useState(false);
			const [failure, setFailure] = React.useState("");
			const [confirm, setConfirm] = React.useState(null);
			const [query, setQuery] = React.useState("");
			const [state, setState] = React.useState("all");
			const [sort, setSort] = React.useState("newest");
			const [selected, setSelected] = React.useState(() => new Set());

			const load = React.useCallback(async () => {
				setLoading(true);
				setFailure("");
				try { setData(await api("sessions")); }
				catch (error) { setFailure(error instanceof Error ? error.message : String(error)); }
				finally { setLoading(false); }
			}, []);

			React.useEffect(() => {
				const changed = () => { void load(); };
				window.addEventListener("dsm:changed", changed);
				void load();
				return () => window.removeEventListener("dsm:changed", changed);
			}, [load]);

			const mutate = async (route, body, refreshClient) => {
				setBusy(true);
				setFailure("");
				try {
					const value = route === "batch" ? await runBatch(body.op, body.ids) : await api(route, body);
					if (route === "batch") {
						const failed = Array.isArray(value?.failed) ? value.failed : [];
						setSelected(new Set(failed.map(row => row.id)));
						if (failed.length > 0) {
							setFailure(`${value.succeeded} 个已处理，${failed.length} 个失败：${failed[0].error}`);
							signalChanged();
							if (value.succeeded > 0 && refreshClient) await refreshRuntime();
							return;
						}
					}
					setConfirm(null);
					signalChanged();
					if (refreshClient) await refreshRuntime();
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				} finally { setBusy(false); }
			};
			const toggleSelected = (key, checked) => {
				setSelected(current => {
					const next = new Set(current);
					if (checked) next.add(key);
					else next.delete(key);
					return next;
				});
			};
			const changeView = next => {
				setView(next);
				setSelected(new Set());
			};

			const allRows = view === "sessions" ? (data?.sessions || []) : (data?.trash || []);
			const rows = filteredRows(allRows, view, query, state, sort);
			const trashSize = (data?.trash || []).reduce((sum, item) => sum + item.size, 0);
			const selectable = rows.filter(item => view !== "sessions" || item.running !== true);
			const selectedRows = selectable.filter(item => selected.has(view === "sessions" ? item.id : item.trashId));
			const selectedSize = selectedRows.reduce((sum, item) => sum + item.size, 0);
			return h("section", { className: "dsm-root" },
				h("div", { className: "dsm-header" },
					h("div", { className: "dsm-heading" },
						h("h2", { className: "dsm-title" }, "会话管理"),
						h("p", { className: "dsm-intro" }, "查看本地会话、占用和运行状态。"),
					),
					h("div", { className: "dsm-header-tools" },
						view === "trash" && rows.length > 0 ? h("button", {
							className: "dsm-action dsm-danger", type: "button", disabled: loading || busy,
							onClick: () => setConfirm({ kind: "empty", item: { count: rows.length, size: trashSize } }),
						}, "清空回收站") : null,
					),
				),
			failure.length === 0 ? null : h("div", { className: "dsm-error", role: "alert" }, failure),
			h("div", { className: "dsm-tabs", role: "tablist", "aria-label": "会话视图" },
				h("button", { className: `dsm-tab ${view === "sessions" ? "dsm-tab-active" : ""}`, type: "button", role: "tab", "aria-selected": view === "sessions", onClick: () => changeView("sessions") }, `会话 ${data?.sessions?.length ?? 0}`),
				h("button", { className: `dsm-tab ${view === "trash" ? "dsm-tab-active" : ""}`, type: "button", role: "tab", "aria-selected": view === "trash", onClick: () => changeView("trash") }, `回收站 ${data?.trash?.length ?? 0}`),
			),
			h("div", { className: "dsm-controls" },
				h("label", { className: "dsm-search" },
					IconSearch === undefined ? null : h(IconSearch, { size: 16 }),
					h("input", {
						className: "dsm-input", type: "search", value: query,
						placeholder: "搜索标题、路径或会话 ID", "aria-label": "搜索会话",
						onChange: event => setQuery(event.target.value),
					}),
				),
				view === "sessions" ? h("select", {
					className: "dsm-select", value: state, "aria-label": "筛选会话状态",
					onChange: event => setState(event.target.value),
				},
					h("option", { value: "all" }, "全部状态"),
					h("option", { value: "idle" }, "空闲"),
					h("option", { value: "running" }, "运行中"),
					h("option", { value: "archived" }, "已归档"),
					h("option", { value: "blank" }, "空会话"),
					h("option", { value: "unassigned" }, "未加入工作区"),
				) : null,
				h("select", {
					className: "dsm-select dsm-sort", value: sort, "aria-label": "会话排序",
					onChange: event => setSort(event.target.value),
				},
					h("option", { value: "newest" }, "最新优先"),
					h("option", { value: "oldest" }, "最早优先"),
					h("option", { value: "largest" }, "最大优先"),
					h("option", { value: "title" }, "按标题"),
				),
				h("button", { className: "dsm-icon-button", type: "button", title: "刷新", "aria-label": "刷新会话列表", disabled: loading || busy, onClick: () => void load() }, h(RefreshIcon)),
			),
			h("div", { className: "dsm-inventory" },
				rows.length === 0 ? null : h("div", { className: "dsm-list-head" },
					h(SelectionBox, {
						id: "dsm-select-visible",
						checked: selectable.length > 0 && selectedRows.length === selectable.length,
						disabled: busy || selectable.length === 0,
						indeterminate: selectedRows.length > 0 && selectedRows.length < selectable.length,
						label: "选择全部可见会话",
						onChange: checked => setSelected(current => {
							const next = new Set(current);
							for (const item of selectable) {
								const key = view === "sessions" ? item.id : item.trashId;
								if (checked) next.add(key);
								else next.delete(key);
							}
							return next;
						}),
					}),
					h("div", { className: "dsm-list-head-text" },
						h("label", { className: "dsm-batch-all", htmlFor: "dsm-select-visible" }, selectedRows.length > 0 ? `已选 ${selectedRows.length}` : "全选"),
						selectedRows.length === 0 ? null : h("button", {
							className: "dsm-invert", type: "button", disabled: busy,
							onClick: () => setSelected(current => {
								const next = new Set(current);
								for (const item of selectable) {
									const key = view === "sessions" ? item.id : item.trashId;
									if (next.has(key)) next.delete(key);
									else next.add(key);
								}
								return next;
							}),
						}, "反选"),
						allRows.length === rows.length ? null : h("span", { className: "dsm-result-count" }, `${rows.length} / ${allRows.length}`),
					),
				selectedRows.length === 0 ? null : h("div", { className: "dsm-batch-actions" },
					view === "sessions" ? h("button", {
						className: "dsm-icon-button", type: "button", title: "移到回收站",
						"aria-label": `将选中的 ${selectedRows.length} 个会话移到回收站`, disabled: busy,
						onClick: () => setConfirm({ kind: "batch-trash", item: { ids: selectedRows.map(item => item.id), count: selectedRows.length, size: selectedSize } }),
					}, h(IconCloseOutline16, { size: 16 })) : h("button", {
						className: "dsm-icon-button", type: "button", title: "恢复",
						"aria-label": `恢复选中的 ${selectedRows.length} 个会话`, disabled: busy,
						onClick: () => setConfirm({ kind: "batch-restore", item: { ids: selectedRows.map(item => item.trashId), count: selectedRows.length, size: selectedSize } }),
					}, h("span", { className: "dsm-undo-icon", "aria-hidden": "true" }, "↶")),
					h("button", {
						className: "dsm-icon-button dsm-danger", type: "button", title: "永久删除",
						"aria-label": `永久删除选中的 ${selectedRows.length} 个会话`, disabled: busy,
						onClick: () => setConfirm({
							kind: view === "sessions" ? "batch-delete" : "batch-purge",
							item: {
								ids: selectedRows.map(item => view === "sessions" ? item.id : item.trashId),
								count: selectedRows.length,
								size: selectedSize,
							},
						}),
					}, h(IconTrashOutline16, { size: 16 })),
				),
				),
			loading && data === null
				? h("div", { className: "dsm-status", role: "status" }, "加载中…")
				: rows.length === 0
					? h("div", { className: "dsm-empty" }, view === "sessions" ? "暂无可管理会话" : "回收站为空")
					: h("div", { className: "dsm-list" }, rows.map(item => view === "sessions"
						? h(SessionRow, {
							key: item.id, item, selected: selected.has(item.id), onToggle: toggleSelected,
							onTrash: value => setConfirm({ kind: "trash", item: value }),
							onDelete: value => setConfirm({ kind: "delete", item: value }),
						})
						: h(TrashRow, {
							key: item.trashId, item, busy, selected: selected.has(item.trashId), onToggle: toggleSelected,
							onRestore: value => void mutate("restore", { trashId: value.trashId }, true),
							onPurge: value => setConfirm({ kind: "purge", item: value }),
						}))),
			),
				h(ConfirmDialog, {
					action: confirm,
					busy,
					failure,
					onCancel: () => { if (!busy) { setConfirm(null); setFailure(""); } },
					onConfirm: () => confirm === null ? undefined : void mutate(
						confirm.kind.startsWith("batch-") ? "batch" : confirm.kind,
						confirm.kind === "empty"
							? {}
							: confirm.kind.startsWith("batch-")
								? { op: confirm.kind.slice("batch-".length), ids: confirm.item.ids }
								: confirm.kind === "trash" || confirm.kind === "delete"
									? { sessionId: confirm.item.id }
									: { trashId: confirm.item.trashId },
						confirm.kind === "trash" || confirm.kind === "delete" || confirm.kind === "batch-trash" || confirm.kind === "batch-delete" || confirm.kind === "batch-restore",
					),
				}),
			);
		}

		function SessionManagerPluginCard({ ctx }) {
				const api = settingsApi(ctx);
			const [open, setOpen] = React.useState(false);
			const [value, setValue] = React.useState({ showSidebarTrash: true, autoRecoverInterruptedGoals: true });
			const [saved, setSaved] = React.useState({ showSidebarTrash: true, autoRecoverInterruptedGoals: true });
			const [revision, setRevision] = React.useState(0);
			const [writable, setWritable] = React.useState(false);
			const [busy, setBusy] = React.useState(false);
			const [failure, setFailure] = React.useState("");

			const load = React.useCallback(async () => {
				try {
					const response = await api.settings.describe({});
					if (!response.result.ok) throw new Error(response.result.error.message);
					const row = response.result.value.namespaces.find(item => item.ns === SETTINGS_NAMESPACE);
					if (row === undefined) return;
					const next = {
						showSidebarTrash: row.value?.showSidebarTrash !== false,
						autoRecoverInterruptedGoals: row.value?.autoRecoverInterruptedGoals !== false,
					};
					setValue(next);
					setSaved(next);
					setRevision(row.revision);
					setWritable(response.result.value.writable === true);
					setFailure("");
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				}
			}, [api]);

			React.useEffect(() => {
				void load();
			}, [load]);

			const save = async () => {
				setBusy(true);
				setFailure("");
				try {
					const response = await api.settings.mutate({
						ns: SETTINGS_NAMESPACE,
						ops: [
							{ op: "set", path: ["showSidebarTrash"], value: value.showSidebarTrash },
							{ op: "set", path: ["autoRecoverInterruptedGoals"], value: value.autoRecoverInterruptedGoals },
						],
						expectedRevision: revision,
					});
					if (!response.result.ok) throw new Error(response.result.error.message);
					setRevision(response.result.value.revision);
					setSaved({
						showSidebarTrash: response.result.value.value.showSidebarTrash !== false,
						autoRecoverInterruptedGoals: response.result.value.value.autoRecoverInterruptedGoals !== false,
					});
					signalChanged();
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			};
			const dirty = value.showSidebarTrash !== saved.showSidebarTrash
				|| value.autoRecoverInterruptedGoals !== saved.autoRecoverInterruptedGoals;

			return h("li", { className: `dsm-plugin-card ${open ? "dsm-plugin-card-open" : ""}` },
				h("button", {
					className: "dsm-plugin-head", type: "button", "aria-expanded": open,
					"aria-label": `${open ? "收起" : "展开"}: 会话管理`, onClick: () => setOpen(!open),
				},
					h("span", { className: "dsm-plugin-head-text" },
						h("span", { className: "dsm-plugin-name" }, "会话管理"),
						h("span", { className: "dsm-plugin-description" }, "会话回收站与侧边栏入口"),
					),
					dirty ? h("span", { className: "dsm-plugin-pending" }, "未保存") : null,
					h(IconChevronDownOutline14, { className: `dsm-plugin-chevron ${open ? "dsm-plugin-chevron-open" : ""}` }),
				),
				open ? h("div", { className: "dsm-plugin-body" },
					!writable ? h("p", { className: "dsm-plugin-readonly", role: "status" }, "当前配置为只读") : null,
					h("div", { className: "dsm-plugin-field" },
						h("label", { className: "dsm-plugin-toggle" },
							h("input", {
								type: "checkbox", checked: value.showSidebarTrash, disabled: busy || !writable,
								onChange: event => setValue(current => ({ ...current, showSidebarTrash: event.target.checked })),
							}),
							h("span", null, "工作区下方显示回收站"),
						),
						h("p", { className: "dsm-plugin-hint" }, "关闭后仅隐藏侧边栏入口，回收站内容保持不变。"),
					),
					h("div", { className: "dsm-plugin-field" },
						h("label", { className: "dsm-plugin-toggle" },
							h("input", {
								type: "checkbox", checked: value.autoRecoverInterruptedGoals, disabled: busy || !writable,
								onChange: event => setValue(current => ({ ...current, autoRecoverInterruptedGoals: event.target.checked })),
							}),
							h("span", null, "自动恢复意外中断的任务"),
						),
						h("p", { className: "dsm-plugin-hint" }, "启动后检查冷会话；运行中的会话不会被接管。"),
					),
					h("div", { className: "dsm-plugin-footer" },
						failure.length === 0 ? null : h("p", { className: "dsm-plugin-failed", role: "status" }, failure),
						h("button", {
							className: "dsm-plugin-discard", type: "button", disabled: busy || !dirty,
							onClick: () => setValue(saved),
						}, "放弃"),
						h("button", {
							className: "dsm-plugin-save", type: "button", disabled: busy || !writable || !dirty,
							onClick: () => void save(),
						}, busy ? "保存中…" : "保存"),
					),
				) : null,
			);
		}

		const settingsApis = new WeakMap();
		function settingsApi(ctx) {
			const legacy = ctx.get("connection")?.api;
			if (legacy !== undefined) return legacy;
			if (settingsApis.has(ctx)) return settingsApis.get(ctx);
			const settings = ctx.get("remote")?.settings;
			const api = { settings: {
				describe: async () => ({ result: await settings.describe() }),
				mutate: async ({ ns, ops, expectedRevision }) => ({ result: await settings.mutate(ns, ops, expectedRevision) }),
			} };
			settingsApis.set(ctx, api);
			return api;
		}


		function NavIconSource() {
			const icon = IconNav !== undefined
				? h(IconNav, { size: 16 })
				: h("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", "aria-hidden": "true" },
					h("path", { d: "M6 3.5h7.5M6 8h7.5M6 12.5h7.5" }),
					h("path", { d: "M2.6 3.5h.01M2.6 8h.01M2.6 12.5h.01" }),
				);
			return h("span", { className: "dsm-icon-source dsm-nav-icon-source", "aria-hidden": "true" }, icon);
		}

		function installNavIcon() {
			const applyIcon = () => {
				if (document.querySelector("nav") === null) return;
				const source = document.querySelector(".dsm-nav-icon-source svg");
				if (source === null) return;
				for (const button of document.querySelectorAll("nav button")) {
					const label = [...button.children].find(node => node.localName === "span" && node.textContent.trim() === "会话管理");
					if (label === undefined) continue;
					const icon = [...button.children].find(node => node.localName === "svg") ?? button.querySelector("svg");
					if (icon === null || icon.dataset.dsmNav === "1") continue;
					const next = source.cloneNode(true);
					next.dataset.dsmNav = "1";
					const navClass = icon.getAttribute("class");
					if (navClass) next.setAttribute("class", navClass);
					next.setAttribute("width", "16");
					next.setAttribute("height", "16");
					icon.replaceWith(next);
				}
			};
			const observer = new MutationObserver(applyIcon);
			observer.observe(document.body, { childList: true, subtree: true });
			applyIcon();
			return () => observer.disconnect();
		}

		const inject = ["slots", "sessions", "workspaces", "connection"];
		function apply(ctx) {
			let nativeMenu = false;
			const refreshRuntime = async () => {
				// New Workspace controllers follow Host snapshots instead of exposing refresh().
				await Promise.all([ctx.sessions.refresh(),
					typeof ctx.workspaces.refresh === "function" ? ctx.workspaces.refresh() : undefined]);
			};
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "session-manager",
				order: 30,
				label: () => "会话管理",
			}, props => h(SessionManagerSection, { ...props, refreshRuntime })));
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "session-trash",
				order: 20,
			}, props => h(TrashSidebarAction, { ...props, refreshRuntime })));
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: SETTINGS_NAMESPACE,
			}, () => h(SessionManagerPluginCard, { ctx })));
			ctx.inject(["remote", "remote.settings"], modern => modern.slots.inject("settings.plugins.tab", () => modern.slots.register({
				name: "settings.plugins.tab",
				id: SETTINGS_NAMESPACE,
				order: 30,
				label: () => "会话管理",
			}, () => h(SessionManagerPluginCard, { ctx: modern }))));
			ctx.slots.inject("sidebar.workspaces.session.menu.item", () => {
				if (MenuItemButton === undefined) return;
				nativeMenu = true;
				const disposers = ["trash", "delete"].map((kind, index) => ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item", id: `session-manager-${kind}`, order: 500 + index,
				}, function SessionMenuAction({ sessionId, useMenuOpenState }) {
					const [, setMenuOpen] = useMenuOpenState();
					return h(MenuItemButton, {
						icon: h(kind === "trash" ? IconCloseOutline16 : IconTrashOutline16, { size: 16 }),
						danger: kind === "delete",
						onSelect: async () => {
							setMenuOpen(false);
							try {
								const value = await api("sessions");
								const item = value.sessions.find(item => item.id === sessionId);
								if (item === undefined) throw new Error("会话不存在");
								window.dispatchEvent(new CustomEvent("dsm:confirm-action", { detail: { kind, item } }));
							} catch (error) {
								window.dispatchEvent(new CustomEvent("dsm:action-error", { detail: error.message }));
							}
						},
					}, kind === "trash" ? "移到回收站" : "永久删除会话");
				}));
				return () => { nativeMenu = false; for (const dispose of disposers) dispose(); };
			});
			ctx.effect(() => {
				const container = document.createElement("div");
				container.dataset.dshSessionManagerOverlay = "";
				document.body.appendChild(container);
				const root = ReactDOMClient.createRoot(container);
				root.render(h(React.Fragment, null, h(NavIconSource), h(MenuActionController, { refreshRuntime })));
				const disposeNav = installNavIcon();
				const disposeMenu = installSessionMenuActions(() => nativeMenu);
				return () => {
					disposeNav();
					disposeMenu();
					root.unmount();
					container.remove();
				};
			}, "session-manager menu action");
		}

		exports.apply = apply;
		exports.settingsApi = settingsApi;
		exports.inject = inject;
		return module.exports;
	}
});
