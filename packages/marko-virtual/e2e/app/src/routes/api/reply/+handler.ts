// The chat fixtures POST to an absolute /api/reply, so the streaming handler is
// mounted once at the app root and shared by both. Re-exported from the chat
// example rather than copied: the example is the single source of truth, so a
// change to its streaming shape is exercised here instead of drifting from it.
export { POST } from '../../../../../../../../examples/marko/chat/src/routes/api/reply/+handler'
