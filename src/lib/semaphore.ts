/**
 * Simple async semaphore for concurrency control.
 * Used to limit parallel generation requests per provider.
 */

export class Semaphore {
  private queue: (() => void)[] = []
  private running = 0

  constructor(private max: number) {}

  async acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Request cancelled', 'AbortError')
    if (this.running < this.max) {
      this.running++
      return
    }
    return new Promise((resolve, reject) => {
      const abort = () => {
        const index = this.queue.indexOf(ready)
        if (index >= 0) this.queue.splice(index, 1)
        reject(signal?.reason ?? new DOMException('Request cancelled', 'AbortError'))
      }
      const ready = () => { signal?.removeEventListener('abort', abort); this.running++; resolve() }
      signal?.addEventListener('abort', abort, { once: true })
      this.queue.push(ready)
    })
  }

  release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) next()
  }
}
