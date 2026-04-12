# Trainer Overrides

Trainer-spezifisches Wissen liegt hier und hat in der Runtime Vorrang vor dem allgemeinen Basiswissen und den FIP-Regeln.

Dateiname:

`knowledge/trainers/<trainer-id>.json`

Format:

```json
[
  {
    "id": "bandeja-coach-override",
    "title": "Bandeja nach Coach-Methodik",
    "keywords": ["bandeja"],
    "content": "Coach-spezifische Erklärung oder Korrekturhinweis.",
    "sourceLabel": "Trainer Override"
  }
]
```

Hinweise:

- `trainer-id` entspricht der internen Trainer-ID aus Storage.
- Überschreibungen funktionieren pragmatisch über dieselben Keywords und werden bei gleicher Relevanz vor Basiswissen und Regeln gerankt.
- Kurz und konkret halten. Die WhatsApp-Antworten sollen weiterhin maximal knapp bleiben.
