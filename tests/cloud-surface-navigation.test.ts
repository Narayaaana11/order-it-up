import assert from 'node:assert/strict';
import { isDesktopOnlyRoute, shouldHideInCloud } from '../frontend/src/lib/cloud-surface';

assert.equal(isDesktopOnlyRoute('/settings'), true);
assert.equal(isDesktopOnlyRoute('/settings?tab=kds'), true, 'query variants are desktop-only');
assert.equal(isDesktopOnlyRoute('/whatsapp'), true);
assert.equal(isDesktopOnlyRoute('/ai-insights'), true);
assert.equal(isDesktopOnlyRoute('/online-orders'), true);
assert.equal(isDesktopOnlyRoute('/customers'), false, 'customer management is Cloud-backed');
assert.equal(isDesktopOnlyRoute('/tablet-pos'), false);
assert.equal(isDesktopOnlyRoute('/settings-archive'), false, 'prefix matching must not overreach');

assert.equal(shouldHideInCloud('/settings', false), true, 'web hides LAN-only settings');
assert.equal(shouldHideInCloud('/settings', true), false, 'the desktop shell keeps settings');
assert.equal(shouldHideInCloud('/customers', false), false);

console.log('Cloud navigation surface gate passed: desktop-only routes are hidden in web only.');
