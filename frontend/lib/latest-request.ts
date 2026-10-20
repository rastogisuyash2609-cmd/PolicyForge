/** Each request channel owns its own cancellation and identity checks. */
export class LatestRequest {
  private sequence = 0;
  private controller: AbortController | null = null;
  begin() {
    this.cancel();
    const id = this.sequence;
    this.controller = new AbortController();
    return { id, signal: this.controller.signal };
  }
  current(id: number) {
    return id === this.sequence && !this.controller?.signal.aborted;
  }
  cancel() {
    this.sequence++;
    this.controller?.abort();
    this.controller = null;
  }
}
