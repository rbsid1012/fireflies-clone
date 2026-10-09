/** Ask the Ask Fred panel for a meeting to run a prompt (used by the AI Skills tab). */
export function runInAskFred(meetingId: number | null, prompt: string): void {
  window.dispatchEvent(new CustomEvent("ask-fred:run", { detail: { meetingId, prompt } }));
}
