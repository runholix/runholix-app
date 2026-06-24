export function getDeviceName() {
  const ua = navigator.userAgent;
  // OS detection
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMac = /Macintosh/.test(ua) && !isIOS;
  const isWindows = /Windows/.test(ua);
  const isLinux = /Linux/.test(ua) && !isAndroid;

  // Browser detection (order matters — check Edge/OPR before Chrome)
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Chromium\//.test(ua)) browser = 'Chromium';

  let os = '';
  if (isIOS) os = /iPad/.test(ua) ? 'iPad' : 'iPhone';
  else if (isAndroid) os = 'Android';
  else if (isMac) os = 'Mac';
  else if (isWindows) os = 'Windows';
  else if (isLinux) os = 'Linux';

  return os ? `${browser} on ${os}` : browser;
}

import { APP_VERSION } from './version.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData], char => char.charCodeAt(0));
}

export async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('This browser does not support service workers.');
  }
  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    registration = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(APP_VERSION)}`);
  }
  await navigator.serviceWorker.ready;
  return registration;
}

export async function subscribeToPush(publicKey) {
  if (!publicKey) throw new Error('Push notifications are not configured on this server.');
  const registration = await ensureServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  return subscription.toJSON();
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
