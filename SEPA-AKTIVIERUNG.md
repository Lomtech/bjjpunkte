# SEPA Lastschrift aktivieren — Schritt-für-Schritt-Anleitung für Gym-Betreiber

> **Was ist SEPA Lastschrift?**  
> SEPA Lastschrift (Direct Debit) ermöglicht monatliche automatische Abbuchungen direkt vom Bankkonto deiner Mitglieder. Das Mitglied gibt einmalig sein IBAN an und erteilt ein Mandat — danach wird jeden Monat automatisch abgebucht. Keine Kreditkarte nötig.

---

## Voraussetzungen

- Du hast Osss bereits mit deinem Stripe-Konto verbunden (Settings → Zahlungen → Stripe Connect)
- Dein Stripe-Konto ist vollständig verifiziert (Auszahlungen aktiviert)

---

## Schritt 1 — Stripe Express Dashboard öffnen

1. Gehe in Osss zu **Settings → Zahlungen**
2. Klicke auf **„Stripe Dashboard"**

   👉 Alternativ direkt: https://connect.stripe.com/express_login

   Du wirst automatisch in dein Express-Dashboard weitergeleitet.

---

## Schritt 2 — Zahlungsmethoden aufrufen

Im Stripe Express Dashboard:

1. Klicke links im Menü auf **„Einstellungen"** (Zahnrad-Icon)
2. Wähle **„Zahlungsmethoden"**

   Du siehst eine Liste aller verfügbaren Zahlungsmethoden.

---

## Schritt 3 — SEPA Lastschrift aktivieren

1. Suche den Eintrag **„SEPA-Lastschriftverfahren"**
2. Klicke auf **„Aktivieren"** oder **„Beantragen"**

   > Falls du keinen Aktivieren-Button siehst, sind möglicherweise noch Verifikationsschritte offen (siehe Schritt 4).

3. Stripe zeigt dir ggf. eine kurze Bestätigung oder Nutzungsbedingungen — akzeptiere diese.

4. Der Status wechselt zu **„Aktiv"** ✅

---

## Schritt 4 — Falls Verifikation aussteht

Wenn Stripe noch Informationen benötigt:

1. Im Express Dashboard siehst du oben einen Banner: **„Handlungsbedarf"** oder **„Ausstehende Anforderungen"**
2. Klicke darauf und vervollständige die angeforderten Angaben:
   - Personalausweis / Reisepass (Identitätsverifikation)
   - Bankverbindung für Auszahlungen
   - Unternehmensadresse / Steuerinfo

3. Nach Einreichung prüft Stripe innerhalb von **1–2 Werktagen** (oft sofort)
4. Du erhältst eine E-Mail von Stripe sobald SEPA aktiviert wurde

---

## Schritt 5 — Testen

Sobald SEPA aktiviert ist:

1. Gehe in Osss zu einem Mitglied mit einem aktiven Tarif
2. Klicke auf **„Abo-Checkout senden"**
3. Öffne den Checkout-Link — SEPA Lastschrift erscheint jetzt als Zahlungsoption neben Kreditkarte

Das Mitglied gibt beim ersten Checkout sein IBAN ein, Stripe erstellt automatisch das Mandat und bucht ab dem nächsten Monat automatisch ab.

---

## Was das Mitglied sieht

Beim Checkout-Formular erscheint:

```
Zahlungsmethode wählen:
○ Kreditkarte / Debitkarte
○ SEPA-Lastschrift  ← NEU
```

Bei SEPA gibt das Mitglied ein:
- Vollständiger Name
- IBAN (z.B. DE89 3704 0044 0532 0130 00)

Stripe zeigt einen **SEPA-Mandatstext** an (gesetzlich vorgeschrieben):  
*„Durch Angabe Ihrer IBAN und Bestätigung dieser Zahlung ermächtigen Sie [Gym-Name] und Stripe, Ihrem Konto zukünftige Zahlungen zu belasten..."*

Das Mandat wird automatisch gespeichert. Ab dann läuft alles automatisch.

---

## Häufige Fragen

**Wie lange dauert eine SEPA-Abbuchung?**  
3–5 Werktage bis das Geld auf deinem Konto erscheint.

**Was passiert wenn eine Abbuchung fehlschlägt?**  
Stripe versucht es automatisch erneut und benachrichtigt dich per E-Mail. In Osss wird der Zahlungsstatus entsprechend aktualisiert.

**Kann ein Mitglied widersprechen (Rücklastschrift)?**  
Ja, innerhalb von 8 Wochen. Stripe benachrichtigt dich automatisch darüber.

**Muss ich für SEPA zusätzlich zahlen?**  
Stripe berechnet für SEPA-Lastschriften eine eigene Gebühr (ca. 0,35 % + 0,25 €, max. 6 €). Keine zusätzlichen Osss-Gebühren.

---

## Support

Bei Problemen mit der Stripe-Aktivierung:  
📧 stripe.com/contact  
📞 Stripe Support: https://support.stripe.com

Bei Problemen mit Osss:  
📧 Dein Osss-Kontakt
