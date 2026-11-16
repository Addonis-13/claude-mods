# claude-mods

Mods Claude Code de Sélim, en un seul marketplace.

| Mod | Ce qu'il fait | Où il vit |
|---|---|---|
| `verdict-fin` | Chaque réponse finit par « ✅ Terminé », « 👉 À toi : … » ou « ⏳ Pas fini : … », affiché en bandeau au-dessus de la saisie et en notification. | `plugins/verdict-fin/` |
| `be-not-afraid` | Le thème Baroque Nocturne. | dépôt `Addonis-13/baroque-nocturne` |

## Installer (sur le portable)

```bash
claude plugin marketplace add Addonis-13/claude-mods
```

```bash
claude plugin install verdict-fin@claude-mods
```

Puis relancer Claude Code : après une réponse, le bandeau apparaît au-dessus de la saisie.
Dans l'app (session cloud), le bandeau ne s'affiche pas ; la ligne de verdict reste dans la réponse.

## Tester

```bash
claude plugin test plugins/verdict-fin
```
