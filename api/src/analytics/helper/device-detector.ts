export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown';

export function detectDevice(userAgent?: string | null): DeviceType {
  if (!userAgent) return 'unknown';
  if (/bot|crawler|spider|slurp|facebookexternalhit/i.test(userAgent)) return 'bot';
  if (/ipad|tablet|kindle/i.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export interface ClientInfo {
  device_vendor: string;
  device_model: string;
  os_name: string;
  os_version: string;
  browser_name: string;
  browser_major: string;
}

const UNKNOWN = 'unknown';

// Strip non-printable ASCII and truncate to avoid storing arbitrary user-controlled strings
const sanitize = (val: string, maxLen = 80): string =>
  val
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, maxLen) || UNKNOWN;

const ANDROID_VENDORS: [RegExp, string][] = [
  [/samsung|SM-|SCH-|SGH-|SHV-|SPH-/i, 'Samsung'],
  [/xiaomi|redmi|poco/i, 'Xiaomi'],
  [/huawei|honor/i, 'Huawei'],
  [/motorola|moto\s/i, 'Motorola'],
  [/LGE|LG-/i, 'LG'],
  [/sony|xperia/i, 'Sony'],
  [/oneplus/i, 'OnePlus'],
  [/asus/i, 'ASUS'],
  [/oppo/i, 'OPPO'],
  [/vivo/i, 'Vivo'],
  [/realme/i, 'Realme'],
  [/nokia/i, 'Nokia'],
  [/tcl/i, 'TCL'],
];

export function parseUA(userAgent?: string | null): ClientInfo {
  const empty: ClientInfo = {
    device_vendor: UNKNOWN,
    device_model: UNKNOWN,
    os_name: UNKNOWN,
    os_version: UNKNOWN,
    browser_name: UNKNOWN,
    browser_major: UNKNOWN,
  };

  if (!userAgent) return empty;

  const ua = userAgent;

  // ── OS ──────────────────────────────────────────────────────────────────
  let os_name = UNKNOWN;
  let os_version = UNKNOWN;

  const androidM = ua.match(/Android ([\d.]+)/);
  if (androidM) {
    os_name = 'Android';
    os_version = androidM[1].split('.')[0]; // major only
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    const iosM = ua.match(/OS ([\d_]+)/);
    os_name = 'iOS';
    if (iosM) os_version = iosM[1].split('_')[0];
  } else if (/Windows NT/.test(ua)) {
    os_name = 'Windows';
    const winM = ua.match(/Windows NT ([\d.]+)/);
    if (winM) {
      const map: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
      os_version = map[winM[1]] ?? winM[1];
    }
  } else if (/Mac OS X/.test(ua)) {
    os_name = 'macOS';
    const macM = ua.match(/Mac OS X ([\d_.]+)/);
    if (macM) os_version = macM[1].split(/[_.]/, 1)[0];
  } else if (/Linux/.test(ua)) {
    os_name = 'Linux';
  }

  // ── Device ──────────────────────────────────────────────────────────────
  let device_vendor = UNKNOWN;
  let device_model = UNKNOWN;

  if (os_name === 'Android') {
    // UA format: (Linux; Android X.X; Vendor Model Build/...)
    const devM = ua.match(/Android [\d.]+;\s*([^)]+)\)/);
    if (devM) {
      const raw = devM[1].split(/\s+Build\//)[0].trim(); // strip "Build/..."
      device_model = sanitize(raw);
      for (const [pattern, vendor] of ANDROID_VENDORS) {
        if (pattern.test(raw) || pattern.test(ua)) {
          device_vendor = vendor;
          break;
        }
      }
    }
  } else if (os_name === 'iOS') {
    device_vendor = 'Apple';
    device_model = /iPad/.test(ua) ? 'iPad' : /iPod/.test(ua) ? 'iPod' : 'iPhone';
  } else if (os_name === 'macOS') {
    device_vendor = 'Apple';
    device_model = 'Mac';
  } else if (os_name === 'Windows') {
    device_vendor = 'PC';
    device_model = 'Windows PC';
  } else if (os_name === 'Linux') {
    device_vendor = 'PC';
    device_model = 'Linux PC';
  }

  // ── Browser ─────────────────────────────────────────────────────────────
  let browser_name = UNKNOWN;
  let browser_major = UNKNOWN;

  // Order matters: Edge & Opera both contain "Chrome/" in their UA
  const browserPatterns: [RegExp, string, RegExp][] = [
    [/Edg\//, 'Edge', /Edg\/([\d]+)/],
    [/OPR\//, 'Opera', /OPR\/([\d]+)/],
    [/SamsungBrowser\//, 'Samsung Browser', /SamsungBrowser\/([\d]+)/],
    [/Chrome\//, 'Chrome', /Chrome\/([\d]+)/],
    [/Firefox\//, 'Firefox', /Firefox\/([\d]+)/],
    [/Version\/.*Safari/, 'Safari', /Version\/([\d]+)/],
    [/Safari\//, 'Safari', /Safari\/([\d]+)/],
  ];

  for (const [detect, name, versionRe] of browserPatterns) {
    if (detect.test(ua)) {
      browser_name = name;
      const m = ua.match(versionRe);
      if (m) browser_major = m[1];
      break;
    }
  }

  return { device_vendor, device_model, os_name, os_version, browser_name, browser_major };
}
