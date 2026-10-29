import '../models/category_model.dart';
import '../models/product_model.dart';
import '../models/table_model.dart';
import '../models/order_model.dart';
import '../models/kds_ticket_model.dart';
import '../models/user_model.dart';
import '../models/held_order_model.dart';
import '../models/customer_model.dart';
import '../models/ingredient_model.dart';
import '../models/cash_closure_model.dart';
import '../models/reservation_model.dart';

class MockDataService {
  static UserModel get mockWaiterUser => UserModel(
        id: 'u-waiter-1',
        name: 'Rahul (Server)',
        email: 'waiter@restaurant.com',
        role: 'server',
        token: 'mock-jwt-waiter-token',
      );

  static UserModel get mockCashierUser => UserModel(
        id: 'u-cashier-1',
        name: 'Priya (Cashier)',
        email: 'cashier@restaurant.com',
        role: 'cashier',
        token: 'mock-jwt-cashier-token',
      );

  static UserModel get mockChefUser => UserModel(
        id: 'u-chef-1',
        name: 'Chef Vikram',
        email: 'chef@restaurant.com',
        role: 'chef',
        token: 'mock-jwt-chef-token',
      );

  static UserModel get mockManagerUser => UserModel(
        id: 'u-mgr-1',
        name: 'Vikram (Manager)',
        email: 'manager@restaurant.com',
        role: 'manager',
        token: 'mock-jwt-manager-token',
      );

  static List<CategoryModel> getCategories() {
    return [
      CategoryModel(id: 'cat-1', name: 'Starters & Appetizers', sortOrder: 1),
      CategoryModel(id: 'cat-2', name: 'Main Course', sortOrder: 2),
      CategoryModel(id: 'cat-3', name: 'Biryani & Rice', sortOrder: 3),
      CategoryModel(id: 'cat-4', name: 'Breads & Rotis', sortOrder: 4),
      CategoryModel(id: 'cat-5', name: 'Beverages', sortOrder: 5),
      CategoryModel(id: 'cat-6', name: 'Desserts', sortOrder: 6),
    ];
  }

