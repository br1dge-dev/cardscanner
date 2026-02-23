// fetch-cards.js - Lädt alle Riftbound-Karten von der API
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://api.dotgg.gg/cgfw/getcards?game=riftbound';
const OUTPUT_FILE = path.join(__dirname, 'cards.json');

console.log('🔄 Lade Kartendaten von der API...');

https.get(API_URL, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const cards = JSON.parse(data);
      
      // Extrahiere nur die wichtigen Felder
      const simplified = cards.map(card => {
        // Extrahiere Nummer aus ID (z.B. "OGN-170" -> "170")
        const numberMatch = card.id.match(/-(\\d+)/);
        const number = numberMatch ? numberMatch[1] : '';
        
        return {
          id: card.id,
          name: card.name,
          set_name: card.set_name,
          number: number,
          image: card.image,
          price: parseFloat(card.price) || 0
        };
      });
      
      // Speichere als JSON
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(simplified, null, 2));
      
      console.log(`✅ ${simplified.length} Karten gespeichert nach ${OUTPUT_FILE}`);
      console.log(`📊 Sets: ${[...new Set(simplified.map(c => c.set_name))].join(', ')}`);
    } catch (error) {
      console.error('❌ Fehler beim Parsen:', error.message);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('❌ Fehler beim Laden:', err.message);
  process.exit(1);
});
