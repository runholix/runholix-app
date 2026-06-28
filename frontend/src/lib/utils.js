import { format, parseISO } from "date-fns";

export const PDF_MAX_BYTES = 10 * 1024 * 1024;
export const ROUTE_HARD_MAX = 100 * 1024 * 1024;
export const ROUTE_BASE_BYTES = 5 * 1024 * 1024;

export function sanitiseFileName(raw) {
    return (raw || 'upload')
        .replace(/\0/g, '')
        .replace(/[/\\:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/\.{2,}/g, '.')
        .slice(0, 200) || 'upload';
}

export function routeLimitBytes(distanceKm) {
    const km = parseFloat(distanceKm);
    if (!km || km <= 10) return ROUTE_BASE_BYTES;
    const calculated = Math.ceil(km * 0.6 * 1024 * 1024);
    return Math.min(calculated, ROUTE_HARD_MAX);
}

export function fmtMB(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export function validateRouteFile(file, distanceKm) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['fit', 'gpx', 'kml'].includes(ext)) return 'Only .fit, .gpx, .kml files are accepted';
    const limit = routeLimitBytes(distanceKm);
    if (file.size > limit) {
        const km = parseFloat(distanceKm);
        const ctx = km > 0 ? `for a ${km} km race` : 'for undefined distance';
        return `File too large ${ctx}. Maximum: ${fmtMB(limit)}`;
    }
    return null;
}

export function fmtTime(sec) {
    if (!sec) return '—';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

export function fmtDate(val) {
    return val ? format(parseISO(val), 'dd MMM yyyy') : null;
}

export function fmtDateTime(value) {
    if (!value) return null;
    return format(parseISO(String(value).replace(' ', 'T')), 'dd MMM yyyy, HH:mm');
}

// Parse "HH:MM:SS" or "MM:SS" string to seconds
export function parseTimeStr(t) {
    if (!t) return null;
    const parts = t.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
}

// Returns "M:SS /km" pace string
export function paceStr(sec, distKm) {
    if (!sec || !distKm || distKm <= 0) return null;
    const paceS = Math.round(sec / distKm);
    const m = Math.floor(paceS / 60);
    const s = paceS % 60;
    return `${m}:${String(s).padStart(2,'0')} /km`;
}

// Locale-formatted number with optional decimal places and suffix
export function fmtNum(v, { decimals = 0, suffix = '' } = {}) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (isNaN(n)) return null;
    const formatted = decimals !== undefined
        ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : n.toLocaleString("en-US");
    return suffix ? `${formatted} ${suffix}` : formatted;
}

export function fmtDist(km) {
    if (!km) return '—';
    return fmtNum(km, { decimals: 0, suffix: 'km' });
}

export function validatePdfFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf') return 'Only PDF files are accepted';
    if (file.size > PDF_MAX_BYTES) return `PDF too large. Maximum: ${fmtMB(PDF_MAX_BYTES)}`;
    return null;
}

// ── Activity file parser (client-side, no library) ────────────────────────
// Returns { distanceKm, elevationGainM, heartRateAvg, heartRateMax } — any may be null
export async function parseActivityFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const text = ext !== 'fit' ? await file.text() : null;
    const bytes = ext === 'fit' ? new Uint8Array(await file.arrayBuffer()) : null;

    try {
        if (ext === 'gpx') return parseGpx(text);
        if (ext === 'kml') return parseKml(text);
        if (ext === 'fit') return parseFit(bytes);
    } catch { /* swallow parse errors — autofill is best-effort */ }
    return {};
}