  static List<ProductModel> getProducts() {
    return [
      // Starters
      ProductModel(
        id: 'p-1',
        categoryId: 'cat-1',
        name: 'Paneer Tikka',
        price: 240.0,
        description: 'Cottage cheese cubes marinated in spiced yogurt and grilled in tandoor.',
        dietaryType: 'veg',
        station: 'grill',
      ),
      ProductModel(
        id: 'p-2',
        categoryId: 'cat-1',
        name: 'Chicken Malai Tikka',
        price: 320.0,
        description: 'Tender chicken cubes in creamy cashew and cardamom marinade.',
        dietaryType: 'non_veg',
        station: 'grill',
      ),
      ProductModel(
        id: 'p-3',
        categoryId: 'cat-1',
        name: 'Crispy Corn Salt & Pepper',
        price: 190.0,
        description: 'Fried sweet corn tossed with bell peppers and fresh scallions.',
        dietaryType: 'veg',
        station: 'kitchen',
      ),
      ProductModel(
        id: 'p-4',
        categoryId: 'cat-1',
        name: 'Crispy Chilli Chicken',
        price: 290.0,
        description: 'Indo-Chinese style battered chicken with soy, green chillies, and garlic.',
        dietaryType: 'non_veg',
        station: 'kitchen',
      ),

      // Main Course
      ProductModel(
        id: 'p-5',
        categoryId: 'cat-2',
        name: 'Butter Chicken (Murgh Makhani)',
        price: 380.0,
        description: 'Smoked chicken tikka simmered in rich velvety tomato-butter gravy.',
        dietaryType: 'non_veg',
        station: 'kitchen',
      ),
      ProductModel(
        id: 'p-6',
        categoryId: 'cat-2',
        name: 'Paneer Butter Masala',
        price: 310.0,
        description: 'Fresh cottage cheese cubes in aromatic tomato and cashew cream sauce.',
        dietaryType: 'veg',
        station: 'kitchen',
      ),
      ProductModel(
        id: 'p-7',
        categoryId: 'cat-2',
        name: 'Dal Makhani',
        price: 260.0,
        description: 'Black lentils slow cooked overnight with butter, cream, and spices.',
        dietaryType: 'veg',
        station: 'kitchen',
      ),
      ProductModel(
        id: 'p-8',
        categoryId: 'cat-2',
        name: 'Mutton Rogan Josh',
        price: 460.0,
        description: 'Kashmiri style tender mutton braised in aromatic red gravy.',
        dietaryType: 'non_veg',
        station: 'kitchen',
      ),

      // Biryani & Rice
      ProductModel(
        id: 'p-9',
        categoryId: 'cat-3',
        name: 'Hyderabadi Chicken Dum Biryani',
        price: 360.0,
        description: 'Aromatic basmati rice cooked on dum with marinated chicken and saffron.',
        dietaryType: 'non_veg',
        station: 'kitchen',
      ),
      ProductModel(
        id: 'p-10',
        categoryId: 'cat-3',
        name: 'Special Veg Dum Biryani',
        price: 280.0,
        description: 'Layers of long grain rice and fresh garden vegetables with fried onions.',
        dietaryType: 'veg',
        station: 'kitchen',
      ),
      ProductModel(
        id: 'p-11',
        categoryId: 'cat-3',
        name: 'Jeera Rice with Dal Tadka',
        price: 220.0,
        description: 'Cumin tempered basmati rice served with yellow lentil tadka.',
        dietaryType: 'veg',
        station: 'kitchen',
      ),

      // Breads
      ProductModel(
        id: 'p-12',
        categoryId: 'cat-4',
        name: 'Butter Garlic Naan',
        price: 65.0,
        description: 'Tandoori flatbread topped with minced garlic and melted butter.',
        dietaryType: 'veg',
        station: 'kitchen',
      ),
      ProductModel(
        id: 'p-13',
        categoryId: 'cat-4',
        name: 'Tandoori Roti (Butter)',
        price: 35.0,
        description: 'Whole wheat bread roasted in clay oven.',
        dietaryType: 'veg',
        station: 'kitchen',
      ),
      ProductModel(
        id: 'p-14',
        categoryId: 'cat-4',
        name: 'Cheese Stuffed Kulcha',
        price: 110.0,
        description: 'Crispy leavened bread filled with melted cheddar and mozzarella.',
        dietaryType: 'veg',
        station: 'kitchen',
      ),

      // Beverages
      ProductModel(
        id: 'p-15',
        categoryId: 'cat-5',
        name: 'Mango Lassi',
        price: 130.0,
        description: 'Thick churned sweet yogurt blended with Alphonso mango pulp.',
        dietaryType: 'veg',
        station: 'bar',
      ),
      ProductModel(
        id: 'p-16',
        categoryId: 'cat-5',
        name: 'Fresh Mint Lime Soda',
        price: 90.0,
        description: 'Crisp club soda with fresh lime juice, mint leaves, and rock salt.',
        dietaryType: 'veg',
        station: 'bar',
      ),
      ProductModel(
        id: 'p-17',
        categoryId: 'cat-5',
        name: 'Iced Cold Coffee with Vanilla',
        price: 150.0,
        description: 'Espresso whipped with chilled milk and a scoop of vanilla gelato.',
        dietaryType: 'veg',
        station: 'bar',
      ),

      // Desserts
      ProductModel(
        id: 'p-18',
        categoryId: 'cat-6',
        name: 'Warm Gulab Jamun (2 pcs)',
        price: 120.0,
        description: 'Soft milk solids dumplings soaked in rose water sugar syrup.',
        dietaryType: 'veg',
        station: 'dessert',
      ),
      ProductModel(
        id: 'p-19',
        categoryId: 'cat-6',
        name: 'Sizzling Brownie with Ice Cream',
        price: 220.0,
        description: 'Fudge chocolate brownie served sizzling with hot chocolate drizzle.',
        dietaryType: 'veg',
        station: 'dessert',
      ),
      ProductModel(
        id: 'p-20',
        categoryId: 'cat-6',
        name: 'Rasmalai (2 pcs)',
        price: 140.0,
        description: 'Soft cottage cheese patties soaked in saffron and cardamom milk.',
        dietaryType: 'veg',
        station: 'dessert',
      ),
    ];
  }

