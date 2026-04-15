export function createNoopResultReporter() {
  return {
    async reportResult() {},
  }
}
