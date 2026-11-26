// A loading hint only. Reading or sending messages still requires the HttpOnly credential.
export const visitorChatHintCookie = '__Host-tanstack_chat_started'
export function hasVisitorChatHint(cookie: string) {
  return cookie
    .split(';')
    .some((part) => part.trim() === `${visitorChatHintCookie}=1`)
}
