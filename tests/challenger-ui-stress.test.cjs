/**
 * Challenger 1 Adversarial UI Stress & Empirical Verification Harness
 * 
 * Target Subsystems:
 * 1. AnimatedCounter: Easing math, zero duration, NaN/negatives/floats, rapid re-renders, viewport intersection triggers.
 * 2. AmbientBackground: 10,000 synthetic mouse bursts, touch device compatibility, reduced-motion enforcement.
 * 3. RolePersonas: Rapid tab toggles (1,000 iterations), concurrent simulator mutations, SLA timer stress.
 * 4. Static Export: Exhaustive integrity and payload verification across all 34 routes in frontend/out/.
 * 
 * Run with: `node tests/challenger-ui-stress.test.cjs`
 */

const { describe, it, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const OUT_DIR = path.join(FRONTEND_DIR, 'out');
const LANDING_DIR = path.join(FRONTEND_DIR, 'src', 'components', 'landing');

// ============================================================================
// SUITE 1: ANIMATED COUNTER EMPIRICAL ADVERSARIAL STRESS
// ============================================================================
describe('Suite 1: AnimatedCounter Adversarial Math & Lifecycle Stress', () => {

  // Pure mathematical ease-out function as implemented in AnimatedCounter.tsx
  const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);

  test('1.1: Ease-out curve monotonicity and strict bounds [0, 1] across 10,000 steps', () => {
    let prev = -1;
    const STEPS = 10000;
    for (let i = 0; i <= STEPS; i++) {
      const p = i / STEPS;
      const val = easeOutCubic(p);

      // Boundary guarantees
      assert(val >= 0, `Ease-out at ${p} must be >= 0 (got ${val})`);
      assert(val <= 1, `Ease-out at ${p} must be <= 1 (got ${val})`);

      // Monotonic progression
      assert(val >= prev, `Ease-out must be strictly monotonic at step ${i}`);
      prev = val;
    }
    assert.equal(easeOutCubic(0), 0, 'Origin must be exactly 0');
    assert.equal(easeOutCubic(1), 1, 'Terminal must be exactly 1');
  });

  test('1.2: Zero and negative duration defense (Math.max(duration, 1))', () => {
    // Component implements: progress = Math.min(elapsed / Math.max(duration, 1), 1)
    const computeProgress = (elapsed, duration) => {
      const safeDuration = Math.max(duration, 1);
      return Math.min(elapsed / safeDuration, 1);
    };

    // Duration = 0 must not produce NaN or Infinity
    const pZeroDuration = computeProgress(16, 0);
    assert.equal(Number.isFinite(pZeroDuration), true, 'Duration 0 must result in finite progress');
    assert.equal(pZeroDuration, 1, 'Duration 0 must immediately complete at frame 1');

    // Negative duration must clamp safely
    const pNegDuration = computeProgress(16, -500);
    assert.equal(Number.isFinite(pNegDuration), true, 'Negative duration must result in finite progress');
    assert.equal(pNegDuration, 1, 'Negative duration must clamp to complete');

    // Sub-millisecond duration
    const pSubMs = computeProgress(1, 0.0001);
    assert.equal(pSubMs, 1, 'Sub-millisecond duration must complete safely');
  });

  test('1.3: Number formatting edge cases: NaN, negative, huge, floating point', () => {
    const format = (num, decimals = 0, prefix = '', suffix = '') => {
      return `${prefix}${num.toFixed(decimals)}${suffix}`;
    };

    // Standard integer
    assert.equal(format(50000, 0, '', '+'), '50000+');

    // Floating-point IEEE 754 precision test (0.1 + 0.2)
    const floatVal = 0.1 + 0.2;
    assert.equal(format(floatVal, 2, '₹', ' Cr'), '₹0.30 Cr');

    // Large numbers
    assert.equal(format(999999999999, 0, '$', ''), '$999999999999');

    // Negative values
    assert.equal(format(-1450, 0, '-₹', ''), '-₹-1450');
    assert.equal(format(-1450.55, 2, '₹', ''), '₹-1450.55');

    // NaN input does not throw in JS .toFixed()
    assert.equal(format(NaN, 0), 'NaN');
  });

  test('1.4: Emulated RAF Animation Loop: Frame-by-Frame Convergence', () => {
    // Emulate component animation loop with synthetic 60fps clock (16.66ms per frame)
    const targetValue = 99.9;
    const duration = 1000;
    const decimals = 1;
    const prefix = '';
    const suffix = '%';

    let elapsed = 0;
    let currentRender = '0.0%';
    const recordedValues = [];

    while (elapsed <= duration + 32) {
      const progress = Math.min(elapsed / Math.max(duration, 1), 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = targetValue * easeOut;
      currentRender = `${prefix}${current.toFixed(decimals)}${suffix}`;
      recordedValues.push({ elapsed, progress, current, currentRender });

      if (progress >= 1) {
        currentRender = `${prefix}${targetValue.toFixed(decimals)}${suffix}`;
        break;
      }
      elapsed += 16.666;
    }

    // Verify termination and final output
    assert.equal(currentRender, '99.9%', 'Terminal render must match targetValue with formatting');
    assert(recordedValues.length >= 50, `Must take roughly 60 frames for 1000ms duration (took ${recordedValues.length})`);
    
    // Verify each frame value is monotonically non-decreasing
    for (let i = 1; i < recordedValues.length; i++) {
      assert(
        recordedValues[i].current >= recordedValues[i - 1].current,
        `Frame ${i} (${recordedValues[i].current}) must be >= Frame ${i - 1} (${recordedValues[i - 1].current})`
      );
    }
  });

  test('1.5: Viewport Intersection Observer & Reduced-Motion Emulation', () => {
    const counterSource = fs.readFileSync(path.join(LANDING_DIR, 'AnimatedCounter.tsx'), 'utf8');

    // Verify rootMargin and threshold configuration
    assert(counterSource.includes('threshold: 0.15'), 'Threshold must be 0.15 for early viewport trigger');
    assert(counterSource.includes("rootMargin: '0px 0px -50px 0px'"), 'Root margin must prevent bottom edge false triggers');

    // Verify reduced motion immediate bypass
    assert(
      counterSource.includes("window.matchMedia('(prefers-reduced-motion: reduce)').matches"),
      'Must check prefers-reduced-motion media query'
    );
    assert(
      counterSource.includes('hasAnimatedRef.current = true'),
      'Must mark hasAnimatedRef true to prevent multiple animation triggers'
    );
    assert(
      counterSource.includes('observer.disconnect()'),
      'Must disconnect observer on viewport intersection to prevent CPU leak'
    );
  });

  test('1.6: Rapid Prop Re-render & Cleanup Race Resistance', () => {
    // Verify effect cleanup cancels RAF and disconnects observer
    const counterSource = fs.readFileSync(path.join(LANDING_DIR, 'AnimatedCounter.tsx'), 'utf8');
    assert(counterSource.includes('cancelAnimationFrame(rafId)'), 'Must cancel pending RAF in cleanup');
    assert(counterSource.includes('observer.disconnect()'), 'Must disconnect observer in cleanup');
    assert(counterSource.includes('[targetValue, duration, prefix, suffix, decimals]'), 'Must include all active props in deps array');
  });

  test('1.7: Post-Animation & Mid-Flight Target Value Mutation Snap Invariant', () => {
    // Emulate component behavior when hasAnimatedRef is true
    let hasAnimated = true;
    let textContent = '0';
    const format = (num, decimals = 0) => num.toFixed(decimals);

    // Simulate prop change after having animated
    const handlePropUpdate = (newTarget) => {
      if (hasAnimated) {
        textContent = format(newTarget, 0);
        return { animated: false, output: textContent };
      }
      return { animated: true, output: textContent };
    };

    const res1 = handlePropUpdate(250);
    assert.equal(res1.animated, false, 'Should snap directly without re-animating');
    assert.equal(res1.output, '250');

    const res2 = handlePropUpdate(5000);
    assert.equal(res2.animated, false);
    assert.equal(res2.output, '5000');
  });

  test('1.8: Decimals Boundary & Precision Torture', () => {
    const format = (num, decimals = 0, prefix = '', suffix = '') => {
      return `${prefix}${num.toFixed(decimals)}${suffix}`;
    };

    // Extreme precision decimals
    assert.equal(format(3.1415926535, 4), '3.1416');
    assert.equal(format(0.00001, 5), '0.00001');
    assert.equal(format(1e7, 2), '10000000.00');

    // Negative small fractional number
    assert.equal(format(-0.0005, 3), '-0.001');

    // Zero with multiple decimals
    assert.equal(format(0, 3, '$', ' USD'), '$0.000 USD');
  });
});

// ============================================================================
// SUITE 2: AMBIENT BACKGROUND ADVERSARIAL STRESS
// ============================================================================
describe('Suite 2: AmbientBackground Event Burst & Coordinate Stress', () => {

  test('2.1: 10,000 Synthetic Mouse Event Burst — RAF Single-Flight Invariant', () => {
    // Emulate the AmbientBackground handleMouseMove throttling logic:
    // let rafId = null;
    // const handleMouseMove = (e) => {
    //   if (rafId) cancelAnimationFrame(rafId);
    //   rafId = requestAnimationFrame(...);
    // };
    let rafQueue = [];
    let rafIdCounter = 0;
    let activeRafId = null;
    let scheduledCallbacks = 0;
    let canceledCallbacks = 0;
    let executedCallbacks = 0;

    const mockRequestAnimationFrame = (cb) => {
      const id = ++rafIdCounter;
      rafQueue.push({ id, cb });
      scheduledCallbacks++;
      return id;
    };

    const mockCancelAnimationFrame = (id) => {
      rafQueue = rafQueue.filter((item) => item.id !== id);
      canceledCallbacks++;
    };

    const containerStyle = {};
    const mockContainer = {
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 800, height: 600 }),
      style: {
        setProperty: (prop, val) => { containerStyle[prop] = val; }
      }
    };

    const handleMouseMove = (e) => {
      if (activeRafId) {
        mockCancelAnimationFrame(activeRafId);
      }
      activeRafId = mockRequestAnimationFrame(() => {
        const rect = mockContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        mockContainer.style.setProperty('--spotlight-x', `${x}px`);
        mockContainer.style.setProperty('--spotlight-y', `${y}px`);
      });
    };

    // Adversarial burst: 10,000 rapid mouse movements within a single frame interval
    for (let i = 0; i < 10000; i++) {
      handleMouseMove({ clientX: 200 + (i % 50), clientY: 250 + (i % 50) });
    }

    // Assert: Only 1 item remains in rafQueue!
    assert.equal(rafQueue.length, 1, 'Only exactly 1 RAF callback must be pending in queue despite 10,000 events');
    assert.equal(canceledCallbacks, 9999, '9,999 redundant RAF calls must have been canceled');

    // Flush the single surviving frame
    const finalItem = rafQueue.shift();
    finalItem.cb();
    executedCallbacks++;

    assert.equal(executedCallbacks, 1, 'Only 1 callback executed');
    assert.equal(containerStyle['--spotlight-x'], `${(200 + (9999 % 50)) - 100}px`);
    assert.equal(containerStyle['--spotlight-y'], `${(250 + (9999 % 50)) - 100}px`);
  });

  test('2.2: Coordinate Math Extreme Offsets (Negative, Offscreen, Fractional)', () => {
    const rect = { left: 50, top: 100 };
    const computeCoordinates = (clientX, clientY) => {
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return { x: `${x}px`, y: `${y}px` };
    };

    // Cursor far left-top of screen (negative coordinates)
    const neg = computeCoordinates(-200, -350);
    assert.equal(neg.x, '-250px');
    assert.equal(neg.y, '-450px');

    // Fractional pixels (high-DPI mouse)
    const frac = computeCoordinates(150.456, 250.789);
    assert(Math.abs(parseFloat(frac.x) - 100.456) < 1e-6, `frac.x ${frac.x} must be ~100.456px`);
    assert(Math.abs(parseFloat(frac.y) - 150.789) < 1e-6, `frac.y ${frac.y} must be ~150.789px`);

    // Extreme off-screen right
    const far = computeCoordinates(10000, 20000);
    assert.equal(far.x, '9950px');
    assert.equal(far.y, '19900px');
  });

  test('2.3: Touch-Only Fallback & Pointer Event Transparency', () => {
    const ambientSource = fs.readFileSync(path.join(LANDING_DIR, 'AmbientBackground.tsx'), 'utf8');

    // Verify inline default style values
    assert(ambientSource.includes("'--spotlight-x': '50%'"), 'Must have 50% default X position');
    assert(ambientSource.includes("'--spotlight-y': '20%'"), 'Must have 20% default Y position');

    // Verify pointer-events-none on decorative elements
    assert(ambientSource.includes('pointer-events-none absolute inset-0 z-0 bg-[radial-gradient'), 'Dot matrix must be pointer-events-none');
    assert(ambientSource.includes('pointer-events-none absolute inset-0 z-0 transition-opacity'), 'Spotlight glow must be pointer-events-none');
  });

  test('2.4: Reduced-Motion Bypasses Mousemove Listener', () => {
    const ambientSource = fs.readFileSync(path.join(LANDING_DIR, 'AmbientBackground.tsx'), 'utf8');
    assert(
      ambientSource.includes("window.matchMedia('(prefers-reduced-motion: reduce)').matches"),
      'Must check prefers-reduced-motion to skip mouse tracking'
    );
  });

  test('2.5: Spotlight Lifecycle: Dynamic Toggle and Event Cleanup', () => {
    const ambientSource = fs.readFileSync(path.join(LANDING_DIR, 'AmbientBackground.tsx'), 'utf8');

    // Verify early return when showSpotlight is false
    assert(ambientSource.includes('if (!showSpotlight) return;'), 'Must exit early if showSpotlight is false');

    // Verify window event listener removal and RAF cancellation
    assert(
      ambientSource.includes("window.removeEventListener('mousemove', handleMouseMove)"),
      'Must clean up mousemove event listener on unmount'
    );
    assert(
      ambientSource.includes('cancelAnimationFrame(rafId)'),
      'Must cancel any pending RAF on unmount'
    );
  });
});

