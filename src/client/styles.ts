const STYLE_ID = 'dsh-antv-ava'

const CSS = `
.dsh-antv-ava{--daa-bg:color-mix(in srgb,currentColor 4%,transparent);--daa-border:color-mix(in srgb,currentColor 16%,transparent);--daa-muted:color-mix(in srgb,currentColor 62%,transparent);position:relative;margin:10px 0 14px;border:1px solid var(--daa-border);border-radius:12px;background:var(--daa-bg);overflow:hidden;color:inherit}
.dsh-antv-ava__toolbar{display:flex;align-items:center;gap:6px;min-height:40px;padding:6px 8px;border-bottom:1px solid var(--daa-border);background:color-mix(in srgb,currentColor 3%,transparent)}
.dsh-antv-ava__brand{font-size:12px;font-weight:700;margin-right:2px;opacity:.78;letter-spacing:.01em}
.dsh-antv-ava__badge{border-radius:999px;padding:4px 7px;background:color-mix(in srgb,#1677ff 14%,transparent);color:#1677ff;font-size:11px;font-weight:650}
.dsh-antv-ava__score{margin-right:auto;color:var(--daa-muted);font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace}
.dsh-antv-ava__button{appearance:none;border:1px solid var(--daa-border);border-radius:7px;background:transparent;color:inherit;font:inherit;font-size:12px;line-height:1;padding:7px 9px;cursor:pointer;transition:background .15s,border-color .15s,opacity .15s}
.dsh-antv-ava__button:hover:not(:disabled){background:color-mix(in srgb,currentColor 8%,transparent);border-color:color-mix(in srgb,currentColor 30%,transparent)}
.dsh-antv-ava__button:disabled{cursor:not-allowed;opacity:.4}
.dsh-antv-ava__heading{display:flex;flex-direction:column;gap:4px;padding:14px 16px 2px;background:#fff;color:#172033;color-scheme:light}
.dsh-antv-ava__heading strong{font-size:16px;line-height:1.4}
.dsh-antv-ava__heading span{color:#667085;font-size:12px;line-height:1.5}
.dsh-antv-ava__viewport{position:relative;min-height:260px;padding:8px 16px 14px;overflow:auto;background:#fff;color:#172033;color-scheme:light}
.dsh-antv-ava__canvas{min-width:320px;min-height:240px}
.dsh-antv-ava__canvas canvas,.dsh-antv-ava__canvas svg{display:block;max-width:100%}
.dsh-antv-ava__status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;color:#667085;font-size:13px;padding:16px}
.dsh-antv-ava__insights{display:flex;flex-direction:column;gap:7px;padding:12px 16px;border-top:1px solid var(--daa-border);font-size:12px;line-height:1.55}
.dsh-antv-ava__insights>strong{font-size:12px}
.dsh-antv-ava__insights>span{color:var(--daa-muted)}
.dsh-antv-ava__insights ul{margin:0;padding-left:18px;display:grid;gap:4px}
.dsh-antv-ava__error{margin:10px;padding:9px 11px;border-radius:8px;border:1px solid rgba(239,68,68,.36);background:rgba(239,68,68,.10);color:#dc2626;font-size:12px;line-height:1.55;white-space:pre-wrap}
.dsh-antv-ava__source{border-top:1px solid var(--daa-border)}
.dsh-antv-ava__source>summary{cursor:pointer;padding:8px 12px;font-size:12px;color:var(--daa-muted);user-select:none}
.dsh-antv-ava__source pre{max-height:260px;overflow:auto;margin:0;padding:12px;background:rgba(0,0,0,.05);font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
.dsh-antv-ava-dom{min-width:0}
@media (prefers-color-scheme:dark){.dsh-antv-ava__source pre{background:rgba(255,255,255,.04)}.dsh-antv-ava__error{color:#fca5a5}}
`

export function ensureAvaStyles(): void {
  if (typeof document === 'undefined') return
  if (document.head.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
