window.__ModuleLoader__.load({
	id: "@local/dsh-session-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const ReactDOMClient = require("react-dom/client");
		const { IconCloseOutline16, IconTrashOutline16 } = require("@deepseek-ai/dsh-client-ui-primitives");
		const h = React.createElement;
		const API_ROOT = "/plugins/@local/dsh-session-manager/api";

		const css = `
.dsm-root{box-sizing:border-box;width:100%;max-width:900px;margin:0 auto;padding:24px 28px 32px;color:var(--dsw-alias-label-primary)}
.dsm-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
.dsm-header-tools{display:flex;align-items:center;gap:8px}
.dsm-title{margin:0;font-size:20px;line-height:28px;font-weight:600;letter-spacing:0}
.dsm-refresh,.dsm-action,.dsm-tab{box-sizing:border-box;font:inherit;letter-spacing:0;cursor:pointer}
.dsm-refresh{width:32px;height:32px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-secondary);background:transparent;font-size:18px;line-height:30px}
.dsm-refresh:hover,.dsm-action:hover,.dsm-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsm-refresh:disabled,.dsm-action:disabled{cursor:default;opacity:.5}
.dsm-tabs{display:inline-grid;grid-template-columns:1fr 1fr;min-width:220px;padding:3px;margin-bottom:18px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-fill-secondary)}
.dsm-tab{height:30px;padding:0 14px;border:0;border-radius:5px;color:var(--dsw-alias-label-secondary);background:transparent;font-size:13px}
.dsm-tab-active{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-fill-primary);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dsm-list{display:grid;gap:8px}
.dsm-row{box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;min-height:72px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-fill-primary)}
.dsm-main{min-width:0}
.dsm-row-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px;font-weight:550}
.dsm-meta{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:5px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dsm-path{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-actions{display:flex;align-items:center;gap:8px}
.dsm-action{height:32px;padding:0 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-secondary);background:transparent;font-size:12px;white-space:nowrap}
.dsm-danger{color:var(--dsw-alias-state-error-primary)}
.dsm-live{display:inline-flex;align-items:center;height:22px;padding:0 7px;border-radius:5px;color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-secondary);font-size:11px;white-space:nowrap}
.dsm-empty,.dsm-status{padding:24px 4px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.dsm-error{margin-bottom:14px;padding:10px 12px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:6px;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.dsm-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.42)}
.dsm-dialog{box-sizing:border-box;width:min(440px,100%);padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu);box-shadow:0 18px 48px rgba(0,0,0,.24)}
.dsm-dialog-title{margin:0;font-size:16px;line-height:24px;font-weight:600;letter-spacing:0}
.dsm-dialog-body{margin:10px 0 18px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;overflow-wrap:anywhere}
.dsm-dialog-actions{display:flex;justify-content:flex-end;gap:8px}
.dsm-primary{color:white;border-color:transparent;background:var(--dsw-alias-state-business-primary)}
.dsm-menu-delete{color:var(--dsw-alias-state-error-primary)!important}
.dsm-sidebar-trigger{box-sizing:border-box;flex:none;display:flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:4px -2px;padding:0 10px 0 8px;border:0;border-radius:12px;color:var(--dsw-alias-label-primary);background:transparent;cursor:pointer;font:inherit;font-size:14px;line-height:22px;letter-spacing:0;overflow:hidden}
.dsm-sidebar-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsm-sidebar-trigger-rail{width:36px;height:36px;margin:8px 0 2px;padding:0;justify-content:center;gap:0;border-radius:50%}
.dsm-sidebar-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-sidebar-count{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;margin-left:auto;padding:0 5px;border-radius:9px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-fill-secondary);font-size:11px;line-height:18px}
.dsm-panel{position:relative;box-sizing:border-box;display:flex;flex-direction:column;width:min(760px,100%);height:min(680px,calc(100vh - 40px));border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu);box-shadow:0 18px 48px rgba(0,0,0,.24);overflow:hidden}
.dsm-panel-header{box-sizing:border-box;display:flex;align-items:center;gap:12px;min-height:58px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dsm-panel-heading{min-width:0;flex:1}
.dsm-panel-title{margin:0;font-size:16px;line-height:24px;font-weight:600;letter-spacing:0}
.dsm-panel-summary{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dsm-icon-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:0;border-radius:6px;color:var(--dsw-alias-label-secondary);background:transparent;cursor:pointer}
.dsm-icon-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsm-panel-body{min-height:0;flex:1;padding:14px 16px 18px;overflow-y:auto}
@media(max-width:640px){.dsm-root{min-width:0;padding:14px 6px 24px;overflow-x:hidden}.dsm-header{gap:6px;margin-bottom:12px}.dsm-title{font-size:16px;line-height:24px}.dsm-tabs{width:100%;min-width:0;margin-bottom:12px}.dsm-tab{min-width:0;padding:0 3px;font-size:11px}.dsm-row{min-width:0;grid-template-columns:minmax(0,1fr);gap:8px;padding:9px 8px}.dsm-row-title{font-size:13px}.dsm-meta{display:grid;grid-template-columns:1fr;gap:2px;margin-top:3px}.dsm-path{display:none}.dsm-actions{min-width:0;flex-direction:column;align-items:stretch}.dsm-action{width:100%;padding:0 4px}.dsm-live{justify-content:center}.dsm-dialog{padding:16px}}
`;
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
			const value = await response.json();
			if (!response.ok || value.ok !== true) throw new Error(value.error || `HTTP ${response.status}`);
			return value.value;
		}

		function signalChanged() {
			window.dispatchEvent(new Event("dsm:changed"));
		}

		function ConfirmDialog({ action, busy, failure = "", onCancel, onConfirm }) {
			if (action === null) return null;
			const permanent = action.kind === "delete" || action.kind === "purge" || action.kind === "empty";
			const title = action.kind === "empty"
				? "清空回收站"
				: permanent ? "永久删除会话" : "移到回收站";
			const body = action.kind === "empty"
				? `将永久删除回收站中的 ${action.item.count} 个会话，共 ${formatBytes(action.item.size)}。此操作无法恢复。`
				: action.kind === "delete"
					? `“${action.item.title}”将被永久删除，不会进入回收站，无法恢复。`
					: action.kind === "purge"
						? `“${action.item.title}”将从回收站中永久删除，无法恢复。`
						: `“${action.item.title}”将从会话列表移除，并保留在回收站中。`;
			return h("div", { className: "dsm-overlay", role: "presentation", onMouseDown: (event) => {
				if (event.target === event.currentTarget && !busy) onCancel();
			} }, h("div", { className: "dsm-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "dsm-dialog-title" },
				h("h3", { id: "dsm-dialog-title", className: "dsm-dialog-title" }, title),
				h("p", { className: "dsm-dialog-body" }, body),
				failure.length === 0 ? null : h("div", { className: "dsm-error", role: "alert" }, failure),
				h("div", { className: "dsm-dialog-actions" },
					h("button", { className: "dsm-action", type: "button", disabled: busy, onClick: onCancel }, "取消"),
					h("button", { className: `dsm-action ${permanent ? "dsm-danger" : "dsm-primary"}`, type: "button", disabled: busy, onClick: onConfirm }, busy ? "处理中…" : (action.kind === "empty" ? "清空回收站" : permanent ? "永久删除" : "移到回收站")),
				),
			));
		}

		function SessionRow({ item, onTrash, onDelete }) {
			return h("div", { className: "dsm-row" },
				h("div", { className: "dsm-main" },
					h("div", { className: "dsm-row-title", title: item.title }, item.title),
					h("div", { className: "dsm-meta" },
						h("span", { className: "dsm-path", title: item.cwd }, item.cwd),
						h("span", null, formatTime(item.createdAt)),
						h("span", null, formatBytes(item.size)),
					),
				),
				h("div", { className: "dsm-actions" },
					item.running
						? h("span", { className: "dsm-live" }, "运行中")
						: item.attached ? h("span", { className: "dsm-live" }, "已打开") : null,
					h("button", { className: "dsm-action", type: "button", disabled: item.attached || item.running, onClick: () => onTrash(item) }, "移到回收站"),
					h("button", { className: "dsm-action dsm-danger", type: "button", disabled: item.attached || item.running, onClick: () => onDelete(item) }, "永久删除"),
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
					await refreshRuntime();
					setAction(null);
					setBusy(false);
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

		function installSessionMenuActions() {
			let activeRow = null;
			let activeTrigger = null;
			let scheduled = false;

			const addDeleteItems = () => {
				scheduled = false;
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
						if (kind === "delete") {
							const sourceIcon = document.querySelector(".dsm-sidebar-trigger svg");
							const targetIcon = button.querySelector("svg");
							if (sourceIcon !== null && targetIcon !== null) targetIcon.replaceWith(sourceIcon.cloneNode(true));
						}
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
					const permanent = createItem("delete", "永久删除会话…", true);
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

		function TrashRow({ item, busy, onRestore, onPurge }) {
			return h("div", { className: "dsm-row" },
				h("div", { className: "dsm-main" },
					h("div", { className: "dsm-row-title", title: item.title }, item.title),
					h("div", { className: "dsm-meta" },
						h("span", { className: "dsm-path", title: item.cwd }, item.cwd),
						h("span", null, formatTime(item.trashedAt)),
						h("span", null, formatBytes(item.size)),
					),
				),
				h("div", { className: "dsm-actions" },
					h("button", { className: "dsm-action", type: "button", disabled: busy, onClick: () => onRestore(item) }, "恢复"),
					h("button", { className: "dsm-action dsm-danger", type: "button", disabled: busy, onClick: () => onPurge(item) }, "永久删除"),
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
					h(IconTrashOutline16, { size: wide ? 16 : 18 }),
					wide ? h("span", { className: "dsm-sidebar-label" }, "回收站") : null,
					wide && trash.length > 0 ? h("span", { className: "dsm-sidebar-count" }, trash.length) : null,
				),
				open ? h("div", { className: "dsm-overlay", role: "presentation", onMouseDown: event => {
					if (event.target === event.currentTarget && !busy) setOpen(false);
				} }, h("section", { className: "dsm-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "dsm-trash-title" },
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

		function SessionManagerSection({ refreshRuntime }) {
			const [view, setView] = React.useState("sessions");
			const [data, setData] = React.useState(null);
			const [loading, setLoading] = React.useState(true);
			const [busy, setBusy] = React.useState(false);
			const [failure, setFailure] = React.useState("");
			const [confirm, setConfirm] = React.useState(null);

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
					await api(route, body);
					setConfirm(null);
					signalChanged();
					if (refreshClient) await refreshRuntime();
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				} finally { setBusy(false); }
			};

			const rows = view === "sessions" ? (data?.sessions || []) : (data?.trash || []);
			const trashSize = (data?.trash || []).reduce((sum, item) => sum + item.size, 0);
			return h("section", { className: "dsm-root" },
				h("div", { className: "dsm-header" },
					h("h2", { className: "dsm-title" }, "会话管理"),
					h("div", { className: "dsm-header-tools" },
						view === "trash" && rows.length > 0 ? h("button", {
							className: "dsm-action dsm-danger", type: "button", disabled: loading || busy,
							onClick: () => setConfirm({ kind: "empty", item: { count: rows.length, size: trashSize } }),
						}, "清空回收站") : null,
						h("button", { className: "dsm-refresh", type: "button", title: "刷新", "aria-label": "刷新会话列表", disabled: loading || busy, onClick: () => void load() }, "↻"),
					),
			),
			failure.length === 0 ? null : h("div", { className: "dsm-error", role: "alert" }, failure),
			h("div", { className: "dsm-tabs", role: "tablist", "aria-label": "会话视图" },
				h("button", { className: `dsm-tab ${view === "sessions" ? "dsm-tab-active" : ""}`, type: "button", role: "tab", "aria-selected": view === "sessions", onClick: () => setView("sessions") }, `会话 ${data?.sessions?.length ?? 0}`),
				h("button", { className: `dsm-tab ${view === "trash" ? "dsm-tab-active" : ""}`, type: "button", role: "tab", "aria-selected": view === "trash", onClick: () => setView("trash") }, `回收站 ${data?.trash?.length ?? 0}`),
			),
			loading && data === null
				? h("div", { className: "dsm-status", role: "status" }, "加载中…")
				: rows.length === 0
					? h("div", { className: "dsm-empty" }, view === "sessions" ? "暂无可管理会话" : "回收站为空")
					: h("div", { className: "dsm-list" }, rows.map(item => view === "sessions"
						? h(SessionRow, {
							key: item.id, item,
							onTrash: value => setConfirm({ kind: "trash", item: value }),
							onDelete: value => setConfirm({ kind: "delete", item: value }),
						})
						: h(TrashRow, { key: item.trashId, item, busy, onRestore: value => void mutate("restore", { trashId: value.trashId }, true), onPurge: value => setConfirm({ kind: "purge", item: value }) }))),
				h(ConfirmDialog, {
					action: confirm,
					busy,
					onCancel: () => setConfirm(null),
					onConfirm: () => confirm === null ? undefined : void mutate(
						confirm.kind,
						confirm.kind === "empty"
							? {}
							: confirm.kind === "trash" || confirm.kind === "delete"
								? { sessionId: confirm.item.id }
								: { trashId: confirm.item.trashId },
						confirm.kind === "trash" || confirm.kind === "delete",
					),
				}),
			);
		}

		const inject = ["slots", "sessions", "workspaces"];
		function apply(ctx) {
			const refreshRuntime = async () => {
				await Promise.all([ctx.sessions.refresh(), ctx.workspaces.refresh()]);
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
			ctx.effect(() => {
				const container = document.createElement("div");
				container.dataset.dshSessionManagerOverlay = "";
				document.body.appendChild(container);
				const root = ReactDOMClient.createRoot(container);
				root.render(h(MenuActionController, { refreshRuntime }));
				const disposeMenu = installSessionMenuActions();
				return () => {
					disposeMenu();
					root.unmount();
					container.remove();
				};
			}, "session-manager menu action");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
