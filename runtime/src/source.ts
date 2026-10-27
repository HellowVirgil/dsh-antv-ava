import { basename, isAbsolute, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { invariant, record, string } from 'dsh-antv-ava/protocol'
import type { AnalysisRuntime, FileAccess, FileReference } from './service.js'

/** Minimal public host contracts: file attachments are optional on older DSH builds. */
interface SessionSource {
  header: { id: string; cwd?: string }
  deriveMessages(): readonly unknown[]
}
interface AttachmentReader {
  readonly root?: string
  fileHostPath(ref: FileReference): string | undefined
  readFileStream(ref: FileReference, signal?: AbortSignal): AsyncIterable<Uint8Array>
}
interface SessionReader {
  observeSession(id: string, options: { signal: AbortSignal; projectionMode: 'none' }): Promise<{
    header: { id: string }
    events: readonly unknown[]
    [Symbol.dispose](): void
  }>
}

function fileReferences(messages: readonly unknown[]): FileReference[] {
  const references = new Map<string, FileReference>()
  for (const message of messages) {
    if (!record(message) || message.role !== 'user' || !record(message.source) || message.source.kind !== 'user' || !Array.isArray(message.content)) continue
    for (const block of message.content) {
      if (!record(block) || block.type !== 'file' || !record(block.attachment)) continue
      const ref = block.attachment
      invariant(typeof ref.attachmentId === 'string' && /^sha256:[a-f0-9]{64}$/.test(ref.attachmentId), 'Invalid session attachment reference')
      invariant(typeof ref.name === 'string' && ref.name.length > 0 && ref.name.length <= 255 && !/[\\/\0]/.test(ref.name) && ref.name !== '.' && ref.name !== '..', 'Invalid session attachment name')
      invariant(Number.isSafeInteger(ref.bytes) && (ref.bytes as number) >= 0, 'Invalid session attachment size')
      references.set(ref.attachmentId + '/' + ref.name, { attachmentId: ref.attachmentId, name: ref.name, bytes: ref.bytes as number })
    }
  }
  return [...references.values()]
}

async function sessionFiles(owner: string, session: SessionSource | undefined, context: Context | undefined, signal: AbortSignal): Promise<FileReference[]> {
  if (!session) return []
  const reader = context?.reflect.get('sessionQuery', false) as SessionReader | undefined
  if (typeof reader?.observeSession === 'function') {
    const observation = await reader.observeSession(owner, { signal, projectionMode: 'none' })
    try {
      invariant(observation.header.id === owner, 'Session observation identity mismatch')
      signal.throwIfAborted()
      return fileReferences(observation.events.flatMap(event => record(event) && event.type === 'user/message' ? [event.data] : []))
    } finally { observation[Symbol.dispose]() }
  }
  // The public derived history is sufficient on hosts without history observations.
  // Never scrape a text path, tool output, or another session's log as an attachment grant.
  return typeof session.deriveMessages === 'function' ? fileReferences(session.deriveMessages()) : []
}

export async function openSessionSource(runtime: AnalysisRuntime, args: Record<string, unknown>, exec: ToolRunContext, host?: Context): Promise<unknown> {
  const owner = String(exec.agent?.id ?? '')
  invariant(owner, 'AVA tools require a DSH agent session')
  invariant((args.path !== undefined) !== (args.attachmentId !== undefined), 'Provide exactly one of path or attachmentId; use uploaded files directly instead of copying them')
  const selector = args.path ?? args.attachmentId
  string(selector, 'source', 4000)
  exec.signal.throwIfAborted()
  const context = exec.agent?.ctx ?? host
  const session = exec.agent?.session as unknown as SessionSource | undefined
  if (session) invariant(session.header?.id === owner, 'Session identity mismatch')
  const workspace = session?.header.cwd
  if (workspace !== undefined) invariant(typeof workspace === 'string' && isAbsolute(workspace), 'Invalid session workspace')
  const store = context?.reflect.get('attachments', false) as AttachmentReader | undefined
  const references = store ? await sessionFiles(owner, session, context, exec.signal) : []
  const byId = args.attachmentId !== undefined
  const matches = references.filter(ref => {
    if (byId) return ref.attachmentId === selector
    if (selector === basename(selector) && ref.name === selector) return true
    const hostPath = typeof store?.fileHostPath === 'function' ? store.fileHostPath(ref) : undefined
    return hostPath !== undefined && isAbsolute(selector) && resolve(selector) === resolve(hostPath)
  })
  invariant(matches.length <= 1, 'Multiple session attachments have this name or ID. Use the exact attachment path or a distinct attachmentId; use ./filename for a workspace file.')
  const attachment = matches[0]
  if (attachment) {
    invariant(typeof store?.readFileStream === 'function', 'This DSH attachment provider cannot read uploaded files')
    return runtime.openAttachment(owner, attachment, () => store.readFileStream(attachment, exec.signal), exec.signal)
  }
  invariant(!byId, 'Attachment is not present in this session. Select a file uploaded to this conversation.')
  const access: FileAccess = {
    ...(workspace === undefined ? {} : { workspace }),
    ...(typeof store?.root === 'string' ? { excludedRoots: [store.root] } : {}),
  }
  return runtime.open(owner, selector, exec.signal, access)
}
