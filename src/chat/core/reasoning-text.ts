/** Split provider reasoning tags before text reaches the transcript processor. */
export class ReasoningTextFilter {
  private pending = ''
  private thinking = false

  push(delta: string, finish = false): string {
    this.pending += delta
    let visible = ''
    while (this.pending) {
      const marker = /<\/?think>/i.exec(this.pending)
      if (marker) {
        if (!this.thinking) visible += this.pending.slice(0, marker.index)
        this.thinking = marker[0].toLowerCase() === '<think>'
        this.pending = this.pending.slice(marker.index + marker[0].length)
        continue
      }
      let keep = 0
      if (!finish) {
        for (const tag of ['<think>', '</think>']) {
          for (let length = 1; length < tag.length; length++) {
            if (this.pending.toLowerCase().endsWith(tag.slice(0, length)))
              keep = Math.max(keep, length)
          }
        }
      }
      const ready = this.pending.slice(0, this.pending.length - keep)
      if (!this.thinking) visible += ready
      this.pending = this.pending.slice(this.pending.length - keep)
      break
    }
    return visible
  }
}
