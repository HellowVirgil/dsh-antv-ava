import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { loadAvaAsset, type AvaChart, type AvaEngine } from '../asset-loader.ts'
import { useChartTheme } from '../runtime/theme.ts'
import { ResultTable } from './ResultTable.tsx'
import type { Scalar } from '../../protocol/types.ts'

function themed(config: string | Record<string, unknown>, theme: string): string | Record<string, unknown> {
  if (typeof config !== 'string') {
    const { title: _title, ...rest } = config
    const grouped = Array.isArray(config.data) && config.data.some(row => typeof row === 'object' && row !== null && 'group' in row)
    const mono = ['bar','column','waterfall'].includes(String(config.type)) && !grouped
    return { ...rest, theme, style: { backgroundColor: 'transparent', ...(mono ? { palette: [theme === 'dark' ? '#91adf5' : '#4774dd'] } : {}) } }
  }
  return config.split('\n').filter(line => line.startsWith(' ') || !/^(?:theme|title)(?::\s*|\s+)/i.test(line)).concat(`theme ${theme}`, 'style', '  backgroundColor transparent').join('\n')
}
export function ChartView({ config, title, language = 'zh-CN', settled = true, table }: {
  config: string | Record<string, unknown>
  title?: string | undefined
  language?: string
  settled?: boolean
  table?: { columns: string[]; rows: Record<string, Scalar>[] } | undefined
}): ReactElement {
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const chart = useRef<AvaChart | null>(null)
  const [engine, setEngine] = useState<AvaEngine | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [canExport, setCanExport] = useState(false)
  const theme = useChartTheme(root)
  const spec = useMemo(() => themed(config, theme), [config, theme])
  const latest = useRef(spec); latest.current = spec
  const zh = language === 'zh-CN'
  useEffect(() => {
    let active = true
    setError(null)
    void loadAvaAsset().then(value => { if (active) setEngine(value) }, reason => { if (active) setError(reason instanceof Error ? reason.message : 'Chart engine unavailable') })
    return () => { active = false }
  }, [attempt])
  useEffect(() => {
    if (!engine || !canvas.current) return
    let active = true
    let frame = 0
    const timer = window.setTimeout(() => {
      try {
        chart.current ??= new engine.GPTVis({ container: canvas.current!, height: 360, locale: language, theme, wrapper: false })
        chart.current.render(spec)
        if (!active) return
        setReady(true); setError(null)
        frame = requestAnimationFrame(() => {
          const image = canvas.current?.querySelector('canvas')
          setCanExport(image instanceof HTMLCanvasElement && image.width > 0 && image.height > 0)
        })
      } catch (reason) {
        if (active && settled) setError(reason instanceof Error ? reason.message : 'Chart rendering failed')
      }
    }, settled ? 0 : 120)
    return () => { active = false; clearTimeout(timer); cancelAnimationFrame(frame) }
  }, [engine, spec, settled, language, theme, attempt])
  useEffect(() => {
    if (!root.current || typeof ResizeObserver === 'undefined') return
    let width = 0
    let frame = 0
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width ?? 0
      if (next <= 0 || next === width) return
      width = next; cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        try { chart.current?.render(latest.current) } catch { /* normal render path reports failures */ }
      })
    })
    observer.observe(root.current)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [])
  useEffect(() => () => { chart.current?.destroy(); chart.current = null }, [])
  const showTable = table !== undefined && (view === 'table' || error !== null)
  return <div ref={root} data-ready={ready ? 'true' : 'false'}>
    <div className="dsh-antv-ava-flow__meta">
      <span>AntV GPT-Vis</span>
      {table && <div className="dsh-antv-ava-actions" aria-label={zh ? '查看方式' : 'View'}>
        <button aria-pressed={!showTable} disabled={!!error} onClick={() => setView('chart')}>{zh ? '图表' : 'Chart'}</button>
        <button aria-pressed={showTable} onClick={() => setView('table')}>{zh ? '数据' : 'Data'}</button>
      </div>}
      {canExport && !showTable && <button onClick={() => {
        try {
          const image = canvas.current?.querySelector('canvas')
          if (!(image instanceof HTMLCanvasElement)) throw new Error('Canvas unavailable')
          const a = document.createElement('a'); a.href = image.toDataURL('image/png'); a.download = (title ?? 'ava-chart') + '.png'; a.click()
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Export failed') }
      }}>{zh ? '下载 PNG' : 'Download PNG'}</button>}
    </div>
    {error && <div className="dsh-antv-ava__error" role="alert">{zh ? '图表暂不可用，已有数据仍可查看。' : 'Chart unavailable; existing data is preserved.'}<details><summary>{zh ? '详情' : 'Details'}</summary>{error}</details><button onClick={() => { chart.current?.destroy(); chart.current = null; setReady(false); setAttempt(n => n + 1) }}>{zh ? '重试图表' : 'Retry chart'}</button></div>}
    {!ready && !error && !showTable && <div className="dsh-antv-ava-flow__status" role="status">{zh ? '正在准备图表…' : 'Preparing chart…'}</div>}
    <div ref={canvas} className="dsh-antv-ava-flow__canvas" role="img" aria-label={title ?? (zh ? '数据图表；可切换数据视图查看数值' : 'Data chart; use the data view for exact values')} hidden={showTable || !!error} />
    {showTable && table && <ResultTable {...table} language={language} />}
  </div>
}