  static List<TableModel> getTables() {
    return [
      TableModel(
        id: 't-1',
        number: 'Table 1',
        capacity: 2,
        section: 'Ground Floor',
        status: 'occupied',
        activeOrderId: 101,
        activeOrderNumber: '#ORD-101',
        activeOrderTotal: 680.0,
        seatedAt: '25 min ago',
      ),
      TableModel(
        id: 't-2',
        number: 'Table 2',
        capacity: 4,
        section: 'Ground Floor',
        status: 'available',
      ),
      TableModel(
        id: 't-3',
        number: 'Table 3',
        capacity: 4,
        section: 'Ground Floor',
        status: 'occupied',
        activeOrderId: 102,
        activeOrderNumber: '#ORD-102',
        activeOrderTotal: 1240.0,
        seatedAt: '42 min ago',
      ),
      TableModel(
        id: 't-4',
        number: 'Table 4',
        capacity: 6,
        section: 'Ground Floor',
        status: 'billed',
        activeOrderId: 103,
        activeOrderNumber: '#ORD-103',
        activeOrderTotal: 1890.0,
        seatedAt: '55 min ago',
      ),
      TableModel(
        id: 't-5',
        number: 'Table 5',
        capacity: 4,
        section: 'Terrace Garden',
        status: 'available',
      ),
      TableModel(
        id: 't-6',
        number: 'Table 6',
        capacity: 4,
        section: 'Terrace Garden',
        status: 'occupied',
        activeOrderId: 104,
        activeOrderNumber: '#ORD-104',
        activeOrderTotal: 840.0,
        seatedAt: '12 min ago',
      ),
      TableModel(
        id: 't-7',
        number: 'Table 7',
        capacity: 2,
        section: 'Terrace Garden',
        status: 'available',
      ),
      TableModel(
        id: 't-8',
        number: 'Table 8',
        capacity: 8,
        section: 'Family AC Section',
        status: 'occupied',
        activeOrderId: 105,
        activeOrderNumber: '#ORD-105',
        activeOrderTotal: 3420.0,
        seatedAt: '35 min ago',
      ),
      TableModel(
        id: 't-9',
        number: 'Table 9',
        capacity: 4,
        section: 'Family AC Section',
        status: 'available',
      ),
      TableModel(
        id: 't-10',
        number: 'Table 10',
        capacity: 6,
        section: 'Family AC Section',
        status: 'available',
      ),
    ];
  }

  static List<OrderModel> getOrders() {
    return [
      OrderModel(
        id: 101,
        orderNumber: '#ORD-101',
        tableId: 't-1',
        tableName: 'Table 1',
        type: 'dine_in',
        status: 'preparing',
        subtotal: 680.0,
        tax: 34.0,
        total: 714.0,
        customerName: 'Amit Verma',
        customerPhone: '+91 98765 43210',
        items: [
          OrderItemModel(
            id: 1,
            productId: 'p-1',
            productName: 'Paneer Tikka',
            quantity: 1,
            unitPrice: 240.0,
            status: 'preparing',
            notes: 'Make it medium spicy',
          ),
          OrderItemModel(
            id: 2,
            productId: 'p-6',
            productName: 'Paneer Butter Masala',
            quantity: 1,
            unitPrice: 310.0,
            status: 'waiting',
          ),
          OrderItemModel(
            id: 3,
            productId: 'p-12',
            productName: 'Butter Garlic Naan',
            quantity: 2,
            unitPrice: 65.0,
            status: 'waiting',
          ),
        ],
      ),
      OrderModel(
        id: 102,
        orderNumber: '#ORD-102',
        tableId: 't-3',
        tableName: 'Table 3',
        type: 'dine_in',
        status: 'ready',
        subtotal: 1240.0,
        tax: 62.0,
        total: 1302.0,
        customerName: 'Deepak Sharma',
        customerPhone: '+91 98111 22334',
        items: [
          OrderItemModel(
            id: 4,
            productId: 'p-5',
            productName: 'Butter Chicken',
            quantity: 2,
            unitPrice: 380.0,
            status: 'ready',
          ),
          OrderItemModel(
            id: 5,
            productId: 'p-9',
            productName: 'Hyderabadi Chicken Biryani',
            quantity: 1,
            unitPrice: 360.0,
            status: 'ready',
          ),
          OrderItemModel(
            id: 6,
            productId: 'p-15',
            productName: 'Mango Lassi',
            quantity: 2,
            unitPrice: 130.0,
            status: 'served',
          ),
        ],
      ),
      OrderModel(
        id: 103,
        orderNumber: '#ORD-103',
        tableId: 't-4',
        tableName: 'Table 4',
        type: 'dine_in',
        status: 'ready',
        subtotal: 1890.0,
        tax: 94.5,
        total: 1984.5,
        customerName: 'Sanjay Reddy',
        customerPhone: '+91 99887 66554',
        items: [
          OrderItemModel(
            id: 7,
            productId: 'p-8',
            productName: 'Mutton Rogan Josh',
            quantity: 2,
            unitPrice: 460.0,
            status: 'served',
          ),
          OrderItemModel(
            id: 8,
            productId: 'p-9',
            productName: 'Hyderabadi Chicken Biryani',
            quantity: 2,
            unitPrice: 360.0,
            status: 'served',
          ),
          OrderItemModel(
            id: 9,
            productId: 'p-18',
            productName: 'Warm Gulab Jamun (2 pcs)',
            quantity: 2,
            unitPrice: 120.0,
            status: 'served',
          ),
        ],
      ),
    ];
  }