// Haversine distance between two lat/lon points in km
export function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function parseGpx(text) {
    const dom = new DOMParser().parseFromString(text, 'application/xml');
    const pts = [...dom.querySelectorAll('trkpt')];
    if (!pts.length) return {};

    let distKm = 0, elevGain = 0, prevEle = null, prevLat = null, prevLon = null;
    const hrs = [];

    pts.forEach(pt => {
        const lat = parseFloat(pt.getAttribute('lat'));
        const lon = parseFloat(pt.getAttribute('lon'));
        const eleEl = pt.querySelector('ele');
        const ele = eleEl ? parseFloat(eleEl.textContent) : null;
        const hrEl = pt.querySelector('hr, gpxtpx\\:hr');
        if (hrEl) hrs.push(parseInt(hrEl.textContent));

        if (prevLat !== null) distKm += haversineKm(prevLat, prevLon, lat, lon);
        if (ele !== null && prevEle !== null && ele > prevEle) elevGain += ele - prevEle;
        prevLat = lat; prevLon = lon; prevEle = ele;
    });

    // Also check heart rate in extensions (Garmin style)
    [...dom.querySelectorAll('extensions')].forEach(ext => {
        const hr = ext.querySelector('hr, TrackPointExtension > hr');
        if (hr) hrs.push(parseInt(hr.textContent));
    });

    return {
        distanceKm: distKm > 0 ? Math.round(distKm * 1000) / 1000 : null,
        elevationGainM: elevGain > 0 ? Math.round(elevGain) : null,
        heartRateAvg: hrs.length ? Math.round(hrs.reduce((a,b) => a+b, 0) / hrs.length) : null,
        heartRateMax: hrs.length ? Math.max(...hrs) : null,
    };
}

export function parseKml(text) {
    const dom = new DOMParser().parseFromString(text, 'application/xml');
    // KML stores coords as lon,lat,ele tuples
    const coordEl = dom.querySelector('coordinates');
    if (!coordEl) return {};
    const tuples = coordEl.textContent.trim().split(/\s+/).map(t => t.split(',').map(Number));
    if (tuples.length < 2) return {};

    let distKm = 0, elevGain = 0, prevEle = null, prevLat = null, prevLon = null;
    tuples.forEach(([lon, lat, ele]) => {
        if (isNaN(lat) || isNaN(lon)) return;
        if (prevLat !== null) distKm += haversineKm(prevLat, prevLon, lat, lon);
        if (!isNaN(ele) && prevEle !== null && ele > prevEle) elevGain += ele - prevEle;
        prevLat = lat; prevLon = lon; prevEle = isNaN(ele) ? null : ele;
    });

    return {
        distanceKm: distKm > 0 ? Math.round(distKm * 1000) / 1000 : null,
        elevationGainM: elevGain > 0 ? Math.round(elevGain) : null,
        heartRateAvg: null, heartRateMax: null,
    };
}

