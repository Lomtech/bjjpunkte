# Google Places API – Token-Waste Audit

**Datei**: `src/app/api/admin/leads/places-search/route.ts`
**Stand**: 2026-05-09
**Frage**: Werden Tokens (Google Places API Calls) bei Duplikat-Anfragen verschwendet?

## Antwort in einem Satz

**Nein – aber nur für identische `(query_lower, bias_lat, bias_lng, bias_radius)`-Tupel innerhalb 7 Tagen.**
Für naheliegende Varianten (z.B. „BJJ München" vs. „Jiu Jitsu München" vs. minimal andere Bias-Koordinaten) wird die Google API erneut belastet, weil der Cache exakte String- und Float-Gleichheit verlangt. Innerhalb eines Suchlaufs werden zusätzlich alle paginierten Seiten geholt, selbst wenn 100 % der Ergebnisse bereits in `sales_leads` existieren – das ist API-architektonisch unvermeidbar (Google-Places-New kennt kein „skip these IDs").

## Aktuelle Logik (Ist-Zustand)

1. **Cache-Hit-Check** liest den jüngsten Eintrag aus `sales_search_history` mit `ilike('query', queryLower)`. Bei identischem `bias_lat/lng/radius` und `ran_at > now() - 7d` antwortet die Route ohne Google-Call (`cached: true`). Mit `force=true` lässt sich das umgehen.
2. **Google Places API**: `searchPlacesText()` ruft `POST https://places.googleapis.com/v1/places:searchText` (Text Search, **Pro-SKU**, ~$0.032/Call). Pagination via `nextPageToken`, bis `maxPages` (1–5, default 3) erreicht ist – also **bis zu 5 Calls pro Suche**.
3. **Daily-Quota** (`getPlacesQuota`) blockt vor dem Lauf, wenn `todayPagesCalled + maxPages > PLACES_DAILY_LIMIT` (default 150). Dies ist die Anti-DoS-Sicherung.
4. **Pro Place**: Lookup `sales_leads` per `google_place_id`. Existiert → Metadaten-Refresh. Existiert nicht → INSERT + `sales_activities`-Eintrag (`kind='place_imported'`).
5. **History-Log** schreibt am Ende `result_count`, `inserted_count`, `updated_count`, `pages_called` in `sales_search_history`.

## Wo Token-Verschwendung möglich ist

| # | Quelle | Schweregrad | Status |
|---|---|---|---|
| 1 | Identische Suche innerhalb 7 Tagen | – | **Bereits gefixt** durch `sales_search_history`-Cache |
| 2 | Synonyme Queries („BJJ München" vs. „Jiu Jitsu München") | Mittel | Nicht automatisch lösbar – semantisch verschieden |
| 3 | Pagination zieht alle Seiten, auch wenn alle Resultate Duplikate sind | Mittel | **Architekturgrenze** – Google API kennt kein „Resume-after-id" |
| 4 | Float-Equality bei Bias (z.B. `52.5200` vs. `52.52`) führt zu Cache-Miss | Klein | Edge-Case – aktuell harmlos weil UI die Bias-Werte konstant setzt |
| 5 | `existingMatchCount` matcht nur ersten Suchwort-Teil als `ilike '%first%'` → ungenaue „X bereits in DB"-Anzeige | UX, **kein Token-Issue** | Verbessern (siehe Fix unten) |

## Empfehlung

Cache (Strategy A) ist solide – nichts zu tun.
**Strategy B (UX nach API-Call)** ist nur halb da: Nutzer sieht `inserted` + `updated`, aber **nicht „skipped"** (= Resultate, die zwar gefunden, aber nicht relevant geupdated waren z.B. wegen Fehler oder weil `existing.status` schon `disqualified` war). Außerdem ist `existingMatchCount` heute irreführend.

Konkrete Verbesserungen:
- **Skipped-Zähler hinzufügen** (`alreadyInDb`): wie viele der gefundenen Places hatten bereits einen `sales_leads`-Eintrag → klare „X von Y waren neu"-Aussage.
- **`existingMatchCount` exakter**: statt `ilike '%first%'` lieber Lead-Anzahl mit selber `city`-Heuristik (oder leeres Feld lassen statt fehlerhafter Statistik).
- **Bias-Normalisierung** auf 4 Nachkommastellen vor Cache-Vergleich (verhindert seltene Float-Drift).

Diese Änderungen brechen keine bestehende Funktionalität, brauchen keine Migration und kosten 0 zusätzliche API-Calls.