  static List<KdsTicketModel> getKdsTickets() {
    final now = DateTime.now();
    return [
      KdsTicketModel(
        id: 101,
        orderNumber: '#ORD-101',
        tableNumber: 'Table 1',
        serverName: 'Rahul',
        type: 'Dine-In',
        station: 'Main Kitchen',
        createdAt: now.subtract(const Duration(minutes: 8)),
        status: 'preparing',
        items: [
          OrderItemModel(
            id: 1,
            productId: 'p-1',
            productName: 'Paneer Tikka',
            quantity: 1,
            unitPrice: 240.0,
            status: 'preparing',
            notes: 'Extra mint chutney on side',
          ),
          OrderItemModel(
            id: 2,
            productId: 'p-6',
            productName: 'Paneer Butter Masala',
            quantity: 1,
            unitPrice: 310.0,
            status: 'waiting',
          ),
        ],
      ),
      KdsTicketModel(
        id: 104,
        orderNumber: '#ORD-104',
        tableNumber: 'Table 6',
        serverName: 'Anitha',
        type: 'Dine-In',
        station: 'Grill Station',
        createdAt: now.subtract(const Duration(minutes: 18)),
        status: 'waiting',
        items: [
          OrderItemModel(
            id: 10,
            productId: 'p-2',
            productName: 'Chicken Malai Tikka',
            quantity: 2,
            unitPrice: 320.0,
            status: 'waiting',
            notes: 'Well done, crispy edges',
          ),
        ],
      ),
      KdsTicketModel(
        id: 106,
        orderNumber: '#ORD-106',
        tableNumber: 'Takeaway #12',
        serverName: 'Counter',
        type: 'Takeaway',
        station: 'Main Kitchen',
        createdAt: now.subtract(const Duration(minutes: 3)),
        status: 'waiting',
        items: [
          OrderItemModel(
            id: 11,
            productId: 'p-9',
            productName: 'Hyderabadi Chicken Biryani',
            quantity: 2,
            unitPrice: 360.0,
            status: 'waiting',
            notes: 'Pack salan & raita separately',
          ),
        ],
      ),
    ];
  }

  static List<HeldOrderModel> getHeldOrders() {
    final prods = getProducts();
    return [
      HeldOrderModel(
        id: 'held-1',
        tableId: 't-5',
        tableName: 'Table 5',
        customerName: 'Vikram Malhotra',
        customerPhone: '+91 98222 33445',
        guestCount: 3,
        orderNotes: 'Guest stepped out to take call',
        createdAt: DateTime.now().subtract(const Duration(minutes: 15)),
        items: [
          DraftLineModel(product: prods[0], quantity: 2, note: 'Extra spicy'),
          DraftLineModel(product: prods[4], quantity: 1, note: ''),
          DraftLineModel(product: prods[11], quantity: 3, note: ''),
        ],
      ),
      HeldOrderModel(
        id: 'held-2',
        tableId: 't-7',
        tableName: 'Table 7',
        customerName: 'Ananya Roy',
        customerPhone: '+91 98444 55667',
        guestCount: 2,
        orderNotes: 'Waiting for rest of party to arrive',
        createdAt: DateTime.now().subtract(const Duration(minutes: 25)),
        items: [
          DraftLineModel(product: prods[8], quantity: 1, note: 'Double raita'),
          DraftLineModel(product: prods[14], quantity: 2, note: ''),
        ],
      ),
    ];
  }

