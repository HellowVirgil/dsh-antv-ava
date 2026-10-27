import { useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { parseAvaSource, type AvaParseResult } from './ava-source.ts'
import { NtvBlock } from './NtvBlock.tsx'
import { ChartView } from './components/ChartView.tsx'
import { AnswerReferenceView, AnswerView } from './components/AnswerView.tsx'
import { LegacyInsights } from './components/LegacyInsights.tsx'
import type { Scalar } from '../protocol/types.ts'

export interface AvaBlockProps {
  source: string
  settled?: boolean | undefined
  parsed?: AvaParseResult | undefined
  parsedSettled?: boolean | undefined
}
export function AvaBlock({ source, settled, parsed: supplied, parsedSettled = settled ?? false }: AvaBlockProps): ReactElement {
  const root = useRef<HTMLDivElement>(null)
  const [inferred, setInferred] = useState(false)
  const [copied, setCopied] = useState(false)
  const complete = settled ?? inferred
  const parsed = useMemo(() => supplied && parsedSettled === complete ? supplied : parseAvaSource(source, complete), [supplied, parsedSettled, source, complete])
  useLayoutEffect(() => { if (settled === undefined && root.current) setInferred(root.current.closest('[data-streaming]') === null) }, [settled, source])
  if (!parsed.ok) return <div ref={root}>{complete && parsed.reason && <p className="dsh-antv-ava__error" role="alert">{parsed.reason}</p>}</div>
  const document = parsed.value
  if (document.mode === 'reference') return <div ref={root}><AnswerReferenceView id={document.id} /></div>
  if (document.mode === 'answer') return <div ref={root}><AnswerView document={document.document} /></div>
  if (document.mode === 'ntv') return <NtvBlock document={document} source={source} settled={complete} rootRef={root} />
  const combined = document.mode === 'combined'
  const chart = combined ? document.chart : document
  const config = chart.mode === 'json-chart' ? chart.config : chart.syntax
  const title = chart.mode === 'json-chart' ? (typeof chart.config.title === 'string' ? chart.config.title : undefined) : chart.title
  const rows = chart.mode === 'json-chart' && Array.isArray(chart.config.data)
    ? chart.config.data.map((row: unknown) => typeof row === 'number' ? { value: row } : row as Record<string, Scalar>) : undefined
  const table = rows ? { columns: [...new Set(rows.flatMap(row => Object.keys(row)))], rows } : undefined
  return <div ref={root} className="dsh-antv-ava-flow" data-stream-state={complete ? 'settled' : 'streaming'}>
    {combined && <NtvBlock document={document.narrative} source={source} settled={complete} showSource={false} />}
    <section className={`dsh-antv-ava-flow__chart${combined ? ' dsh-antv-ava-flow__chart--supplementary' : ''}`}>
      {title && <header className="dsh-antv-ava-flow__heading"><h3>{title}</h3></header>}
      <ChartView config={config} title={title} language={chart.language} settled={complete} table={table} />
      {complete && chart.mode === 'chart' && <LegacyInsights document={chart} />}
    </section>
    <details className="dsh-antv-ava-flow__source"><summary>AVA / GPT-Vis · {chart.language === 'zh-CN' ? '查看 DSL' : 'View DSL'}</summary>
      <button onClick={() => { void navigator.clipboard.writeText(source).then(() => setCopied(true), () => setCopied(false)) }}>{copied ? 'Copied' : 'Copy'}</button><pre>{source}</pre>
    </details>
  </div>
}
