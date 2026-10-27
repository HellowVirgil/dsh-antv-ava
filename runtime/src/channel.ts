import { fork, type ChildProcess } from 'node:child_process'
export class EngineProcess {
  private child: ChildProcess
  private counter = 0
  private stopped = false
  constructor() {
    this.child = fork(new URL('./worker.js', import.meta.url), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], serialization: 'json', execArgv: [] })
  }
  get closed(): boolean { return this.stopped || this.child.exitCode !== null || this.child.signalCode !== null }
  async terminate(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) { this.stopped = true; return }
    this.stopped = true
    await new Promise<void>(resolve => { this.child.once('exit', () => resolve()); this.child.kill('SIGKILL') })
  }
  async request(method: string, args: Record<string, unknown>, signal?: AbortSignal, timeout = 30_000): Promise<unknown> {
    if (this.closed) throw new Error('Dataset runtime closed; reopen the source')
    signal?.throwIfAborted()
    const id = ++this.counter
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>
      let settling = false
      const cleanup = (): void => { clearTimeout(timer); signal?.removeEventListener('abort', abort); this.child.off('message', message); this.child.off('exit', exit); this.child.off('error', error) }
      const finish = (failure?: Error, value?: unknown): void => { if (settling) return; settling = true; cleanup(); failure ? reject(failure) : resolve(value) }
      const error = (reason: Error): void => finish(reason)
      const exit = (): void => finish(new Error('Dataset runtime exited; reopen the source'))
      const stop = (reason: string): void => {
        if (settling) return
        settling = true; cleanup()
        void this.terminate().then(() => reject(new Error(reason)), reject)
      }
      const abort = (): void => stop('Analysis cancelled; reopen the dataset to continue')
      const message = (raw: unknown): void => {
        const result = raw as { id?: number; value?: unknown; error?: string }
        if (result.id === id) finish(result.error ? new Error(result.error) : undefined, result.value)
      }
      this.child.on('message', message); this.child.once('exit', exit); this.child.once('error', error)
      signal?.addEventListener('abort', abort, { once: true })
      timer = setTimeout(() => stop('Analysis deadline exceeded; reopen the dataset'), timeout)
      this.child.send({ id, method, args }, reason => { if (reason) error(reason) })
      if (signal?.aborted) abort()
    })
  }
}
