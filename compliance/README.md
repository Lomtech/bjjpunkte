# Compliance / DSGVO

Interne Dokumente zur DSGVO-Compliance. **Nicht öffentlich.**

## Inhalt

| Datei | Zweck |
|---|---|
| `verarbeitungsverzeichnis.md` | Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO. Pflicht. Bei Aufsichtsbehörden-Anfrage vorzulegen. |
| `avv/` | Unterzeichnete Auftragsverarbeitungsverträge (PDFs). **Gitignored** — sensible Daten. |
| `breach-log.md` | Falls Datenschutzvorfall: Dokumentation gemäß Art. 33 DSGVO. Wird bei Bedarf erstellt. |

## Pflichten — Quick-Check

- [ ] Verarbeitungsverzeichnis aktuell? (jährlich + bei jeder Änderung)
- [ ] AVVs mit allen Auftragsverarbeitern unterzeichnet?
- [ ] TOMs einmal pro Jahr reviewt?
- [ ] Backup-Restore halbjährlich getestet?
- [ ] Datenschutzerklärung auf osss.pro/datenschutz aktuell?

## Rechtsstand

Stand: Mai 2026. Jährlich neu prüfen — DSGVO-Auslegung ändert sich durch
EuGH-Rechtsprechung regelmäßig (z.B. Schrems II, DPF-Entscheidungen).

## Hinweis

Diese Dokumente ersetzen **keine Rechtsberatung**. Vor erstem zahlenden
Kunden: Anwalt einmalig (1-2h) prüfen lassen.

## Phase 9: IBAN-Encryption (DSGVO Art. 32)

IBAN-Daten werden mit AES-256-GCM verschlüsselt in der DB gespeichert.

- **Algorithmus:** AES-256-GCM (Authenticated Encryption, `node:crypto`)
- **Spalte:** `gyms.bank_iban_enc` (text, base64 von `iv|ciphertext|authTag`)
- **ENV-Variable:** `IBAN_ENCRYPTION_KEY` — 32-byte Key, hex-encoded (64 Zeichen)
- **Key-Generierung:** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Helper:** `src/lib/encryption.ts` (`encryptIban`, `decryptIban`, `getIbanFromGym`)
- **Schreib-Pfad:** API-Route `POST /api/gym/iban` (server-side encrypt, Plaintext geht nie in die Browser-DB-Update)
- **Backfill-Skript:** `scripts/encrypt-existing-ibans.ts` — idempotent, setzt nach Encryption das alte `bank_iban` auf NULL
- **Key-Rotation:** bei Wechsel des Keys muss der gesamte Datenbestand mit altem Key entschlüsselt + neuem Key wieder verschlüsselt werden. Vorher Backup ziehen.
