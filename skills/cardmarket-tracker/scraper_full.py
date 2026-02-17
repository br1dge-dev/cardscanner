#!/usr/bin/env python3
"""
Cardmarket Scraper - VOLLSTÄNDIG mit Lazy-Loading
Lädt ALLE Listings durch Scrollen/Clicken
"""

import sqlite3
import os
import re
import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

DB_PATH = os.getenv('CARDMARKET_DB_PATH', '/Users/robert/.openclaw/workspace/cardmarket.db')
PRODUCT_URL = os.getenv('CARDMARKET_PRODUCT_URL', 'https://www.cardmarket.com/en/Riftbound/Products/Box-Sets/Arcane-Box-Set')
FILTER_URL = f"{PRODUCT_URL}?sellerCountry=7"

async def scrape_all_listings():
    """Scraper mit vollständigem Lazy-Loading"""
    print(f"🦀 Cardmarket Scraper (FULL) - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"URL: {FILTER_URL}")
    print("")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport={'width': 1920, 'height': 2000},  # Höherer Viewport = mehr Listings initial
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
            
            # Warte auf initialen Content
            await page.wait_for_selector('.article-row', timeout=30000)
            await page.wait_for_timeout(5000)  # JS-Rendering
            
            # Zähle initiale Listings
            initial_count = len(await page.query_selector_all('.article-row'))
            print(f"📦 Initiale Listings: {initial_count}")
            
            # STRATEGIE 1: Versuche "Load More" Button zu finden und zu klicken
            load_more_selectors = [
                'button:has-text("ZEIGE MEHR")',
                'button:has-text("Load more")',
                'button:has-text("Show more")',
                '.load-more-articles',
                '[data-testid="load-more"]',
                '.table-footer button',
            ]
            
            print("\n🔍 Suche nach Load-More Button...")
            button_clicked = 0
            for selector in load_more_selectors:
                for attempt in range(10):  # Max 10 Klicks
                    btn = await page.query_selector(selector)
                    if btn:
                        visible = await btn.is_visible()
                        if visible:
                            text = await btn.text_content()
                            print(f"  🖱️  Klicke: {text.strip()[:30]}...")
                            await btn.click()
                            await page.wait_for_timeout(3000)  # Warte auf Laden
                            button_clicked += 1
                            
                            # Prüfe ob neue Listings kamen
                            new_count = len(await page.query_selector_all('.article-row'))
                            if new_count > initial_count:
                                print(f"     → Neue Listings: {new_count} (+{new_count - initial_count})")
                                initial_count = new_count
                            else:
                                print(f"     → Keine neuen Listings")
                                break
                        else:
                            break
                    else:
                        break
            
            # STRATEGIE 2: Scrollen falls Button nichts mehr bringt
            print("\n📜 Scrolle für mehr Content...")
            last_count = initial_count
            no_change_count = 0
            
            for scroll_attempt in range(30):  # Max 30 Scroll-Versuche
                # Scroll zu Ende
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                await page.wait_for_timeout(2000)
                
                # Prüfe auf neue Listings
                current_count = len(await page.query_selector_all('.article-row'))
                
                if current_count > last_count:
                    print(f"  Scroll {scroll_attempt+1}: {current_count} Listings (+{current_count - last_count})")
                    last_count = current_count
                    no_change_count = 0
                else:
                    no_change_count += 1
                    if no_change_count >= 3:  # 3x keine Änderung = Ende erreicht
                        print(f"  Scroll {scroll_attempt+1}: Keine neuen Listings (Ende?)")
                        break
            
            # Finale Zählung
            final_count = len(await page.query_selector_all('.article-row'))
            print(f"\n📊 GESAMT: {final_count} Listings geladen")
            
            # Extrahiere alle Listings
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
            
            # Floor Price
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
        VALUES (1, ?, ?, 'sellerCountry=7')
    ''', (len(listings), floor_price))
    
    scrape_id = cursor.lastrowid
    
    for listing in listings:
        cursor.execute('''
            INSERT INTO listings (scrape_id, seller, price, quantity, location)
            VALUES (?, ?, ?, ?, 'Germany')
        ''', (scrape_id, listing['seller'], listing['price'], listing['quantity']))
    
    conn.commit()
    conn.close()
    print(f"✅ Gespeichert: Scrape #{scrape_id}")

if __name__ == '__main__':
    count, floor = asyncio.run(scrape_all_listings())
    print(f"\n🏁 FERTIG: {count} Listings, Floor: {floor:.2f}€" if floor else f"\n🏁 FERTIG: {count} Listings")
