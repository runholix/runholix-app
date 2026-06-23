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