  static List<CustomerModel> getCustomers() {
    return [
      CustomerModel(
        id: 'cust-1',
        name: 'Amit Verma',
        phone: '+91 98765 43210',
        email: 'amit.verma@example.com',
        loyaltyPoints: 340.0,
        totalVisits: 14,
        totalSpend: 18450.0,
        notes: 'Prefers Table 4 in AC Section',
        lastVisit: 'Yesterday, 8:45 PM',
      ),
      CustomerModel(
        id: 'cust-2',
        name: 'Deepak Sharma',
        phone: '+91 98111 22334',
        email: 'deepak.s@example.com',
        loyaltyPoints: 120.0,
        totalVisits: 6,
        totalSpend: 7800.0,
        notes: 'Strict vegetarian',
        lastVisit: '3 days ago',
      ),
      CustomerModel(
        id: 'cust-3',
        name: 'Sanjay Reddy',
        phone: '+91 99887 66554',
        email: 'sanjay.r@example.com',
        loyaltyPoints: 580.0,
        totalVisits: 22,
        totalSpend: 31200.0,
        notes: 'VIP guest - loves Biryani',
        lastVisit: 'Today, 1:15 PM',
      ),
      CustomerModel(
        id: 'cust-4',
        name: 'Pooja Hegde',
        phone: '+91 97766 55443',
        email: 'pooja.h@example.com',
        loyaltyPoints: 95.0,
        totalVisits: 4,
        totalSpend: 4200.0,
        lastVisit: 'Last week',
      ),
    ];
  }

  static List<IngredientModel> getIngredients() {
    return [
      IngredientModel(
        id: 'ing-1',
        name: 'Fresh Paneer (Cottage Cheese)',
        unit: 'kg',
        currentStock: 14.5,
        minimumStock: 8.0,
        costPerUnit: 340.0,
      ),
      IngredientModel(
        id: 'ing-2',
        name: 'Boneless Chicken Breast',
        unit: 'kg',
        currentStock: 6.2,
        minimumStock: 10.0, // Low stock!
        costPerUnit: 260.0,
      ),
      IngredientModel(
        id: 'ing-3',
        name: 'Basmati Long Grain Rice',
        unit: 'kg',
        currentStock: 48.0,
        minimumStock: 20.0,
        costPerUnit: 110.0,
      ),
      IngredientModel(
        id: 'ing-4',
        name: 'Cooking Cream (Amul 25%)',
        unit: 'ltr',
        currentStock: 3.5,
        minimumStock: 6.0, // Low stock!
        costPerUnit: 220.0,
      ),
      IngredientModel(
        id: 'ing-5',
        name: 'Butter (Unsalted)',
        unit: 'kg',
        currentStock: 9.0,
        minimumStock: 5.0,
        costPerUnit: 480.0,
      ),
      IngredientModel(
        id: 'ing-6',
        name: 'Alphonso Mango Pulp',
        unit: 'kg',
        currentStock: 12.0,
        minimumStock: 5.0,
        costPerUnit: 180.0,
      ),
    ];
  }

  static List<CashClosureModel> getCashClosures() {
    final now = DateTime.now();
    return [
      CashClosureModel(
        id: 'cls-1',
        zNumber: 42,
        businessDate: '2026-10-10',
        openingFloat: 2000.0,
        expectedCash: 18450.0,
        countedCash: 18450.0,
        cardTotal: 14200.0,
        upiTotal: 10200.0,
        grossSales: 42850.0,
        closedAt: now.subtract(const Duration(days: 1)),
        closedBy: 'Vikram (Manager)',
        notes: 'Shift balanced perfectly. All card settlements matched EDC slip.',
      ),
    ];
  }

  static List<ReservationModel> getReservations() {
    return [
      ReservationModel(
        id: 'res-1',
        tableId: 't-4',
        tableNumber: 'Table 4',
        customerName: 'Kiran Rao',
        customerPhone: '+91 98333 44556',
        guestCount: 6,
        reservationDate: 'Today',
        reservationTime: '08:30 PM',
        status: 'confirmed',
        notes: 'Birthday celebration - requested corner seating',
      ),
      ReservationModel(
        id: 'res-2',
        tableId: 't-8',
        tableNumber: 'Table 8',
        customerName: 'Meera Nambiar',
        customerPhone: '+91 98555 66778',
        guestCount: 8,
        reservationDate: 'Today',
        reservationTime: '09:00 PM',
        status: 'confirmed',
        notes: 'Corporate family dinner',
      ),
      ReservationModel(
        id: 'res-3',
        tableId: 't-6',
        tableNumber: 'Table 6',
        customerName: 'Arjun Kapoor',
        customerPhone: '+91 98777 88990',
        guestCount: 4,
        reservationDate: 'Today',
        reservationTime: '07:30 PM',
        status: 'seated',
        notes: 'Terrace garden preferred',
      ),
    ];
  }
}
