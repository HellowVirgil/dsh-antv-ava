export const MAX_DOCUMENT_BYTES = 1_048_576
export const MAX_RESULT_ROWS = 500
export const MAX_COLUMNS = 32
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor'])
export function record(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null
}
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
export function string(value: unknown, name: string, max = 4000): asserts value is string {
  invariant(typeof value === 'string' && value.length > 0 && value.length <= max, `Invalid ${name}`)
}
export function safeJson(value: unknown, depth = 0): void {
  invariant(depth <= 16, 'JSON nesting exceeds 16 levels')
  if (value === null || typeof value === 'boolean') return
  if (typeof value === 'number') { invariant(Number.isFinite(value), 'Non-finite number'); return }
  if (typeof value === 'string') { invariant(value.length <= 120_000, 'String too long'); return }
  if (Array.isArray(value)) { invariant(value.length <= 4000, 'Array too large'); value.forEach(item => safeJson(item, depth + 1)); return }
  invariant(record(value), 'Only plain JSON values are supported')
  invariant(Object.keys(value).length <= 100, 'Object has too many keys')
  for (const [key, item] of Object.entries(value)) {
    invariant(!FORBIDDEN.has(key), 'Unsafe object key')
    safeJson(item, depth + 1)
  }
}
export function keys(value: Record<string, unknown>, allowed: readonly string[]): void {
  invariant(Object.keys(value).every(key => allowed.includes(key)), 'Unsupported configuration property')
}
export function boundedJson(text: string): unknown {
  invariant(new TextEncoder().encode(text).length <= MAX_DOCUMENT_BYTES, 'Document exceeds 1 MiB')
  const value: unknown = JSON.parse(text)
  safeJson(value)
  return value
}
