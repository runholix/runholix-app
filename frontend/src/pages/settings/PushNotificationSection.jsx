import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { subscribeToPush, unsubscribeFromPush, getDeviceName } from '../../lib/push.js';
import { Section } from './SettingsPage.jsx';
import Alert from '../../components/Alert.jsx';

function isInstalledPwa() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone;
}

export default function PushNotificationSection({ user, onUpdate }) {
  const [devices, setDevices] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(isInstalledPwa());
  const [currentEndpoint, setCurrentEndpoint] = useState(null);

  useEffect(() => {
    const onBeforeInstallPrompt = e => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const [data, sub] = await Promise.all([
          api.getPushNotification(),
          ('serviceWorker' in navigator
              ? navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription()).catch(() => null)
              : Promise.resolve(null)),
        ]);
        if (!mounted) return;

        const devices = Array.isArray(data.devices) ? data.devices : [];
        setDevices(devices);
        setConfigured(Boolean(data.configured));
        setPublicKey(data.publicKey || null);

        if (sub) {
          const stillRegistered = devices.some(d => d.endpoint === sub.endpoint);
          if (!stillRegistered) {
            // Server no longer knows about this subscription — clean up locally
            await unsubscribeFromPush();
            setCurrentEndpoint(null);
          } else {
            setCurrentEndpoint(sub.endpoint);
          }
        }
      } catch (err) {
        if (mounted) setResult({ type: 'error', message: err.message });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  const permission = useMemo(() => (('Notification' in window) ? Notification.permission : 'unoperable'), []);
  const mobileNeedsInstall = useMemo(() => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !installed, [installed]);
  const isCurrentDeviceRegistered = useMemo(
      () => Boolean(currentEndpoint && devices.some(d => d.endpoint === currentEndpoint && d.is_enabled)),
      [currentEndpoint, devices]
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const [data, sub] = await Promise.all([
        api.getPushNotification(),
        ('serviceWorker' in navigator
            ? navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription()).catch(() => null)
            : Promise.resolve(null)),
      ]);
      setDevices(Array.isArray(data.devices) ? data.devices : []);
      setConfigured(Boolean(data.configured));
      setPublicKey(data.publicKey || null);
      if (sub) setCurrentEndpoint(sub.endpoint);
      else setCurrentEndpoint(null);
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    if (!configured || !publicKey) return;
    if (Notification.permission === 'denied') {
      return setResult({ type: 'error', message: 'Browser notifications are blocked. Please re-enable them in your browser settings.' });
    }

    setSaving(true);
    setResult(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      const deviceName = getDeviceName();

      // 1. If we already have a subscription in this browser, just use it.
      if (subscription) {
        const subscriptionData = subscription.toJSON();
        await api.managePushSubscription({ action: 'enable', subscription: subscriptionData, deviceName });
        setCurrentEndpoint(subscription.endpoint);
      } else {
        // 2. If it's a brand new device, perform the full subscription flow.
        const permissionResult = await Notification.requestPermission();
        if (permissionResult !== 'granted') {
          throw new Error('Notification permission is required.');
        }

        const newSubscription = await subscribeToPush(publicKey);
        await api.managePushSubscription({ action: 'enable', subscription: newSubscription, deviceName });
        setCurrentEndpoint(newSubscription.endpoint);
      }

      await refresh();
      setResult({ type: 'success', message: 'Device registration updated successfully.' });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDevice = async (device) => {
    setSaving(true);
    setResult(null);
    try {
      const isEnabled = device.is_enabled;
      const action = isEnabled ? 'disable' : 'enable';
      const payload = isEnabled
          ? { action, endpoint: device.endpoint }
          : { action, subscription: { endpoint: device.endpoint } };

      // If we are disabling the current browser's subscription, clean it up locally
      if (isEnabled) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription && subscription.endpoint === device.endpoint) {
          await unsubscribeFromPush();
        }
      }

      await api.managePushSubscription(payload);

      await refresh();
      setResult({ type: 'success', message: `Device ${action}ed successfully.` });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = async (endpoint) => {
    if (!window.confirm('Remove this device registration?')) return;
    setSaving(true);
    setResult(null);
    try {
      // If the deleted device is the current browser, clean up local subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription && subscription.endpoint === endpoint) {
        await unsubscribeFromPush();
      }

      // For 'delete': needs { action, endpoint }
      await api.managePushSubscription({ action: 'delete', endpoint });
      await refresh();
      setResult({ type: 'success', message: 'Device removed.' });
    } catch (err) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const install = async () => {
    if (!installPrompt) return;
    const prompt = await installPrompt.prompt();
    if (prompt.outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  };

  return (
      <Section title="Push notifications" description="Manage device-specific notification settings. Enable or disable notification reminders about race registration, race pack collection and race day for different browsers/devices.">
        {!configured && !loading && (
            <Alert type="info" message="Push notifications are not configured on this server." />
        )}

        {loading ? (
            <div className="alert-info">Loading devices...</div>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {devices.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {devices.map(device => {
                      const isCurrent = device.endpoint === currentEndpoint;
                      const label = device.device_name || 'Unknown Device';
                      return (
                          <div key={device.endpoint} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', border: `1px solid ${isCurrent ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontWeight: 600, fontSize: 13, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                {label}{isCurrent && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'var(--color-primary-subtle, #e8f0fe)', borderRadius: 4, padding: '1px 5px' }}>Current</span>}
                              </div>
                              <div style={{ fontSize: 12, color: device.is_enabled ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                {device.is_enabled ? 'Enabled' : 'Disabled'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                  type="button"
                                  className={`btn btn-sm ${device.is_enabled ? 'btn-secondary' : 'btn-primary'}`}
                                  onClick={() => handleToggleDevice(device)}
                                  disabled={saving}
                              >
                                {device.is_enabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteDevice(device.endpoint)}
                                  disabled={saving}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                      );
                    })}
                  </div>
              ) : (
                  <div style={{ fontSize: 14, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No devices registered.</div>
              )}

              <div style={{ paddingTop: 8 }}>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAddDevice}
                    disabled={saving || !configured || !publicKey || isCurrentDeviceRegistered}
                    title={isCurrentDeviceRegistered ? 'This device is already registered' : undefined}
                >
                  {saving ? 'Registering...' : isCurrentDeviceRegistered ? 'Device Already Added' : 'Add This Device'}
                </button>
              </div>

              {mobileNeedsInstall && (
                  <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-bg)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Install the app first on iPhone or Android</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                      Installed PWAs are the reliable path for server-driven push on mobile.
                    </div>
                    {installPrompt ? (
                        <button className="btn btn-secondary btn-sm" onClick={install}>Install app</button>
                    ) : (
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          Open the browser menu and choose Add to Home Screen.
                        </div>
                    )}
                  </div>
              )}
              <Alert {...(result || {})} />
            </div>
        )}
      </Section>
  );
}
