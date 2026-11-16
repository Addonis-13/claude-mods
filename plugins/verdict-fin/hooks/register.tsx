import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Verdict } from '../types'

const dernier = atom({ plugin: 'verdict-fin', key: 'dernier' } as const, null)

const CONSIGNE = `À la toute fin de chaque réponse qui clôt ton tour (pas dans les messages intermédiaires), ajoute une dernière ligne, seule, choisie honnêtement parmi :
- \`**✅ Terminé**\` : la demande est entièrement faite (livrée, poussée, vérifiée selon ce qu'elle exigeait) et l'utilisateur n'a rien à faire.
- \`**👉 À toi :** <action précise en moins de 12 mots>\` : il reste quelque chose que seul l'utilisateur peut faire ou trancher (répondre à une question, valider une maquette, approuver, tester sur son poste…).
- \`**⏳ Pas fini :** <ce qui reste, en moins de 12 mots>\` : tu n'as pas fini (travail en arrière-plan, CI qui tourne, étape que tu feras au prochain tour).
Ne dis jamais Terminé s'il reste un commit, un push, une vérification ou une question ouverte. Cette ligne est lue par une extension qui l'affiche à l'utilisateur.`

const MOTIFS: [Verdict['kind'], RegExp][] = [
  ['fini', /^✅\s*Termin[ée]/i],
  ['a-toi', /^👉\s*[ÀA] toi\s*:?\s*(.*)$/i],
  ['en-cours', /^⏳\s*Pas fini\s*:?\s*(.*)$/i],
]

export function lire(answer: string): Verdict {
  const lignes = answer.trim().split('\n').map(l => l.replace(/[`*_]/g, '').trim())
  for (const ligne of lignes.slice(-3).reverse()) {
    for (const [kind, motif] of MOTIFS) {
      const m = motif.exec(ligne)
      if (m) return { kind, detail: kind === 'fini' ? '' : (m[1] ?? '').trim() }
    }
  }
  return { kind: 'inconnu', detail: '' }
}

const LIBELLE: Record<Verdict['kind'], { icone: string; texte: string; couleur: string }> = {
  fini: { icone: '✅', texte: 'Terminé — rien à faire de ton côté', couleur: 'green' },
  'a-toi': { icone: '👉', texte: 'À toi', couleur: 'yellow' },
  'en-cours': { icone: '⏳', texte: 'Pas fini', couleur: 'cyan' },
  inconnu: { icone: '❔', texte: 'Pas de verdict : lis la fin de la réponse', couleur: 'gray' },
}

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return { ...r, sections: [...r.sections, { id: 'verdict-fin:consigne', text: CONSIGNE, scope: 'session' }] }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta && !e.command) await update($, dernier, () => null)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer') {
      const v = lire(e.answer)
      await update($, dernier, () => v)
      const l = LIBELLE[v.kind]
      $.ui.toast(`${l.icone} ${l.texte}${v.detail ? ` : ${v.detail}` : ''}`, { timeoutMs: 15000 })
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const v = await read($, dernier)
    if (e.props.hasSurvey || v === null) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const l = LIBELLE[v.kind]
    return (
      <Box>
        <Text color={l.couleur} weight="bold">
          {l.icone} {l.texte}
        </Text>
        {v.detail ? <Text> : {v.detail}</Text> : null}
      </Box>
    )
  })
}
