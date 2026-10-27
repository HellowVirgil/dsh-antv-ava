import type {
  BulletItemSpec,
  EntityMetaData,
  EntityType,
  BulletsParagraphSpec,
  HeadingParagraphSpec,
  NarrativeTextSpec,
  ParagraphSpec,
  PhraseSpec,
  StandardSectionSpec,
  TextParagraphSpec,
} from '../protocol/narrative.ts'
import { boundedJson, invariant, record, MAX_DOCUMENT_BYTES } from '../protocol/guards.ts'
import { validateAnswer } from '../protocol/answer.ts'
import { validateChartConfig } from '../protocol/chart.ts'
import type { AnswerReference, StructuredAnswer, JsonChartDocument, ChartType } from '../protocol/types.ts'

export const MAX_AVA_SOURCE_LENGTH = 120_000
export const MAX_AVA_FIELDS = 12
export const MAX_AVA_ROWS = 500
export const MAX_AVA_NTV_PARAGRAPHS = 120
export const MAX_AVA_NTV_PHRASES = 1_000

export type AvaFieldType = 'categorical' | 'quantitative' | 'temporal'
export type AvaFieldRole = 'dimension' | 'measure'
export type AvaPurpose = 'Comparison' | 'Trend' | 'Distribution' | 'Rank' | 'Proportion' | 'Composition'
export type AvaLanguage = 'zh-CN' | 'en-US'

export interface AvaField {
  id: string
  label: string
  type: AvaFieldType
  role: AvaFieldRole
}

export interface AvaDocument {
  mode: 'chart'
  chartType: GptVisChartType
  syntax: string
  title?: string | undefined
  description?: string | undefined
  language: AvaLanguage
}

export interface AvaNtvDocument {
  mode: 'ntv'
  language: AvaLanguage
  spec: NarrativeTextSpec
}

export interface AvaCombinedDocument {
  mode: 'combined'
  narrative: AvaNtvDocument
  chart: AvaDocument
}

export type AvaRenderableDocument = AvaDocument | AvaNtvDocument | AvaCombinedDocument | AnswerReference | StructuredAnswer | JsonChartDocument

export type AvaParseResult =
  | { ok: true; value: AvaRenderableDocument }
  | { ok: false; reason?: string | undefined }

const FIELD_ID = /^[A-Za-z][A-Za-z0-9_.-]*$/
const PURPOSES: AvaPurpose[] = ['Comparison', 'Trend', 'Distribution', 'Rank', 'Proportion', 'Composition']
const TYPES: AvaFieldType[] = ['categorical', 'quantitative', 'temporal']
const ROLES: AvaFieldRole[] = ['dimension', 'measure']
const GPT_VIS_CHART_TYPES = [
  'area',
  'bar',
  'boxplot',
  'column',
  'dual-axes',
  'fishbone-diagram',
  'flow-diagram',
  'funnel',
  'histogram',
  'indented-tree',
  'line',
  'liquid',
  'mindmap',
  'network-graph',
  'organization-chart',
  'pie',
  'radar',
  'sankey',
  'scatter',
  'table',
  'treemap',
  'venn',
  'violin',
  'waterfall',
  'word-cloud',
] as const

export type GptVisChartType = typeof GPT_VIS_CHART_TYPES[number]

const GPT_VIS_CHART_TYPE_SET = new Set<string>(GPT_VIS_CHART_TYPES)

const PRIVATE_URL_PATTERNS = [
  /https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)(?=[:/\s]|$)/i,
  /https?:\/\/10(?:\.\d{1,3}){3}(?=[:/\s]|$)/i,
  /https?:\/\/192\.168(?:\.\d{1,3}){2}(?=[:/\s]|$)/i,
  /https?:\/\/172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}(?=[:/\s]|$)/i,
  /https?:\/\/169\.254(?:\.\d{1,3}){2}(?=[:/\s]|$)/i,
  /https?:\/\/\[?::1\]?(?=[:/\s]|$)/i,
]

