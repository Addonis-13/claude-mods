import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Verdict } from '../types'

const dernier = atom({ plugin: 'verdict-fin', key: 'dernier' } as const, null)

const CONSIGNE = `À la toute fin de chaque réponse qui clôt ton tour (pas dans les messages intermédiaires), ajoute une dernière ligne, seule, choisie honnêtement parmi :
- \`**✅ Terminé**\` : la demande est entièrement faite (livrée, poussée, vérifiée selon ce qu'elle exigeait) et l'utilisateur n'a rien à faire.
- \`**👉 À toi :** <action précise en moins de 12 mots>\` : il reste quelque chose que seul l'utilisateur peut faire ou trancher (répondre à une question, valider une maquette, approuver, tester sur son poste…).
- \`**⏳ Pas fini :** <ce qui reste, en moins de 12 mots>\` : tu n'as pas fini (travail en arrière-plan, CI qui tourne, étape que tu feras au prochain tour).
Ne dis jamais Terminé s'il reste un commit, un push, une vérification ou une question ouverte. Cette ligne est lue par une extension qui l'affiche à l'utilisateur.`

// Entre le libellé et le détail : espaces, deux-points et gras/italique (`**👉 À toi :** x`, `**👉 À toi** : x`).
const SEP = '[\\s*_]*:?[\\s*_]*'

const MOTIFS: [Verdict['kind'], RegExp][] = [
  ['fini', /^✅\s*Termin[ée]/i],
  ['a-toi', new RegExp(`^👉\\s*[ÀA] toi${SEP}(.*)$`, 'iu')],
  ['en-cours', new RegExp(`^⏳\\s*Pas fini${SEP}(.*)$`, 'iu')],
]

/**
 * Ramène une ligne à « emoji libellé détail » : sans sélecteur de variante
 * (U+FE0F), sans puce de liste, sans code en ligne ni gras/italique autour du
 * verdict. Les underscores à l'intérieur des mots (`test_e2e`) restent.
 */
function nettoyer(ligne: string): string {
  return ligne
    .replace(/️/g, '')
    .replace(/`/g, '')
    .trim()
    .replace(/^(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/^[*_\s]+/, '')
    .replace(/[*_\s]+$/, '')
    .replace(/\*/g, '')
}

export function lire(answer: string): Verdict {
  const lignes = answer.trim().split('\n').map(nettoyer)
  for (const ligne of lignes.slice(-3).reverse()) {
    for (const [kind, motif] of MOTIFS) {
      const m = motif.exec(ligne)
      if (m) return { kind, detail: kind === 'fini' ? '' : (m[1] ?? '').trim() }
    }
  }
  return { kind: 'inconnu', detail: '' }
}

const LIBELLE: Record<Exclude<Verdict['kind'], 'inconnu'>, { icone: string; texte: string; couleur: string }> = {
  fini: { icone: '✅', texte: 'Terminé — rien à faire de ton côté', couleur: 'green' },
  'a-toi': { icone: '👉', texte: 'À toi', couleur: 'yellow' },
  'en-cours': { icone: '⏳', texte: 'Pas fini', couleur: 'cyan' },
}

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return { ...r, sections: [...r.sections, { id: 'verdict-fin:consigne', text: CONSIGNE, scope: 'session' }] }
  })

  // Efface le bandeau à l'envoi. Un échec ici ne doit jamais bloquer l'envoi :
  // l'effacement est tenté à part, et le `.catch` laisse passer le message.
  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta && !e.command) {
      try {
        await update($, dernier, () => null)
      } catch {
        // Le bandeau garde l'ancien verdict : sans gravité.
      }
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer') {
      const v = lire(e.answer)
      // Sans verdict, ni bandeau ni notification : rien n'est affiché.
      if (v.kind === 'inconnu') {
        await update($, dernier, () => null)
      } else {
        await update($, dernier, () => v)
        const l = LIBELLE[v.kind]
        $.ui.toast(`${l.icone} ${l.texte}${v.detail ? ` : ${v.detail}` : ''}`, { timeoutMs: 15000 })
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const v = await read($, dernier)
    if (e.props.hasSurvey || v === null || v.kind === 'inconnu') return next(e)
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
