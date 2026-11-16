export type Verdict = {
  kind: 'fini' | 'a-toi' | 'en-cours' | 'inconnu'
  detail: string
}

declare module 'claude-code' {
  interface PluginState {
    'verdict-fin': { dernier: Verdict | null }
  }
}
