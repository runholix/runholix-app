import fs from 'fs';
import path from 'path';

// ── GPX parser ────────────────────────────────────────────────────────────
function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function parseGpx(xml) {
  // Extract trkpt elements
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  const eleRegex = /<ele>([\d.]+)<\/ele>/;
  const hrRegex = /<(?:gpxtpx:hr|ns3:hr|hr)>(\d+)<\/(?:gpxtpx:hr|ns3:hr|hr)>/;

  const points = [];
  let match;
  while ((match = trkptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const inner = match[3];
    const eleMatch = eleRegex.exec(inner);
    const hrMatch  = hrRegex.exec(inner);
    points.push({
      lat, lon,
      ele: eleMatch ? parseFloat(eleMatch[1]) : null,
      hr:  hrMatch  ? parseInt(hrMatch[1])    : null,
    });
  }

  return extractStats(points);
}

// ── KML parser ────────────────────────────────────────────────────────────
function parseKml(xml) {
  // KML stores coords as lon,lat,ele triples separated by whitespace
  const coordsRegex = /<coordinates>([\s\S]*?)<\/coordinates>/g;
  const points = [];
  let match;
  while ((match = coordsRegex.exec(xml)) !== null) {
    const raw = match[1].trim().split(/\s+/);
    for (const triple of raw) {
      const parts = triple.split(',').map(Number);
      if (parts.length >= 2) {
        points.push({ lon: parts[0], lat: parts[1], ele: parts[2] ?? null, hr: null });
      }
    }
  }
  return extractStats(points);
}

// ── FIT parser ────────────────────────────────────────────────────────────
async function parseFit(filePath) {
  try {
    const { default: FitParser } = await import('fit-file-parser');
    const buf = fs.readFileSync(filePath);

    return await new Promise((resolve) => {
      const parser = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'km', elapsedRecordField: true });
      parser.parse(buf, (err, data) => {
        if (err || !data?.records?.length) return resolve(null);

        const records = data.records;
        const hrValues  = records.map(r => r.heart_rate).filter(v => v != null && v > 0 && v < 250);
        const latLons   = records.filter(r => r.position_lat != null && r.position_long != null);
        const altitudes = records.map(r => r.altitude).filter(v => v != null);

        // Distance: sum of haversine between consecutive GPS points
        let distM = 0;
        for (let i = 1; i < latLons.length; i++) {
          distM += haversineM(latLons[i-1].position_lat, latLons[i-1].position_long, latLons[i].position_lat, latLons[i].position_long);
        }

        // Elevation gain: sum of positive altitude differences
        let elevGain = 0;
        for (let i = 1; i < altitudes.length; i++) {
          const diff = altitudes[i] - altitudes[i-1];
          if (diff > 0) elevGain += diff;
        }

        resolve({
          distance_km:   distM > 0    ? Math.round(distM / 10) / 100 : null,
          elevation_m:   elevGain > 0 ? Math.round(elevGain)         : null,
          heart_rate_avg: hrValues.length ? Math.round(hrValues.reduce((a,b) => a+b, 0) / hrValues.length) : null,
          heart_rate_max: hrValues.length ? Math.max(...hrValues) : null,
        });
      });
    });
  } catch {
    return null;
  }
}

// ── Shared stats extractor (GPX/KML points) ───────────────────────────────
function extractStats(points) {
  if (!points.length) return null;

  // Distance
  let distM = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].lat != null && points[i-1].lat != null) {
      distM += haversineM(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon);
    }
  }

  // Elevation gain
  const eles = points.map(p => p.ele).filter(e => e != null);
  let elevGain = 0;
  for (let i = 1; i < eles.length; i++) {
    const diff = eles[i] - eles[i-1];
    if (diff > 0.5) elevGain += diff; // 0.5m threshold to filter GPS noise
  }

  // HR
  const hrs = points.map(p => p.hr).filter(v => v != null && v > 40 && v < 250);

  return {
    distance_km:    distM > 0    ? Math.round(distM / 10) / 100 : null,
    elevation_m:    elevGain > 0 ? Math.round(elevGain)         : null,
    heart_rate_avg: hrs.length   ? Math.round(hrs.reduce((a,b) => a+b, 0) / hrs.length) : null,
    heart_rate_max: hrs.length   ? Math.max(...hrs) : null,
  };
}

// ── Main export ───────────────────────────────────────────────────────────
export async function parseActivityFile(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.fit') {
      return await parseFit(filePath);
    }
    const xml = fs.readFileSync(filePath, 'utf-8');
    if (ext === '.gpx') return parseGpx(xml);
    if (ext === '.kml') return parseKml(xml);
    return null;
  } catch (err) {
    console.error('parseActivityFile error:', err);
    return null;
  }
}
