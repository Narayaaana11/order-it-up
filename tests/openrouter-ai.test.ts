/**
 * OpenRouter AI Integration & Fallback Test Suite
 *
 * Usage: node tests/run-electron-node-test.cjs tests/openrouter-ai.test.ts
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const Module = require('module');
const originalLoad = Module._load;
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiu-openrouter-ai-test-'));

Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'electron') {
    return { app: { isPackaged: true, getPath: () => testDir, getVersion: () => 'test' } };
  }
  return originalLoad.apply(this, arguments as any);
};

process.env.JWT_SECRET = 'test-secret-openrouter-ai';

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { initDatabase, getDatabase, closeDatabase } = require('../main/db');
const { aiRoutes } = require('../main/routes/ai');
const {
  getOpenRouterConfig,
  setOpenRouterConfig,
  explainDish,
  chatVirtualWaiter,
  analyzeRestaurantCopilot,
  testOpenRouterConnection,
  POPULAR_FREE_MODELS,
} = require('../main/services/openrouter');

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function runTests() {
  console.log('\n--- Running OpenRouter AI & Sommelier Test Suite ---\n');

  initDatabase(path.join(testDir, 'test-openrouter.db'));

  const app = express();
  app.use(express.json());

  // Setup staff auth token
  const token = jwt.sign(
    { id: 'admin-1', username: 'admin', role: 'owner', tenant_id: 'default' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Auth middleware mock for testing protected endpoints
  app.use((req: any, _res: any, next: any) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
      } catch {}
    }
    next();
  });

  app.use('/api', aiRoutes);

  try {
    // 1. Test OpenRouter Configuration
    console.log('1. OpenRouter Configuration State:');
    const initialConfig = getOpenRouterConfig();
    assert(initialConfig !== null, 'Config loads cleanly');
    assert(typeof initialConfig.model === 'string', 'Default model is present');

    const updated = setOpenRouterConfig({
      apiKey: 'sk-or-v1-mock-test-key-12345678',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      enabled: true,
    });
    assert(updated.isConfigured === true, 'Configuration updates in SQLite correctly');
    assert(updated.apiKey.includes('mock-test-key'), 'API key is persisted');

    // 2. Test Connection Diagnostics (Mock failure handling)
    console.log('\n2. Test Connection Diagnostics:');
    const connResult = await testOpenRouterConnection('invalid-key', 'non-existent-model');
    assert(connResult.ok === false, 'Detects invalid API key / network error cleanly without crashing');
    assert(typeof connResult.message === 'string', 'Returns informative error message');

    // 3. Test Dish Sommelier (Fallback / Local Engine)
    console.log('\n3. Dish Sommelier Intelligent Profiles:');
    const biryaniProfile = await explainDish({
      dish_name: 'Hyderabadi Dum Biryani',
      category: 'Mains',
      price: 350,
      is_veg: false,
      guest_query: 'Can you make it less spicy for children?',
    });

    assert(biryaniProfile.ok === true, 'Sommelier generates valid response');
    assert(biryaniProfile.story.length > 20, 'Generates rich culinary heritage story');
    assert(biryaniProfile.flavor_profile.length > 5, 'Provides sensory flavor profile');
    assert(biryaniProfile.spice_level.length > 0, 'Indicates spice level');
    assert(biryaniProfile.pairings.length > 0, 'Suggests pairings');
    assert(biryaniProfile.custom_answer !== null, 'Answers guest question specifically');
    assert(typeof biryaniProfile.custom_answer === 'string' && biryaniProfile.custom_answer.toLowerCase().includes('mild'), 'Custom answer handles children/spice query appropriately');

    const paneerProfile = await explainDish({
      dish_name: 'Paneer Butter Masala',
      category: 'Curries',
      price: 280,
      is_veg: true,
    });
    assert(paneerProfile.is_veg === undefined || paneerProfile.ok, 'Handles vegetarian dish');
    assert(paneerProfile.allergens.toLowerCase().includes('dairy'), 'Identifies dairy allergen');

    // 4. Test Virtual Waiter Dialogue
    console.log('\n4. Virtual Tableside Waiter Chat:');
    const menuItems = [
      { id: '1', name: 'Hyderabadi Dum Biryani', category: 'mains', price: 320, is_veg: false },
      { id: '2', name: 'Paneer Tikka Sizzler', category: 'starters', price: 260, is_veg: true },
      { id: '3', name: 'Butter Garlic Naan', category: 'breads', price: 70, is_veg: true },
      { id: '4', name: 'Warm Gulab Jamun', category: 'desserts', price: 120, is_veg: true },
    ];

    const waiterReply = await chatVirtualWaiter(
      [
        { role: 'user', text: 'I am vegetarian, what do you recommend?' },
      ],
      menuItems
    );
    assert(waiterReply.text.length > 10, 'Waiter produces friendly conversational response');
    assert(waiterReply.recommendedDishes.length > 0, 'Waiter recommends menu items');
    assert(waiterReply.recommendedDishes[0].is_veg === true, 'Recommended item matches vegetarian diet');

    // 5. Test AI Restaurant Copilot & Financial Telemetry Grounding
    console.log('\n5. AI Restaurant Copilot Business Analysis:');
    const copilotAnalysis = await analyzeRestaurantCopilot(
      'What should I prep for dinner rush tomorrow?',
      {
        todaySales: { order_count: 25, revenue: 38400 },
        topSeller: { product_name: 'Hyderabadi Dum Biryani', qty: 32, rev: 10240 },
        kitchenBottlenecks: { avg_turnaround_mins: 15.2, peak_delay_station: 'Tandoor' },
      }
    );
    assert(copilotAnalysis.answer.length > 20, 'Copilot gives data-grounded business answer');
    assert(copilotAnalysis.action_item.length > 5, 'Copilot provides clear tactical action item');

    // 6. Test Express API Endpoints (Supertest)
    console.log('\n6. Express REST Endpoints Verification:');
    
    // GET /api/ai/config
    const resConfig = await request(app)
      .get('/api/ai/config')
      .set('Authorization', `Bearer ${token}`);
    assert(resConfig.status === 200, 'GET /api/ai/config responds with 200');
    assert(resConfig.body.ok === true, 'GET /api/ai/config has ok: true');
    assert(Array.isArray(resConfig.body.popular_models), 'Returns popular free models list');

    // POST /api/ai/config
    const resSaveConfig = await request(app)
      .post('/api/ai/config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        api_key: 'sk-or-v1-new-key-abcdef',
        model: 'google/gemini-2.0-flash-exp:free',
      });
    assert(resSaveConfig.status === 200, 'POST /api/ai/config responds with 200');
    assert(resSaveConfig.body.model === 'google/gemini-2.0-flash-exp:free', 'Model successfully updated');

    // POST /api/ai/dish-sommelier (Public endpoint)
    const resSommelier = await request(app)
      .post('/api/ai/dish-sommelier')
      .send({
        dish_name: 'Garlic Butter Naan',
        category: 'Breads',
        price: 60,
        is_veg: true,
      });
    assert(resSommelier.status === 200, 'POST /api/ai/dish-sommelier responds with 200');
    assert(resSommelier.body.ok === true, 'Dish sommelier response contains ok: true');
    assert(resSommelier.body.pairings.length > 0, 'Pairings included in response');

    // POST /api/ai/waiter-chat (Public endpoint)
    const resWaiter = await request(app)
      .post('/api/ai/waiter-chat')
      .send({
        messages: [{ role: 'user', content: 'What are your top spicy starters?' }],
        menu_items: menuItems,
      });
    assert(resWaiter.status === 200, 'POST /api/ai/waiter-chat responds with 200');
    assert(resWaiter.body.ok === true, 'Waiter chat response contains ok: true');
    assert(typeof resWaiter.body.text === 'string', 'Waiter chat text returned');

    // POST /api/ai/ask (Protected endpoint)
    const resAsk = await request(app)
      .post('/api/ai/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({
        question: 'How is our business performing today?',
      });
    if (resAsk.status !== 200) console.error('resAsk error details:', resAsk.status, resAsk.body);
    assert(resAsk.status === 200, 'POST /api/ai/ask responds with 200');
    assert(resAsk.body.ok === true, 'AI copilot response has ok: true');
    assert(typeof resAsk.body.answer === 'string', 'Copilot returns answer');
    assert(typeof resAsk.body.action_item === 'string', 'Copilot returns action item');

    // GET /api/ai/insights (Protected endpoint)
    const resInsights = await request(app)
      .get('/api/ai/insights')
      .set('Authorization', `Bearer ${token}`);
    if (resInsights.status !== 200) console.error('resInsights error details:', resInsights.status, resInsights.body);
    assert(resInsights.status === 200, 'GET /api/ai/insights responds with 200');
    assert(resInsights.body.ok === true, 'AI insights response has ok: true');
    assert(Array.isArray(resInsights.body.prep_forecast), 'Prep forecast returned');
    assert(resInsights.body.bcg_matrix !== undefined, 'BCG matrix returned');

    console.log(`\n========================================`);
    console.log(`OpenRouter AI Test Summary: ${passed}/${total} passed (${failed} failed)`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
