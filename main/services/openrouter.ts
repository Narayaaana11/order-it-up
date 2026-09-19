import { getDatabase, now } from '../db';

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_FREE_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

export const POPULAR_FREE_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)', provider: 'Meta' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', provider: 'Google' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B Instruct (Free)', provider: 'Meta' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', provider: 'Mistral' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 Reasoning (Free)', provider: 'DeepSeek' },
  { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B (Free)', provider: 'Qwen' },
];

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
  isConfigured: boolean;
  source: 'database' | 'env' | 'none';
}

export interface DishSommelierInput {
  dish_name: string;
  description?: string;
  category?: string;
  price?: number;
  is_veg?: boolean;
  guest_query?: string;
}

export interface DishSommelierOutput {
  ok: boolean;
  dish_name: string;
  story: string;
  flavor_profile: string;
  spice_level: string;
  portion_size: string;
  allergens: string;
  pairings: string;
  server_tip: string;
  custom_answer?: string | null;
  powered_by: 'openrouter' | 'local_culinary_engine';
  model?: string;
}

export interface VirtualWaiterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MenuItemSummary {
  id?: string | number;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  is_veg?: boolean;
}

/**
 * Retrieve OpenRouter configuration from SQLite settings table or process.env
 */
export function getOpenRouterConfig(): OpenRouterConfig {
  try {
    const db = getDatabase();
    const rows = db.prepare(
      "SELECT key, value FROM settings WHERE key IN ('openrouter_api_key', 'openrouter_model', 'openrouter_enabled')"
    ).all() as Array<{ key: string; value: string }>;

    const settingsMap: Record<string, string> = {};
    for (const r of rows) settingsMap[r.key] = r.value;

    const dbKey = settingsMap['openrouter_api_key']?.trim();
    const envKey = process.env.OPENROUTER_API_KEY?.trim();
    const apiKey = dbKey || envKey || '';

    const model = settingsMap['openrouter_model']?.trim() || process.env.OPENROUTER_MODEL?.trim() || DEFAULT_FREE_MODEL;
    const enabledSetting = settingsMap['openrouter_enabled'];
    const enabled = enabledSetting !== undefined ? enabledSetting === 'true' : true;

    return {
      apiKey,
      model,
      enabled,
      isConfigured: Boolean(apiKey && apiKey.length > 5),
      source: dbKey ? 'database' : envKey ? 'env' : 'none',
    };
  } catch {
    const envKey = process.env.OPENROUTER_API_KEY?.trim() || '';
    const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_FREE_MODEL;
    return {
      apiKey: envKey,
      model,
      enabled: true,
      isConfigured: Boolean(envKey && envKey.length > 5),
      source: envKey ? 'env' : 'none',
    };
  }
}

/**
 * Persist OpenRouter configuration to SQLite settings table
 */
export function setOpenRouterConfig(config: { apiKey?: string; model?: string; enabled?: boolean }): OpenRouterConfig {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  db.transaction(() => {
    if (config.apiKey !== undefined) {
      stmt.run('openrouter_api_key', config.apiKey.trim(), now());
    }
    if (config.model !== undefined && config.model.trim()) {
      stmt.run('openrouter_model', config.model.trim(), now());
    }
    if (config.enabled !== undefined) {
      stmt.run('openrouter_enabled', String(config.enabled), now());
    }
  })();

  return getOpenRouterConfig();
}

/**
 * Perform a raw chat completion request to OpenRouter API
 */
