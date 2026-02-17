# Cardmarket Tracker

Vollautomatisches Markt-Tracking für Riftbound-Produkte auf Cardmarket.de

## 📊 Aktiver Betrieb (seit 16.02.2026)

3 Produkte werden stündlich getrackt:

| Produkt | ID | Scraper | Cron | Zeit | Letzter Stand |
|---------|----|---------|------|------|---------------|
| **Origins Booster EN** | 1 | `scraper_origins.py` | ✅ Aktiv | :27 | 64 Listings, Floor 187,75€ |
| **Spiritforged Booster EN** | 2 | `scraper_spiritforged.py` | ✅ Aktiv | :42 | 51 Listings, Floor 175,00€ |
| **Arcane Box Set** | 3 | `scraper_full.py` | ✅ Aktiv | :57 | 47 Listings, Floor 185,00€ |

### Berichte
- **Mini-Updates:** Stündlich in Telegram-Gruppe (Key-Erkenntnis pro Scrape)
- **Vollständige Reports:** Auf Anfrage oder täglich
- **Sub-Agent:** `riftbound-reporter` für isolierte Gruppen-Kommunikation

---

## 🏗️ Architektur

```
┌─────────────────────────────────────────────────────┐
│                    CRON JOBS                        │
│  :27 Origins  →  :42 Spiritforged  →  :57 Arcane   │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              Python Scraper (Playwright)            │
│  • Chromium mit Anti-Detection                      │
│  • Lazy-Loading (Scroll + "Load More")              │
│  • 45-64 Listings pro Produkt                       │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              SQLite Datenbank                       │
│  • products (Katalog)                               │
│  • scrapes (Zeitreihe)                              │
│  • listings (jede einzelne Listing)                 │
│  • suspected_sales (Verkaufsverdacht)               │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              Reports & Analyse                      │
│  • Mini-Updates (Telegram-Gruppe)                   │
│  • Preisverteilung (ASCII-Charts)                   │
│  • Trend-Erkennung (Floor-Changes)                  │
│  • Verkaufsverdacht (Q1-Preis-Bereich)              │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Dateien

| File | Status | Beschreibung |
|------|--------|--------------|
| `scraper_full.py` | ✅ **Aktiv** | Arcane Box Set Scraper |
| `scraper_origins.py` | ✅ **Aktiv** | Origins Booster EN Scraper |
| `scraper_spiritforged.py` | ✅ **Aktiv** | Spiritforged Booster EN Scraper |
| `schema.sql` | ✅ Aktiv | DB-Schema (alle Tabellen) |
| `analysis_queries_v2.sql` | ✅ Aktiv | SQL-Analyse-Queries |
| `daily_report.sh` | 🔄 Optional | Tagesbericht (manuell) |
| `weekly_report.sh` | 🔄 Optional | Wochenbericht (manuell) |
| `deprecated/` | 📁 Archiv | Alte nicht-funktionierende Ansätze |

---

## 🔧 Technische Details

### Anti-Scraping Maßnahmen
```python
browser = await p.chromium.launch(
    headless=True,
    args=['--disable-blink-features=AutomationControlled']
)

context = await browser.new_context(
    viewport={'width': 1920, 'height': 2000},
    locale='de-DE',
    timezone_id='Europe/Berlin'
)

# Anti-Detection Script
await context.add_init_script("""
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
""")
```

### Lazy-Loading Strategie
1. **Initial Load** (~25-50 Listings)
2. **"Load More" Button** klicken (sofern vorhanden)
3. **Scrollen** bis keine neuen Listings mehr geladen werden
4. **Resultat:** 45-64 Listings pro Produkt

### Verkaufsverdacht-Logik
```sql
-- Seller aus Q1 (unteres Quartil) des vorherigen Scrapes
-- die im aktuellen Scrape fehlen → "suspected_sale"
```

---

## 📈 Analyse-Möglichkeiten

Mit den gesammelten Daten können wir:

- [x] **Floor-Price Tracking** (stündlich)
- [x] **Listing-Anzahl Trends**
- [x] **Verkaufsverdacht** (automatisiert)
- [ ] **Preisverteilung über Zeit** (Chart)
- [ ] **Seller-Abwanderung**
- [ ] **Liquiditäts-Index**
- [ ] **Trend-Vorhersagen**

---

## 🚀 Setup (falls neu aufgesetzt werden muss)

```bash
# 1. DB initialisieren
sqlite3 cardmarket.db < schema.sql

# 2. Produkte einfügen
sqlite3 cardmarket.db "INSERT INTO products VALUES 
  (1,'Origins Booster','Booster Boxes','Riftbound','...'),
  (2,'Spiritforged Booster','Booster Boxes','Riftbound','...'),
  (3,'Arcane Box Set','Box Sets','Riftbound','...');"

# 3. Cronjobs aktivieren (bereits via OpenClaw cron add)
# - cardmarket-origins-tracker (:27)
# - cardmarket-spiritforged-tracker (:42)
# - cardmarket-arcane-tracker (:57)

# 4. Sub-Agent für Telegram-Gruppe spawnen
# sessions_spawn(label: "riftbound-reporter", ...)
```

---

## 📝 Learnings

1. **Lazy-Loading ist essentiell** – ohne Scrollen nur 30% der Daten
2. **Zeitversatzte Cronjobs** – verhindert Überlastung (15min Abstand)
3. **Playwright > Requests** – Cardmarket blockt einfache HTTP-Requests
4. **Vergleichbarkeit prüfen** – Seller-Sets können sich unterscheiden

---

## 🔮 Zukünftige Erweiterungen

- [ ] Dashboard mit Charts (Preisverläufe)
- [ ] Alerts bei Floor-Drop >5%
- [ ] Tägliche/Wöchentliche Reports
- [ ] Mehr Produkte (einzelne Booster, andere Sets)
- [ ] API für externe Zugriffe

---

**Für:** @br1dge_eth  
**Letzte Aktualisierung:** 16.02.2026
