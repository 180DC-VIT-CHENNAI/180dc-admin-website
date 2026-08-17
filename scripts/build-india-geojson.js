const fs = require('fs');
const path = require('path');
const statesDir = path.join(__dirname, '../node_modules/.pnpm/world-geojson@3.4.0/node_modules/world-geojson/states/india');
const outputDir = path.join(__dirname, '../apps/frontend/public/data');

fs.mkdirSync(outputDir, { recursive: true });

const features = [];
const files = fs.readdirSync(statesDir).filter(f => f.endsWith('.json'));
for (const file of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(statesDir, file), 'utf8'));
    if (data.type === 'FeatureCollection' && data.features) {
      for (const f of data.features) {
        const stateName = f.properties.st_nm || f.properties.NAME_1 || f.properties.name || file.replace('.json', '').replace(/_/g, ' ');
        features.push({
          type: 'Feature',
          properties: { ST_NM: stateName, NAME_1: stateName },
          geometry: f.geometry
        });
      }
    } else if (data.type === 'Feature') {
      const stateName = data.properties.st_nm || data.properties.NAME_1 || file.replace('.json', '').replace(/_/g, ' ');
      data.properties = { ST_NM: stateName, NAME_1: stateName };
      features.push(data);
    }
  } catch (e) {
    console.error('Failed to parse', file, e.message);
  }
}

const collection = { type: 'FeatureCollection', features };
const out = JSON.stringify(collection);
fs.writeFileSync(path.join(outputDir, 'india_states.geojson'), out);
console.log('Combined ' + features.length + ' features into india_states.geojson (' + (out.length / 1024).toFixed(1) + ' KB)');