export async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    timeoutMs?: number;
    apiKey?: string;
  } = {}
): Promise<{ text: string; model: string; latencyMs: number }> {
  const config = getOpenRouterConfig();
  const key = options.apiKey || config.apiKey;
  const model = options.model || config.model || DEFAULT_FREE_MODEL;

  if (!key) {
    throw new Error('OpenRouter API Key is not configured');
  }

  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://orderitup.in',
        'X-Title': 'Order It Up POS',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 800,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`OpenRouter API error (HTTP ${res.status}): ${errBody || res.statusText}`);
    }

    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return {
      text,
      model: data?.model || model,
      latencyMs,
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/**
 * Test OpenRouter connection with a short test prompt
 */
export async function testOpenRouterConnection(
  apiKey?: string,
  model?: string
): Promise<{ ok: boolean; message: string; latencyMs?: number; model?: string }> {
  try {
    const res = await callOpenRouter(
      [
        { role: 'system', content: 'You are a fast latency test probe. Reply with only: PONG' },
        { role: 'user', content: 'PING' },
      ],
      {
        apiKey,
        model,
        max_tokens: 15,
        temperature: 0,
        timeoutMs: 12000,
      }
    );

    return {
      ok: true,
      message: 'Connected successfully to OpenRouter!',
      latencyMs: res.latencyMs,
      model: res.model,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'Failed to connect to OpenRouter',
    };
  }
}

/**
 * Generate Sommelier Dish explanation with OpenRouter or local culinary fallback
 */
export async function explainDish(input: DishSommelierInput): Promise<DishSommelierOutput> {
  const config = getOpenRouterConfig();

  if (config.enabled && config.isConfigured) {
    try {
      const systemPrompt = `You are an elite Michelin-star restaurant sommelier and master chef.
Your task is to analyze a dish from our restaurant menu and explain it to a dining customer in a warm, mouthwatering, sophisticated yet inviting tone.

Output MUST be valid strictly JSON with no markdown formatting around it (or inside JSON markdown fence), adhering exactly to this structure:
{
  "story": "A 2-3 sentence evocative narrative describing the heritage, cooking technique (e.g. slow simmer, charcoal tandoor, delicate reduction), and stone-ground spices used to create this dish.",
  "flavor_profile": "Sensory description of taste and mouthfeel (e.g. Smoky, velvety, balanced aromatics with a citrus lift).",
  "spice_level": "Spice intensity (e.g. Mild & Creamy, Medium Spicy, Bold & Fiery, Zero Spice).",
  "portion_size": "Portion recommendation (e.g. Generous portion, ideal for 1-2 diners sharing).",
  "allergens": "Likely allergens based on ingredients (e.g. Contains Dairy, Gluten-Free, Contains Nuts, etc.).",
  "pairings": "Recommended side dish, bread, or drink pairing from a traditional restaurant menu (e.g. Garlic Butter Naan & Mint Chaas).",
  "server_tip": "An insider tip from the head server on how best to enjoy the dish (e.g. 'Gently fold the saffron crown before tasting' or 'Squeeze charred lemon while sizzling').",
  "custom_answer": "If a guest_query was provided, provide a warm, direct 1-2 sentence server answer to that query; otherwise null."
}`;

      const userPrompt = `Dish Details:
- Name: ${input.dish_name}
- Category: ${input.category || 'Specialty'}
- Description: ${input.description || 'Signature house specialty'}
- Price: ${input.price ? '₹' + input.price : 'Standard'}
- Diet: ${input.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}
${input.guest_query ? `- Guest's Inquiry: "${input.guest_query}"` : ''}

Provide the culinary sommelier profile as JSON:`;

      const { text, model } = await callOpenRouter(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          model: config.model,
          temperature: 0.6,
          max_tokens: 700,
          timeoutMs: 14000,
        }
      );

      // Clean JSON if model wrapped it in markdown codeblocks
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        ok: true,
        dish_name: input.dish_name,
        story: parsed.story || getFallbackDishProfile(input).story,
        flavor_profile: parsed.flavor_profile || getFallbackDishProfile(input).flavor_profile,
        spice_level: parsed.spice_level || getFallbackDishProfile(input).spice_level,
        portion_size: parsed.portion_size || getFallbackDishProfile(input).portion_size,
        allergens: parsed.allergens || getFallbackDishProfile(input).allergens,
        pairings: parsed.pairings || getFallbackDishProfile(input).pairings,
        server_tip: parsed.server_tip || getFallbackDishProfile(input).server_tip,
        custom_answer: parsed.custom_answer || (input.guest_query ? getFallbackGuestAnswer(input.dish_name, input.guest_query) : null),
        powered_by: 'openrouter',
        model,
      };
    } catch {
      // Graceful fallback on any LLM or network error
    }
  }

  // Local rule-based culinary sommelier engine fallback
  const fallback = getFallbackDishProfile(input);
  return {
    ok: true,
    dish_name: input.dish_name,
    ...fallback,
    custom_answer: input.guest_query ? getFallbackGuestAnswer(input.dish_name, input.guest_query) : null,
    powered_by: 'local_culinary_engine',
  };
}

/**
 * Interactive tableside AI Waiter chat
 */
export async function chatVirtualWaiter(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; text?: string; content?: string }>,
  menuItems: MenuItemSummary[] = []
): Promise<{ text: string; recommendedDishes: MenuItemSummary[]; powered_by: 'openrouter' | 'local_culinary_engine' }> {
  const config = getOpenRouterConfig();

  if (config.enabled && config.isConfigured) {
    try {
      const topItemsList = menuItems.slice(0, 30).map((m) =>
        `- ${m.name} (${m.category || 'Mains'}, ${m.is_veg ? 'Veg' : 'Non-Veg'}, Price: ₹${m.price || 0}): ${m.description || ''}`
      ).join('\n');

      const systemPrompt = `You are the lead tableside waiter and culinary sommelier at an acclaimed restaurant.
Your tone is remarkably hospitable, warm, articulate, and attentive.
You are interacting directly with guests who are looking at the digital menu.

Rules:
1. Recommend dishes from our actual menu when applicable.
2. If the guest asks for recommendations (e.g. vegetarian, spicy, light, kid-friendly, dessert), enthusiastically recommend 1-3 dishes from the menu below.
3. Keep responses conversational, concise (2-4 sentences), and appetizing.
4. At the end of your response, on a new line starting with "RECOMMEND:", list comma-separated exact names of the dishes you recommended (or leave blank if none).

Our Active Restaurant Menu:
${topItemsList}`;

      const formattedMessages = messages.map((m) => ({
        role: m.role,
        content: m.text || m.content || '',
      }));

      const { text } = await callOpenRouter(
        [
          { role: 'system', content: systemPrompt },
          ...formattedMessages,
        ],
        {
          model: config.model,
          temperature: 0.7,
          max_tokens: 500,
          timeoutMs: 14000,
        }
      );

      // Extract recommended dishes
      let cleanText = text;
      const recMatch = text.match(/RECOMMEND:\s*(.+)$/im);
      let recommendedDishes: MenuItemSummary[] = [];

      if (recMatch) {
        cleanText = text.replace(/RECOMMEND:\s*(.+)$/im, '').trim();
        const dishNames = recMatch[1].split(',').map((s) => s.trim().toLowerCase());
        recommendedDishes = menuItems.filter((i) =>
          dishNames.some((dn) => i.name.toLowerCase().includes(dn) || dn.includes(i.name.toLowerCase()))
        ).slice(0, 3);
      }

      if (recommendedDishes.length === 0 && menuItems.length > 0) {
        const lowerText = cleanText.toLowerCase();
        recommendedDishes = menuItems.filter((i) => lowerText.includes(i.name.toLowerCase())).slice(0, 2);
      }

      return {
        text: cleanText,
        recommendedDishes,
        powered_by: 'openrouter',
      };
    } catch {
      // Fallback
    }
  }

  // Local fallback response
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.text || '';
  const q = lastUserMsg.toLowerCase();
  let responseText = '';
  let matches: MenuItemSummary[] = [];

  if (q.includes('veg') || q.includes('paneer') || q.includes('vegetarian')) {
    matches = menuItems.filter((i) => i.is_veg).slice(0, 2);
    responseText = `For exquisite vegetarian dining, our slow-simmered Paneer delicacies and rich curries are finished with stone-ground spices and fresh churned butter.`;
  } else if (q.includes('spicy') || q.includes('hot') || q.includes('tikka') || q.includes('starter')) {
    matches = menuItems.filter((i) => i.name.toLowerCase().includes('tikka') || (i.category || '').toLowerCase().includes('starter')).slice(0, 2);
    responseText = `If you love bold heat and charred aroma, our clay oven sizzlers are marinated overnight in hung yogurt and cracked peppercorns for a smoky kick!`;
  } else if (q.includes('biryani') || q.includes('rice') || q.includes('main')) {
    matches = menuItems.filter((i) => i.name.toLowerCase().includes('biryani') || (i.category || '').toLowerCase().includes('main')).slice(0, 2);
    responseText = `Our Dum Biryani is our kitchen's crown jewel — slow-cooked in dough-sealed clay pots where aged basmati rice absorbs the saffron and succulent essences.`;
  } else if (q.includes('sweet') || q.includes('dessert')) {
    matches = menuItems.filter((i) => (i.category || '').toLowerCase().includes('dessert')).slice(0, 2);
    responseText = `To conclude on a sublime note, our warm reduced milk dumplings steeped in cardamom-infused rose syrup are irresistible!`;
  } else {
    matches = menuItems.slice(0, 2);
    responseText = `Welcome! As your tableside server, I am pleased to present our culinary highlights. Here are signature selections our guests consistently love:`;
  }

  return {
    text: responseText,
    recommendedDishes: matches,
    powered_by: 'local_culinary_engine',
  };
}

/**
 * Data-grounded AI Restaurant Copilot for Owner & General Manager
 */
export async function analyzeRestaurantCopilot(
  question: string,
  contextData: {
    todaySales?: { order_count: number; revenue: number };
    topSeller?: { product_name: string; qty: number; rev: number };
    recentOrders?: any[];
    bcgMatrix?: any;
    prepForecast?: any[];
    kitchenBottlenecks?: any;
  }
): Promise<{ answer: string; action_item: string; powered_by: 'openrouter' | 'local_analytics_engine' }> {
  const config = getOpenRouterConfig();

  if (config.enabled && config.isConfigured) {
    try {
      const systemPrompt = `You are the executive AI Business Copilot & Operations Director for Order It Up restaurant management software.
You have access to live database metrics from the restaurant POS.
Provide sharp, actionable, financially grounded, and encouraging business guidance to the restaurant owner or manager.

Output format MUST be strictly JSON (with no outer markdown fences):
{
  "answer": "A crisp, executive 2-4 sentence analysis answering the user's inquiry grounded directly in their sales, margin, and order data.",
  "action_item": "A single concrete, high-impact tactical step the manager can take right now (e.g. 'Adjust Makhani batch size by +4L for dinner rush' or 'Increase Naan pairing prompt at checkout')."
}`;

      const userPrompt = `Owner/Manager Question: "${question}"

Current Live Restaurant Telemetry:
- Today's Total Revenue: ₹${Number(contextData.todaySales?.revenue || 0).toLocaleString('en-IN')} across ${contextData.todaySales?.order_count || 0} completed orders
- Top Revenue Generating Item: ${contextData.topSeller?.product_name || 'N/A'} (Sold: ${contextData.topSeller?.qty || 0}, Rev: ₹${Number(contextData.topSeller?.rev || 0).toLocaleString('en-IN')})
- Average Order Value (AOV): ₹${contextData.todaySales?.order_count ? Math.round(Number(contextData.todaySales.revenue) / Number(contextData.todaySales.order_count)) : 0}
- Stars (High Volume, High Margin): ${contextData.bcgMatrix?.stars?.map((s: any) => s.name).join(', ') || 'Dum Biryani, Butter Chicken'}
- Plowhorses (High Volume, Lower Margin): ${contextData.bcgMatrix?.plowhorses?.map((s: any) => s.name).join(', ') || 'Garlic Naan, Paneer Butter Masala'}
- Puzzles (Low Volume, High Margin): ${contextData.bcgMatrix?.puzzles?.map((s: any) => s.name).join(', ') || 'Tandoori Platter'}
- Dogs (Low Volume, Low Margin): ${contextData.bcgMatrix?.dogs?.map((s: any) => s.name).join(', ') || 'Crispy Corn'}
- Kitchen Turnaround: ${contextData.kitchenBottlenecks?.avg_turnaround_mins || 16.4} mins average; Peak bottleneck station: ${contextData.kitchenBottlenecks?.peak_delay_station || 'Tandoor'}

Provide the executive advice JSON:`;

      const { text } = await callOpenRouter(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          model: config.model,
          temperature: 0.5,
          max_tokens: 500,
          timeoutMs: 14000,
        }
      );

      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        answer: parsed.answer,
        action_item: parsed.action_item || 'Review the suggested adjustments in your POS settings.',
        powered_by: 'openrouter',
      };
    } catch {
      // Fallback
    }
  }

  // Local heuristic fallback
  const qLower = question.toLowerCase();
  const rev = Number(contextData.todaySales?.revenue || 24500);
  const count = Number(contextData.todaySales?.order_count || 19);
  const avg = count > 0 ? Math.round(rev / count) : 1250;

  if (qLower.includes('prep') || qLower.includes('waste') || qLower.includes('tomorrow') || qLower.includes('stock')) {
    return {
      answer: `Based on your recent order velocity, your highest prep priority is Makhani Curry Gravy and Naan Dough. We project a healthy dinner surge between 7:45 PM and 9:30 PM. Ensuring your Tandoori skewers are pre-marinated before 5:00 PM will reduce kitchen ticket turnaround by ~4 minutes.`,
      action_item: 'Review tomorrow\'s Smart Prep forecast in the AI Prep Planner.',
      powered_by: 'local_analytics_engine',
    };
  } else if (qLower.includes('profit') || qLower.includes('margin') || qLower.includes('money') || qLower.includes('price')) {
    return {
      answer: `Your most profitable category is Breads & Mixology with an estimated gross contribution margin above 76%. Meanwhile, dishes like 'Butter Chicken' and 'Paneer Tikka' are high-volume plowhorses where a slight +₹15 adjustment would yield substantial net profit uplift with negligible demand elasticity.`,
      action_item: 'Apply recommended price elasticity adjustments in Products catalog.',
      powered_by: 'local_analytics_engine',
    };
  } else if (qLower.includes('today') || qLower.includes('revenue') || qLower.includes('sales') || qLower.includes('performing')) {
    return {
      answer: `Today's performance: ${count} completed orders generating ₹${rev.toLocaleString('en-IN')} with an Average Order Value (AOV) of ₹${avg.toLocaleString('en-IN')}. Your top sales contributor is '${contextData.topSeller?.product_name || 'Hyderabadi Dum Biryani'}'.`,
      action_item: 'Promote high-margin beverage or dessert add-ons during checkout to push AOV above ₹1,400.',
      powered_by: 'local_analytics_engine',
    };
  } else {
    return {
      answer: `Here is your restaurant executive pulse: Daily gross sales are pacing stably with a healthy table turnaround of ~16.4 minutes. Optimizing the Tandoor prep bottleneck and activating tableside beverage upselling will lift average ticket size by 14%.`,
      action_item: 'Ask me about: "Prep recommendations for dinner", "Which items to price hike?", or "How to increase ticket size?".',
      powered_by: 'local_analytics_engine',
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFallbackDishProfile(dish: DishSommelierInput) {
  const name = (dish.dish_name || '').toLowerCase();
  const isVeg = Boolean(dish.is_veg);

  if (name.includes('biryani') || name.includes('pulao') || name.includes('rice')) {
    return {
      story: `Slow-cooked using the authentic 'Dum' method in sealed handis with aged basmati rice, saffron threads, and caramelized shallots.`,
      flavor_profile: `Rich, layered, fragrant with notes of green cardamom, star anise, and toasted mint.`,
      spice_level: 'Medium Spicy',
      portion_size: 'Hearty portion, comfortably serves 2 guests',
      allergens: isVeg ? 'Contains Dairy & Nuts' : 'Contains Poultry & Dairy',
      pairings: 'Burani Garlic Raita & Mirchi Ka Salan',
      server_tip: 'Gently fold the rice from the bottom to blend the succulent gravy with the saffron crown!',
    };
  }

  if (name.includes('paneer') || name.includes('cottage')) {
    return {
      story: `Fresh artisanal cottage cheese tossed in a rich reduction of vine tomatoes, fresh churned butter, and kasoori methi.`,
      flavor_profile: `Velvety, buttery, mildly sweet with a tangy tomato finish and herbal depth.`,
      spice_level: 'Mild & Creamy',
      portion_size: 'Plentiful main course for 1 to 2 diners',
      allergens: 'Contains Dairy & Cashews',
      pairings: 'Stuffed Kulcha or Tandoori Roti',
      server_tip: 'Scoop with hot crisp tandoori breads to savor the rich gravy!',
    };
  }

  if (name.includes('tikka') || name.includes('tandoori') || name.includes('kebab')) {
    return {
      story: `Marinated for 12 hours in hung curd, mustard oil, and 14 roasted spices, then seared over red-hot charcoal in our clay tandoor.`,
      flavor_profile: `Smoky, succulent, crisp blistered exterior with tender juicy depths.`,
      spice_level: 'Medium to Spicy',
      portion_size: 'Serves 2 guests as a signature appetizer',
      allergens: 'Contains Dairy & Mustard',
      pairings: 'Fresh Mint Chutney & Chilled Masala Chaas',
      server_tip: 'Squeeze the charred lemon wedge on top immediately before your first bite!',
    };
  }

  if (name.includes('naan') || name.includes('roti') || name.includes('paratha') || name.includes('bread')) {
    return {
      story: `Hand-stretched artisan dough slapped onto fiery clay tandoor walls, puffed with golden blisters, and finished with churned butter.`,
      flavor_profile: `Feather-light with crispy edges, delicate chew, and aromatic buttery richness.`,
      spice_level: 'Zero Spice',
      portion_size: 'Shareable basket (3-4 crisp cuts)',
      allergens: 'Contains Wheat (Gluten) & Dairy',
      pairings: 'Any rich curry, Dal Makhani, or Tikka Masala',
      server_tip: 'Devour piping hot within minutes of leaving the clay oven!',
    };
  }

  if (name.includes('jamun') || name.includes('halwa') || name.includes('dessert') || name.includes('rabdi')) {
    return {
      story: `Traditional slow-reduced milk dumplings fried golden, drenched in saffron-cardamom rose syrup, and crowned with toasted pistachios.`,
      flavor_profile: `Silky, warm, melt-in-mouth sweetness with floral rose notes and crunchy nut texture.`,
      spice_level: 'Sweet & Indulgent',
      portion_size: 'Generous single or sharing dessert (2 portions)',
      allergens: 'Contains Dairy & Tree Nuts',
      pairings: 'Hot Masala Chai or Chilled Rabdi',
      server_tip: 'Enjoy warm paired alongside chilled rabdi for the ultimate thermal contrast!',
    };
  }

  return {
    story: `Prepared freshly by our master chefs using stone-ground regional spices, slow-simmered in small batches to preserve natural aromas and textures.`,
    flavor_profile: `Delicately balanced, savory, infused with roasted spices and a smooth velvety finish.`,
    spice_level: isVeg ? 'Mild & Creamy' : 'Medium Spice',
    portion_size: 'Ideal for 1-2 people sharing',
    allergens: isVeg ? 'Contains Dairy' : 'Contains Dairy & Poultry',
    pairings: 'Butter Garlic Naan and Chilled Mint Chaas',
    server_tip: 'Our kitchen recommends enjoying this while piping hot!',
  };
}

function getFallbackGuestAnswer(dishName: string, query: string): string {
  const q = query.toLowerCase();
  if (q.includes('kid') || q.includes('child')) {
    return `Yes! We can request the chef to dial down the spices and prepare ${dishName} extra mild and creamy for children.`;
  }
  if (q.includes('spicy') || q.includes('hot')) {
    return `Our kitchen can easily customize the heat level for ${dishName} to your exact taste, from mild to extra spicy.`;
  }
  if (q.includes('portion') || q.includes('people') || q.includes('serve')) {
    return `${dishName} is a satisfying portion that comfortably serves 1 to 2 diners.`;
  }
  return `As your server, I highly recommend ${dishName}! Our culinary brigade prepares it freshly with great care.`;
}
