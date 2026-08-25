const STYLE_ID = 'dsh-antv-ava'

const CSS = `
.dsh-antv-ava-flow{position:relative;min-width:0;margin:0;color:inherit;font:inherit;line-height:inherit;letter-spacing:inherit}
.dsh-antv-ava-flow__chart{min-width:0;margin:0}
.dsh-antv-ava-flow__chart--supplementary{margin-top:32px}
.dsh-antv-ava-flow__heading h3{font:var(--dsw-font-markdown-h3,700 20px/30px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);margin:0 0 8px;color:inherit}
.dsh-antv-ava-flow__heading p{margin:0 0 16px;color:inherit}
.dsh-antv-ava-flow__meta{display:flex;align-items:center;gap:12px;margin:0 0 8px;color:var(--dsw-alias-label-caption,color-mix(in srgb,currentColor 58%,transparent));font:var(--dsw-font-markdown-small,14px/24px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif)}
.dsh-antv-ava-flow__meta span{margin-right:auto}
.dsh-antv-ava-flow__meta button,.dsh-antv-ava-flow__source-actions button{appearance:none;border:0;background:transparent;color:inherit;font:inherit;padding:0;cursor:pointer;text-decoration:underline;text-decoration-color:color-mix(in srgb,currentColor 30%,transparent);text-underline-offset:3px}
.dsh-antv-ava-flow__meta button:hover:not(:disabled),.dsh-antv-ava-flow__source-actions button:hover{color:var(--dsw-alias-label-secondary,currentColor);text-decoration-color:currentColor}
.dsh-antv-ava-flow__meta button:disabled{cursor:not-allowed;opacity:.4}
.dsh-antv-ava-flow__canvas{min-width:320px;min-height:360px;width:100%;overflow:hidden}
.dsh-antv-ava-flow__canvas canvas,.dsh-antv-ava-flow__canvas svg{display:block;max-width:100%}
.dsh-antv-ava-flow__status{min-height:96px;display:flex;align-items:center;color:var(--dsw-alias-label-caption,color-mix(in srgb,currentColor 58%,transparent));font:var(--dsw-font-markdown-small,14px/24px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif)}
.dsh-antv-ava-flow__insights{margin-top:16px;color:inherit}
.dsh-antv-ava-flow__insights h4{font:var(--dsw-font-markdown-h4,600 16px/28px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);margin:16px 0 8px;color:inherit}
.dsh-antv-ava-flow__insights p,.dsh-antv-ava-flow__insights ul{margin:8px 0 0}
.dsh-antv-ava-flow__insights ul{padding-left:18px}.dsh-antv-ava-flow__insights li:not(:first-child){margin-top:6px}
.dsh-antv-ava__error{margin:8px 0;color:#dc2626;font:var(--dsw-font-markdown-small,14px/24px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);white-space:pre-wrap}
.dsh-antv-ava-flow__source{font:var(--dsw-font-markdown-small,14px/24px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);margin:8px 0 0;color:var(--dsw-alias-label-caption,color-mix(in srgb,currentColor 58%,transparent))}
.dsh-antv-ava-flow__source>summary{display:list-item;width:max-content;cursor:pointer;padding:0;user-select:none}
.dsh-antv-ava-flow__source-actions{display:flex;justify-content:flex-end;margin:4px 0}
.dsh-antv-ava-flow__source pre{max-height:260px;overflow:auto;margin:4px 0 0;padding:12px;border-radius:8px;background:color-mix(in srgb,currentColor 5%,transparent);color:inherit;font:var(--dsw-font-markdown-code-block-small,12px/18px ui-monospace,SFMono-Regular,Menlo,monospace);white-space:pre-wrap;word-break:break-word}
.dsh-antv-ava-ntv-shell{position:relative;min-width:0;margin:0;color:inherit}
.dsh-antv-ava-ntv{font:inherit;line-height:inherit;color:inherit;letter-spacing:inherit}
.dsh-antv-ava-ntv__headline{font:var(--dsw-font-markdown-h2,700 22px/32px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);margin:0 0 16px;color:inherit}
.dsh-antv-ava-ntv p{margin:16px 0}
.dsh-antv-ava-ntv h1{font:var(--dsw-font-markdown-h1,700 24px/34px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);margin:32px 0 16px}
.dsh-antv-ava-ntv h2{font:var(--dsw-font-markdown-h2,700 22px/32px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);margin:32px 0 16px}
.dsh-antv-ava-ntv h3{font:var(--dsw-font-markdown-h3,700 20px/30px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);margin:32px 0 16px}
.dsh-antv-ava-ntv h4{font:var(--dsw-font-markdown-h4,600 16px/28px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);margin:16px 0}
.dsh-antv-ava-ntv h5,.dsh-antv-ava-ntv h6{font:var(--dsw-font-markdown-base-strong,600 16px/28px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);margin:16px 0}
.dsh-antv-ava-ntv :where(h1,h2,h3,h4,h5,h6){color:inherit}.dsh-antv-ava-ntv :where(h1,h2,h3,h4,h5,h6) strong{font-weight:inherit}
.dsh-antv-ava-ntv :where(ul,ol){margin:16px 0;padding-left:18px}
.dsh-antv-ava-ntv li{padding-left:0}.dsh-antv-ava-ntv li:not(:first-child){margin-top:6px}
.dsh-antv-ava-ntv li::marker{line-height:28px;color:var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 58%,transparent))}
.dsh-antv-ava-ntv :where(h4,h5,h6)+:where(ul,ol){margin-top:8px}.dsh-antv-ava-ntv :where(h4,h5,h6):has(+:where(ul,ol)){margin-bottom:8px}
.dsh-antv-ava-ntv> :first-child,.dsh-antv-ava-ntv p:first-child{margin-top:0!important}.dsh-antv-ava-ntv> :last-child,.dsh-antv-ava-ntv p:last-child{margin-bottom:0!important}
.dsh-antv-ava-ntv hr{border:0;border-top:1px solid var(--dsw-alias-label-caption,color-mix(in srgb,currentColor 15%,transparent));margin:16px 0}
.dsh-antv-ava-ntv__entity{display:inline;color:inherit}
.dsh-antv-ava-ntv__entity--metric_name{font-weight:650;color:inherit}
.dsh-antv-ava-ntv__entity--metric_value{color:#1677ff;font-weight:500}
.dsh-antv-ava-ntv__entity--dim_value{color:inherit;font-weight:600}
.dsh-antv-ava-ntv__entity--time_desc{color:inherit}
.dsh-antv-ava-ntv__entity--contribute_ratio,.dsh-antv-ava-ntv__entity--trend_desc{color:#1f0352}
.dsh-antv-ava-ntv__entity--positive{color:#fa541c}
.dsh-antv-ava-ntv__entity--negative{color:#13a8a8}
.dsh-antv-ava-ntv__entity--equal{color:inherit}
.dsh-antv-ava-ntv__arrow{display:inline-block;margin-right:2px;font-size:.72em;vertical-align:.08em}
.dsh-antv-ava-ntv__proportion-wrap{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.dsh-antv-ava-ntv__proportion{--daa-proportion:0deg;display:inline-block;width:1em;height:1em;border-radius:50%;background:conic-gradient(#3471f9 0 var(--daa-proportion),#cdddfd var(--daa-proportion) 360deg);vertical-align:-.12em;box-shadow:inset 0 0 0 .5px rgba(22,119,255,.08)}
.dsh-antv-ava-ntv__source{font:var(--dsw-font-markdown-small,14px/24px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);margin:8px 0 0;color:var(--dsw-alias-label-caption,color-mix(in srgb,currentColor 58%,transparent))}
.dsh-antv-ava-ntv__source>summary{display:list-item;width:max-content;cursor:pointer;padding:0;user-select:none}
.dsh-antv-ava-ntv__source-actions{display:flex;justify-content:flex-end;margin:4px 0}
.dsh-antv-ava-ntv__source-actions button{appearance:none;border:0;background:transparent;color:inherit;font:inherit;padding:2px 4px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.dsh-antv-ava-ntv__source pre{max-height:260px;overflow:auto;margin:4px 0 0;padding:12px;border-radius:8px;background:color-mix(in srgb,currentColor 5%,transparent);color:inherit;font:var(--dsw-font-markdown-code-block-small,12px/18px ui-monospace,SFMono-Regular,Menlo,monospace);white-space:pre-wrap;word-break:break-word}
.dsh-antv-ava-dom{min-width:0}
@media (prefers-color-scheme:dark){.dsh-antv-ava__error{color:#fca5a5}.dsh-antv-ava-ntv__entity--metric_value{color:#4b91ff}.dsh-antv-ava-ntv__entity--contribute_ratio,.dsh-antv-ava-ntv__entity--trend_desc{color:#d8c3f3}.dsh-antv-ava-ntv__entity--positive{color:#fa541c}.dsh-antv-ava-ntv__entity--negative{color:#13a8a8}}
`

export function ensureAvaStyles(): void {
  if (typeof document === 'undefined') return
  if (document.head.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginCss = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
