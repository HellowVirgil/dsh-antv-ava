import { createHash, randomBytes } from 'node:crypto'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { mkdir, mkdtemp, open as openFile, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { boundedJson, configFromView, invariant, record, safeJson, string, validateAnswer, validateResult, validateView, type AnswerDocument, type ResultSnapshot, type ResultColumn, type Scalar, type ViewSpec, type AnswerBlock } from 'dsh-antv-ava/protocol'
import { EngineProcess } from './channel.js'

export interface RuntimeOptions { roots: string[]; storageDir: string; idleMs?: number }
/** Trusted host context, not a model-visible argument or a persistent global grant. */
export interface FileAccess { workspace?: string; excludedRoots?: readonly string[] }
export interface FileReference { attachmentId: string; name: string; bytes: number }
const MAX_SOURCE_BYTES = 20 * 1024 * 1024
export interface OpenedDataset { datasetId: string; source: string; datasetVersion: string; schema: unknown }
interface Dataset {
  id: string; owner: string; source: string; version: string; directory: string
  engine: EngineProcess; queue: Promise<unknown>; lastUsed: number; busy: number; closing: boolean
  semanticVersion?: string; semantics?: string
}
const hash = (text: string | Uint8Array): string => createHash('sha256').update(text).digest('hex')
const token = (): string => randomBytes(32).toString('hex')
const validId = (id: string): void => invariant(/^[a-f0-9]{64}$/.test(id), 'Invalid identifier')
function within(root: string, path: string): boolean {
  const delta = relative(root, path)
  return delta !== '..' && !delta.startsWith('..' + sep) && !isAbsolute(delta)
}

export class AnalysisRuntime {
  private datasets = new Map<string, Dataset>()
  private disposed = false
  private openQueue: Promise<unknown> = Promise.resolve()
  constructor(private options: RuntimeOptions) {
    invariant(Array.isArray(options.roots) && options.roots.length > 0 && options.roots.every(root => typeof root === 'string' && isAbsolute(root)), 'roots must contain absolute directory paths')
    invariant(typeof options.storageDir === 'string' && isAbsolute(options.storageDir), 'storageDir must be an absolute path')
    invariant(options.idleMs === undefined || (Number.isSafeInteger(options.idleMs) && options.idleMs > 0), 'idleMs must be a positive integer')
  }
  private metadata(value: unknown): unknown {
    // Generated reader-view SQL contains internal snapshot paths, not business definitions.
    if (!record(value)) return value
    if (Array.isArray(value.models)) { const { views: _views, ...schema } = value; return schema }
    return { ...value, ...(record(value.schema) ? { schema: this.metadata(value.schema) } : {}) }
  }
  private async initialize(): Promise<void> {
    invariant(!this.disposed, 'Runtime is disposed')
    invariant(this.options.roots.length > 0, 'Configure at least one allowed data root')
    for (const name of ['sources','results','presentations']) await mkdir(join(this.options.storageDir, name), { recursive: true, mode: 0o700 })
  }
  private enqueueOpen<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.openQueue.catch(() => {}).then(operation)
    this.openQueue = pending
    return pending
  }
  open(owner: string, file: string, signal?: AbortSignal, access: FileAccess = {}): Promise<OpenedDataset> {
    return this.enqueueOpen(() => this.openDataset(owner, file, signal, access))
  }
  openAttachment(owner: string, ref: FileReference, read: () => AsyncIterable<Uint8Array>, signal?: AbortSignal): Promise<OpenedDataset> {
    return this.enqueueOpen(async () => {
      string(owner, 'owner')
      await this.initialize(); signal?.throwIfAborted()
      invariant(this.datasets.size < 8, 'At most 8 datasets may be open')
      invariant(/^sha256:[a-f0-9]{64}$/.test(ref.attachmentId), 'Invalid attachment digest')
      invariant(Number.isSafeInteger(ref.bytes) && ref.bytes >= 0 && ref.bytes <= MAX_SOURCE_BYTES, 'Attachment must be no larger than 20 MiB')
      invariant(ref.name === basename(ref.name) && !/[\\/\0]/.test(ref.name), 'Invalid attachment filename')
      this.sourceExtension(ref.name)
      const chunks: Buffer[] = []
      let length = 0
      for await (const chunk of read()) {
        signal?.throwIfAborted()
        invariant(chunk instanceof Uint8Array, 'Invalid attachment bytes')
        length += chunk.byteLength
        invariant(length <= MAX_SOURCE_BYTES && length <= ref.bytes, 'Attachment exceeds its recorded size')
        chunks.push(Buffer.from(chunk))
      }
      signal?.throwIfAborted()
      const bytes = Buffer.concat(chunks)
      invariant(length === ref.bytes && hash(bytes) === ref.attachmentId.slice('sha256:'.length), 'Attachment integrity verification failed')
      return this.openSnapshot(owner, ref.name, bytes, signal)
    })
  }
  private sourceExtension(name: string): string {
    const extension = extname(name).toLowerCase()
    invariant(['.csv','.json','.xlsx'].includes(extension), 'Supported file types: CSV, JSON, XLSX')
    return extension
  }
  private async openDataset(owner: string, file: string, signal: AbortSignal | undefined, access: FileAccess): Promise<OpenedDataset> {
    string(owner, 'owner'); string(file, 'file')
    await this.initialize(); signal?.throwIfAborted()
    invariant(this.datasets.size < 8, 'At most 8 datasets may be open')
    invariant(isAbsolute(file) || access.workspace !== undefined, 'Use an absolute local file path when the session has no workspace')
    if (access.workspace !== undefined) invariant(isAbsolute(access.workspace), 'Invalid session workspace')
    const requested = isAbsolute(file) ? file : resolve(access.workspace!, file)
    const path = await realpath(requested)
    invariant(!within(await realpath(this.options.storageDir), path), 'Runtime storage cannot be opened as an analysis source')
    for (const root of access.excludedRoots ?? []) {
      let canonical: string
      try { canonical = await realpath(root) }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error }
      invariant(!within(canonical, path), 'This managed attachment is not available to the current session. Use a file uploaded to this conversation.')
    }
    let allowed = false
    for (const root of this.options.roots) {
      if (within(await realpath(root), path)) allowed = true
    }
    if (access.workspace !== undefined && within(await realpath(access.workspace), path)) allowed = true
    invariant(allowed, 'File is outside the configured data roots and current session workspace. Use a current-session upload or an authorized workspace file; do not copy files to probe other directories.')
    const info = await stat(path)
    invariant(info.isFile() && info.size <= MAX_SOURCE_BYTES, 'Source must be a regular file no larger than 20 MiB')
    this.sourceExtension(path)
    const bytes = await readFile(path, signal ? { signal } : undefined)
    invariant(bytes.length <= MAX_SOURCE_BYTES, 'Source exceeds 20 MiB')
    return this.openSnapshot(owner, basename(path), bytes, signal)
  }
  private async openSnapshot(owner: string, name: string, bytes: Uint8Array, signal?: AbortSignal): Promise<OpenedDataset> {
    signal?.throwIfAborted()
    const extension = this.sourceExtension(name)
    const version = hash(bytes)
    const directory = await mkdtemp(join(this.options.storageDir, 'sources', 'dataset-'))
    const snapshot = join(directory, 'source' + extension)
    try { await writeFile(snapshot, bytes, { mode: 0o600, ...(signal ? { signal } : {}) }) }
    catch (error) { await rm(directory, { recursive: true, force: true }); throw error }
    if (this.disposed) { await rm(directory, { recursive: true, force: true }); throw new Error('Runtime is disposed') }
    const engine = new EngineProcess()
    const id = token()
    const dataset: Dataset = { id, owner, source: name, version, directory, engine, queue: Promise.resolve(), lastUsed: Date.now(), busy: 1, closing: false }
    this.datasets.set(id, dataset)
    try {
      const schema = await engine.request('source', { source: { type: extension === '.xlsx' ? 'excel' : extension === '.csv' ? 'csv-file' : 'json-file', options: { path: snapshot } } }, signal, 60_000)
      invariant(!this.disposed, 'Runtime was disposed while opening')
      return { datasetId: id, source: dataset.source, datasetVersion: version, schema: this.metadata(schema) }
    } catch (error) {
      this.datasets.delete(id); await engine.terminate(); await rm(directory, { recursive: true, force: true }); throw error
    } finally { dataset.busy = 0; dataset.lastUsed = Date.now() }
  }
  private dataset(owner: string, id: string): Dataset {
    validId(id)
    const dataset = this.datasets.get(id)
    invariant(dataset && dataset.owner === owner && !dataset.closing && !dataset.engine.closed, 'Dataset unavailable for this session; reopen it')
    return dataset
  }
  private async run<T>(owner: string, id: string, operation: (dataset: Dataset) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const dataset = this.dataset(owner, id)
    dataset.busy++
    const result = dataset.queue.catch(() => {}).then(async () => {
      signal?.throwIfAborted()
      invariant(!dataset.closing && !dataset.engine.closed, 'Dataset is closed')
      dataset.lastUsed = Date.now()
      return operation(dataset)
    })
    dataset.queue = result
    try { return await result } finally {
      dataset.busy--; dataset.lastUsed = Date.now()
      if (dataset.engine.closed && !dataset.closing) {
        dataset.closing = true; this.datasets.delete(id)
        await rm(dataset.directory, { recursive: true, force: true })
      }
    }
  }
  inspect(owner: string, id: string, profile = false, signal?: AbortSignal): Promise<unknown> {
    return this.run(owner, id, async d => this.metadata(await d.engine.request('inspect', { profile }, signal)), signal)
  }
  semantics(owner: string, id: string, semantic: unknown, signal?: AbortSignal): Promise<unknown> {
    safeJson(semantic)
    invariant(JSON.stringify(semantic).length <= 10_000, 'Semantic definition is too large')
    return this.run(owner, id, async d => {
      const value = await d.engine.request('semantic', { semantic }, signal)
      d.semanticVersion = hash(JSON.stringify(value)); d.semantics = JSON.stringify(value)
      return value
    }, signal)
  }
  query(owner: string, id: string, sql: string, options: { maxRows?: number; maxResultBytes?: number } = {}, signal?: AbortSignal): Promise<ResultSnapshot> {
    string(sql, 'SQL', 40_000)
    const maxRows = options.maxRows ?? 200
    const maxResultBytes = options.maxResultBytes ?? 256_000
    invariant(Number.isInteger(maxRows) && maxRows >= 1 && maxRows <= 500, 'maxRows must be 1–500')
    invariant(Number.isInteger(maxResultBytes) && maxResultBytes >= 1 && maxResultBytes <= 512_000, 'maxResultBytes must be 1–512000')
    return this.run(owner, id, async dataset => {
      const raw = await dataset.engine.request('query', { sql, options: { maxRows, maxResultBytes } }, signal) as { data: Record<string, Scalar>[]; schema: { name: string; type?: string }[]; truncated?: boolean; truncatedBy?: string; rowCount?: number }
      signal?.throwIfAborted()
      const columns: ResultColumn[] = raw.schema.map(c => {
        const type = c.type ?? ''
        const numeric = /INT|DECIMAL|FLOAT|DOUBLE|REAL|NUMBER/i.test(type)
        const encoded = numeric && raw.data.some(row => typeof row[c.name] === 'string')
        return { id: c.name, logicalType: numeric ? 'number' : /DATE|TIME/i.test(type) ? 'date' : /BOOL/i.test(type) ? 'boolean' : 'string', ...(encoded ? { encoding: /DECIMAL/i.test(type) ? 'decimal-string' as const : 'integer-string' as const } : {}) }
      })
      const result = validateResult({
        id: token(), datasetId: id, datasetVersion: dataset.version, ...(dataset.semanticVersion ? { semanticVersion: dataset.semanticVersion } : {}),
        queryId: token(), columns, rows: raw.data, rowKeys: raw.data.map((_, i) => String(i)), returnedRows: raw.data.length,
        ...(raw.rowCount === undefined ? {} : { totalRows: raw.rowCount }),
        truncated: raw.truncated === true, ...(raw.truncated ? { truncatedBy: [raw.truncatedBy === 'maxRows' ? 'rows' : 'bytes'] } : {}),
        executedAt: new Date().toISOString(), executionRef: token(),
        evidence: { source: dataset.source, query: sql, ...(dataset.semantics ? { semantics: dataset.semantics } : {}) },
      })
      await this.save('results', result.id, { owner, result }, signal)
      return result
    }, signal)
  }
  private async save(kind: string, id: string, value: unknown, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    validId(id)
    const text = JSON.stringify(value)
    invariant(Buffer.byteLength(text) <= 1_048_576, 'Snapshot exceeds 1 MiB')
    const path = join(this.options.storageDir, kind, id + '.json')
    const file = await openFile(path, 'wx', 0o600)
    let complete = false
    try {
      await file.writeFile(text, signal ? { signal } : undefined)
      signal?.throwIfAborted()
      complete = true
    } finally {
      try { await file.close() }
      finally { if (!complete) await rm(path, { force: true }) }
    }
  }
  private async ownedResult(owner: string, id: string): Promise<ResultSnapshot> {
    validId(id)
    const value = boundedJson(await readFile(join(this.options.storageDir, 'results', id + '.json'), 'utf8'))
    invariant(record(value) && value.owner === owner, 'Result unavailable for this session')
    return validateResult(value.result)
  }
  async present(owner: string, input: { resultId: string; view: Omit<ViewSpec, 'resultId' | 'id'>; blocks?: AnswerBlock[]; title?: string; language?: 'zh-CN' | 'en-US' }, signal?: AbortSignal): Promise<{ presentationId: string; fence: string }> {
    signal?.throwIfAborted()
    const result = await this.ownedResult(owner, input.resultId)
    const view = validateView({ ...input.view, id: 'chart', resultId: result.id }, [result])
    // Empty results remain inspectable as tables; non-empty charts must be derivable without editing values.
    if (result.rows.length) configFromView(view, result)
    const document = validateAnswer({
      schemaVersion: 1, id: token(), revision: 0, source: 'analysis', language: input.language ?? 'zh-CN',
      ...(input.title ? { title: input.title } : {}),
      results: [result], views: [view], blocks: input.blocks ?? [{ id: 'chart', kind: 'chart', viewId: 'chart' }],
    })
    const presentationId = token()
    await this.save('presentations', presentationId, document, signal)
    return { presentationId, fence: '\x60\x60\x60ava\nava result ' + presentationId + '\n\x60\x60\x60' }
  }
  /** The random 256-bit identifier is a read capability, never a caller-selected file path. */
  async presentation(id: string): Promise<AnswerDocument> {
    validId(id)
    return validateAnswer(boundedJson(await readFile(join(this.options.storageDir, 'presentations', id + '.json'), 'utf8')))
  }
  async close(owner: string, id: string): Promise<void> {
    const dataset = this.datasets.get(id)
    invariant(dataset && dataset.owner === owner, 'Dataset unavailable for this session')
    dataset.closing = true
    await dataset.queue.catch(() => {})
    await dataset.engine.terminate()
    this.datasets.delete(id)
    await rm(dataset.directory, { recursive: true, force: true })
  }
  async expire(): Promise<void> {
    for (const d of this.datasets.values()) if (!d.busy && Date.now() - d.lastUsed > (this.options.idleMs ?? 30 * 60_000)) await this.close(d.owner, d.id)
  }
  async closeOwner(owner: string): Promise<void> {
    for (const d of [...this.datasets.values()].filter(item => item.owner === owner)) {
      d.closing = true; await d.engine.terminate(); await d.queue.catch(() => {})
      this.datasets.delete(d.id); await rm(d.directory, { recursive: true, force: true })
    }
  }
  async dispose(): Promise<void> {
    this.disposed = true
    for (const d of [...this.datasets.values()]) { d.closing = true; await d.engine.terminate(); await d.queue.catch(() => {}); await rm(d.directory, { recursive: true, force: true }) }
    this.datasets.clear()
    await this.openQueue.catch(() => {})
  }
}
