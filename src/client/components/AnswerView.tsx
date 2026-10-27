import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { AnswerDocument, AnswerBlock, ResultSnapshot, ViewSpec } from '../../protocol/types.ts'
import { validateAnswer, resolveValue, formatValue } from '../../protocol/answer.ts'
import { boundedJson } from '../../protocol/guards.ts'
import { configFromView } from '../../protocol/chart.ts'
import { ChartView } from './ChartView.tsx'
import { EvidenceView, ResultTable } from './ResultTable.tsx'

function ResultView({ view, result, language }: { view: ViewSpec; result: ResultSnapshot; language: string }): ReactElement {
  const config = useMemo(() => { try { return configFromView(view, result) } catch { return null } }, [view, result])
  const table = { columns: result.columns.map(c => c.id), rows: result.rows }
  return <section className="dsh-antv-ava-flow__chart">
    {view.title && <h3>{view.title}</h3>}
    {config && view.chartType !== 'table'
      ? <ChartView config={config} title={view.title} table={table} language={language} />
      : <><p className="dsh-antv-ava-scope">{language === 'zh-CN' ? '以数据表展示当前结果。' : 'Showing the result as a table.'}</p><ResultTable {...table} language={language} /></>}
  </section>
}
function Block({ block, document }: { block: AnswerBlock; document: AnswerDocument }): ReactElement | null {
  const show = (ref: Parameters<typeof resolveValue>[0], format?: 'number' | 'money' | 'percent', currency?: string): string => formatValue(resolveValue(ref, document.results), format, document.language, currency)
  if (block.kind === 'paragraph') return <p>{block.phrases.map((p, i) => p.kind === 'text' ? <span key={i}>{p.text}</span> : <span className="dsh-antv-ava-ntv__entity--metric_value" key={i}>{show(p.ref, p.format, p.currency)}</span>)}</p>
  if (block.kind === 'metric') return <div className="dsh-antv-ava-metric"><span>{block.label}</span><strong>{show(block.value, block.format, block.currency)}</strong></div>
  const view = document.views.find(v => v.id === block.viewId)
  const result = document.results.find(r => r.id === view?.resultId)
  return view && result ? <ResultView view={view} result={result} language={document.language} /> : null
}
export function AnswerView({ document, trusted = false }: { document: AnswerDocument; trusted?: boolean }): ReactElement {
  const zh = document.language === 'zh-CN'
  return <article className="dsh-antv-ava-flow" lang={document.language} data-ready="true">
    {document.title && <h2>{document.title}</h2>}
    {document.results.some(r => r.truncated) && <p className="dsh-antv-ava-notice" role="status">{zh ? '查询结果不完整。图表和数据表仅展示已返回的行，不能据此判断总体占比。' : 'The result is truncated. These rows do not establish population shares.'}</p>}
    {document.blocks.map(block => <Block key={block.id} block={block} document={document} />)}
    {document.results.filter(result => !document.views.some(view => view.resultId === result.id && document.blocks.some(b => b.kind === 'chart' && b.viewId === view.id))).map(result => <details key={result.id} className="dsh-antv-ava-evidence"><summary>{zh ? '查看结果数据' : 'View result data'}</summary><ResultTable columns={result.columns.map(c => c.id)} rows={result.rows} language={document.language} /></details>)}
    {document.results.map(result => <EvidenceView key={result.id} result={result} trusted={trusted} language={document.language} />)}
  </article>
}
export function AnswerReferenceView({ id }: { id: string }): ReactElement {
  const [state, setState] = useState<{ id: string; document?: AnswerDocument; error?: string }>({ id })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    const timer = setTimeout(() => {
      setState({ id, error: '读取结果超时，请重试。' })
      abort.abort()
    }, 15_000)
    setState({ id })
    void (async () => {
      try {
        const response = await fetch(`/plugins/dsh-antv-ava/results/${id}`, { signal: abort.signal, credentials: 'same-origin', cache: 'no-store' })
        if (!response.ok) throw new Error(response.status === 404 ? '结果快照不可用，请确认分析运行时已启用且快照仍然存在。' : '读取结果失败')
        const document = validateAnswer(boundedJson(await response.text()))
        if (!abort.signal.aborted) setState({ id, document })
      } catch (reason) {
        if (!abort.signal.aborted) setState({ id, error: reason instanceof Error ? reason.message : '读取结果失败' })
      } finally { clearTimeout(timer) }
    })()
    return () => { clearTimeout(timer); abort.abort() }
  }, [id, attempt])
  if (state.id === id && state.document) return <AnswerView document={state.document} trusted />
  if (state.id === id && state.error) return <div role="alert" className="dsh-antv-ava__error">{state.error}<button onClick={() => setAttempt(n => n + 1)}>重新读取结果</button></div>
  return <p role="status">正在读取已保存的分析结果…</p>
}
