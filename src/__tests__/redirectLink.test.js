/** WhatsApp UTILITY-template redirect links open the app (2026-10-10). */
import fs from 'fs';
import path from 'path';
import {parseRedirectLink} from '../utils/redirectLink';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';
const read = p => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

test('per-customer execute link', () => {
  expect(parseRedirectLink(`https://app.alphaquark.in/api/redirect/prod~${TOKEN}`))
    .toEqual({kind: 'execute', tenant: 'prod', token: TOKEN});
  expect(parseRedirectLink(`https://APP.alphaquark.in/api/redirect/Prod~${TOKEN}?x=1#y`))
    .toEqual({kind: 'execute', tenant: 'prod', token: TOKEN});
});

test('generic "View update" link', () => {
  expect(parseRedirectLink('https://app.alphaquark.in/api/redirect/prod.alphaquark.in'))
    .toEqual({kind: 'view', slug: 'prod.alphaquark.in'});
});

test('anything else is not ours', () => {
  for (const u of [
    `https://evil.example/api/redirect/prod~${TOKEN}`,
    `http://app.alphaquark.in/api/redirect/prod~${TOKEN}`,
    'https://app.alphaquark.in/api/redirect/prod~short',
    'https://app.alphaquark.in/l/prod?t=x',
    'https://app.alphaquark.in/api/redirect/a/b',
    null,
  ]) {
    expect(parseRedirectLink(u)).toBeNull();
  }
});

test('native claims are this tenant only and wired into handleSmartLink', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  expect(read('src/utils/smartLink.js')).toContain('if (!parsed) return handleRedirectLink(url);');
  // White-label forks claim WhatsApp redirect links only once their own tenant
  // is registered in WellKnownRouter; until then they must not claim prod's.
  if (!manifest.includes('/api/redirect/')) {
    expect(manifest).not.toContain('/api/redirect/prod~');
    return;
  }
  expect(manifest).toContain('<data android:host="app.alphaquark.in" />');
  expect(manifest).toContain('<data android:pathPrefix="/api/redirect/prod~" />');
  expect(manifest).toContain('<data android:path="/api/redirect/prod.alphaquark.in" />');
  expect(read('ios/AlphaQuark/AlphaQuark.entitlements')).toContain('<string>applinks:app.alphaquark.in</string>');
  expect(read('src/utils/smartLink.js')).toContain('if (!parsed) return handleRedirectLink(url);');
});
