import webpush from 'web-push';
import pool from './db/pool.js';

const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:support@example.com';
const APP_URL = (process.env.APP_URL || 'http://localhost').replace(/\/$/, '');

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export const pushEnabled = Boolean(publicKey && privateKey);

export function getPushPublicKey() {
  return publicKey || null;
}

export async function upsertPushSubscription(userId, subscription) {
  if (!subscription?.endpoint) throw new Error('Invalid push subscription');

  // 1. Check if this specific endpoint already exists and if it's currently enabled
  const endpointInfo = await pool.query(
      'SELECT is_enabled FROM push_subscriptions WHERE endpoint = $1',
      [subscription.endpoint]
  );

  // 2. We only need to check the limit if we are adding a NEW device
  //    OR re-enabling an OLD/DISABLED device.
  const isNewOrDisabled = endpointInfo.rowCount === 0 || !endpointInfo.rows[0].is_enabled;

  if (isNewOrDisabled) {
    // 3. Only count devices that are ACTUALLY enabled
    const countRes = await pool.query(
        'SELECT COUNT(*) FROM push_subscriptions WHERE user_id = $1 AND is_enabled = true',
        [userId]
    );

    if (parseInt(countRes.rows[0].count, 10) >= 3) {
      throw new Error('Maximum of 3 enabled devices allowed for push notifications');
    }
  }

  // UPDATED: Added 'is_enabled' to the INSERT/UPDATE query
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, subscription, is_enabled, updated_at)
     VALUES ($1, $2, $3, true, NOW())
     ON CONFLICT (endpoint)
       DO UPDATE SET user_id = EXCLUDED.user_id,
         subscription = CASE
            WHEN EXCLUDED.subscription->'keys' IS NOT NULL
              THEN EXCLUDED.subscription
            ELSE push_subscriptions.subscription
           END,
         is_enabled = true,
         updated_at = NOW()`,
    [userId, subscription.endpoint, subscription]
  );
}

export async function setPushSubscriptionEnabled(userId, endpoint, isEnabled) {
  await pool.query(
      'UPDATE push_subscriptions SET is_enabled = $1, updated_at = NOW() WHERE user_id = $2 AND endpoint = $3',
      [isEnabled, userId, endpoint]
  );
}

export async function deletePushSubscription(userId, endpoint) {
  if (!endpoint) return;
  await pool.query(
    'DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2',
    [userId, endpoint]
  );
}

export async function sendPushToUser(userId, payload) {
  if (!pushEnabled) return { sent: 0, disabled: true };
  const { rows } = await pool.query(
    'SELECT id, endpoint, subscription FROM push_subscriptions WHERE user_id=$1 AND is_enabled = true',
    [userId]
  );
  let sent = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload));
      sent += 1;
    } catch (err) {
      const statusCode = err?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id=$1', [row.id]);
      } else {
        console.error(`[push] Failed for user ${userId}:`, err?.message || err);
      }
    }
  }
  return { sent, disabled: false };
}

function raceUrl(raceId) {
  return `${APP_URL}/races/${raceId}`;
}

export function buildRegistrationReminderPush(race, kind = 'd1') {
  const isHour = kind === 't1h';
  return {
    title: isHour ? `1 hour to go: ${race.event_name}` : `Tomorrow: ${race.event_name}`,
    body: isHour
      ? 'Race registration starts in about 1 hour.'
      : 'Race registration starts tomorrow.',
    url: raceUrl(race.id),
    tag: `race-${race.id}-reg-${kind}`,
  };
}

export function buildRegistrationFollowupPush(race) {
  return {
    title: `Update your race details`,
    body: `${race.event_name}: review and update your registration details.`,
    url: raceUrl(race.id),
    tag: `race-${race.id}-reg-d3`,
  };
}

export function buildRaceDayPush(race) {
  return {
    title: `Tomorrow: ${race.event_name}`,
    body: 'Race day is tomorrow. Good luck!',
    url: raceUrl(race.id),
    tag: `race-${race.id}-day`,
  };
}

export function buildRpcReminderPush(race) {
  return {
    title: `Race pack collection starts tomorrow`,
    body: `${race.event_name}: collection begins tomorrow.`,
    url: raceUrl(race.id),
    tag: `race-${race.id}-rpc`,
  };
}

export function buildRpcEndReminderPush(race) {
  return {
    title: `Race pack collection ends today`,
    body: `${race.event_name}: collection closes today and your pack is still not collected.`,
    url: raceUrl(race.id),
    tag: `race-${race.id}-rpc-end`,
  };
}

export function buildFillRpcReminderPush(race, daysUntil) {
  return {
    title: `Add race pack collection details`,
    body: `${race.event_name} is ${daysUntil} day${daysUntil === 1 ? '' : 's'} away — add collection details.`,
    url: raceUrl(race.id),
    tag: `race-${race.id}-fill-rpc-${daysUntil}`,
  };
}

export function buildFillResultsReminderPush(race) {
  return {
    title: `Fill in your race results`,
    body: `How did ${race.event_name} go? Log your results while they're fresh.`,
    url: raceUrl(race.id),
    tag: `race-${race.id}-fill-results`,
  };
}
