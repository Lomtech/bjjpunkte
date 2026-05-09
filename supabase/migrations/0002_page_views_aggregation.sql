-- 0002_page_views_aggregation.sql
--
-- Aggregat-Tabelle für page_views.
-- Hintergrund: bei 500 Studios × ~1000 Page-Views/Monat × 30 Tage entstehen
-- 15-30M Rows/Monat in `page_views`. Der Admin-Analytics-Endpoint zieht aktuell
-- bis zu 50k raw Rows in JS und timeouted bei dieser Last.
--
-- Lösung: täglich (per Cron) aggregieren wir den Vortag in `page_views_daily`
-- und löschen raw Rows > 90 Tage. Der Admin-Endpoint kann später auf das
-- Aggregat umgestellt werden — Migration und Cron-Endpoint reichen für jetzt.
--
-- Granularität: pro Tag × Pfad × Event-Typ × Country × Device × Browser × Referrer-Source.
-- Damit bleiben alle Drilldowns aus dem aktuellen Admin-Endpoint möglich,
-- aber die Row-Anzahl ist drastisch reduziert (Faktor ~100-1000x).

CREATE TABLE IF NOT EXISTS page_views_daily (
  date            DATE    NOT NULL,
  path            TEXT    NOT NULL,
  event_type      TEXT    NOT NULL DEFAULT 'page_view',
  country         TEXT,
  device_type     TEXT,
  browser         TEXT,
  referrer_source TEXT,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  total_views     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (
    date,
    path,
    event_type,
    COALESCE(country, ''),
    COALESCE(device_type, ''),
    COALESCE(browser, ''),
    COALESCE(referrer_source, '')
  )
);

CREATE INDEX IF NOT EXISTS idx_page_views_daily_date ON page_views_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_daily_path ON page_views_daily(path);