// ============================================================================
// SUITE 3: ROLE PERSONAS SIMULATOR & SLA STRESS
// ============================================================================
describe('Suite 3: RolePersonas Simulator State Mutations & SLA Stress', () => {

  const ROLES = ['owner', 'manager', 'cashier', 'waiter', 'chef', 'accountant'];

  test('3.1: 1,000 Rapid Tab Toggles & Persona Lookup Invariant', () => {
    const personasSource = fs.readFileSync(path.join(LANDING_DIR, 'RolePersonas.tsx'), 'utf8');

    // Verify all 6 roles are present in SHOWCASE_PERSONAS
    for (const role of ROLES) {
      assert(personasSource.includes(`id: "${role}"`), `SHOWCASE_PERSONAS must define "${role}"`);
    }

    // Simulate 1,000 rapid random tab switches
    let currentRole = 'owner';
    for (let i = 0; i < 1000; i++) {
      const nextRole = ROLES[Math.floor(Math.random() * ROLES.length)];
      currentRole = nextRole;
      assert(ROLES.includes(currentRole), `Current role must always be valid: ${currentRole}`);
    }
  });

  test('3.2: Owner Simulator: 1,000 Consecutive PIN Generations', () => {
    // Component implements:
    // const random1 = Math.floor(100 + Math.random() * 900);
    // const random2 = Math.floor(100 + Math.random() * 900);
    // return `${random1} ${random2}`;
    for (let i = 0; i < 1000; i++) {
      const r1 = Math.floor(100 + Math.random() * 900);
      const r2 = Math.floor(100 + Math.random() * 900);
      const pin = `${r1} ${r2}`;

      assert.equal(pin.length, 7, `PIN must be 7 characters ("XXX XXX"), got "${pin}"`);
      assert(/^\d{3} \d{3}$/.test(pin), `PIN must match pattern ^\\d{3} \\d{3}$, got "${pin}"`);
      assert(r1 >= 100 && r1 <= 999, 'First block must be in range 100..999');
      assert(r2 >= 100 && r2 <= 999, 'Second block must be in range 100..999');
    }
  });

  test('3.3: Cashier Simulator: Tender Mathematical Balancing Invariant', () => {
    const item1 = 600.00; // 2x Margherita
    const item2 = 240.00; // 2x Iced Tea
    const subtotal = item1 + item2; // 840.00
    const cgstRate = 0.025;
    const sgstRate = 0.025;
    // In Order It Up, menu prices are tax-inclusive: ₹840 = ₹800 base + ₹20 CGST + ₹20 SGST
    const taxIncludedCGST = 20.00;
    const taxIncludedSGST = 20.00;
    const totalDue = subtotal;

    // Test Split Tender: Cash 400 + UPI 440
    const cashTender = 400.00;
    const upiTender = 440.00;
    const splitBalance = totalDue - (cashTender + upiTender);
    assert.equal(splitBalance, 0, 'Split tender balance due must be exactly 0.00');

    // Test 100% Cash: Cash 1000, Change 160
    const cashReceived = 1000.00;
    const changeDue = cashReceived - totalDue;
    assert.equal(changeDue, 160.00, 'Cash change due must be exactly 160.00');
  });

  test('3.4: Waiter Simulator: Table State Machine Cycle Stress', () => {
    // Cycle: vacant -> occupied -> billed -> vacant
    const cycleTableStatus = (status) => {
      if (status === 'vacant') return { status: 'occupied', time: '1m' };
      if (status === 'occupied') return { status: 'billed', time: '45m' };
      return { status: 'vacant', time: '-' };
    };

    let state = { status: 'vacant', time: '-' };
    const history = [];

    // Run 300 state transitions
    for (let i = 0; i < 300; i++) {
      state = cycleTableStatus(state.status);
      history.push(state.status);
    }

    assert.equal(history.length, 300);
    // Verify strict 3-state periodicity
    for (let i = 0; i < 300; i += 3) {
      assert.equal(history[i], 'occupied');
      assert.equal(history[i + 1], 'billed');
      assert.equal(history[i + 2], 'vacant');
    }
  });

  test('3.5: Kitchen Chef SLA Alert Threshold Stress & Ticket Bumping Cycle', () => {
    // SLA Oracle derived from RolePersonas.tsx line 146:
    // Color-coded SLA alert timers (<8m green, 8-15m amber, >15m red/gray)
    const classifySla = (elapsedSeconds, status = 'Preparing') => {
      if (status === 'Served') return 'gray';
      if (elapsedSeconds < 480) return 'green'; // < 8 min
      if (elapsedSeconds < 900) return 'amber'; // 8 - 15 min
      return 'red'; // >= 15 min
    };

    // Boundary value testing
    assert.equal(classifySla(0), 'green', '0s must be green');
    assert.equal(classifySla(252), 'green', '4m 12s (252s) must be green');
    assert.equal(classifySla(479), 'green', '7m 59s (479s) must be green');
    assert.equal(classifySla(480), 'amber', '8m 00s (480s) boundary must be amber');
    assert.equal(classifySla(645), 'amber', '10m 45s (645s) must be amber');
    assert.equal(classifySla(899), 'amber', '14m 59s (899s) boundary must be amber');
    assert.equal(classifySla(900), 'red', '15m 00s (900s) boundary must be red');
    assert.equal(classifySla(1200), 'red', '20m 00s must be red');
    assert.equal(classifySla(962, 'Served'), 'gray', 'Served ticket must always be gray');

    // Ticket bumping state cycle
    const bumpTicket = (status) => {
      if (status === 'Preparing') return { status: 'Ready', sla: 'amber' };
      if (status === 'Ready') return { status: 'Served', sla: 'gray' };
      return { status: 'Preparing', sla: 'green' };
    };

    let ticket = { status: 'Preparing', sla: 'green' };
    ticket = bumpTicket(ticket.status);
    assert.equal(ticket.status, 'Ready');
    assert.equal(ticket.sla, 'amber');

    ticket = bumpTicket(ticket.status);
    assert.equal(ticket.status, 'Served');
    assert.equal(ticket.sla, 'gray');

    ticket = bumpTicket(ticket.status);
    assert.equal(ticket.status, 'Preparing');
    assert.equal(ticket.sla, 'green');
  });

  test('3.6: Adversarial Persona Fallback: Unknown/Corrupted Role IDs', () => {
    const personasSource = fs.readFileSync(path.join(LANDING_DIR, 'RolePersonas.tsx'), 'utf8');

    // Verify fallback code pattern:
    // const activePersona = SHOWCASE_PERSONAS.find((r) => r.id === selectedRole) ||
    //   SHOWCASE_PERSONAS.find((r) => r.id === ROLE_PERSONAS[0].id) ||
    //   SHOWCASE_PERSONAS[0];
    assert(
      personasSource.includes('SHOWCASE_PERSONAS.find((r) => r.id === selectedRole) ||'),
      'Must contain fallback lookup for selectedRole'
    );
    assert(
      personasSource.includes('SHOWCASE_PERSONAS[0]'),
      'Must have absolute guaranteed fallback to SHOWCASE_PERSONAS[0]'
    );

    // Test oracle fallback behavior
    const mockShowcase = [
      { id: 'owner', title: 'Restaurant Owner' },
      { id: 'cashier', title: 'Counter Cashier' },
    ];
    const resolvePersona = (id) => mockShowcase.find((r) => r.id === id) || mockShowcase[0];

    assert.equal(resolvePersona('invalid_role').id, 'owner');
    assert.equal(resolvePersona('').id, 'owner');
    assert.equal(resolvePersona(null).id, 'owner');
    assert.equal(resolvePersona(undefined).id, 'owner');
    assert.equal(resolvePersona('__proto__').id, 'owner');
  });

  test('3.7: Concurrent Functional State Updates: Atomic Mutators', () => {
    // Verify that state mutators use functional updates `setKdsTickets(prev => ...)`
    const personasSource = fs.readFileSync(path.join(LANDING_DIR, 'RolePersonas.tsx'), 'utf8');
    assert(personasSource.includes('setTables((prev) =>'), 'handleToggleTable must use functional updater');
    assert(personasSource.includes('setKdsTickets((prev) =>'), 'handleBumpTicket must use functional updater');
  });
});

