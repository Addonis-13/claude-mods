import { expect, test } from 'claude-code/testing'
import { lire } from './register'

test('fini', () => expect(lire('blabla\n\n**✅ Terminé**')).toEqual({ kind: 'fini', detail: '' }))
test('à toi', () => expect(lire('x\n**👉 À toi :** valider la maquette')).toEqual({ kind: 'a-toi', detail: 'valider la maquette' }))
test('en cours', () => expect(lire('x\n**⏳ Pas fini :** la CI tourne').detail).toBe('la CI tourne'))
test('absent', () => expect(lire('juste du texte').kind).toBe('inconnu'))

// 1. Emoji suivi du sélecteur de variante U+FE0F.
test('sélecteur de variante U+FE0F', () => {
  expect(lire('x\n**✅️ Terminé**')).toEqual({ kind: 'fini', detail: '' })
  expect(lire('x\n**👉️ À toi :** relire')).toEqual({ kind: 'a-toi', detail: 'relire' })
  expect(lire('x\n**⏳️ Pas fini :** la CI tourne')).toEqual({ kind: 'en-cours', detail: 'la CI tourne' })
})

// 2. Ligne de verdict en liste.
test('ligne en liste', () => {
  expect(lire('x\n- **✅ Terminé**')).toEqual({ kind: 'fini', detail: '' })
  expect(lire('x\n* **👉 À toi :** valider')).toEqual({ kind: 'a-toi', detail: 'valider' })
  expect(lire('x\n+ ⏳ Pas fini : build')).toEqual({ kind: 'en-cours', detail: 'build' })
  expect(lire('x\n1. **✅ Terminé**').kind).toBe('fini')
})

// 3. Les underscores du détail restent ; seul le gras/italique autour du verdict part.
test('underscores du détail gardés', () => {
  expect(lire('x\n**⏳ Pas fini :** lancer test_e2e').detail).toBe('lancer test_e2e')
  expect(lire('x\n_⏳ Pas fini :_ lancer `test_e2e`').detail).toBe('lancer test_e2e')
  expect(lire('x\n__👉 À toi__ : lire __init__.py').detail).toBe('lire __init__.py')
  expect(lire('x\n**👉 À toi** : valider **la maquette**').detail).toBe('valider la maquette')
})

const SUBMIT = { text: 'salut', wait: false, origin: { kind: 'user' } } as const

// 4. Un échec à l'envoi ne bloque jamais le message.
test("prompt.submit passe même si l'état échoue", async ($, on) => {
  on('state.set', () => {
    throw new Error('stockage indisponible')
  })
  let recu: string | undefined
  on('prompt.submit', (_, e) => {
    recu = e.text
    return { text: e.text }
  })
  const r = await $.prompt.submit(SUBMIT as never)
  expect(recu).toBe('salut')
  expect(r).toEqual(expect.objectContaining({ text: 'salut' }))
})

function tour(answer: string) {
  return { answer, durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as const
}

// 5. Sans verdict : ni notification, ni bandeau.
test('sans verdict : rien affiché', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('turn.complete', () => ({ text: '' }))

  await $.turn.complete(tour('x\n**✅ Terminé**') as never)
  expect(toasts).toEqual(['✅ Terminé — rien à faire de ton côté'])

  await $.turn.complete(tour('juste du texte') as never)
  expect(toasts.length).toBe(1)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'verdict-fin', component: 'AbovePrompt', surface, props: { hasSurvey: false } } as never)
    expect(await ui.find({ type: 'Text', text: /Terminé|❔|verdict/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('avec verdict : bandeau affiché', async ($, on) => {
  on('ui.toast', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete(tour('x\n**👉 À toi :** lancer test_e2e') as never)
  const ui = await $.ui.mount({ plugin: 'verdict-fin', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false } } as never)
  expect((await ui.find({ type: 'Text', text: /test_e2e/ }))?.text).toBe(' : lancer test_e2e')
  await ui.unmount()
})
