#!/usr/bin/env python3
"""
Cardmarket Scraper - Origins Booster Box (EN, DE Seller)
VOLLSTÄNDIG mit Lazy-Loading
"""

import sqlite3
import os
import re
import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

DB_PATH = os.getenv('CARDMARKET_DB_PATH', '/Users/robert/.openclaw/workspace/cardmarket.db')
PRODUCT_URL = 'https://www.cardmarket.com/en/Riftbound/Products/Booster-Boxes/Origins-Booster-Box'
FILTER_URL = f"{PRODUCT_URL}?sellerCountry=7&language=1"
PRODUCT_ID = 2

async def scrape_origins():
    """Scraper für Origins Booster Box"""
    print(f"🦋 Origins Booster Scraper - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"URL: {FILTER_URL}")
    print("")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport={'width': 1920, 'height': 2000},
            locale='de-DE',
            timezone_id='Europe/Berlin'
        )
        
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        """)
        
        page = await context.new_page()
        
        try:
            print("🌐 Lade Seite...")
            response = await page.goto(FILTER_URL, wait_until='domcontentloaded', timeout=60000)
            print(f"📊 Status: {response.status}")
            
            await page.wait_for_selector('.article-row', timeout=30000)
            await page.wait_for_timeout(5000)
            
            initial_count = len(await page.query_selector_all('.article-row'))
            print(f"📦 Initiale Listings: {initial_count}")
            
            # Load-More Button
            load_more_selectors = [
                'button:has-text("ZEIGE MEHR")',
                'button:has-text("Load more")',
                'button:has-text("Show more")',
                '.load-more-articles',
                '[data-testid="load-more"]',
                '.table-footer button',
            ]
            
            print("\n🔍 Suche nach Load-More Button...")
            for selector in load_more_selectors:
                for attempt in range(10):
                    btn = await page.query_selector(selector)
                    if btn:
                        visible = await btn.is_visible()
                        if visible:
                            text = await btn.text_content()
                            print(f"  🖱️  Klicke: {text.strip()[:30]}...")
                            await btn.click()
                            await page.wait_for_timeout(3000)
                            new_count = len(await page.query_selector_all('.article-row'))
                            if new_count > initial_count:
                                print(f"     → Neue Listings: {new_count} (+{new_count - initial_count})")
                                initial_count = new_count
                            else:
                                break
                        else:
                            break
                    else:
                        break
            
            # Scrollen
            print("\n📜 Scrolle für mehr Content...")
            last_count = initial_count
            no_change_count = 0
            
            for scroll_attempt in range(30):
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                await page.wait_for_timeout(2000)
                
                current_count = len(await page.query_selector_all('.article-row'))
                if current_count > last_count:
                    print(f"  Scroll {scroll_attempt+1}: {current_count} Listings (+{current_count - last_count})")
                    last_count = current_count
                    no_change_count = 0
                else:
                    no_change_count += 1
                    if no_change_count >= 3:
                        print(f"  Scroll {scroll_attempt+1}: Keine neuen Listings (Ende?)")
                        break
            
            final_count = len(await page.query_selector_all('.article-row'))
            print(f"\n📊 GESAMT: {final_count} Listings geladen")
            
            # Extrahiere Listings
            listings = []
            rows = await page.query_selector_all('.article-row')
            
            for i, row in enumerate(rows):
                try:
                    seller_elem = await row.query_selector('a[href*="/Users/"]')
                    seller = await seller_elem.text_content() if seller_elem else 'Unknown'
                    seller = seller.strip() if seller else 'Unknown'
                    
                    price_elem = await row.query_selector('.price, .fw-bold')
                    price_text = await price_elem.text_content() if price_elem else '0 €'
                    match = re.search(r'([\d,]+)\s*€', price_text or '')
                    price = float(match.group(1).replace(',', '.')) if match else 0
                    
                    qty_elem = await row.query_selector('.badge, .amount')
                    qty_text = await qty_elem.text_content() if qty_elem else '1'
                    try:
                        quantity = int(re.search(r'\d+', qty_text or '1').group())
                    except:
                        quantity = 1
                    
                    # Nur gültige Listings (Seller bekannt, Preis > 0)
                    if seller and seller != 'Unknown' and price > 0:
                        listings.append({'seller': seller, 'price': price, 'quantity': quantity})
                except Exception as e:
                    print(f"  ⚠️ Fehler bei Zeile {i+1}: {e}")
                    continue
            
            print(f"✅ Erfolgreich geparst: {len(listings)} Listings (mit gültigem Preis)")
            
            # Floor nur aus gültigen Preisen berechnen
            floor_price = min([l['price'] for l in listings]) if listings else None
            if not floor_price:
                print(f"⚠️ Kein gültiger Floor-Price gefunden")
                await browser.close()
                return 0, None
            
            await browser.close()
            
            # Speichern in DB
            try:
                save_to_db(listings, floor_price)
                print(f"💶 Floor-Price: {floor_price:.2f}€ (gespeichert)")
                return len(listings), floor_price
            except Exception as e:
                print(f"❌ DB-Fehler: {e}")
                return 0, None
            
        except Exception as e:
            await browser.close()
            print(f"❌ Fehler: {e}")
            raise

def save_to_db(listings, floor_price):
    """Speichert in SQLite"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO scrapes (product_id, total_listings, floor_price, filters_applied)
        VALUES (?, ?, ?, 'sellerCountry=7&language=1')
    ''', (PRODUCT_ID, len(listings), floor_price))
    
    scrape_id = cursor.lastrowid
    
    for listing in listings:
        cursor.execute('''
            INSERT INTO listings (scrape_id, seller, price, quantity, location)
            VALUES (?, ?, ?, ?, 'Germany')
        ''', (scrape_id, listing['seller'], listing['price'], listing['quantity']))
    
    conn.commit()
    
    # Verkaufsverdacht prüfen
    check_suspected_sales(cursor)
    
    conn.commit()
    conn.close()
    print(f"✅ Gespeichert: Scrape #{scrape_id}")

def check_suspected_sales(cursor):
    """Prüft auf fehlende Seller (Verkaufsverdacht)"""
    cursor.execute('SELECT id FROM scrapes WHERE product_id = ? ORDER BY id DESC LIMIT 2', (PRODUCT_ID,))
    scrapes = cursor.fetchall()
    
    if len(scrapes) < 2:
        print("ℹ️ Nicht genug Historie für Verkaufsanalyse")
        return
    
    current_scrape = scrapes[0][0]
    previous_scrape = scrapes[1][0]
    
    cursor.execute('''
        WITH prev_prices AS (
            SELECT seller, price,
                   NTILE(4) OVER (ORDER BY price) as quartile
            FROM listings WHERE scrape_id = ?
        ),
        current_sellers AS (
            SELECT DISTINCT seller FROM listings WHERE scrape_id = ?
        )
        SELECT p.seller, p.price 
        FROM prev_prices p
        LEFT JOIN current_sellers c ON p.seller = c.seller
        WHERE c.seller IS NULL AND p.quartile = 1
    ''', (previous_scrape, current_scrape))
    
    missing_sellers = cursor.fetchall()
    
    for seller, price in missing_sellers:
        cursor.execute('''
            INSERT INTO suspected_sales (product_id, detected_at, seller, price, confidence, reasoning)
            VALUES (?, datetime('now'), ?, ?, 'medium', 'Seller not in current scrape, was in Q1 price range')
        ''', (PRODUCT_ID, seller, price))
        print(f"🚨 Verkaufsverdacht: {seller} @ {price:.2f}€")

if __name__ == '__main__':
    count, floor = asyncio.run(scrape_origins())
    print(f"\n🏁 FERTIG: {count} Listings, Floor: {floor:.2f}€" if floor else f"\n🏁 FERTIG: {count} Listings")
