const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const auth = read('landing/src/lib/auth.ts');
const modal = read('landing/src/components/AuthModal.tsx');
const previews = read('landing/src/components/CredentialsModal.tsx');
const login = read('frontend/src/app/auth/login/page.tsx');
const register = read('frontend/src/app/auth/register/page.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

assert(auth.includes('user.token.length < 20'), 'authenticated browser sessions require a non-trivial cloud token');
assert(auth.includes('setStoredUser(user)'), 'cloud authentication persists the authenticated user');
assert(auth.includes('/api/auth/'), 'landing authentication calls the cloud authentication API');
assert(modal.includes('authenticateWithCloud'), 'landing sign-in and registration use cloud authentication');
assert(!modal.includes('DEMO_USERS') && !modal.includes('setTimeout'), 'landing sign-in has no local demo credential bypass');
assert(previews.includes('setDemoPreviewUser'), 'sample role previews use isolated preview-session storage');
assert(!previews.includes('setStoredUser('), 'sample previews cannot create authenticated sessions');
assert(!auth.includes('demo_google_jwt_token') && !auth.includes('demo_jwt_token_'), 'no synthetic JWT values are issued by landing auth');
assert(!login.includes('demo_google_jwt_token') && !login.includes('handleGoogleDemoSignIn'), 'desktop/cloud login has no simulated Google sign-in');
assert(!register.includes('demo_google_jwt_token') && !register.includes('handleGoogleDemoSignIn'), 'registration has no simulated Google sign-in');
assert(!login.includes("a.download = 'Order-It-Up-Setup.exe'"), 'login never fabricates a text file with an installer extension');

console.log('Production authentication regression checks passed.');