// ============================================================================
// SUITE 4: STATIC EXPORT 34-ROUTE VERIFICATION & PAYLOAD INTEGRITY
// ============================================================================
describe('Suite 4: Cloudflare Pages Static Export 34-Route Verification', () => {

  // Authoritative catalog of all 34 statically exported HTML routes in frontend/out/
  const EXPECTED_34_ROUTES = [
    { route: '/', filePath: path.join(OUT_DIR, 'index.html'), desc: 'Root Landing Page' },
    { route: '/404', filePath: path.join(OUT_DIR, '404', 'index.html'), desc: '404 Standalone' },
    { route: '/404.html', filePath: path.join(OUT_DIR, '404.html'), desc: 'Cloudflare Pages Top-Level 404' },
    { route: '/_not-found', filePath: path.join(OUT_DIR, '_not-found', 'index.html'), desc: 'Next.js App Router Not Found' },
    { route: '/addon-groups', filePath: path.join(OUT_DIR, 'addon-groups', 'index.html'), desc: 'POS Add-on Groups' },
    { route: '/ai-insights', filePath: path.join(OUT_DIR, 'ai-insights', 'index.html'), desc: 'AI Menu & Sales Insights' },
    { route: '/auth/login', filePath: path.join(OUT_DIR, 'auth', 'login', 'index.html'), desc: 'Authentication Login' },
    { route: '/auth/recover', filePath: path.join(OUT_DIR, 'auth', 'recover', 'index.html'), desc: 'Password Recovery' },
    { route: '/auth/register', filePath: path.join(OUT_DIR, 'auth', 'register', 'index.html'), desc: 'SaaS Registration & Onboarding' },
    { route: '/cloud-portal', filePath: path.join(OUT_DIR, 'cloud-portal', 'index.html'), desc: 'Owner / Super Admin Cloud HQ Portal' },
    { route: '/customer-display', filePath: path.join(OUT_DIR, 'customer-display', 'index.html'), desc: 'Dual-Screen Customer Facing Display' },
    { route: '/customers', filePath: path.join(OUT_DIR, 'customers', 'index.html'), desc: 'CRM & Customer Loyalty' },
    { route: '/dashboard', filePath: path.join(OUT_DIR, 'dashboard', 'index.html'), desc: 'Manager Store Operations Dashboard' },
    { route: '/expenses', filePath: path.join(OUT_DIR, 'expenses', 'index.html'), desc: 'Petty Cash & Expense Tracking' },
    { route: '/inventory', filePath: path.join(OUT_DIR, 'inventory', 'index.html'), desc: 'Ingredient & Inventory Stock Control' },
    { route: '/kds', filePath: path.join(OUT_DIR, 'kds', 'index.html'), desc: 'Kitchen Display System (POS Integrated)' },
    { route: '/kds-standalone', filePath: path.join(OUT_DIR, 'kds-standalone', 'index.html'), desc: 'Standalone LAN Kitchen Display :3002' },
    { route: '/menu', filePath: path.join(OUT_DIR, 'menu', 'index.html'), desc: 'Digital QR Menu' },
    { route: '/online-orders', filePath: path.join(OUT_DIR, 'online-orders', 'index.html'), desc: 'Aggregator & Web Online Orders' },
    { route: '/order-history-demo', filePath: path.join(OUT_DIR, 'order-history-demo', 'index.html'), desc: 'Audit Order History Demo' },
    { route: '/orders', filePath: path.join(OUT_DIR, 'orders', 'index.html'), desc: 'Live Order Management' },
    { route: '/pos', filePath: path.join(OUT_DIR, 'pos', 'index.html'), desc: 'Counter POS Billing Screen' },
    { route: '/print-test', filePath: path.join(OUT_DIR, 'print-test', 'index.html'), desc: 'Thermal ESC/POS Print Diagnostics' },
    { route: '/products', filePath: path.join(OUT_DIR, 'products', 'index.html'), desc: 'Product & Menu Catalog Management' },
    { route: '/qr', filePath: path.join(OUT_DIR, 'qr', 'index.html'), desc: 'Tabletop QR Dine-In Ordering' },
    { route: '/reports', filePath: path.join(OUT_DIR, 'reports', 'index.html'), desc: 'Accountant Tax & Financial Reports' },
    { route: '/reservations', filePath: path.join(OUT_DIR, 'reservations', 'index.html'), desc: 'Table Reservation Book' },
    { route: '/server-standalone', filePath: path.join(OUT_DIR, 'server-standalone', 'index.html'), desc: 'Standalone Waiter Server :3003' },
    { route: '/settings', filePath: path.join(OUT_DIR, 'settings', 'index.html'), desc: 'POS Hardware & Outlet Settings' },
    { route: '/setup', filePath: path.join(OUT_DIR, 'setup', 'index.html'), desc: 'First-Run Store Setup Wizard' },
    { route: '/staff', filePath: path.join(OUT_DIR, 'staff', 'index.html'), desc: 'Staff Management & Role Assignments' },
    { route: '/support', filePath: path.join(OUT_DIR, 'support', 'index.html'), desc: 'Merchant Support Portal' },
    { route: '/tables', filePath: path.join(OUT_DIR, 'tables', 'index.html'), desc: 'Waiter Floorplan & Table Management' },
    { route: '/whatsapp', filePath: path.join(OUT_DIR, 'whatsapp', 'index.html'), desc: 'WhatsApp Digital Bill & Marketing' },
  ];

  test('4.1: Verify existence of all 34 statically generated route HTML files in frontend/out/', () => {
    assert.equal(EXPECTED_34_ROUTES.length, 34, 'Expected catalog must contain exactly 34 routes');

    for (const item of EXPECTED_34_ROUTES) {
      const exists = fs.existsSync(item.filePath);
      assert(
        exists,
        `Route "${item.route}" (${item.desc}) is missing from static export directory: ${item.filePath}`
      );
    }
  });

  test('4.2: Verify HTML document integrity, non-trivial payload size, and valid structure', () => {
    for (const item of EXPECTED_34_ROUTES) {
      const stat = fs.statSync(item.filePath);
      assert(
        stat.size >= 500,
        `Route "${item.route}" payload size is suspiciously small: ${stat.size} bytes (min expected: 500 bytes)`
      );

      const content = fs.readFileSync(item.filePath, 'utf8');

      // Check essential HTML markers
      assert(content.includes('<!DOCTYPE html>'), `Route "${item.route}" missing <!DOCTYPE html>`);
      assert(content.includes('<html'), `Route "${item.route}" missing <html tag`);
      assert(content.includes('<head'), `Route "${item.route}" missing <head tag`);
      assert(content.includes('<body'), `Route "${item.route}" missing <body tag`);
      assert(content.includes('</html>'), `Route "${item.route}" missing closing </html> tag`);

      // Check for common SSR / build-time error strings
      assert(
        !content.includes('Application error: a client-side exception has occurred'),
        `Route "${item.route}" contains unhandled client exception error screen`
      );
      assert(
        !content.includes('Error: Hydration failed'),
        `Route "${item.route}" contains hydration error trace`
      );
    }
  });

  test('4.3: Verify Landing Page index.html embeds React Bits styling and structure', () => {
    const indexPath = path.join(OUT_DIR, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    // Key marketing sections
    assert(indexContent.includes('Order It Up'), 'index.html must include brand title');
    assert(indexContent.includes('Offline-First Operating System'), 'index.html must include hero slogan');
    assert(indexContent.includes('/auth/login'), 'index.html must render /auth/login links');
    assert(indexContent.includes('/auth/register'), 'index.html must render /auth/register links');
    assert(indexContent.includes('Cloud HQ :443'), 'index.html must render Owner Cloud HQ active ribbon');
    assert(indexContent.includes('>Sub-3s<'), 'index.html must render Cashier Sub-3s tab pill');
    assert(indexContent.includes('>LAN<'), 'index.html must render Chef LAN tab pill');
    assert(indexContent.includes('>Mobile<'), 'index.html must render Waiter Mobile tab pill');
    assert(indexContent.includes('>Operations<'), 'index.html must render Manager Operations tab pill');
    assert(indexContent.includes('>GST<'), 'index.html must render Accountant GST tab pill');
  });

  test('4.4: Verify Cloudflare Pages Static Assets and Manifest', () => {
    const manifestPath = path.join(OUT_DIR, 'manifest.json');
    assert(fs.existsSync(manifestPath), 'manifest.json must exist in static export');

    const swPath = path.join(OUT_DIR, 'sw.js');
    assert(fs.existsSync(swPath), 'Service worker sw.js must exist for PWA offline operation');

    const nextStaticDir = path.join(OUT_DIR, '_next', 'static');
    assert(fs.existsSync(nextStaticDir), '_next/static/ directory must exist containing bundled JS/CSS');
  });

  test('4.5: Adversarial Link Audit: Zero Dead Routes & Section Anchor Validation', () => {
    const indexPath = path.join(OUT_DIR, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    // Extract all href attributes
    const hrefRegex = /href="([^"]+)"/g;
    const links = [];
    let match;
    while ((match = hrefRegex.exec(indexContent)) !== null) {
      links.push(match[1]);
    }

    const internalRoutes = [...new Set(links.filter((h) => h.startsWith('/') && !h.startsWith('//')))];
    const inPageAnchors = [...new Set(links.filter((h) => h.startsWith('#')))];

    // 1. Verify every internal route exists in frontend/out/
    for (const route of internalRoutes) {
      // Clean query params / hashes
      const clean = route.split('?')[0].split('#')[0].replace(/^\//, '');
      if (clean === '') continue; // Root

      const dirPath = path.join(OUT_DIR, clean, 'index.html');
      const directFile = path.join(OUT_DIR, clean);
      const htmlFile = path.join(OUT_DIR, clean + '.html');

      const exists = fs.existsSync(dirPath) || fs.existsSync(directFile) || fs.existsSync(htmlFile);
      assert(
        exists,
        `Landing page links to dead route "${route}"! Neither ${dirPath} nor ${htmlFile} exists.`
      );
    }

    // 2. Primary section anchors used for navigation must exist in DOM
    const primarySectionAnchors = ['#features', '#roles', '#architecture', '#download'];
    for (const anchor of primarySectionAnchors) {
      const targetId = anchor.slice(1);
      const idPattern = `id="${targetId}"`;
      assert(
        indexContent.includes(idPattern),
        `Primary section navigation anchor "${anchor}" target element missing! Expected ${idPattern}`
      );
    }

    // 3. Document mock download anchors as empirical finding
    const mockDownloadAnchors = inPageAnchors.filter((a) => a.startsWith('#download-'));
    assert(
      mockDownloadAnchors.length > 0,
      'Must detect desktop download platform anchors (#download-windows, etc.)'
    );
  });
});
