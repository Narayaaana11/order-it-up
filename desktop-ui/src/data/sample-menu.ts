export interface MenuItemAddon {
  id: string;
  name: string;
  price: number;
}

export interface MenuItemAddonGroup {
  id: string;
  name: string;
  is_required: boolean;
  min_selection: number;
  max_selection: number;
  addons: MenuItemAddon[];
}

export interface MenuItem {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  price: number;
  original_price?: number;
  is_veg: boolean;
  is_bestseller?: boolean;
  is_chef_special?: boolean;
  spicy_level?: number; // 0: None, 1: Mild, 2: Medium, 3: Hot
  rating: number;
  rating_count: number;
  description: string;
  image_url: string;
  addon_groups?: MenuItemAddonGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export const SAMPLE_CATEGORIES: MenuCategory[] = [
  { id: 'starters', name: 'Starters & Appetizers', description: 'Crispy, sizzling, and mouthwatering bites to kick off your meal' },
  { id: 'tandoor', name: 'Tandoor & Grills', description: 'Charred to perfection in a traditional clay oven' },
  { id: 'biryani', name: 'Biryanis & Rice', description: 'Aromatic dum-cooked basmati rice with fragrant spices' },
  { id: 'mains', name: 'Main Course Specialties', description: 'Rich gravies, slow-cooked curries, and comforting classics' },
  { id: 'breads', name: 'Fresh Tandoori Breads', description: 'Warm, buttery, and freshly baked naans & rotis' },
  { id: 'desserts', name: 'Desserts & Sweets', description: 'Decadent sweet treats to complete your dining experience' },
  { id: 'beverages', name: 'Mocktails & Beverages', description: 'Chilled coolers, fresh shakes, and refreshing sodas' },
];

export const SAMPLE_MENU_ITEMS: MenuItem[] = [
  // --- STARTERS ---
  {
    id: 'st-1',
    name: 'Paneer Tikka Angara',
    category_id: 'starters',
    category_name: 'Starters & Appetizers',
    price: 289,
    original_price: 320,
    is_veg: true,
    is_bestseller: true,
    spicy_level: 2,
    rating: 4.6,
    rating_count: 184,
    description: 'Succulent cubes of cottage cheese marinated in crushed whole spices, Kashmiri red chilli, and mustard oil, roasted with charred bell peppers.',
    image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80',
    addon_groups: [
      {
        id: 'portion-paneer',
        name: 'Choose Portion',
        is_required: true,
        min_selection: 1,
        max_selection: 1,
        addons: [
          { id: 'reg', name: 'Regular (6 Pcs)', price: 0 },
          { id: 'large', name: 'Platter (10 Pcs)', price: 140 },
        ],
      },
      {
        id: 'dip-paneer',
        name: 'Extra Dips',
        is_required: false,
        min_selection: 0,
        max_selection: 2,
        addons: [
          { id: 'mint-chutney', name: 'Special Mint Chutney', price: 25 },
          { id: 'garlic-dip', name: 'Creamy Garlic Dip', price: 35 },
        ],
      },
    ],
  },
  {
    id: 'st-2',
    name: 'Crispy Corn & Water Chestnut Salt & Pepper',
    category_id: 'starters',
    category_name: 'Starters & Appetizers',
    price: 249,
    is_veg: true,
    is_bestseller: false,
    spicy_level: 1,
    rating: 4.4,
    rating_count: 98,
    description: 'Crunchy golden sweet corn kernels and sliced water chestnuts tossed with scallions, fresh red chillies, and cracked white pepper.',
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'st-3',
    name: 'Guntur Chilli Chicken (Dry)',
    category_id: 'starters',
    category_name: 'Starters & Appetizers',
    price: 349,
    original_price: 379,
    is_veg: false,
    is_bestseller: true,
    is_chef_special: true,
    spicy_level: 3,
    rating: 4.8,
    rating_count: 246,
    description: 'Tender diced chicken tossed in fiery Andhra Guntur red chillies, fragrant curry leaves, roasted garlic, and freshly crushed peppercorns.',
    image_url: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
    addon_groups: [
      {
        id: 'spice-chicken',
        name: 'Spice Level',
        is_required: false,
        min_selection: 0,
        max_selection: 1,
        addons: [
          { id: 'med', name: 'Medium Spice', price: 0 },
          { id: 'extra-spicy', name: 'Extra Fiery (Chef Style)', price: 0 },
        ],
      },
    ],
  },
  {
    id: 'st-4',
    name: 'Dahi Ke Kebab',
    category_id: 'starters',
    category_name: 'Starters & Appetizers',
    price: 279,
    is_veg: true,
    is_bestseller: false,
    spicy_level: 1,
    rating: 4.5,
    rating_count: 76,
    description: 'Velvety hung curd patties infused with green chillies, fresh coriander, and cardamom, shallow fried to a crisp golden crust.',
    image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'st-5',
    name: 'Amritsari Fish Fingers',
    category_id: 'starters',
    category_name: 'Starters & Appetizers',
    price: 389,
    is_veg: false,
    is_bestseller: true,
    spicy_level: 2,
    rating: 4.7,
    rating_count: 162,
    description: 'Boneless river sole fillets marinated in carom seeds (ajwain), ginger-garlic, and gram flour batter, crisp fried and served with tartare sauce.',
    image_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80',
  },

  // --- TANDOOR & GRILLS ---
  {
    id: 'tan-1',
    name: 'Tandoori Murgh (Classic)',
    category_id: 'tandoor',
    category_name: 'Tandoor & Grills',
    price: 360,
    original_price: 399,
    is_veg: false,
    is_bestseller: true,
    spicy_level: 2,
    rating: 4.8,
    rating_count: 310,
    description: 'Whole spring chicken marinated overnight in spiced yogurt, smoked paprika, and hand-ground garam masala, slow-roasted in charcoal tandoor.',
    image_url: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80',
    addon_groups: [
      {
        id: 'portion-tandoori',
        name: 'Select Size',
        is_required: true,
        min_selection: 1,
        max_selection: 1,
        addons: [
          { id: 'half', name: 'Half (4 Pcs)', price: 0 },
          { id: 'full', name: 'Full (8 Pcs)', price: 290 },
        ],
      },
    ],
  },
  {
    id: 'tan-2',
    name: 'Murgh Malai Tikka',
    category_id: 'tandoor',
    category_name: 'Tandoor & Grills',
    price: 379,
    is_veg: false,
    is_bestseller: false,
    spicy_level: 0,
    rating: 4.6,
    rating_count: 140,
    description: 'Melt-in-your-mouth chicken breast cubes marinated in clotted cream, cream cheese, green cardamom, and cashew paste, char-grilled with butter basting.',
    image_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'tan-3',
    name: 'Tandoori Soya Chaap Tikka',
    category_id: 'tandoor',
    category_name: 'Tandoor & Grills',
    price: 269,
    is_veg: true,
    is_bestseller: true,
    spicy_level: 2,
    rating: 4.5,
    rating_count: 195,
    description: 'Tender layered soy protein skewers soaked in spiced hung curd marinade and roasted in the tandoor with onions and capsicum.',
    image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
  },

  // --- BIRYANIS & RICE ---
  {
    id: 'bir-1',
    name: 'Hyderabadi Dum Chicken Biryani',
    category_id: 'biryani',
    category_name: 'Biryanis & Rice',
    price: 379,
    original_price: 420,
    is_veg: false,
    is_bestseller: true,
    is_chef_special: true,
    spicy_level: 2,
    rating: 4.9,
    rating_count: 512,
    description: 'Long-grain aged Basmati rice layered with marinated bone-in chicken, saffron milk, caramelized brown onions, and fresh mint, dum-cooked in a sealed clay pot. Served with Mirchi Ka Salan and Raita.',
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
    addon_groups: [
      {
        id: 'biryani-size',
        name: 'Portion Size',
        is_required: true,
        min_selection: 1,
        max_selection: 1,
        addons: [
          { id: 'single', name: 'Regular (Serves 1-2)', price: 0 },
          { id: 'jumbo', name: 'Handi Feast (Serves 3-4)', price: 340 },
        ],
      },
      {
        id: 'biryani-sides',
        name: 'Extra Accompaniments',
        is_required: false,
        min_selection: 0,
        max_selection: 3,
        addons: [
          { id: 'extra-raita', name: 'Boondi Raita Bowl', price: 45 },
          { id: 'extra-salan', name: 'Mirchi Ka Salan', price: 45 },
          { id: 'boiled-egg', name: 'Boiled Egg (2 Pcs)', price: 40 },
        ],
      },
    ],
  },
  {
    id: 'bir-2',
    name: 'Awadhi Mutton Dum Biryani',
    category_id: 'biryani',
    category_name: 'Biryanis & Rice',
    price: 489,
    is_veg: false,
    is_bestseller: true,
    is_chef_special: true,
    spicy_level: 2,
    rating: 4.8,
    rating_count: 288,
    description: 'Tender baby lamb cuts slow-cooked in rich yakhni stock, layered with fragrant basmati, mace, kewra water, and pure cow ghee.',
    image_url: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'bir-3',
    name: 'Subz Dum Biryani (Royal Veg)',
    category_id: 'biryani',
    category_name: 'Biryanis & Rice',
    price: 299,
    is_veg: true,
    is_bestseller: false,
    spicy_level: 1,
    rating: 4.5,
    rating_count: 174,
    description: 'Farm-fresh florets, baby beans, carrots, and cottage cheese infused with shahi jeera, saffron, and aromatic spices, baked under sealed pastry.',
    image_url: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=600&q=80',
  },

  // --- MAIN COURSE ---
  {
    id: 'mc-1',
    name: 'Butter Chicken Grand Trunk',
    category_id: 'mains',
    category_name: 'Main Course Specialties',
    price: 399,
    original_price: 430,
    is_veg: false,
    is_bestseller: true,
    spicy_level: 1,
    rating: 4.9,
    rating_count: 620,
    description: 'Char-grilled tandoori chicken simmered in a silken, creamy tomato gravy perfumed with fenugreek leaves (kasuri methi) and finished with fresh white butter.',
    image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80',
    addon_groups: [
      {
        id: 'bc-style',
        name: 'Preparation Style',
        is_required: true,
        min_selection: 1,
        max_selection: 1,
        addons: [
          { id: 'boneless', name: 'Boneless Chicken Chunks', price: 40 },
          { id: 'bone-in', name: 'Traditional Bone-in', price: 0 },
        ],
      },
    ],
  },
  {
    id: 'mc-2',
    name: 'Dal Makhani Bukhara Style',
    category_id: 'mains',
    category_name: 'Main Course Specialties',
    price: 289,
    is_veg: true,
    is_bestseller: true,
    spicy_level: 1,
    rating: 4.8,
    rating_count: 480,
    description: 'Whole black lentils and kidney beans slow-simmered on a gentle tandoor ember for over 18 hours, finished with dairy cream and country butter.',
    image_url: 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'mc-3',
    name: 'Paneer Lababdar',
    category_id: 'mains',
    category_name: 'Main Course Specialties',
    price: 329,
    is_veg: true,
    is_bestseller: false,
    spicy_level: 2,
    rating: 4.6,
    rating_count: 215,
    description: 'Soft cottage cheese squares and grated paneer cooked in a rich onion-tomato masala with cashew paste, ginger juliennes, and coriander seeds.',
    image_url: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'mc-4',
    name: 'Rogan Josh Kashmiri',
    category_id: 'mains',
    category_name: 'Main Course Specialties',
    price: 499,
    is_veg: false,
    is_bestseller: false,
    is_chef_special: true,
    spicy_level: 2,
    rating: 4.7,
    rating_count: 160,
    description: 'Tender lamb chunks braised in a gravy flavored with aromatic Kashmiri chillies, dried ginger powder, and the subtle note of ratan jot.',
    image_url: 'https://images.unsplash.com/photo-1545247181-516773cae754?auto=format&fit=crop&w=600&q=80',
  },

  // --- BREADS ---
  {
    id: 'br-1',
    name: 'Butter Garlic Naan',
    category_id: 'breads',
    category_name: 'Fresh Tandoori Breads',
    price: 75,
    is_veg: true,
    is_bestseller: true,
    rating: 4.8,
    rating_count: 340,
    description: 'Fluffy refined flour flatbread studded with minced garlic, fresh cilantro, baked in tandoor and brushed generously with salted butter.',
    image_url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'br-2',
    name: 'Cheese & Chilli Stuffed Naan',
    category_id: 'breads',
    category_name: 'Fresh Tandoori Breads',
    price: 110,
    is_veg: true,
    is_bestseller: false,
    spicy_level: 1,
    rating: 4.7,
    rating_count: 190,
    description: 'Tandoori naan bursting with melted mozzarella, cheddar, and finely chopped green chillies.',
    image_url: 'https://images.unsplash.com/photo-1506280754576-f6fa8a873550?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'br-3',
    name: 'Laccha Paratha',
    category_id: 'breads',
    category_name: 'Fresh Tandoori Breads',
    price: 60,
    is_veg: true,
    rating: 4.5,
    rating_count: 110,
    description: 'Crispy, multi-layered whole wheat bread baked in the clay oven with pure ghee.',
    image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
  },

  // --- DESSERTS ---
  {
    id: 'des-1',
    name: 'Gulab Jamun with Rabri',
    category_id: 'desserts',
    category_name: 'Desserts & Sweets',
    price: 160,
    is_veg: true,
    is_bestseller: true,
    rating: 4.9,
    rating_count: 275,
    description: 'Two warm, melt-in-mouth khoya dumplings soaked in saffron sugar syrup, nestled over a bed of chilled, thickened cardamom rabri.',
    image_url: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'des-2',
    name: 'Sizzling Brownie with Vanilla Bean Ice Cream',
    category_id: 'desserts',
    category_name: 'Desserts & Sweets',
    price: 220,
    is_veg: true,
    is_bestseller: true,
    rating: 4.8,
    rating_count: 320,
    description: 'Warm fudgy walnut brownie served on a piping hot cast-iron sizzler plate, crowned with vanilla ice cream and drizzled with molten chocolate.',
    image_url: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=600&q=80',
  },

  // --- BEVERAGES ---
  {
    id: 'bev-1',
    name: 'Virgin Mojito Crush',
    category_id: 'beverages',
    category_name: 'Mocktails & Beverages',
    price: 140,
    is_veg: true,
    is_bestseller: true,
    rating: 4.6,
    rating_count: 180,
    description: 'Fresh mint leaves muddled with Mexican lime wedges, raw sugar, topped with chilled sparkling club soda and crushed ice.',
    image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'bev-2',
    name: 'Mango Alphonso Shake',
    category_id: 'beverages',
    category_name: 'Mocktails & Beverages',
    price: 160,
    is_veg: true,
    rating: 4.7,
    rating_count: 140,
    description: 'Thick, creamy blend of Ratnagiri Alphonso mango pulp, full-cream milk, topped with a scoop of vanilla ice cream and pistachios.',
    image_url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80',
  },
];
