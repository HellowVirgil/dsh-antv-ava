import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { parseAvaSource, type AvaDocument, type AvaField, type AvaNtvDocument } from './ava-source.ts'
import {
  loadAvaAsset,
  type AvaAnalysis,
  type AvaChart,
  type AvaEngine,
  type AvaPattern,
} from './asset-loader.ts'
import { NtvBlock } from './NtvBlock.tsx'

export interface AvaBlockProps {
  source: string
  /** DOM fallback knows this exactly; registry rendering may infer it. */
  settled?: boolean | undefined
}

const CHART_NAMES: Record<string, { 'zh-CN': string; 'en-US': string }> = {
  line_chart: { 'zh-CN': '折线图', 'en-US': 'Line chart' },
  column_chart: { 'zh-CN': '柱状图', 'en-US': 'Column chart' },
  bar_chart: { 'zh-CN': '条形图', 'en-US': 'Bar chart' },
  pie_chart: { 'zh-CN': '饼图', 'en-US': 'Pie chart' },
  donut_chart: { 'zh-CN': '环形图', 'en-US': 'Donut chart' },
  scatter_plot: { 'zh-CN': '散点图', 'en-US': 'Scatter plot' },
  area_chart: { 'zh-CN': '面积图', 'en-US': 'Area chart' },
  grouped_column_chart: { 'zh-CN': '分组柱状图', 'en-US': 'Grouped column chart' },
  stacked_column_chart: { 'zh-CN': '堆叠柱状图', 'en-US': 'Stacked column chart' },
  table: { 'zh-CN': '数据表', 'en-US': 'Table' },
}

function describeError(value: unknown): string {
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  return 'AVA 分析或图表渲染失败'
}

function fieldLabel(fields: AvaField[], id: unknown): string {
  const key = typeof id === 'string' ? id : ''
  return fields.find(field => field.id === key)?.label ?? key
}

function printable(value: unknown): string {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  return typeof value === 'string' ? value : ''
}

function describePattern(pattern: AvaPattern, document: AvaDocument): string {
  const zh = document.language === 'zh-CN'
  const measure = fieldLabel(document.fields, pattern.measure)
  const dimension = fieldLabel(document.fields, pattern.dimension)
  switch (pattern.type) {
    case 'trend': {
      const trend = pattern.trend
      if (zh) {
        const label = trend === 'increasing' ? '上升' : trend === 'decreasing' ? '下降' : '基本稳定'
        return `${measure || '指标'}随${dimension || '维度'}呈${label}趋势`
      }
      return `${measure || 'The measure'} is ${trend === 'increasing' ? 'increasing' : trend === 'decreasing' ? 'decreasing' : 'mostly stable'} across ${dimension || 'the dimension'}`
    }
    case 'category_outlier':
    case 'time_series_outlier':
      return zh
        ? `${printable(pattern.x)} 的${measure || '数值'} ${printable(pattern.y)} 是明显异常点`
        : `${printable(pattern.x)} is an outlier for ${measure || 'the measure'} at ${printable(pattern.y)}`
    case 'change_point':
      return zh
        ? `${measure || '指标'}在 ${printable(pattern.x)} 附近出现显著变化`
        : `${measure || 'The measure'} changes significantly near ${printable(pattern.x)}`
    case 'majority': {
      const proportion = typeof pattern.proportion === 'number' ? `${(pattern.proportion * 100).toFixed(1)}%` : ''
      return zh
        ? `${printable(pattern.x)} 占据主要份额${proportion === '' ? '' : `（${proportion}）`}`
        : `${printable(pattern.x)} accounts for the majority${proportion === '' ? '' : ` (${proportion})`}`
    }
    case 'correlation': {
      const measures = Array.isArray(pattern.measures) ? pattern.measures.map(item => fieldLabel(document.fields, item)).join('、') : ''
      const coefficient = typeof pattern.pcorr === 'number' ? pattern.pcorr.toFixed(2) : ''
      return zh
        ? `${measures || '两个指标'}存在相关性${coefficient === '' ? '' : `（系数 ${coefficient}）`}`
        : `${measures || 'The measures'} are correlated${coefficient === '' ? '' : ` (coefficient ${coefficient})`}`
    }
    case 'low_variance':
      return zh
        ? `${measure || '指标'}波动较小，整体较稳定`
        : `${measure || 'The measure'} has low variance and is relatively stable`
    default:
      return zh ? `AVA 检测到 ${pattern.type} 数据模式` : `AVA detected a ${pattern.type} pattern`
  }
}

