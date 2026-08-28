window.__ModuleLoader__.load({
	id: "@local/dsh-session-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const h = React.createElement;
		const API_ROOT = "/plugins/@local/dsh-session-manager/api";

		const css = `
.dsm-root{box-sizing:border-box;width:100%;max-width:900px;margin:0 auto;padding:24px 28px 32px;color:var(--dsw-alias-label-primary)}
.dsm-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
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
.dsm-dialog{box-sizing:border-box;width:min(440px,100%);padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-dialog-fill,var(--dsw-alias-fill-primary));box-shadow:0 18px 48px rgba(0,0,0,.24)}
.dsm-dialog-title{margin:0;font-size:16px;line-height:24px;font-weight:600;letter-spacing:0}
.dsm-dialog-body{margin:10px 0 18px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;overflow-wrap:anywhere}
.dsm-dialog-actions{display:flex;justify-content:flex-end;gap:8px}
.dsm-primary{color:white;border-color:transparent;background:var(--dsw-alias-state-business-primary)}
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

		function ConfirmDialog({ action, busy, onCancel, onConfirm }) {
			if (action === null) return null;
			const purge = action.kind === "purge";
			return h("div", { className: "dsm-overlay", role: "presentation", onMouseDown: (event) => {
				if (event.target === event.currentTarget && !busy) onCancel();
			} }, h("div", { className: "dsm-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "dsm-dialog-title" },
				h("h3", { id: "dsm-dialog-title", className: "dsm-dialog-title" }, purge ? "永久删除会话" : "移到回收站"),
				h("p", { className: "dsm-dialog-body" }, purge
					? `“${action.item.title}”将被永久删除，无法恢复。`
					: `“${action.item.title}”将从会话列表移除，并保留在回收站中。`),
				h("div", { className: "dsm-dialog-actions" },
					h("button", { className: "dsm-action", type: "button", disabled: busy, onClick: onCancel }, "取消"),
					h("button", { className: `dsm-action ${purge ? "dsm-danger" : "dsm-primary"}`, type: "button", disabled: busy, onClick: onConfirm }, busy ? "处理中…" : (purge ? "永久删除" : "移到回收站")),
				),
			));
		}

		function SessionRow({ item, onTrash }) {
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
					item.live ? h("span", { className: "dsm-live" }, "运行中") : null,
					h("button", { className: "dsm-action dsm-danger", type: "button", disabled: item.live, onClick: () => onTrash(item) }, "移到回收站"),
				),
			);
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

		function SessionManagerSection() {
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

			React.useEffect(() => { void load(); }, [load]);

			const mutate = async (route, body, reloadPage) => {
				setBusy(true);
				setFailure("");
				try {
					await api(route, body);
					setConfirm(null);
					await load();
					if (reloadPage) window.setTimeout(() => window.location.reload(), 250);
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				} finally { setBusy(false); }
			};

			const rows = view === "sessions" ? (data?.sessions || []) : (data?.trash || []);
			return h("section", { className: "dsm-root" },
				h("div", { className: "dsm-header" },
					h("h2", { className: "dsm-title" }, "会话管理"),
					h("button", { className: "dsm-refresh", type: "button", title: "刷新", "aria-label": "刷新会话列表", disabled: loading || busy, onClick: () => void load() }, "↻"),
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
						? h(SessionRow, { key: item.id, item, onTrash: value => setConfirm({ kind: "trash", item: value }) })
						: h(TrashRow, { key: item.trashId, item, busy, onRestore: value => void mutate("restore", { trashId: value.trashId }, true), onPurge: value => setConfirm({ kind: "purge", item: value }) }))),
				h(ConfirmDialog, {
					action: confirm,
					busy,
					onCancel: () => setConfirm(null),
					onConfirm: () => confirm === null ? undefined : void mutate(
						confirm.kind,
						confirm.kind === "trash" ? { sessionId: confirm.item.id } : { trashId: confirm.item.trashId },
						confirm.kind === "trash",
					),
				}),
			);
		}

		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "session-manager",
				order: 30,
				label: () => "会话管理",
			}, SessionManagerSection));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
