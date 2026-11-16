import { expect, test } from 'claude-code/testing'
import { lire } from './register'

test('fini', () => expect(lire('blabla\n\n**✅ Terminé**')).toEqual({ kind: 'fini', detail: '' }))
test('à toi', () => expect(lire('x\n**👉 À toi :** valider la maquette')).toEqual({ kind: 'a-toi', detail: 'valider la maquette' }))
test('en cours', () => expect(lire('x\n**⏳ Pas fini :** la CI tourne').detail).toBe('la CI tourne'))
test('absent', () => expect(lire('juste du texte').kind).toBe('inconnu'))