const DANGEROUS_PATTERNS: Array<[RegExp, string]> = [
  [/<\s*(?:script|iframe|object|embed|foreignobject|svg|symbol)\b/i, '不允许嵌入可执行 HTML/SVG'],
  [/\bjavascript\s*:/i, '不允许 javascript URL'],
  [/\bdata\s*:\s*text\/(?:html|javascript)/i, '不允许可执行 data URL'],
  [/\bfile\s*:/i, '不允许 file URL'],
  [/\b(?:onload|onclick|onerror|onmouseover|onfocus)\s*=/i, '不允许事件处理属性'],
]

interface MutableField {
  id: string
  label?: string
  type?: AvaFieldType
  role?: AvaFieldRole
}

function fail(reason: string | undefined, settled: boolean): AvaParseResult {
  return { ok: false, reason: settled ? reason : undefined }
}

function metadataValue(line: string, key: string): string | undefined {
  const prefix = `${key} `
  return line.startsWith(prefix) ? line.slice(prefix.length).trim() : undefined
}

function inferLanguage(text: string): AvaLanguage {
  return /[\u3400-\u9fff]/u.test(text) ? 'zh-CN' : 'en-US'
}

function parseNumber(value: string): number | undefined {
  const normalized = value.replaceAll(',', '').replace(/%$/, '')
  if (normalized.trim() === '') return undefined
  const number = Number(normalized)
  return Number.isFinite(number) ? number : undefined
}

function safeSource(source: string): AvaParseResult | undefined {
  if (source.length > MAX_AVA_SOURCE_LENGTH) {
    return { ok: false, reason: `内容超过 ${MAX_AVA_SOURCE_LENGTH.toLocaleString()} 字符限制` }
  }
  for (const [pattern, reason] of DANGEROUS_PATTERNS) {
    if (pattern.test(source)) return { ok: false, reason }
  }
  for (const pattern of PRIVATE_URL_PATTERNS) {
    if (pattern.test(source)) return { ok: false, reason: '不允许访问 localhost 或私有网络资源' }
  }
  return undefined
}

function completeLines(source: string, settled: boolean): string[] {
  let lines = source.replaceAll('\r\n', '\n').split('\n')
  if (!settled && !source.endsWith('\n')) lines = lines.slice(0, -1)
  while (lines.length > 0 && lines.at(-1)?.trim() === '') lines.pop()
  return lines
}

const ENTITY_COMMANDS: Record<string, EntityType> = {
  'metric-name': 'metric_name',
  'metric-value': 'metric_value',
  'other-value': 'other_metric_value',
  contribution: 'contribute_ratio',
  dimension: 'dim_value',
  time: 'time_desc',
  proportion: 'proportion',
  trend: 'trend_desc',
}

function entityPhrase(entityType: EntityType, value: string, metadata?: Partial<EntityMetaData>): PhraseSpec {
  return {
    type: 'entity',
    value,
    metadata: { entityType, ...metadata },
  }
}

function isTextParagraph(paragraph: ParagraphSpec): paragraph is TextParagraphSpec {
  return paragraph.type === 'normal'
}

function isBulletsParagraph(paragraph: ParagraphSpec): paragraph is BulletsParagraphSpec {
  return paragraph.type === 'bullets'
}

function isHeadingParagraph(paragraph: ParagraphSpec): paragraph is HeadingParagraphSpec {
  return typeof paragraph.type === 'string' && /^heading[1-6]$/.test(paragraph.type)
}

function proportionOrigin(value: string): number | undefined {
  const parsed = parseNumber(value)
  if (parsed === undefined) return undefined
  return value.trim().endsWith('%') ? parsed / 100 : parsed
}

function phraseFromLine(line: string): PhraseSpec | undefined {
  const body = line.slice(2)
  const separator = body.indexOf(' ')
  const command = separator < 0 ? body : body.slice(0, separator)
  const value = separator < 0 ? '' : body.slice(separator + 1)
  if (value.trim() === '') return undefined
  if (command === 'text') return { type: 'text', value }
  if (command === 'strong') return { type: 'text', value, bold: true }
  if (command === 'delta' || command === 'ratio') {
    const assessmentEnd = value.indexOf(' ')
    if (assessmentEnd < 0) return undefined
    const assessment = value.slice(0, assessmentEnd)
    if (assessment !== 'positive' && assessment !== 'negative' && assessment !== 'equal') return undefined
    const displayValue = value.slice(assessmentEnd + 1)
    if (displayValue.trim() === '') return undefined
    return entityPhrase(command === 'delta' ? 'delta_value' : 'ratio_value', displayValue, { assessment })
  }
  const entityType = ENTITY_COMMANDS[command]
  if (entityType === undefined) return undefined
  const origin = entityType === 'proportion' ? proportionOrigin(value) : undefined
  return entityPhrase(entityType, value, origin === undefined ? undefined : { origin })
}

