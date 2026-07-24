export function shouldSendPaidSherlockRequest(attempts: number): boolean {
  return attempts <= 1;
}
