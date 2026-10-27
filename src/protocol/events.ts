import type { AnswerDocument, Phrase } from './types.ts'
import { validateAnswer } from './answer.ts'
export type AnswerEvent = { runId: string; seq: number; documentId: string; revision: number } & (
  | { type: 'phase'; phase: 'queued' | 'loading' | 'computing' | 'presenting' }
  | { type: 'snapshot'; document: AnswerDocument }
  | { type: 'paragraph.replace'; blockId: string; phrases: Phrase[] }
  | { type: 'complete' }
  | { type: 'cancelled' }
  | { type: 'error'; message: string }
)
export interface AnswerStreamState {
  runId: string
  documentId: string
  seq: number
  revision: number
  status: 'receiving' | 'completed' | 'failed' | 'cancelled'
  needsSnapshot: boolean
  document?: AnswerDocument
  phase?: string
  error?: string
}
export function startAnswerStream(runId: string, documentId: string): AnswerStreamState {
  return { runId, documentId, seq: 0, revision: -1, status: 'receiving', needsSnapshot: false }
}
export function reduceAnswerEvent(state: AnswerStreamState, event: AnswerEvent): AnswerStreamState {
  if (state.status !== 'receiving' || event.runId !== state.runId || event.documentId !== state.documentId || event.seq <= state.seq) return state
  if (!Number.isSafeInteger(event.seq) || !Number.isSafeInteger(event.revision) || event.revision < 0 || event.revision < state.revision) return { ...state, needsSnapshot: true }
  if ((state.needsSnapshot || event.seq !== state.seq + 1) && event.type !== 'snapshot') return { ...state, needsSnapshot: true }
  const next = { ...state, seq: event.seq, revision: event.revision }
  if (event.type === 'snapshot') {
    let document: AnswerDocument
    try { document = validateAnswer(event.document) } catch { return { ...state, needsSnapshot: true } }
    if (document.id !== state.documentId || document.revision !== event.revision) return { ...state, needsSnapshot: true }
    return { ...next, document, needsSnapshot: false }
  }
  if (event.type === 'phase') return { ...next, phase: event.phase }
  if (event.type === 'error') return { ...next, status: 'failed', error: event.message }
  if (event.type === 'cancelled') return { ...next, status: 'cancelled' }
  if (event.type === 'complete') return state.document ? { ...next, status: 'completed' } : { ...state, needsSnapshot: true }
  if (!state.document || event.revision <= state.revision || !state.document.blocks.some(b => b.id === event.blockId && b.kind === 'paragraph')) return { ...state, needsSnapshot: true }
  let document: AnswerDocument
  try { document = validateAnswer({ ...state.document, revision: event.revision, blocks: state.document.blocks.map(b => b.id === event.blockId ? { ...b, phrases: event.phrases } : b) }) } catch { return { ...state, needsSnapshot: true } }
  return { ...next, document }
}