// Intervented with other AI
export function parseFit(bytes) {
    if (!bytes || bytes.length < 12) return {};

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headerSize = bytes[0]; // usually 12 or 14

    if (headerSize < 12 || bytes.length < headerSize) return {};

    const dataSize = view.getUint32(4, true); // FIT header is little-endian
    const end = headerSize + dataSize;

    if (bytes.length < end) return {}; // truncated file

    const localMsgDefs = {};

    const recordHrs = [];
    const lapAvgHrs = [];
    const lapMaxHrs = [];

    let recordMaxDistRaw = 0; // record.distance: field 5, uint32, scale 100, metres
    let recordElevGainRaw = 0; // altitude raw units, scale 5
    let prevAltRaw = null;

    let sessionDistanceRaw = null; // session.total_distance: field 9, uint32, scale 100, metres
    let sessionElevationGainM = null; // session.total_ascent: field 22, uint16, metres
    let sessionAvgHr = null; // session.avg_heart_rate: field 16, uint8
    let sessionMaxHr = null; // session.max_heart_rate: field 17, uint8

    let lapDistanceRawTotal = 0; // lap.total_distance: field 9, uint32, scale 100, metres
    let lapElevationGainMTotal = 0; // lap.total_ascent: field 21, uint16, metres

    let foundData = false;
    let offset = headerSize;

    function isValidUint8(value) {
        return value !== null && value !== 0xFF;
    }

    function isValidUint16(value) {
        return value !== null && value !== 0xFFFF;
    }

    function isValidUint32(value) {
        return value !== null && value !== 0xFFFFFFFF;
    }

    function readFieldValue(field, isBigEndian) {
        if (offset + field.size > end) {
            offset = end;
            return null;
        }

        let value = null;

        // This intentionally supports only the simple scalar field sizes needed
        // by distance, altitude, ascent, and heart-rate fields.
        if (field.size === 1) {
            value = view.getUint8(offset);
        } else if (field.size === 2) {
            value = view.getUint16(offset, !isBigEndian);
        } else if (field.size === 4) {
            value = view.getUint32(offset, !isBigEndian);
        }

        offset += field.size;
        return value;
    }

    function parseDataMessage(def) {
        const globalNum = def.globalNum;

        for (const field of def.fields) {
            const value = readFieldValue(field, def.isBigEndian);
            if (value === null) continue;

            const isSession = globalNum === 18;
            const isLap = globalNum === 19;
            const isRecord = globalNum === 20;

            if (isSession) {
                // session.total_distance — field 9, uint32, scale 100, unit m
                if (field.fieldNum === 9 && field.size === 4 && isValidUint32(value)) {
                    sessionDistanceRaw = value;
                    foundData = true;
                }

                // session.avg_heart_rate — field 16, uint8, bpm
                if (field.fieldNum === 16 && field.size === 1 && isValidUint8(value) && value > 0) {
                    sessionAvgHr = value;
                    foundData = true;
                }

                // session.max_heart_rate — field 17, uint8, bpm
                if (field.fieldNum === 17 && field.size === 1 && isValidUint8(value) && value > 0) {
                    sessionMaxHr = value;
                    foundData = true;
                }

                // session.total_ascent — field 22, uint16, metres
                if (field.fieldNum === 22 && field.size === 2 && isValidUint16(value)) {
                    sessionElevationGainM = value;
                    foundData = true;
                }
            }

            if (isLap) {
                // lap.total_distance — field 9, uint32, scale 100, unit m
                if (field.fieldNum === 9 && field.size === 4 && isValidUint32(value)) {
                    lapDistanceRawTotal += value;
                    foundData = true;
                }

                // lap.avg_heart_rate — field 15, uint8, bpm
                if (field.fieldNum === 15 && field.size === 1 && isValidUint8(value) && value > 0) {
                    lapAvgHrs.push(value);
                    foundData = true;
                }

                // lap.max_heart_rate — field 16, uint8, bpm
                if (field.fieldNum === 16 && field.size === 1 && isValidUint8(value) && value > 0) {
                    lapMaxHrs.push(value);
                    foundData = true;
                }

                // lap.total_ascent — field 21, uint16, metres
                if (field.fieldNum === 21 && field.size === 2 && isValidUint16(value)) {
                    lapElevationGainMTotal += value;
                    foundData = true;
                }
            }

            if (isRecord) {
                // record.distance — field 5, uint32, scale 100, unit m
                // Your previous code used field 6; in the standard FIT profile,
                // field 6 is speed, while distance is field 5.
                if (field.fieldNum === 5 && field.size === 4 && isValidUint32(value)) {
                    if (value > recordMaxDistRaw) recordMaxDistRaw = value;
                    foundData = true;
                }

                // record.altitude — field 2, uint16, scale 5, offset 500, unit m
                if (field.fieldNum === 2 && field.size === 2 && isValidUint16(value)) {
                    const altitudeM = value / 5 - 500;

                    if (altitudeM > -500 && altitudeM < 9000) {
                        if (prevAltRaw !== null) {
                            const gainRaw = value - prevAltRaw;
                            if (gainRaw > 0) recordElevGainRaw += gainRaw;
                        }

                        prevAltRaw = value;
                        foundData = true;
                    }
                }

                // record.heart_rate — field 3, uint8, bpm
                if (field.fieldNum === 3 && field.size === 1 && isValidUint8(value) && value > 0) {
                    recordHrs.push(value);
                    foundData = true;
                }
            }
        }
    }

    while (offset < end) {
        if (offset >= bytes.length) break;

        const recordHeader = bytes[offset++];

        const isCompressedTimestamp = (recordHeader & 0x80) !== 0;

        if (isCompressedTimestamp) {
            // Compressed timestamp header:
            // local message number is stored in bits 6-5.
            // This is still a data message, so parse it instead of skipping it.
            const localNum = (recordHeader >> 5) & 0x03;
            const def = localMsgDefs[localNum];

            if (!def) break;

            parseDataMessage(def);
            continue;
        }

        const isDefinition = (recordHeader & 0x40) !== 0;
        const hasDevFields = (recordHeader & 0x20) !== 0;
        const localNum = recordHeader & 0x0F;

        if (isDefinition) {
            if (offset + 5 > end) break;

            offset++; // reserved byte

            const arch = bytes[offset++]; // 0 = little-endian, 1 = big-endian
            const isBigEndian = arch === 1;

            const globalNum = view.getUint16(offset, !isBigEndian);
            offset += 2;

            const numFields = bytes[offset++];

            const fields = [];

            for (let i = 0; i < numFields; i++) {
                if (offset + 3 > end) break;

                const fieldNum = bytes[offset++];
                const size = bytes[offset++];
                const baseType = bytes[offset++];

                fields.push({ fieldNum, size, baseType });
            }

            if (hasDevFields && offset < end) {
                const numDevFields = bytes[offset++];

                for (let i = 0; i < numDevFields; i++) {
                    if (offset + 3 > end) break;

                    // developer field definition:
                    // field_number, size, developer_data_index
                    offset += 3;
                }
            }

            localMsgDefs[localNum] = {
                globalNum,
                isBigEndian,
                fields,
            };
        } else {
            const def = localMsgDefs[localNum];

            if (!def) {
                // Without the local definition we cannot know this message length.
                break;
            }

            parseDataMessage(def);
        }
    }

    if (!foundData) return {};

    const distanceRaw =
        sessionDistanceRaw ??
        (lapDistanceRawTotal > 0 ? lapDistanceRawTotal : null) ??
        (recordMaxDistRaw > 0 ? recordMaxDistRaw : null);

    const distanceKm = distanceRaw != null && distanceRaw > 0
        ? Math.round((distanceRaw / 100 / 1000) * 1000) / 1000
        : null;

    const elevationGainM =
        sessionElevationGainM ??
        (lapElevationGainMTotal > 0 ? lapElevationGainMTotal : null) ??
        (recordElevGainRaw > 0 ? Math.round(recordElevGainRaw / 5) : null);

    const heartRateAvg =
        sessionAvgHr ??
        (
            lapAvgHrs.length
                ? Math.round(lapAvgHrs.reduce((sum, hr) => sum + hr, 0) / lapAvgHrs.length)
                : recordHrs.length
                    ? Math.round(recordHrs.reduce((sum, hr) => sum + hr, 0) / recordHrs.length)
                    : null
        );

    const heartRateMax =
        sessionMaxHr ??
        (
            lapMaxHrs.length
                ? Math.max(...lapMaxHrs)
                : recordHrs.length
                    ? Math.max(...recordHrs)
                    : null
        );

    return {
        distanceKm,
        elevationGainM,
        heartRateAvg,
        heartRateMax,
    };
}

