import { useState, type ReactElement } from 'react'
import type { Scalar, ResultSnapshot } from '../../protocol/types.ts'

export function csvText(columns: string[], rows: Record<string, Scalar>[]): string {
  const quote = (value: Scalar | undefined): string => {
    let text = value === null || value === undefined ? '' : String(value)
    if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\uFEFF' + [columns.map(quote).join(','), ...rows.map(row => columns.map(col => quote(row[col])).join(','))].join('\r\n')
}
export function ResultTable({ columns, rows, language = 'zh-CN' }: { columns: string[]; rows: Record<string, Scalar>[]; language?: string }): ReactElement {
  const [page, setPage] = useState(0)
  const effectivePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1))
  const zh = language === 'zh-CN'
  const visible = rows.slice(effectivePage * 50, (effectivePage + 1) * 50)
  return <div className="dsh-antv-ava-table">
    <div className="dsh-antv-ava-table__scroll" tabIndex={0} role="region" aria-label={zh ? '结果数据表' : 'Result data'}>
      <table><thead><tr>{columns.map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead>
        <tbody>{visible.map((row, i) => <tr key={i}>{columns.map(c => <td key={c}>{row[c] === null || row[c] === undefined ? '—' : String(row[c])}</td>)}</tr>)}</tbody></table>
    </div>
    {rows.length === 0 && <p>{zh ? '查询成功，当前条件下没有数据。' : 'The query succeeded with no matching rows.'}</p>}
    {rows.length > 50 && <div className="dsh-antv-ava-actions"><button disabled={effectivePage === 0} onClick={() => setPage(effectivePage - 1)}>{zh ? '上一页' : 'Previous'}</button><span>{effectivePage + 1} / {Math.ceil(rows.length / 50)}</span><button disabled={(effectivePage + 1) * 50 >= rows.length} onClick={() => setPage(effectivePage + 1)}>{zh ? '下一页' : 'Next'}</button></div>}
    <button onClick={() => {
      const blob = new Blob([csvText(columns, rows)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'ava-result.csv'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }}>{zh ? '下载当前结果 CSV' : 'Download current result CSV'}</button>
  </div>
}
export function EvidenceView({ result, trusted, language }: { result: ResultSnapshot; trusted: boolean; language: string }): ReactElement {
  const zh = language === 'zh-CN'
  return <details className="dsh-antv-ava-evidence"><summary>{zh ? '数据来源与计算口径' : 'Source and calculation'}</summary>
    <dl><dt>{zh ? '来源' : 'Source'}</dt><dd>{result.evidence.source}</dd>
      <dt>{zh ? '依据' : 'Evidence'}</dt><dd>{trusted ? (zh ? '宿主保存的执行结果' : 'Host-stored execution result') : (zh ? '回答提供的快照，执行来源未验证' : 'Supplied snapshot; execution source unverified')}</dd>
      <dt>{zh ? '时间' : 'Time'}</dt><dd>{result.executedAt}</dd>
      <dt>{zh ? '范围' : 'Scope'}</dt><dd>{result.evidence.scope ?? (zh ? '以查询条件为准' : 'Defined by the query')} · {result.returnedRows} {zh ? '行' : 'rows'}</dd>
      {result.evidence.semantics && <><dt>{zh ? '口径' : 'Semantics'}</dt><dd>{result.evidence.semantics}</dd></>}
    </dl>
    <details><summary>{zh ? '查看查询详情' : 'Query details'}</summary><pre>{result.evidence.query}</pre></details>
  </details>
}
