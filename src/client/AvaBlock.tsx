import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { parseAvaSource, type AvaDocument, type AvaField } from './ava-source.ts'
import {
  loadAvaAsset,
  type AvaAnalysis,
  type AvaChart,
  type AvaEngine,
  type AvaPattern,
} from './asset-loader.ts'

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
  const parsed = useMemo(() => parseAvaSource(source, isSettled), [isSettled, source])

  useLayoutEffect(() => {
    if (settled !== undefined) {
      setIsSettled(settled)
      return
    }
    const node = rootRef.current
    if (node !== null && node.closest('[data-streaming]') === null) setIsSettled(true)
  }, [settled, source])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    const container = canvasRef.current
    if (engine === null || container === null || !parsed.ok) return
    let active = true
    setReady(false)
    setError(null)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          chartRef.current?.destroy()
          container.replaceChildren()
          const nextAnalysis = engine.analyze(parsed.value)
          const chart = new engine.Chart({ container, autoFit: true, height: 360 })
          chartRef.current = chart
          chart.options({
            ...nextAnalysis.advice.spec,
            data: parsed.value.data,
            animate: false,
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
  }, [engine, parsed])

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

  const document = parsed.ok ? parsed.value : undefined
  const patterns = document === undefined || analysis === null
    ? []
    : analysis.patterns.map(pattern => describePattern(pattern, document))
  const language = document?.language ?? 'zh-CN'
  const chartName = analysis === null
    ? ''
    : CHART_NAMES[analysis.advice.type]?.[language] ?? analysis.advice.type

  return (
    <div ref={rootRef} className="dsh-antv-ava" data-ready={ready ? 'true' : 'false'}>
      <div className="dsh-antv-ava__toolbar">
        <span className="dsh-antv-ava__brand">AntV AVA</span>
        {chartName !== '' && <span className="dsh-antv-ava__badge">{chartName}</span>}
        {analysis !== null && <span className="dsh-antv-ava__score">score {analysis.advice.score.toFixed(2)}</span>}
        <button
          type="button"
          className="dsh-antv-ava__button"
          disabled={!ready}
          onClick={() => {
            try {
              if (canvasRef.current !== null && document !== undefined) downloadPng(canvasRef.current, document.title)
            } catch (reason) {
              setError(`导出失败：${describeError(reason)}`)
            }
          }}
        >
          PNG
        </button>
        <button type="button" className="dsh-antv-ava__button" onClick={() => void copySource()}>
          {copied ? '已复制' : '复制 DSL'}
        </button>
      </div>

      {document !== undefined && (
        <div className="dsh-antv-ava__heading">
          <strong>{document.title}</strong>
          {document.description !== undefined && <span>{document.description}</span>}
        </div>
      )}
      {error !== null && <div className="dsh-antv-ava__error" role="alert">{error}</div>}
      {!parsed.ok && isSettled && parsed.reason !== undefined && (
        <div className="dsh-antv-ava__error" role="alert">{parsed.reason}</div>
      )}

      <div className="dsh-antv-ava__viewport">
        {!ready && error === null && (
          <div className="dsh-antv-ava__status">
            {engine === null ? '正在加载 AntV AVA 引擎…' : '正在分析数据并推荐图表…'}
          </div>
        )}
        <div ref={canvasRef} className="dsh-antv-ava__canvas" />
      </div>

      {ready && document !== undefined && (
        <div className="dsh-antv-ava__insights">
          <strong>{language === 'zh-CN' ? 'AVA 自动洞察' : 'AVA insights'}</strong>
          {patterns.length > 0 ? (
            <ul>{patterns.map((pattern, index) => <li key={`${index}-${pattern}`}>{pattern}</li>)}</ul>
          ) : (
            <span>{language === 'zh-CN' ? '当前数据未检测到显著统计模式。' : 'No significant statistical pattern was detected.'}</span>
          )}
        </div>
      )}

      <details className="dsh-antv-ava__source">
        <summary>{language === 'zh-CN' ? '查看 AVA DSL' : 'View AVA DSL'}</summary>
        <pre>{source}</pre>
      </details>
    </div>
  )
}