// ── HEIC → JPEG conversion via canvas ────────────────────────────────────
export async function heicToJpeg(file) {
    // Load heic2any lazily via dynamic import (CDN fallback: draw on canvas)
    // We use the createImageBitmap approach which works for HEIC in some browsers,
    // otherwise fall back to drawing via an img element with object URL.
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width  = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(blob => {
                URL.revokeObjectURL(url);
                if (!blob) return reject(new Error('HEIC conversion failed'));
                resolve(new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.92);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load HEIC image')); };
        img.src = url;
    });
}

// ── Sort key for ordering events by time ──────────────────────────────────
// Race flag-off → RPC time → training time → type order → name
function eventSortKey(ev) {
    const timeStr = ev.time || '';
    // Parse HH:MM times to minutes for sorting; non-time strings sort after
    const timeMin = /^\d{1,2}:\d{2}/.test(timeStr)
        ? parseInt(timeStr) * 60 + parseInt(timeStr.split(':')[1])
        : 9999;
    const typeOrder = { registration: 0, race: 1, rpc: 2, training: 3 };
    return [timeMin, typeOrder[ev.type] ?? 3, ev.label];
}

export function sortedEvents(events) {
    return [...events].sort((a, b) => {
        const [am, at, al] = eventSortKey(a);
        const [bm, bt, bl] = eventSortKey(b);
        if (am !== bm) return am - bm;
        if (at !== bt) return at - bt;
        return al < bl ? -1 : al > bl ? 1 : 0;
    });
}