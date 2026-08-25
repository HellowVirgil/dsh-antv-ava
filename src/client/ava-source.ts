export const MAX_AVA_SOURCE_LENGTH = 120_000
export const MAX_AVA_FIELDS = 12
export const MAX_AVA_ROWS = 500

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
  title: string
  description?: string | undefined
  purpose?: AvaPurpose | undefined
  language: AvaLanguage
  fields: AvaField[]
  data: Array<Record<string, string | number>>
}

export type AvaParseResult =
  | { ok: true; value: AvaDocument }
  | { ok: false; reason?: string | undefined }

const FIELD_ID = /^[A-Za-z][A-Za-z0-9_.-]*$/
const PURPOSES: AvaPurpose[] = ['Comparison', 'Trend', 'Distribution', 'Rank', 'Proportion', 'Composition']
const TYPES: AvaFieldType[] = ['categorical', 'quantitative', 'temporal']
const ROLES: AvaFieldRole[] = ['dimension', 'measure']

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

/** Parse the model-authored, line-based AVA DSL without evaluating code or markup. */
export function parseAvaSource(source: string, settled = false): AvaParseResult {
  if (source.length > MAX_AVA_SOURCE_LENGTH) {
    return { ok: false, reason: `内容超过 ${MAX_AVA_SOURCE_LENGTH.toLocaleString()} 字符限制` }
  }
  for (const [pattern, reason] of DANGEROUS_PATTERNS) {
    if (pattern.test(source)) return { ok: false, reason }
  }
  for (const pattern of PRIVATE_URL_PATTERNS) {
    if (pattern.test(source)) return { ok: false, reason: '不允许访问 localhost 或私有网络资源' }
  }

  let lines = source.replaceAll('\r\n', '\n').split('\n')
  if (!settled && !source.endsWith('\n')) lines = lines.slice(0, -1)
  while (lines.length > 0 && lines.at(-1)?.trim() === '') lines.pop()
  if (lines.length === 0) return fail('围栏内容为空', settled)
  if (lines[0]?.trim().toLowerCase() !== 'ava') return fail('第一行必须是 ava', settled)

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

  return {
    ok: true,
    value: {
      title,
      ...(description === undefined ? {} : { description }),
      ...(purpose === undefined ? {} : { purpose }),
      language: language ?? inferLanguage(`${title}${description ?? ''}`),
      fields,
      data,
    },
  }
}
