export type ChatScriptStep =
  | { kind: 'user'; textKey: string }
  | { kind: 'emilia'; textKey: string; proposal?: boolean };

export const CHAT_SCRIPT: ChatScriptStep[] = [
  { kind: 'user', textKey: 'mockup.script.q1' },
  { kind: 'emilia', textKey: 'mockup.script.a1' },
  { kind: 'user', textKey: 'mockup.script.q2' },
  { kind: 'emilia', textKey: 'mockup.script.a2' },
  { kind: 'user', textKey: 'mockup.script.q3' },
  { kind: 'emilia', textKey: 'mockup.script.a3', proposal: true },
];