function downloadPng(container: HTMLElement, title: string): void {
  const canvas = container.querySelector('canvas')
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('当前图表没有可导出的 Canvas')
  const anchor = document.createElement('a')
  anchor.href = canvas.toDataURL('image/png')
  anchor.download = `${title.replace(/[^\p{L}\p{N}._-]+/gu, '-') || 'ava-analysis'}.png`
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function chartTheme(container: HTMLElement): 'classic' | 'classicDark' {
  let node: HTMLElement | null = container
  while (node !== null) {
    const match = getComputedStyle(node).backgroundColor.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)$/)
    if (match !== null && Number(match[4] ?? 1) > 0) {
      const luminance = (Number(match[1]) * 299 + Number(match[2]) * 587 + Number(match[3]) * 114) / 1000
      return luminance < 128 ? 'classicDark' : 'classic'
    }
    node = node.parentElement
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'classicDark' : 'classic'
}

export function AvaBlock({ source, settled }: AvaBlockProps): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<AvaChart | null>(null)
  const [isSettled, setIsSettled] = useState(settled ?? false)
  const [engine, setEngine] = useState<AvaEngine | null>(null)
  const [analysis, setAnalysis] = useState<AvaAnalysis | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resolvedChartTheme, setResolvedChartTheme] = useState<'classic' | 'classicDark' | undefined>()
  const parsed = useMemo(() => parseAvaSource(source, isSettled), [isSettled, source])

  useLayoutEffect(() => {
    if (settled !== undefined) {
      setIsSettled(settled)
      return
    }
    const node = rootRef.current
    if (node !== null && node.closest('[data-streaming]') === null) setIsSettled(true)
  }, [settled, source])

  const narrativeDocument: AvaNtvDocument | undefined = !parsed.ok
    ? undefined
    : parsed.value.mode === 'ntv'
      ? parsed.value
      : parsed.value.mode === 'combined'
        ? parsed.value.narrative
        : undefined
  const document: AvaDocument | undefined = !parsed.ok
    ? undefined
    : parsed.value.mode === 'chart'
      ? parsed.value
      : parsed.value.mode === 'combined'
        ? parsed.value.chart
        : undefined
  const combined = parsed.ok && parsed.value.mode === 'combined'

  useLayoutEffect(() => {
    const container = canvasRef.current
    if (document === undefined || container === null) {
      setResolvedChartTheme(undefined)
      return
    }

    let timers: number[] = []
    const sampleTheme = (): void => {
      const next = chartTheme(container)
      setResolvedChartTheme(current => current === next ? current : next)
    }
    const scheduleThemeSample = (): void => {
      for (const timer of timers) window.clearTimeout(timer)
      timers = [0, 80, 260].map(delay => window.setTimeout(sampleTheme, delay))
    }

    sampleTheme()
    const observer = new MutationObserver(scheduleThemeSample)
    let node: HTMLElement | null = container
    while (node !== null) {
      observer.observe(node, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme', 'data-color-mode'],
      })
      node = node.parentElement
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener?.('change', scheduleThemeSample)

    return () => {
      observer.disconnect()
      media.removeEventListener?.('change', scheduleThemeSample)
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [document])

  useEffect(() => {
    if (document === undefined) return
    let active = true
    void loadAvaAsset().then(
      loaded => {
        if (active) setEngine(loaded)
      },
      reason => {
        if (active) setError(describeError(reason))
      },
    )
    return () => {
      active = false
    }
  }, [document])

  useEffect(() => {
    const container = canvasRef.current
    if (engine === null || container === null || document === undefined || resolvedChartTheme === undefined) return
    let active = true
    if (chartRef.current === null) setReady(false)
    setError(null)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          chartRef.current?.destroy()
          container.replaceChildren()
          const nextAnalysis = engine.analyze(document)
          const chart = new engine.Chart({ container, autoFit: true, height: 360 })
          chartRef.current = chart
          chart.options({
            ...nextAnalysis.advice.spec,
            data: document.data,
            animate: false,
            theme: resolvedChartTheme,
          })
          await chart.render()
          if (!active) {
            chart.destroy()
            return
          }
          setAnalysis(nextAnalysis)
          setReady(true)
        } catch (reason) {
          if (active) setError(describeError(reason))
        }
      })()
    }, 120)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [document, engine, resolvedChartTheme])

  useEffect(() => () => {
    chartRef.current?.destroy()
    chartRef.current = null
  }, [])

  const copySource = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(source)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('复制失败：浏览器没有授予剪贴板权限')
    }
  }

  if (narrativeDocument !== undefined && document === undefined) {
    return <NtvBlock document={narrativeDocument} source={source} settled={isSettled} rootRef={rootRef} />
  }

  const patterns = document === undefined || analysis === null
    ? []
    : analysis.patterns.map(pattern => describePattern(pattern, document))
  const language = document?.language ?? 'zh-CN'
  const chartName = analysis === null
    ? ''
    : CHART_NAMES[analysis.advice.type]?.[language] ?? analysis.advice.type

  return (
    <div ref={rootRef} className="dsh-antv-ava-flow" data-ready={ready ? 'true' : 'false'} data-stream-state={isSettled ? 'settled' : 'streaming'}>
      {combined && narrativeDocument !== undefined && (
        <NtvBlock document={narrativeDocument} source={source} settled={isSettled} showSource={false} />
      )}

      <section className={`dsh-antv-ava-flow__chart${combined ? ' dsh-antv-ava-flow__chart--supplementary' : ''}`}>
        {document !== undefined && (
          <header className="dsh-antv-ava-flow__heading">
            <h3>{document.title}</h3>
            {document.description !== undefined && <p>{document.description}</p>}
          </header>
        )}

        <div className="dsh-antv-ava-flow__meta">
          <span>{chartName === '' ? 'AntV AVA' : `AntV AVA · ${chartName}`}</span>
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              try {
                if (canvasRef.current !== null && document !== undefined) downloadPng(canvasRef.current, document.title)
              } catch (reason) {
                setError(`导出失败：${describeError(reason)}`)
              }
            }}
          >
            {language === 'zh-CN' ? '下载 PNG' : 'Download PNG'}
          </button>
        </div>

        {error !== null && <div className="dsh-antv-ava__error" role="alert">{error}</div>}
        {!parsed.ok && isSettled && parsed.reason !== undefined && (
          <div className="dsh-antv-ava__error" role="alert">{parsed.reason}</div>
        )}

        {!ready && error === null && (
          <div className="dsh-antv-ava-flow__status">
            {engine === null
              ? (language === 'zh-CN' ? '正在加载 AntV AVA 引擎…' : 'Loading AntV AVA…')
              : (language === 'zh-CN' ? '正在分析数据并生成图表…' : 'Analyzing data and rendering the chart…')}
          </div>
        )}
        <div ref={canvasRef} className="dsh-antv-ava-flow__canvas" />

        {ready && document !== undefined && !combined && (
          <div className="dsh-antv-ava-flow__insights">
            <h4>{language === 'zh-CN' ? '数据洞察' : 'Data insights'}</h4>
            {patterns.length > 0 ? (
              <ul>{patterns.map((pattern, index) => <li key={`${index}-${pattern}`}>{pattern}</li>)}</ul>
            ) : (
              <p>{language === 'zh-CN' ? '当前数据未检测到显著统计模式。' : 'No significant statistical pattern was detected.'}</p>
            )}
          </div>
        )}
      </section>

      <details className="dsh-antv-ava-flow__source">
        <summary>{language === 'zh-CN' ? 'AVA · 查看 DSL' : 'AVA · View DSL'}</summary>
        <div className="dsh-antv-ava-flow__source-actions">
          <button type="button" onClick={() => void copySource()}>{copied ? (language === 'zh-CN' ? '已复制' : 'Copied') : (language === 'zh-CN' ? '复制 DSL' : 'Copy DSL')}</button>
        </div>
        <pre>{source}</pre>
      </details>
    </div>
  )
}