function parseAvaNtvSource(source: string, settled: boolean): AvaParseResult {
  const lines = completeLines(source, settled)
  if (lines.length === 0) return fail('围栏内容为空', settled)
  if (lines[0]?.trim().toLowerCase() !== 'ava ntv') return fail('NTV 第一行必须是 ava ntv', settled)

  let language: AvaLanguage | undefined
  let headline: NarrativeTextSpec['headline']
  const sections: StandardSectionSpec[] = [{ paragraphs: [] }]
  let currentSection = sections[0] as StandardSectionSpec
  let currentPhrases: PhraseSpec[] | undefined
  let phraseCount = 0
  let paragraphCount = 0

  const appendParagraph = (paragraph: ParagraphSpec): boolean => {
    paragraphCount += 1
    if (paragraphCount > MAX_AVA_NTV_PARAGRAPHS) return false
    currentSection.paragraphs?.push(paragraph)
    return true
  }

  for (const line of lines.slice(1)) {
    if (line.trim() === '') continue
    if (!line.startsWith(' ')) {
      currentPhrases = undefined
      const nextLanguage = metadataValue(line, 'language')
      if (nextLanguage !== undefined) {
        if (nextLanguage !== 'zh-CN' && nextLanguage !== 'en-US') return fail(`不支持的语言：${nextLanguage}`, settled)
        language = nextLanguage
        continue
      }
      const nextHeadline = metadataValue(line, 'headline')
      if (nextHeadline !== undefined) {
        if (nextHeadline === '') return fail('headline 不能为空', settled)
        headline = { type: 'headline', phrases: [{ type: 'text', value: nextHeadline, bold: true }] }
        continue
      }
      if (line === 'section') {
        if ((currentSection.paragraphs?.length ?? 0) > 0) {
          currentSection = { paragraphs: [] }
          sections.push(currentSection)
        }
        continue
      }
      const heading = line.match(/^heading ([1-6]) (.+)$/)
      if (heading !== null) {
        const phrases: PhraseSpec[] = [{ type: 'text', value: heading[2] ?? '', bold: true }]
        if (!appendParagraph({ type: `heading${heading[1]}` as `heading${1 | 2 | 3 | 4 | 5 | 6}`, phrases })) {
          return { ok: false, reason: `NTV 段落数量不能超过 ${MAX_AVA_NTV_PARAGRAPHS}` }
        }
        continue
      }
      if (line === 'divider') {
        if (!appendParagraph({ type: 'divider' })) {
          return { ok: false, reason: `NTV 段落数量不能超过 ${MAX_AVA_NTV_PARAGRAPHS}` }
        }
        continue
      }
      if (line === 'paragraph') {
        const paragraph: ParagraphSpec = { type: 'normal', phrases: [] }
        if (!appendParagraph(paragraph)) return { ok: false, reason: `NTV 段落数量不能超过 ${MAX_AVA_NTV_PARAGRAPHS}` }
        currentPhrases = paragraph.phrases
        continue
      }
      if (line === 'bullet') {
        const paragraphs = currentSection.paragraphs ?? []
        let bullets = paragraphs.at(-1)
        if (bullets === undefined || !isBulletsParagraph(bullets)) {
          bullets = { type: 'bullets', isOrder: false, bullets: [] }
          if (!appendParagraph(bullets)) return { ok: false, reason: `NTV 段落数量不能超过 ${MAX_AVA_NTV_PARAGRAPHS}` }
        }
        if (!isBulletsParagraph(bullets)) return fail('NTV bullet 结构无效', settled)
        const item: BulletItemSpec = { type: 'bullet-item', phrases: [] }
        bullets.bullets.push(item)
        currentPhrases = item.phrases
        continue
      }
      return fail(`无法识别的 NTV 语句：${line}`, settled)
    }

    if (!line.startsWith('  ') || line.startsWith('   ') || currentPhrases === undefined) {
      return fail(`NTV 短语必须使用两个空格缩进并位于 paragraph 或 bullet 中：${line.trim()}`, settled)
    }
    const phrase = phraseFromLine(line)
    if (phrase === undefined) return fail(`无法识别的 NTV 短语：${line.trim()}`, settled)
    phraseCount += 1
    if (phraseCount > MAX_AVA_NTV_PHRASES) return { ok: false, reason: `NTV 短语数量不能超过 ${MAX_AVA_NTV_PHRASES}` }
    currentPhrases.push(phrase)
  }

  for (const section of sections) {
    section.paragraphs = (section.paragraphs ?? []).filter(paragraph => {
      if (isTextParagraph(paragraph)) return paragraph.phrases.length > 0
      if (isBulletsParagraph(paragraph)) {
        paragraph.bullets = paragraph.bullets.filter(item => item.phrases.length > 0)
        return paragraph.bullets.length > 0
      }
      if (isHeadingParagraph(paragraph)) return paragraph.phrases.length > 0
      return true
    })
  }
  const completeSections = sections.filter(section => (section.paragraphs?.length ?? 0) > 0)
  if (headline === undefined && completeSections.length === 0) return fail('NTV 至少需要一个完整短语', settled)
  const inferredText = lines.slice(1).join('')
  return {
    ok: true,
    value: {
      mode: 'ntv',
      language: language ?? inferLanguage(inferredText),
      spec: {
        ...(headline === undefined ? {} : { headline }),
        ...(completeSections.length === 0 ? {} : { sections: completeSections }),
      },
    },
  }
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed.at(-1)
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

function gptVisMetadataValue(line: string, key: string): string | undefined {
  const match = line.match(new RegExp(`^${key}(?::\\s*|\\s+)(.*)$`, 'i'))
  return match === null ? undefined : unquote(match[1] ?? '')
}

function gptVisRows(lines: string[]): Array<Record<string, string>> {
  const dataIndex = lines.findIndex(line => line === 'data')
  if (dataIndex < 0) return []
  const rows: Array<Record<string, string>> = []
  let current: Record<string, string> | undefined
  for (const line of lines.slice(dataIndex + 1)) {
    if (line.trim() === '') continue
    if (!line.startsWith(' ')) break
    const start = line.match(/^ {2}- ([A-Za-z][A-Za-z0-9_-]*)(?:\s+(.+))?$/)
    if (start !== null) {
      current = { [start[1] ?? '']: unquote(start[2] ?? '') }
      rows.push(current)
      continue
    }
    const property = line.match(/^ {4}([A-Za-z][A-Za-z0-9_-]*)\s+(.+)$/)
    if (property !== null && current !== undefined) current[property[1] ?? ''] = unquote(property[2] ?? '')
  }
  return rows
}

function hasCanonicalGptVisData(chartType: GptVisChartType, lines: string[], strict: boolean): boolean {
  if (chartType === 'liquid') {
    const percent = lines.map(line => gptVisMetadataValue(line, 'percent')).find(value => value !== undefined)
    const number = percent === undefined ? undefined : parseNumber(percent)
    return number !== undefined && number >= 0 && number <= 1
  }
  if (chartType === 'histogram') {
    const dataIndex = lines.findIndex(line => line === 'data')
    return dataIndex >= 0 && lines.slice(dataIndex + 1).some(line => /^ {2}-\s+-?(?:\d+\.?\d*|\.\d+)$/.test(line))
  }
  if (chartType === 'dual-axes') {
    return lines.includes('categories')
      && lines.includes('series')
      && lines.some(line => /^ {2}-\s+\S/.test(line))
      && lines.some(line => /^ {6}-\s+-?(?:\d+\.?\d*|\.\d+)$/.test(line))
  }
  if (['flow-diagram', 'fishbone-diagram', 'indented-tree', 'mindmap', 'network-graph', 'organization-chart'].includes(chartType)) {
    return lines.some(line => /^\s{2,}(?:-\s+)?\S+(?:\s+\S.*)?$/.test(line))
  }

  const required: Partial<Record<GptVisChartType, string[]>> = {
    line: ['time', 'value'],
    area: ['time', 'value'],
    column: ['category', 'value'],
    bar: ['category', 'value'],
    pie: ['category', 'value'],
    funnel: ['category', 'value'],
    boxplot: ['category', 'value'],
    violin: ['category', 'value'],
    waterfall: ['category'],
    scatter: ['x', 'y'],
    radar: ['name', 'value'],
    treemap: ['name', 'value'],
    sankey: ['source', 'target', 'value'],
    venn: ['sets', 'value'],
    'word-cloud': ['text', 'value'],
  }
  const fields = required[chartType]
  const rows = gptVisRows(lines)
  if (chartType === 'table') return lines.some(line => /^ {2}-\s+\S/.test(line))
  if (chartType === 'waterfall') {
    return rows.some(row => row.category !== undefined && (parseNumber(row.value ?? '') !== undefined || row.isTotal === 'true'))
  }
  if (fields === undefined) return rows.length > 0
  const numericFields: Partial<Record<GptVisChartType, string[]>> = {
    line: ['value'],
    area: ['value'],
    column: ['value'],
    bar: ['value'],
    pie: ['value'],
    funnel: ['value'],
    boxplot: ['value'],
    violin: ['value'],
    scatter: ['x', 'y'],
    radar: ['value'],
    treemap: ['value'],
    sankey: ['value'],
    venn: ['value'],
    'word-cloud': ['value'],
  }
  const valid = (row: Record<string, string>): boolean => fields.every(field => row[field] !== undefined && row[field] !== '')
    && (numericFields[chartType] ?? []).every(field => parseNumber(row[field] ?? '') !== undefined)
  return strict ? rows.length > 0 && rows.every(valid) : rows.some(valid)
}

function parseGptVisChartSyntax(
  source: string,
  settled: boolean,
  inheritedLanguage?: AvaLanguage,
  sourceAlreadyComplete = false,
): AvaParseResult {
  const lines = completeLines(source, sourceAlreadyComplete ? true : settled)
  if (lines.length === 0) return fail('chart 区段为空', settled)
  const declaration = lines[0]?.trim().match(/^vis\s+([a-z][a-z0-9-]*)$/i)
  if (declaration === null || declaration === undefined) {
    return fail('chart 区段第一行必须是 vis <chart-type>', settled)
  }
  const chartType = declaration[1]?.toLowerCase() ?? ''
  if (!GPT_VIS_CHART_TYPE_SET.has(chartType)) return fail(`GPT-Vis 不支持图表类型：${chartType}`, settled)
  if (!hasCanonicalGptVisData(chartType as GptVisChartType, lines, settled)) {
    return fail(`GPT-Vis ${chartType} 图表尚未包含符合字段约定的可渲染数据`, settled)
  }

  const arrayItems = lines.filter(line => /^\s+-\s+\S/.test(line)).length
  if (arrayItems > MAX_AVA_ROWS) return { ok: false, reason: `GPT-Vis 数组项数量不能超过 ${MAX_AVA_ROWS}` }

  const title = lines
    .filter(line => !line.startsWith(' '))
    .map(line => gptVisMetadataValue(line, 'title'))
    .find((value): value is string => value !== undefined && value !== '')
  const syntax = lines.join('\n')
  return {
    ok: true,
    value: {
      mode: 'chart',
      chartType: chartType as GptVisChartType,
      syntax,
      ...(title === undefined ? {} : { title }),
      language: inheritedLanguage ?? inferLanguage(syntax),
    },
  }
}

function quoteGptVisValue(value: string): string {
  if (!/\s/.test(value) && !/^["']|["']$/.test(value)) return value
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

function legacyChartType(purpose: AvaPurpose | undefined): GptVisChartType {
  if (purpose === 'Trend') return 'line'
  if (purpose === 'Proportion' || purpose === 'Composition') return 'pie'
  if (purpose === 'Distribution') return 'column'
  if (purpose === 'Rank') return 'bar'
  return 'column'
}

function legacyChartSyntax(
  title: string,
  purpose: AvaPurpose | undefined,
  fields: AvaField[],
  data: Array<Record<string, string | number>>,
): { chartType: GptVisChartType; syntax: string } {
  const chartType = legacyChartType(purpose)
  const lines = [`vis ${chartType}`, 'data']
  const dimension = fields.find(field => field.role === 'dimension') as AvaField
  const measure = fields.find(field => field.role === 'measure') as AvaField
  const categoryKey = chartType === 'line' ? 'time' : 'category'
  for (const row of data) {
    const category = row[dimension.id]
    const value = row[measure.id]
    const renderedCategory = typeof category === 'number' ? String(category) : quoteGptVisValue(category ?? '')
    const renderedValue = typeof value === 'number' ? String(value) : quoteGptVisValue(value ?? '')
    lines.push(`  - ${categoryKey} ${renderedCategory}`, `    value ${renderedValue}`)
  }
  lines.push(`title ${quoteGptVisValue(title)}`)
  lines.push(`axisXTitle ${quoteGptVisValue(dimension.label)}`)
  lines.push(`axisYTitle ${quoteGptVisValue(measure.label)}`)
  return { chartType, syntax: lines.join('\n') }
}

/** Parse the model-authored, line-based AVA DSL without evaluating code or markup. */
function parseAvaChartSource(source: string, settled: boolean): AvaParseResult {
  const lines = completeLines(source, settled)
  if (lines.length === 0) return fail('围栏内容为空', settled)
  const header = lines[0]?.trim().toLowerCase()
  if (header !== 'ava' && header !== 'ava chart') return fail('图表第一行必须是 ava chart', settled)

  let title = ''
  let description: string | undefined
  let purpose: AvaPurpose | undefined
  let language: AvaLanguage | undefined
  let section: 'root' | 'fields' | 'data' = 'root'
  const mutableFields: MutableField[] = []
  const rawRows: Array<Record<string, string>> = []
  let currentField: MutableField | undefined
  let currentRow: Record<string, string> | undefined

  for (const line of lines.slice(1)) {
    if (line.trim() === '') continue
    if (line === 'fields') {
      section = 'fields'
      currentField = undefined
      continue
    }
    if (line === 'data') {
      section = 'data'
      currentRow = undefined
      continue
    }
    if (!line.startsWith(' ')) {
      section = 'root'
      const nextTitle = metadataValue(line, 'title')
      if (nextTitle !== undefined) {
        title = nextTitle
        continue
      }
      const nextDescription = metadataValue(line, 'description')
      if (nextDescription !== undefined) {
        description = nextDescription
        continue
      }
      const nextPurpose = metadataValue(line, 'purpose')
      if (nextPurpose !== undefined) {
        purpose = PURPOSES.find(item => item.toLowerCase() === nextPurpose.toLowerCase())
        if (purpose === undefined) return fail(`不支持的分析目的：${nextPurpose}`, settled)
        continue
      }
      const nextLanguage = metadataValue(line, 'language')
      if (nextLanguage !== undefined) {
        if (nextLanguage !== 'zh-CN' && nextLanguage !== 'en-US') return fail(`不支持的语言：${nextLanguage}`, settled)
        language = nextLanguage
        continue
      }
      return fail(`无法识别的顶层语句：${line}`, settled)
    }

    if (section === 'fields') {
      const start = line.match(/^ {2}- id ([A-Za-z][A-Za-z0-9_.-]*)\s*$/)
      if (start !== null) {
        currentField = { id: start[1] ?? '' }
        mutableFields.push(currentField)
        continue
      }
      const property = line.match(/^ {4}(label|type|role) (.+?)\s*$/)
      if (property === null || currentField === undefined) return fail(`字段定义格式错误：${line.trim()}`, settled)
      const [, key, rawValue] = property
      const value = rawValue?.trim() ?? ''
      if (key === 'label') currentField.label = value
      if (key === 'type') {
        const type = TYPES.find(item => item === value.toLowerCase())
        if (type === undefined) return fail(`不支持的字段类型：${value}`, settled)
        currentField.type = type
      }
      if (key === 'role') {
        const role = ROLES.find(item => item === value.toLowerCase())
        if (role === undefined) return fail(`不支持的字段角色：${value}`, settled)
        currentField.role = role
      }
      continue
    }

    if (section === 'data') {
      const start = line.match(/^ {2}- ([A-Za-z][A-Za-z0-9_.-]*) (.+?)\s*$/)
      if (start !== null) {
        currentRow = { [start[1] ?? '']: start[2]?.trim() ?? '' }
        rawRows.push(currentRow)
        continue
      }
      const property = line.match(/^ {4}([A-Za-z][A-Za-z0-9_.-]*) (.+?)\s*$/)
      if (property === null || currentRow === undefined) return fail(`数据行格式错误：${line.trim()}`, settled)
      currentRow[property[1] ?? ''] = property[2]?.trim() ?? ''
      continue
    }

    return fail(`缩进语句必须位于 fields 或 data 中：${line.trim()}`, settled)
  }

  if (title === '') return fail('缺少 title', settled)
  if (mutableFields.length < 2) return fail('至少需要两个字段', settled)
  if (mutableFields.length > MAX_AVA_FIELDS) return { ok: false, reason: `字段数量不能超过 ${MAX_AVA_FIELDS}` }

  const fields: AvaField[] = []
  const ids = new Set<string>()
  for (const field of mutableFields) {
    if (!FIELD_ID.test(field.id)) return fail(`字段 id 无效：${field.id}`, settled)
    if (ids.has(field.id)) return { ok: false, reason: `字段 id 重复：${field.id}` }
    ids.add(field.id)
    if (field.label === undefined || field.type === undefined || field.role === undefined) {
      return fail(`字段 ${field.id} 缺少 label、type 或 role`, settled)
    }
    fields.push({ id: field.id, label: field.label, type: field.type, role: field.role })
  }
  if (!fields.some(field => field.role === 'dimension')) return fail('至少需要一个 dimension 字段', settled)
  if (!fields.some(field => field.role === 'measure')) return fail('至少需要一个 measure 字段', settled)

  const data: Array<Record<string, string | number>> = []
  for (const rawRow of rawRows.slice(0, MAX_AVA_ROWS)) {
    const missing = fields.find(field => rawRow[field.id] === undefined)
    if (missing !== undefined) {
      if (settled) return { ok: false, reason: `数据行缺少字段：${missing.id}` }
      continue
    }
    const row: Record<string, string | number> = {}
    let valid = true
    for (const field of fields) {
      const rawValue = rawRow[field.id] ?? ''
      if (field.type === 'quantitative') {
        const number = parseNumber(rawValue)
        if (number === undefined) {
          valid = false
          if (settled) return { ok: false, reason: `字段 ${field.id} 必须是数值：${rawValue}` }
          break
        }
        row[field.id] = number
      } else {
        row[field.id] = rawValue
      }
    }
    if (valid) data.push(row)
  }
  if (rawRows.length > MAX_AVA_ROWS) return { ok: false, reason: `数据行数不能超过 ${MAX_AVA_ROWS}` }
  if (data.length === 0) return fail('至少需要一行完整数据', settled)

  const converted = legacyChartSyntax(title, purpose, fields, data)
  return {
    ok: true,
    value: {
      mode: 'chart',
      chartType: converted.chartType,
      syntax: converted.syntax,
      title,
      ...(description === undefined ? {} : { description }),
      language: language ?? inferLanguage(`${title}${description ?? ''}`),
    },
  }
}

type UnifiedSection = 'narrative' | 'chart'

function parseUnifiedAvaSource(source: string, settled: boolean): AvaParseResult {
  const lines = completeLines(source, settled)
  if (lines.length === 0) return fail('围栏内容为空', settled)
  if (lines[0]?.trim().toLowerCase() !== 'ava') return fail('统一 AVA 第一行必须是 ava', settled)

  let language: AvaLanguage | undefined
  let currentSection: UnifiedSection | undefined
  const seen = new Set<UnifiedSection>()
  const sectionLines: Record<UnifiedSection, string[]> = { narrative: [], chart: [] }

  for (const line of lines.slice(1)) {
    if (line.trim() === '') {
      if (currentSection !== undefined) sectionLines[currentSection].push('')
      continue
    }
    if (!line.startsWith(' ')) {
      const normalized = line.trim().toLowerCase()
      if (normalized === 'narrative' || normalized === 'chart') {
        if (seen.has(normalized)) return fail(`不能重复声明 ${normalized} 区段`, settled)
        currentSection = normalized
        seen.add(normalized)
        continue
      }
      const nextLanguage = metadataValue(line, 'language')
      if (nextLanguage !== undefined) {
        if (nextLanguage !== 'zh-CN' && nextLanguage !== 'en-US') return fail(`不支持的语言：${nextLanguage}`, settled)
        language = nextLanguage
        continue
      }
      return fail(`统一 AVA 只能包含 language、narrative 和 chart：${line}`, settled)
    }
    if (currentSection === undefined || !line.startsWith('  ')) {
      return fail(`统一 AVA 区段内容必须使用至少两个空格缩进：${line.trim()}`, settled)
    }
    sectionLines[currentSection].push(line.slice(2))
  }

  if (seen.size === 0) return fail('统一 AVA 至少需要 narrative 或 chart 区段', settled)

  const sectionSource = (header: 'ava ntv' | 'ava chart', section: UnifiedSection): string => {
    const inheritedLanguage = language === undefined ? [] : [`language ${language}`]
    return [header, ...inheritedLanguage, ...sectionLines[section]].join('\n')
  }
  const narrativeResult = seen.has('narrative')
    ? parseAvaNtvSource(sectionSource('ava ntv', 'narrative'), true)
    : undefined
  const chartResult = seen.has('chart')
    ? sectionLines.chart[0]?.trim().toLowerCase().startsWith('vis ')
      ? parseGptVisChartSyntax(sectionLines.chart.join('\n'), settled, language, true)
      : parseAvaChartSource(sectionSource('ava chart', 'chart'), true)
    : undefined

  if (settled && narrativeResult !== undefined && !narrativeResult.ok) {
    return fail(`narrative 区段无效：${narrativeResult.reason ?? '内容不完整'}`, true)
  }
  if (settled && chartResult !== undefined && !chartResult.ok) {
    return fail(`chart 区段无效：${chartResult.reason ?? '内容不完整'}`, true)
  }

  const narrative = narrativeResult?.ok && narrativeResult.value.mode === 'ntv'
    ? narrativeResult.value
    : undefined
  const chart = chartResult?.ok && chartResult.value.mode === 'chart'
    ? chartResult.value
    : undefined

  if (narrative !== undefined && chart !== undefined) {
    return { ok: true, value: { mode: 'combined', narrative, chart } }
  }
  if (narrative !== undefined) return { ok: true, value: narrative }
  if (chart !== undefined) return { ok: true, value: chart }
  return fail('narrative 或 chart 区段尚未形成可渲染内容', settled)
}

/** Parse the model-authored, line-based AVA DSL without evaluating code or markup. */
export function parseAvaSource(source: string, settled = false): AvaParseResult {
  if (source.length > MAX_DOCUMENT_BYTES) return fail('Document is too large', settled)
  const reference = source.trim().match(/^ava result ([a-f0-9]{64})$/)
  if (reference && (settled || source.endsWith('\n'))) return { ok: true, value: { mode: 'reference', id: reference[1]! } }
  if (/^ava (?:json|answer)\r?\n/.test(source)) {
    try {
      const header = source.slice(0, source.indexOf('\n')).trim()
      const value = boundedJson(source.slice(source.indexOf('\n') + 1))
      if (header === 'ava answer') return { ok: true, value: { mode: 'answer', document: validateAnswer(value) } }
      const config = validateChartConfig(record(value) && Object.hasOwn(value, 'config') ? value.config : value)
      if (record(value) && Object.hasOwn(value, 'config')) invariant(value.chartType === config.type, 'Chart type mismatch')
      return { ok: true, value: { mode: 'json-chart', chartType: config.type as ChartType, config, language: inferLanguage(source) } }
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'Invalid JSON document', settled)
    }
  }
  const unsafe = safeSource(source)
  if (unsafe !== undefined) return unsafe
  const lines = completeLines(source, settled)
  const firstLine = lines[0]?.trim().toLowerCase()
  if (firstLine === 'ava ntv') return parseAvaNtvSource(source, settled)
  if (firstLine === 'ava' && lines.slice(1).some(line => line === 'narrative' || line === 'chart')) {
    return parseUnifiedAvaSource(source, settled)
  }
  return parseAvaChartSource(source, settled)
}
