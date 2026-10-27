import { useState, type ReactElement } from 'react'
import type { AvaDocument, AvaField } from '../ava-source.ts'
import type { AvaAnalysis, AvaPattern } from '../ava-analysis.ts'
import { loadInsights } from '../runtime/insights.ts'
function fieldLabel(fields: AvaField[], id: unknown): string {
  const key = typeof id === 'string' ? id : ''
  return fields.find(field => field.id === key)?.label ?? key
}

function printable(value: unknown): string {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  return typeof value === 'string' ? value : ''
}

function describePattern(pattern: AvaPattern, fields: AvaField[], language: 'zh-CN' | 'en-US'): string {
  const zh = language === 'zh-CN'
  const measure = fieldLabel(fields, pattern.measure)
  const dimension = fieldLabel(fields, pattern.dimension)
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
      const measures = Array.isArray(pattern.measures) ? pattern.measures.map(item => fieldLabel(fields, item)).join('、') : ''
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

export function LegacyInsights({ document }: { document: AvaDocument }): ReactElement {
  const [state, setState] = useState<{ syntax: string; result?: AvaAnalysis; error?: string; loading?: boolean }>({ syntax: document.syntax })
  const current = state.syntax === document.syntax ? state : { syntax: document.syntax }
  return <details className="dsh-antv-ava-evidence"><summary>{document.language === 'zh-CN' ? '可选统计模式' : 'Optional statistical patterns'}</summary>
    <p>{document.language === 'zh-CN' ? '仅分析图表内的数据，统计模式不代表因果关系。' : 'Computed from chart data only; patterns do not establish causality.'}</p>
    <button disabled={current.loading} onClick={() => {
      setState({ syntax: document.syntax, loading: true })
      void loadInsights(document).then(result => setState({ syntax: document.syntax, result }), error => setState({ syntax: document.syntax, error: String(error) }))
    }}>{current.loading ? '…' : document.language === 'zh-CN' ? '计算统计模式' : 'Compute patterns'}</button>
    {current.error && <p role="alert">{current.error}</p>}
    {current.result && (current.result.status === 'unsupported' ? <p>当前数据形态不支持此统计分析。</p> : current.result.patterns.length ? <ul>{current.result.patterns.map((p,i) => <li key={i}>{describePattern(p, current.result!.fields, document.language)}</li>)}</ul> : <p>{document.language === 'zh-CN' ? '当前数据未检测到显著统计模式。' : 'No significant statistical pattern was detected.'}</p>)}
  </details>
}
