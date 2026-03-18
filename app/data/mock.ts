// import type {
//   Tenant, User, Service, Product, Category,
//   Appointment, Order, AnalyticsSummary,
// } from "../types/index";

// // ─────────────────────────────────────────────────────────────
// // TENANTS  (2 appointment + 2 ordering)
// // ─────────────────────────────────────────────────────────────
// export const mockTenants: Tenant[] = [
//   {
//     id: "apt-001",
//     name: "Luxe Beauty Studio",
//     slug: "luxe-beauty",
//     businessType: "appointment",
//     logo: "LB",
//     logoBg: "#c084fc",
//     description:
//       "Premium hair, nails & skincare services in the heart of the city. Walk-ins welcome, appointments preferred.",
//     phone: "(555) 234-5678",
//     email: "hello@luxebeauty.com",
//     address: "142 Bloom Street",
//     city: "Miami, FL",
//     coverImage:
//       "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80",
//     businessHours: [
//       { day: "Monday", open: "09:00", close: "18:00", closed: false },
//       { day: "Tuesday", open: "09:00", close: "18:00", closed: false },
//       { day: "Wednesday", open: "09:00", close: "20:00", closed: false },
//       { day: "Thursday", open: "09:00", close: "20:00", closed: false },
//       { day: "Friday", open: "09:00", close: "18:00", closed: false },
//       { day: "Saturday", open: "10:00", close: "16:00", closed: false },
//       { day: "Sunday", open: "", close: "", closed: true },
//     ],
//     socialLinks: { instagram: "@luxebeautystudio", facebook: "luxebeautystudio" },
//     primaryColor: "#c084fc",
//     accentColor: "#f0abfc",
//     createdAt: "2024-01-15",
//     isActive: true,
//     plan: "pro",
//     stripeConnected: true,
//   },
//   {
//     id: "apt-002",
//     name: "Iron Edge Barbershop",
//     slug: "iron-edge",
//     businessType: "appointment",
//     logo: "IE",
//     logoBg: "#34d399",
//     description:
//       "Classic cuts, modern styles. Premium grooming for the modern gentleman.",
//     phone: "(555) 876-5432",
//     email: "book@ironedge.com",
//     address: "88 Kings Avenue",
//     city: "Atlanta, GA",
//     coverImage:
//       "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&q=80",
//     businessHours: [
//       { day: "Monday", open: "08:00", close: "19:00", closed: false },
//       { day: "Tuesday", open: "08:00", close: "19:00", closed: false },
//       { day: "Wednesday", open: "08:00", close: "19:00", closed: false },
//       { day: "Thursday", open: "08:00", close: "19:00", closed: false },
//       { day: "Friday", open: "08:00", close: "19:00", closed: false },
//       { day: "Saturday", open: "09:00", close: "17:00", closed: false },
//       { day: "Sunday", open: "", close: "", closed: true },
//     ],
//     socialLinks: { instagram: "@ironedgebarber", twitter: "@ironedgebarber" },
//     primaryColor: "#34d399",
//     accentColor: "#6ee7b7",
//     createdAt: "2024-02-20",
//     isActive: true,
//     plan: "starter",
//     stripeConnected: true,
//   },
//   {
//     id: "ord-001",
//     name: "Ember & Oak Kitchen",
//     slug: "ember-oak",
//     businessType: "ordering",
//     logo: "EO",
//     logoBg: "#fb923c",
//     description:
//       "Wood-fired comfort food made fresh daily. Order online for pickup or delivery.",
//     phone: "(555) 321-7890",
//     email: "orders@emberoakkitchen.com",
//     address: "500 Flame Road",
//     city: "Austin, TX",
//     coverImage:
//       "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
//     businessHours: [
//       { day: "Monday", open: "11:00", close: "21:00", closed: false },
//       { day: "Tuesday", open: "11:00", close: "21:00", closed: false },
//       { day: "Wednesday", open: "11:00", close: "21:00", closed: false },
//       { day: "Thursday", open: "11:00", close: "22:00", closed: false },
//       { day: "Friday", open: "11:00", close: "22:00", closed: false },
//       { day: "Saturday", open: "10:00", close: "22:00", closed: false },
//       { day: "Sunday", open: "10:00", close: "20:00", closed: false },
//     ],
//     socialLinks: { instagram: "@emberoakkitchen", facebook: "emberoakkitchen" },
//     primaryColor: "#fb923c",
//     accentColor: "#fdba74",
//     createdAt: "2024-03-05",
//     isActive: true,
//     plan: "pro",
//     stripeConnected: true,
//   },
//   {
//     id: "ord-002",
//     name: "Blossom Bakehouse",
//     slug: "blossom-bakehouse",
//     businessType: "ordering",
//     logo: "BB",
//     logoBg: "#f472b6",
//     description:
//       "Artisan pastries, custom cakes, and fresh-baked breads. Pre-order for best selection.",
//     phone: "(555) 456-7890",
//     email: "hello@blossombakehouse.com",
//     address: "27 Petal Lane",
//     city: "Portland, OR",
//     coverImage:
//       "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=1200&q=80",
//     businessHours: [
//       { day: "Monday", open: "07:00", close: "17:00", closed: false },
//       { day: "Tuesday", open: "07:00", close: "17:00", closed: false },
//       { day: "Wednesday", open: "07:00", close: "17:00", closed: false },
//       { day: "Thursday", open: "07:00", close: "17:00", closed: false },
//       { day: "Friday", open: "07:00", close: "18:00", closed: false },
//       { day: "Saturday", open: "08:00", close: "16:00", closed: false },
//       { day: "Sunday", open: "", close: "", closed: true },
//     ],
//     socialLinks: { instagram: "@blossombakehouse", facebook: "blossombakehouse" },
//     primaryColor: "#f472b6",
//     accentColor: "#f9a8d4",
//     createdAt: "2024-04-12",
//     isActive: true,
//     plan: "pro",
//     stripeConnected: false,
//   },
// ];

// // ─────────────────────────────────────────────────────────────
// // USERS  (2-3 per tenant)
// // ─────────────────────────────────────────────────────────────
// export const mockUsers: User[] = [
//   { id: "u1", tenantId: "apt-001", name: "Serena Williams", email: "serena@luxebeauty.com", role: "owner", avatar: "SW", createdAt: "2024-01-15", lastLogin: "2025-01-10" },
//   { id: "u2", tenantId: "apt-001", name: "Maya Johnson", email: "maya@luxebeauty.com", role: "admin", avatar: "MJ", createdAt: "2024-01-20", lastLogin: "2025-01-09" },
//   { id: "u3", tenantId: "apt-001", name: "Zoe Chen", email: "zoe@luxebeauty.com", role: "staff", avatar: "ZC", createdAt: "2024-02-01", lastLogin: "2025-01-08" },
//   { id: "u4", tenantId: "apt-002", name: "Marcus Thompson", email: "marcus@ironedge.com", role: "owner", avatar: "MT", createdAt: "2024-02-20", lastLogin: "2025-01-10" },
//   { id: "u5", tenantId: "apt-002", name: "Derek Smith", email: "derek@ironedge.com", role: "admin", avatar: "DS", createdAt: "2024-03-01", lastLogin: "2025-01-07" },
//   { id: "u6", tenantId: "ord-001", name: "Isabella Garcia", email: "isabella@emberoakkitchen.com", role: "owner", avatar: "IG", createdAt: "2024-03-05", lastLogin: "2025-01-10" },
//   { id: "u7", tenantId: "ord-001", name: "Carlos Rivera", email: "carlos@emberoakkitchen.com", role: "admin", avatar: "CR", createdAt: "2024-03-10", lastLogin: "2025-01-10" },
//   { id: "u8", tenantId: "ord-002", name: "Lily Parker", email: "lily@blossombakehouse.com", role: "owner", avatar: "LP", createdAt: "2024-04-12", lastLogin: "2025-01-09" },
//   { id: "u9", tenantId: "ord-002", name: "Sam Reed", email: "sam@blossombakehouse.com", role: "admin", avatar: "SR", createdAt: "2024-04-20", lastLogin: "2025-01-08" },
// ];

// // ─────────────────────────────────────────────────────────────
// // SERVICES
// // ─────────────────────────────────────────────────────────────
// export const mockServices: Service[] = [
//   // Luxe Beauty
//   { id: "s1", tenantId: "apt-001", name: "Signature Hair Color", description: "Full color with premium products, toning & style finish.", duration: 120, price: 145, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=70", category: "Hair", isActive: true, requiresDeposit: true, depositAmount: 30, depositType: "fixed", createdAt: "2024-01-15" },
//   { id: "s2", tenantId: "apt-001", name: "Balayage & Highlights", description: "Hand-painted balayage for a natural sun-kissed look.", duration: 180, price: 220, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=70", category: "Hair", isActive: true, requiresDeposit: true, depositAmount: 50, depositType: "fixed", createdAt: "2024-01-15" },
//   { id: "s3", tenantId: "apt-001", name: "Luxury Manicure", description: "Gel polish, cuticle care, hand massage & nail art.", duration: 60, price: 55, image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=70", category: "Nails", isActive: true, requiresDeposit: false, createdAt: "2024-01-16" },
//   { id: "s4", tenantId: "apt-001", name: "Hydrating Facial", description: "Deep cleanse, exfoliation, mask & serum treatment.", duration: 75, price: 95, image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=70", category: "Skincare", isActive: true, requiresDeposit: false, createdAt: "2024-01-17" },
//   { id: "s5", tenantId: "apt-001", name: "Haircut & Style", description: "Precision cut, blow dry & styling finish.", duration: 60, price: 75, image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&q=70", category: "Hair", isActive: false, requiresDeposit: false, createdAt: "2024-01-18" },
//   // Iron Edge
//   { id: "s6", tenantId: "apt-002", name: "Classic Haircut", description: "Scissor or clipper cut, hot towel & style.", duration: 45, price: 35, image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=70", category: "Cuts", isActive: true, requiresDeposit: false, createdAt: "2024-02-20" },
//   { id: "s7", tenantId: "apt-002", name: "Beard Trim & Shape", description: "Full beard shaping, trimming & hot towel finish.", duration: 30, price: 25, image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&q=70", category: "Beard", isActive: true, requiresDeposit: false, createdAt: "2024-02-21" },
//   { id: "s8", tenantId: "apt-002", name: "Cut + Beard Combo", description: "Full haircut and beard grooming package.", duration: 60, price: 55, image: "https://images.unsplash.com/photo-1559479946-3fd82b9d8a35?w=400&q=70", category: "Packages", isActive: true, requiresDeposit: false, createdAt: "2024-02-22" },
//   { id: "s9", tenantId: "apt-002", name: "Hot Shave", description: "Traditional straight razor shave with hot towel.", duration: 30, price: 40, image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&q=70", category: "Shave", isActive: true, requiresDeposit: false, createdAt: "2024-02-23" },
// ];

// // ─────────────────────────────────────────────────────────────
// // CATEGORIES
// // ─────────────────────────────────────────────────────────────
// export const mockCategories: Category[] = [
//   { id: "c1", tenantId: "ord-001", name: "Starters", sortOrder: 1 },
//   { id: "c2", tenantId: "ord-001", name: "Mains", sortOrder: 2 },
//   { id: "c3", tenantId: "ord-001", name: "Sides", sortOrder: 3 },
//   { id: "c4", tenantId: "ord-001", name: "Drinks", sortOrder: 4 },
//   { id: "c5", tenantId: "ord-001", name: "Desserts", sortOrder: 5 },
//   { id: "c6", tenantId: "ord-002", name: "Breads", sortOrder: 1 },
//   { id: "c7", tenantId: "ord-002", name: "Pastries", sortOrder: 2 },
//   { id: "c8", tenantId: "ord-002", name: "Cakes", sortOrder: 3 },
//   { id: "c9", tenantId: "ord-002", name: "Beverages", sortOrder: 4 },
// ];

// // ─────────────────────────────────────────────────────────────
// // PRODUCTS
// // ─────────────────────────────────────────────────────────────
// export const mockProducts: Product[] = [
//   // Ember & Oak
//   { id: "p1", tenantId: "ord-001", name: "Ember Chicken Wings", description: "Wood-smoked wings with house dry rub and dipping sauce.", price: 14.99, image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&q=70", categoryId: "c1", categoryName: "Starters", isActive: true, inventory: 50, tags: ["popular", "spicy"], createdAt: "2024-03-05" },
//   { id: "p2", tenantId: "ord-001", name: "Oak Burger", description: "8oz smashed patty, aged cheddar, caramelized onions, brioche bun.", price: 18.99, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=70", categoryId: "c2", categoryName: "Mains", isActive: true, inventory: 30, tags: ["bestseller"], createdAt: "2024-03-05" },
//   { id: "p3", tenantId: "ord-001", name: "Wood-Fired Salmon", description: "Cedar plank salmon, lemon herb butter, seasonal veggies.", price: 26.99, image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=70", categoryId: "c2", categoryName: "Mains", isActive: true, inventory: 20, tags: ["healthy"], createdAt: "2024-03-06" },
//   { id: "p4", tenantId: "ord-001", name: "Truffle Mac & Cheese", description: "Creamy three-cheese sauce, truffle oil, crispy breadcrumbs.", price: 11.99, image: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400&q=70", categoryId: "c3", categoryName: "Sides", isActive: true, inventory: 40, tags: ["vegetarian"], createdAt: "2024-03-06" },
//   { id: "p5", tenantId: "ord-001", name: "Craft Lemonade", description: "House-made lemonade with fresh mint and lavender.", price: 5.99, image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&q=70", categoryId: "c4", categoryName: "Drinks", isActive: true, inventory: 100, tags: [], createdAt: "2024-03-07" },
//   { id: "p6", tenantId: "ord-001", name: "Ember Brownie", description: "Warm chocolate brownie, vanilla bean ice cream, caramel.", price: 9.99, image: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&q=70", categoryId: "c5", categoryName: "Desserts", isActive: true, inventory: 25, tags: ["popular"], createdAt: "2024-03-08" },
//   // Blossom
//   { id: "p7", tenantId: "ord-002", name: "Sourdough Loaf", description: "48-hour fermented sourdough with a crispy crust.", price: 12.00, image: "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=400&q=70", categoryId: "c6", categoryName: "Breads", isActive: true, inventory: 15, tags: ["bestseller"], createdAt: "2024-04-12" },
//   { id: "p8", tenantId: "ord-002", name: "Butter Croissant", description: "Flaky, buttery croissant baked fresh every morning.", price: 4.50, image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=70", categoryId: "c7", categoryName: "Pastries", isActive: true, inventory: 30, tags: ["popular"], createdAt: "2024-04-12" },
//   { id: "p9", tenantId: "ord-002", name: "Seasonal Fruit Tart", description: "Almond cream, fresh seasonal berries, vanilla glaze.", price: 6.50, image: "https://images.unsplash.com/photo-1484308788776-90d7db1e6e22?w=400&q=70", categoryId: "c7", categoryName: "Pastries", isActive: true, inventory: 20, tags: ["seasonal"], createdAt: "2024-04-13" },
//   { id: "p10", tenantId: "ord-002", name: "Custom Birthday Cake", description: "Made to order — choose flavor, filling, and design. 48hr notice.", price: 65.00, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=70", categoryId: "c8", categoryName: "Cakes", isActive: true, inventory: 5, tags: ["custom", "preorder"], createdAt: "2024-04-14" },
//   { id: "p11", tenantId: "ord-002", name: "Lavender Latte", description: "Oat milk latte with house-made lavender syrup.", price: 6.00, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=70", categoryId: "c9", categoryName: "Beverages", isActive: true, inventory: 100, tags: [], createdAt: "2024-04-15" },
// ];

// // ─────────────────────────────────────────────────────────────
// // APPOINTMENTS
// // ─────────────────────────────────────────────────────────────
// export const mockAppointments: Appointment[] = [
//   { id: "a1", tenantId: "apt-001", serviceId: "s1", serviceName: "Signature Hair Color", servicePrice: 145, customerName: "Alicia Banks", customerEmail: "alicia@email.com", customerPhone: "(555) 111-2222", date: "2025-01-13", time: "10:00", duration: 120, status: "confirmed", paymentStatus: "partial", depositPaid: 30, notes: "Prefers cooler tones", createdAt: "2025-01-05" },
//   { id: "a2", tenantId: "apt-001", serviceId: "s2", serviceName: "Balayage & Highlights", servicePrice: 220, customerName: "Jennifer Torres", customerEmail: "j.torres@email.com", customerPhone: "(555) 333-4444", date: "2025-01-13", time: "13:00", duration: 180, status: "confirmed", paymentStatus: "partial", depositPaid: 50, createdAt: "2025-01-06" },
//   { id: "a3", tenantId: "apt-001", serviceId: "s3", serviceName: "Luxury Manicure", servicePrice: 55, customerName: "Sandra Kim", customerEmail: "sandra@email.com", customerPhone: "(555) 555-6666", date: "2025-01-14", time: "11:00", duration: 60, status: "pending", paymentStatus: "unpaid", createdAt: "2025-01-08" },
//   { id: "a4", tenantId: "apt-001", serviceId: "s4", serviceName: "Hydrating Facial", servicePrice: 95, customerName: "Rachel Green", customerEmail: "rachel@email.com", customerPhone: "(555) 777-8888", date: "2025-01-14", time: "14:00", duration: 75, status: "confirmed", paymentStatus: "paid", createdAt: "2025-01-07" },
//   { id: "a5", tenantId: "apt-001", serviceId: "s1", serviceName: "Signature Hair Color", servicePrice: 145, customerName: "Monica Patel", customerEmail: "monica@email.com", customerPhone: "(555) 999-0000", date: "2025-01-10", time: "09:00", duration: 120, status: "completed", paymentStatus: "paid", depositPaid: 30, createdAt: "2025-01-02" },
//   { id: "a6", tenantId: "apt-001", serviceId: "s3", serviceName: "Luxury Manicure", servicePrice: 55, customerName: "Diana Prince", customerEmail: "diana@email.com", customerPhone: "(555) 123-9999", date: "2025-01-15", time: "10:30", duration: 60, status: "pending", paymentStatus: "unpaid", createdAt: "2025-01-09" },
//   { id: "a7", tenantId: "apt-002", serviceId: "s6", serviceName: "Classic Haircut", servicePrice: 35, customerName: "James Wilson", customerEmail: "james@email.com", customerPhone: "(555) 221-3300", date: "2025-01-13", time: "09:00", duration: 45, status: "confirmed", paymentStatus: "paid", createdAt: "2025-01-10" },
//   { id: "a8", tenantId: "apt-002", serviceId: "s8", serviceName: "Cut + Beard Combo", servicePrice: 55, customerName: "Marcus Lee", customerEmail: "mlee@email.com", customerPhone: "(555) 440-5500", date: "2025-01-13", time: "11:00", duration: 60, status: "pending", paymentStatus: "unpaid", createdAt: "2025-01-11" },
//   { id: "a9", tenantId: "apt-002", serviceId: "s7", serviceName: "Beard Trim & Shape", servicePrice: 25, customerName: "Tyler Brooks", customerEmail: "tyler@email.com", customerPhone: "(555) 660-7700", date: "2025-01-14", time: "14:00", duration: 30, status: "confirmed", paymentStatus: "paid", createdAt: "2025-01-09" },
// ];

// // ─────────────────────────────────────────────────────────────
// // ORDERS
// // ─────────────────────────────────────────────────────────────
// export const mockOrders: Order[] = [
//   {
//     id: "o1", tenantId: "ord-001", orderNumber: "EO-1001", customerName: "James Wilson",
//     customerEmail: "james@email.com", customerPhone: "(555) 222-3333",
//     items: [
//       { id: "oi1", productId: "p2", productName: "Oak Burger", productImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&q=60", quantity: 2, price: 18.99 },
//       { id: "oi2", productId: "p4", productName: "Truffle Mac & Cheese", productImage: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=100&q=60", quantity: 1, price: 11.99 },
//     ],
//     status: "preparing", paymentStatus: "paid", totalAmount: 49.97, pickupTime: "12:30", createdAt: "2025-01-10T11:45:00",
//   },
//   {
//     id: "o2", tenantId: "ord-001", orderNumber: "EO-1002", customerName: "Priya Shah",
//     customerEmail: "priya@email.com", customerPhone: "(555) 444-5555",
//     items: [
//       { id: "oi3", productId: "p3", productName: "Wood-Fired Salmon", productImage: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=100&q=60", quantity: 1, price: 26.99 },
//       { id: "oi4", productId: "p5", productName: "Craft Lemonade", productImage: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=100&q=60", quantity: 2, price: 5.99 },
//     ],
//     status: "confirmed", paymentStatus: "paid", totalAmount: 38.97, createdAt: "2025-01-10T12:15:00",
//   },
//   {
//     id: "o3", tenantId: "ord-001", orderNumber: "EO-1003", customerName: "Tom Bradley",
//     customerEmail: "tom@email.com", customerPhone: "(555) 666-7777",
//     items: [
//       { id: "oi5", productId: "p1", productName: "Ember Chicken Wings", productImage: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=100&q=60", quantity: 2, price: 14.99 },
//       { id: "oi6", productId: "p6", productName: "Ember Brownie", productImage: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=100&q=60", quantity: 1, price: 9.99 },
//     ],
//     status: "pending", paymentStatus: "paid", totalAmount: 39.97, createdAt: "2025-01-10T13:00:00",
//   },
//   {
//     id: "o4", tenantId: "ord-001", orderNumber: "EO-1000", customerName: "Emily Chen",
//     customerEmail: "emily@email.com", customerPhone: "(555) 888-9999",
//     items: [{ id: "oi7", productId: "p2", productName: "Oak Burger", productImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&q=60", quantity: 1, price: 18.99 }],
//     status: "delivered", paymentStatus: "paid", totalAmount: 18.99, createdAt: "2025-01-09T18:30:00",
//   },
//   {
//     id: "o5", tenantId: "ord-002", orderNumber: "BB-201", customerName: "Sarah Davis",
//     customerEmail: "sarah@email.com", customerPhone: "(555) 101-2020",
//     items: [
//       { id: "oi8", productId: "p7", productName: "Sourdough Loaf", productImage: "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=100&q=60", quantity: 2, price: 12.00 },
//       { id: "oi9", productId: "p8", productName: "Butter Croissant", productImage: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=100&q=60", quantity: 3, price: 4.50 },
//     ],
//     status: "confirmed", paymentStatus: "paid", totalAmount: 37.50, createdAt: "2025-01-10T08:00:00",
//   },
//   {
//     id: "o6", tenantId: "ord-002", orderNumber: "BB-202", customerName: "Mike Johnson",
//     customerEmail: "mike@email.com", customerPhone: "(555) 303-4040",
//     items: [{ id: "oi10", productId: "p10", productName: "Custom Birthday Cake", productImage: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=100&q=60", quantity: 1, price: 65.00 }],
//     status: "pending", paymentStatus: "unpaid", totalAmount: 65.00, notes: "Chocolate sponge, vanilla buttercream. Write 'Happy 30th Emma'", createdAt: "2025-01-09T14:00:00",
//   },
// ];

// // ─────────────────────────────────────────────────────────────
// // ANALYTICS
// // ─────────────────────────────────────────────────────────────
// export const mockAnalytics: Record<string, AnalyticsSummary> = {
//   "apt-001": {
//     totalRevenue: 4820, totalActivity: 42, newCustomers: 18, avgOrderValue: 114.76,
//     revenueChange: 12.4, activityChange: 8.2,
//     topItems: [
//       { name: "Balayage & Highlights", count: 14, revenue: 3080 },
//       { name: "Signature Hair Color", count: 12, revenue: 1740 },
//       { name: "Hydrating Facial", count: 9, revenue: 855 },
//       { name: "Luxury Manicure", count: 7, revenue: 385 },
//     ],
//     revenueData: [
//       { date: "Jan 1", revenue: 320, count: 3 }, { date: "Jan 2", revenue: 580, count: 5 },
//       { date: "Jan 3", revenue: 420, count: 4 }, { date: "Jan 4", revenue: 690, count: 6 },
//       { date: "Jan 5", revenue: 510, count: 5 }, { date: "Jan 6", revenue: 740, count: 7 },
//       { date: "Jan 7", revenue: 380, count: 4 }, { date: "Jan 8", revenue: 620, count: 6 },
//       { date: "Jan 9", revenue: 260, count: 2 }, { date: "Jan 10", revenue: 300, count: 0 },
//     ],
//   },
//   "apt-002": {
//     totalRevenue: 2340, totalActivity: 67, newCustomers: 31, avgOrderValue: 34.93,
//     revenueChange: 5.1, activityChange: 12.0,
//     topItems: [
//       { name: "Cut + Beard Combo", count: 28, revenue: 1540 },
//       { name: "Classic Haircut", count: 24, revenue: 840 },
//       { name: "Hot Shave", count: 8, revenue: 320 },
//       { name: "Beard Trim", count: 7, revenue: 175 },
//     ],
//     revenueData: [
//       { date: "Jan 1", revenue: 175, count: 5 }, { date: "Jan 2", revenue: 280, count: 8 },
//       { date: "Jan 3", revenue: 245, count: 7 }, { date: "Jan 4", revenue: 315, count: 9 },
//       { date: "Jan 5", revenue: 260, count: 7 }, { date: "Jan 6", revenue: 350, count: 10 },
//       { date: "Jan 7", revenue: 215, count: 6 }, { date: "Jan 8", revenue: 290, count: 8 },
//       { date: "Jan 9", revenue: 120, count: 4 }, { date: "Jan 10", revenue: 90, count: 3 },
//     ],
//   },
//   "ord-001": {
//     totalRevenue: 12480, totalActivity: 312, newCustomers: 89, avgOrderValue: 40.00,
//     revenueChange: 22.1, activityChange: 15.3,
//     topItems: [
//       { name: "Oak Burger", count: 98, revenue: 1861 },
//       { name: "Wood-Fired Salmon", count: 72, revenue: 1943 },
//       { name: "Ember Chicken Wings", count: 61, revenue: 914 },
//       { name: "Ember Brownie", count: 55, revenue: 549 },
//     ],
//     revenueData: [
//       { date: "Jan 1", revenue: 980, count: 24 }, { date: "Jan 2", revenue: 1240, count: 31 },
//       { date: "Jan 3", revenue: 1100, count: 27 }, { date: "Jan 4", revenue: 1380, count: 34 },
//       { date: "Jan 5", revenue: 1420, count: 36 }, { date: "Jan 6", revenue: 1580, count: 39 },
//       { date: "Jan 7", revenue: 1640, count: 41 }, { date: "Jan 8", revenue: 1320, count: 33 },
//       { date: "Jan 9", revenue: 960, count: 24 }, { date: "Jan 10", revenue: 860, count: 23 },
//     ],
//   },
//   "ord-002": {
//     totalRevenue: 6720, totalActivity: 148, newCustomers: 52, avgOrderValue: 45.41,
//     revenueChange: 18.5, activityChange: 9.8,
//     topItems: [
//       { name: "Custom Birthday Cake", count: 32, revenue: 2080 },
//       { name: "Sourdough Loaf", count: 58, revenue: 696 },
//       { name: "Butter Croissant", count: 112, revenue: 504 },
//       { name: "Seasonal Fruit Tart", count: 44, revenue: 286 },
//     ],
//     revenueData: [
//       { date: "Jan 1", revenue: 480, count: 12 }, { date: "Jan 2", revenue: 720, count: 16 },
//       { date: "Jan 3", revenue: 650, count: 14 }, { date: "Jan 4", revenue: 810, count: 18 },
//       { date: "Jan 5", revenue: 760, count: 17 }, { date: "Jan 6", revenue: 920, count: 20 },
//       { date: "Jan 7", revenue: 680, count: 15 }, { date: "Jan 8", revenue: 740, count: 16 },
//       { date: "Jan 9", revenue: 510, count: 11 }, { date: "Jan 10", revenue: 450, count: 9 },
//     ],
//   },
// };

// // ─────────────────────────────────────────────────────────────
// // HELPERS
// // ─────────────────────────────────────────────────────────────
// export const getServicesByTenant    = (id: string) => mockServices.filter(s => s.tenantId === id);
// export const getProductsByTenant    = (id: string) => mockProducts.filter(p => p.tenantId === id);
// export const getCategoriesByTenant  = (id: string) => mockCategories.filter(c => c.tenantId === id);
// export const getAppointmentsByTenant = (id: string) => mockAppointments.filter(a => a.tenantId === id);
// export const getOrdersByTenant      = (id: string) => mockOrders.filter(o => o.tenantId === id);
// export const getUsersByTenant       = (id: string) => mockUsers.filter(u => u.tenantId === id);
// export const getTenantById          = (id: string) => mockTenants.find(t => t.id === id);
// export const getTenantBySlug        = (slug: string) => mockTenants.find(t => t.slug === slug);





// import type {
//   Tenant, User, Service, Product, Category,
//   Appointment, Order, AnalyticsSummary,
// } from "../types/index";

// // ─────────────────────────────────────────────────────────────
// // TENANTS  (2 appointment + 2 ordering)
// // ─────────────────────────────────────────────────────────────
// export const mockTenants: Tenant[] = [
//   {
//     id: "apt-001",
//     name: "Luxe Beauty Studio",
//     slug: "luxe-beauty",
//     businessType: "appointment",
//     logo: "LB",
//     logoBg: "#c084fc",
//     description:
//       "Premium hair, nails & skincare services in the heart of the city. Walk-ins welcome, appointments preferred.",
//     phone: "(555) 234-5678",
//     email: "hello@luxebeauty.com",
//     address: "142 Bloom Street",
//     city: "Miami, FL",
//     coverImage:
//       "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80",
//     businessHours: [
//       { day: "Monday", open: "09:00", close: "18:00", closed: false },
//       { day: "Tuesday", open: "09:00", close: "18:00", closed: false },
//       { day: "Wednesday", open: "09:00", close: "20:00", closed: false },
//       { day: "Thursday", open: "09:00", close: "20:00", closed: false },
//       { day: "Friday", open: "09:00", close: "18:00", closed: false },
//       { day: "Saturday", open: "10:00", close: "16:00", closed: false },
//       { day: "Sunday", open: "", close: "", closed: true },
//     ],
//     socialLinks: { instagram: "@luxebeautystudio", facebook: "luxebeautystudio" },
//     primaryColor: "#c084fc",
//     accentColor: "#f0abfc",
//     createdAt: "2024-01-15",
//     isActive: true,
//     plan: "pro",
//     stripeConnected: true,
//   },
//   {
//     id: "apt-002",
//     name: "Iron Edge Barbershop",
//     slug: "iron-edge",
//     businessType: "appointment",
//     logo: "IE",
//     logoBg: "#34d399",
//     description:
//       "Classic cuts, modern styles. Premium grooming for the modern gentleman.",
//     phone: "(555) 876-5432",
//     email: "book@ironedge.com",
//     address: "88 Kings Avenue",
//     city: "Atlanta, GA",
//     coverImage:
//       "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&q=80",
//     businessHours: [
//       { day: "Monday", open: "08:00", close: "19:00", closed: false },
//       { day: "Tuesday", open: "08:00", close: "19:00", closed: false },
//       { day: "Wednesday", open: "08:00", close: "19:00", closed: false },
//       { day: "Thursday", open: "08:00", close: "19:00", closed: false },
//       { day: "Friday", open: "08:00", close: "19:00", closed: false },
//       { day: "Saturday", open: "09:00", close: "17:00", closed: false },
//       { day: "Sunday", open: "", close: "", closed: true },
//     ],
//     socialLinks: { instagram: "@ironedgebarber", twitter: "@ironedgebarber" },
//     primaryColor: "#34d399",
//     accentColor: "#6ee7b7",
//     createdAt: "2024-02-20",
//     isActive: true,
//     plan: "starter",
//     stripeConnected: true,
//   },
//   {
//     id: "ord-001",
//     name: "Ember & Oak Kitchen",
//     slug: "ember-oak",
//     businessType: "ordering",
//     logo: "EO",
//     logoBg: "#fb923c",
//     description:
//       "Wood-fired comfort food made fresh daily. Order online for pickup or delivery.",
//     phone: "(555) 321-7890",
//     email: "orders@emberoakkitchen.com",
//     address: "500 Flame Road",
//     city: "Austin, TX",
//     coverImage:
//       "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
//     businessHours: [
//       { day: "Monday", open: "11:00", close: "21:00", closed: false },
//       { day: "Tuesday", open: "11:00", close: "21:00", closed: false },
//       { day: "Wednesday", open: "11:00", close: "21:00", closed: false },
//       { day: "Thursday", open: "11:00", close: "22:00", closed: false },
//       { day: "Friday", open: "11:00", close: "22:00", closed: false },
//       { day: "Saturday", open: "10:00", close: "22:00", closed: false },
//       { day: "Sunday", open: "10:00", close: "20:00", closed: false },
//     ],
//     socialLinks: { instagram: "@emberoakkitchen", facebook: "emberoakkitchen" },
//     primaryColor: "#fb923c",
//     accentColor: "#fdba74",
//     createdAt: "2024-03-05",
//     isActive: true,
//     plan: "pro",
//     stripeConnected: true,
//   },
//   {
//     id: "ord-002",
//     name: "Blossom Bakehouse",
//     slug: "blossom-bakehouse",
//     businessType: "ordering",
//     logo: "BB",
//     logoBg: "#f472b6",
//     description:
//       "Artisan pastries, custom cakes, and fresh-baked breads. Pre-order for best selection.",
//     phone: "(555) 456-7890",
//     email: "hello@blossombakehouse.com",
//     address: "27 Petal Lane",
//     city: "Portland, OR",
//     coverImage:
//       "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=1200&q=80",
//     businessHours: [
//       { day: "Monday", open: "07:00", close: "17:00", closed: false },
//       { day: "Tuesday", open: "07:00", close: "17:00", closed: false },
//       { day: "Wednesday", open: "07:00", close: "17:00", closed: false },
//       { day: "Thursday", open: "07:00", close: "17:00", closed: false },
//       { day: "Friday", open: "07:00", close: "18:00", closed: false },
//       { day: "Saturday", open: "08:00", close: "16:00", closed: false },
//       { day: "Sunday", open: "", close: "", closed: true },
//     ],
//     socialLinks: { instagram: "@blossombakehouse", facebook: "blossombakehouse" },
//     primaryColor: "#f472b6",
//     accentColor: "#f9a8d4",
//     createdAt: "2024-04-12",
//     isActive: true,
//     plan: "pro",
//     stripeConnected: false,
//   },
// ];

// // ─────────────────────────────────────────────────────────────
// // USERS  (2-3 per tenant + superadmin)
// // ─────────────────────────────────────────────────────────────
// export const mockUsers: User[] = [
//   // Super Admin
//   { id: "sa1", tenantId: null, name: "Alex Rivera", email: "admin@localspace.io", role: "superadmin", avatar: "AR", createdAt: "2024-01-01", lastLogin: "2025-01-10" },
//   // Luxe Beauty
//   { id: "u1", tenantId: "apt-001", name: "Serena Williams", email: "serena@luxebeauty.com", role: "owner", avatar: "SW", createdAt: "2024-01-15", lastLogin: "2025-01-10" },
//   { id: "u2", tenantId: "apt-001", name: "Maya Johnson", email: "maya@luxebeauty.com", role: "admin", avatar: "MJ", createdAt: "2024-01-20", lastLogin: "2025-01-09" },
//   { id: "u3", tenantId: "apt-001", name: "Zoe Chen", email: "zoe@luxebeauty.com", role: "staff", avatar: "ZC", createdAt: "2024-02-01", lastLogin: "2025-01-08" },
//   // Iron Edge
//   { id: "u4", tenantId: "apt-002", name: "Marcus Thompson", email: "marcus@ironedge.com", role: "owner", avatar: "MT", createdAt: "2024-02-20", lastLogin: "2025-01-10" },
//   { id: "u5", tenantId: "apt-002", name: "Derek Smith", email: "derek@ironedge.com", role: "admin", avatar: "DS", createdAt: "2024-03-01", lastLogin: "2025-01-07" },
//   // Ember & Oak
//   { id: "u6", tenantId: "ord-001", name: "Isabella Garcia", email: "isabella@emberoakkitchen.com", role: "owner", avatar: "IG", createdAt: "2024-03-05", lastLogin: "2025-01-10" },
//   { id: "u7", tenantId: "ord-001", name: "Carlos Rivera", email: "carlos@emberoakkitchen.com", role: "admin", avatar: "CR", createdAt: "2024-03-10", lastLogin: "2025-01-10" },
//   // Blossom
//   { id: "u8", tenantId: "ord-002", name: "Lily Parker", email: "lily@blossombakehouse.com", role: "owner", avatar: "LP", createdAt: "2024-04-12", lastLogin: "2025-01-09" },
//   { id: "u9", tenantId: "ord-002", name: "Sam Reed", email: "sam@blossombakehouse.com", role: "admin", avatar: "SR", createdAt: "2024-04-20", lastLogin: "2025-01-08" },
// ];

// // Demo login accounts for quick reference
// export const demoAccounts = [
//   { label: "Super Admin", name: "Alex Rivera", email: "admin@localspace.io", password: "admin123", role: "superadmin" as const, tenantId: null },
//   { label: "Luxe Beauty (Appointments)", name: "Serena Williams", email: "serena@luxebeauty.com", password: "password123", role: "owner" as const, tenantId: "apt-001" },
//   { label: "Iron Edge (Appointments)", name: "Marcus Thompson", email: "marcus@ironedge.com", password: "password123", role: "owner" as const, tenantId: "apt-002" },
//   { label: "Ember & Oak (Ordering)", name: "Isabella Garcia", email: "isabella@emberoakkitchen.com", password: "password123", role: "owner" as const, tenantId: "ord-001" },
//   { label: "Blossom Bakehouse (Ordering)", name: "Lily Parker", email: "lily@blossombakehouse.com", password: "password123", role: "owner" as const, tenantId: "ord-002" },
// ];

// // ─────────────────────────────────────────────────────────────
// // SERVICES
// // ─────────────────────────────────────────────────────────────
// export const mockServices: Service[] = [
//   // Luxe Beauty
//   { id: "s1", tenantId: "apt-001", name: "Signature Hair Color", description: "Full color with premium products, toning & style finish.", duration: 120, price: 145, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=70", category: "Hair", isActive: true, requiresDeposit: true, depositAmount: 30, depositType: "fixed", createdAt: "2024-01-15" },
//   { id: "s2", tenantId: "apt-001", name: "Balayage & Highlights", description: "Hand-painted balayage for a natural sun-kissed look.", duration: 180, price: 220, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=70", category: "Hair", isActive: true, requiresDeposit: true, depositAmount: 50, depositType: "fixed", createdAt: "2024-01-15" },
//   { id: "s3", tenantId: "apt-001", name: "Luxury Manicure", description: "Gel polish, cuticle care, hand massage & nail art.", duration: 60, price: 55, image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=70", category: "Nails", isActive: true, requiresDeposit: false, createdAt: "2024-01-16" },
//   { id: "s4", tenantId: "apt-001", name: "Hydrating Facial", description: "Deep cleanse, exfoliation, mask & serum treatment.", duration: 75, price: 95, image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=70", category: "Skincare", isActive: true, requiresDeposit: false, createdAt: "2024-01-17" },
//   { id: "s5", tenantId: "apt-001", name: "Haircut & Style", description: "Precision cut, blow dry & styling finish.", duration: 60, price: 75, image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&q=70", category: "Hair", isActive: false, requiresDeposit: false, createdAt: "2024-01-18" },
//   // Iron Edge
//   { id: "s6", tenantId: "apt-002", name: "Classic Haircut", description: "Scissor or clipper cut, hot towel & style.", duration: 45, price: 35, image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=70", category: "Cuts", isActive: true, requiresDeposit: false, createdAt: "2024-02-20" },
//   { id: "s7", tenantId: "apt-002", name: "Beard Trim & Shape", description: "Full beard shaping, trimming & hot towel finish.", duration: 30, price: 25, image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&q=70", category: "Beard", isActive: true, requiresDeposit: false, createdAt: "2024-02-21" },
//   { id: "s8", tenantId: "apt-002", name: "Cut + Beard Combo", description: "Full haircut and beard grooming package.", duration: 60, price: 55, image: "https://images.unsplash.com/photo-1559479946-3fd82b9d8a35?w=400&q=70", category: "Packages", isActive: true, requiresDeposit: false, createdAt: "2024-02-22" },
//   { id: "s9", tenantId: "apt-002", name: "Hot Shave", description: "Traditional straight razor shave with hot towel.", duration: 30, price: 40, image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&q=70", category: "Shave", isActive: true, requiresDeposit: false, createdAt: "2024-02-23" },
// ];

// // ─────────────────────────────────────────────────────────────
// // CATEGORIES
// // ─────────────────────────────────────────────────────────────
// export const mockCategories: Category[] = [
//   { id: "c1", tenantId: "ord-001", name: "Starters", sortOrder: 1 },
//   { id: "c2", tenantId: "ord-001", name: "Mains", sortOrder: 2 },
//   { id: "c3", tenantId: "ord-001", name: "Sides", sortOrder: 3 },
//   { id: "c4", tenantId: "ord-001", name: "Drinks", sortOrder: 4 },
//   { id: "c5", tenantId: "ord-001", name: "Desserts", sortOrder: 5 },
//   { id: "c6", tenantId: "ord-002", name: "Breads", sortOrder: 1 },
//   { id: "c7", tenantId: "ord-002", name: "Pastries", sortOrder: 2 },
//   { id: "c8", tenantId: "ord-002", name: "Cakes", sortOrder: 3 },
//   { id: "c9", tenantId: "ord-002", name: "Beverages", sortOrder: 4 },
// ];

// // ─────────────────────────────────────────────────────────────
// // PRODUCTS
// // ─────────────────────────────────────────────────────────────
// export const mockProducts: Product[] = [
//   // Ember & Oak
//   { id: "p1", tenantId: "ord-001", name: "Ember Chicken Wings", description: "Wood-smoked wings with house dry rub and dipping sauce.", price: 14.99, image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&q=70", categoryId: "c1", categoryName: "Starters", isActive: true, inventory: 50, tags: ["popular", "spicy"], createdAt: "2024-03-05" },
//   { id: "p2", tenantId: "ord-001", name: "Oak Burger", description: "8oz smashed patty, aged cheddar, caramelized onions, brioche bun.", price: 18.99, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=70", categoryId: "c2", categoryName: "Mains", isActive: true, inventory: 30, tags: ["bestseller"], createdAt: "2024-03-05" },
//   { id: "p3", tenantId: "ord-001", name: "Wood-Fired Salmon", description: "Cedar plank salmon, lemon herb butter, seasonal veggies.", price: 26.99, image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=70", categoryId: "c2", categoryName: "Mains", isActive: true, inventory: 20, tags: ["healthy"], createdAt: "2024-03-06" },
//   { id: "p4", tenantId: "ord-001", name: "Truffle Mac & Cheese", description: "Creamy three-cheese sauce, truffle oil, crispy breadcrumbs.", price: 11.99, image: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400&q=70", categoryId: "c3", categoryName: "Sides", isActive: true, inventory: 40, tags: ["vegetarian"], createdAt: "2024-03-06" },
//   { id: "p5", tenantId: "ord-001", name: "Craft Lemonade", description: "House-made lemonade with fresh mint and lavender.", price: 5.99, image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&q=70", categoryId: "c4", categoryName: "Drinks", isActive: true, inventory: 100, tags: [], createdAt: "2024-03-07" },
//   { id: "p6", tenantId: "ord-001", name: "Ember Brownie", description: "Warm chocolate brownie, vanilla bean ice cream, caramel.", price: 9.99, image: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&q=70", categoryId: "c5", categoryName: "Desserts", isActive: true, inventory: 25, tags: ["popular"], createdAt: "2024-03-08" },
//   // Blossom
//   { id: "p7", tenantId: "ord-002", name: "Sourdough Loaf", description: "48-hour fermented sourdough with a crispy crust.", price: 12.00, image: "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=400&q=70", categoryId: "c6", categoryName: "Breads", isActive: true, inventory: 15, tags: ["bestseller"], createdAt: "2024-04-12" },
//   { id: "p8", tenantId: "ord-002", name: "Butter Croissant", description: "Flaky, buttery croissant baked fresh every morning.", price: 4.50, image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=70", categoryId: "c7", categoryName: "Pastries", isActive: true, inventory: 30, tags: ["popular"], createdAt: "2024-04-12" },
//   { id: "p9", tenantId: "ord-002", name: "Seasonal Fruit Tart", description: "Almond cream, fresh seasonal berries, vanilla glaze.", price: 6.50, image: "https://images.unsplash.com/photo-1484308788776-90d7db1e6e22?w=400&q=70", categoryId: "c7", categoryName: "Pastries", isActive: true, inventory: 20, tags: ["seasonal"], createdAt: "2024-04-13" },
//   { id: "p10", tenantId: "ord-002", name: "Custom Birthday Cake", description: "Made to order — choose flavor, filling, and design. 48hr notice.", price: 65.00, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=70", categoryId: "c8", categoryName: "Cakes", isActive: true, inventory: 5, tags: ["custom", "preorder"], createdAt: "2024-04-14" },
//   { id: "p11", tenantId: "ord-002", name: "Lavender Latte", description: "Oat milk latte with house-made lavender syrup.", price: 6.00, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=70", categoryId: "c9", categoryName: "Beverages", isActive: true, inventory: 100, tags: [], createdAt: "2024-04-15" },
// ];

// // ─────────────────────────────────────────────────────────────
// // APPOINTMENTS
// // ─────────────────────────────────────────────────────────────
// export const mockAppointments: Appointment[] = [
//   { id: "a1", tenantId: "apt-001", serviceId: "s1", serviceName: "Signature Hair Color", servicePrice: 145, customerName: "Alicia Banks", customerEmail: "alicia@email.com", customerPhone: "(555) 111-2222", date: "2025-01-13", time: "10:00", duration: 120, status: "confirmed", paymentStatus: "partial", depositPaid: 30, notes: "Prefers cooler tones", createdAt: "2025-01-05" },
//   { id: "a2", tenantId: "apt-001", serviceId: "s2", serviceName: "Balayage & Highlights", servicePrice: 220, customerName: "Jennifer Torres", customerEmail: "j.torres@email.com", customerPhone: "(555) 333-4444", date: "2025-01-13", time: "13:00", duration: 180, status: "confirmed", paymentStatus: "partial", depositPaid: 50, createdAt: "2025-01-06" },
//   { id: "a3", tenantId: "apt-001", serviceId: "s3", serviceName: "Luxury Manicure", servicePrice: 55, customerName: "Sandra Kim", customerEmail: "sandra@email.com", customerPhone: "(555) 555-6666", date: "2025-01-14", time: "11:00", duration: 60, status: "pending", paymentStatus: "unpaid", createdAt: "2025-01-08" },
//   { id: "a4", tenantId: "apt-001", serviceId: "s4", serviceName: "Hydrating Facial", servicePrice: 95, customerName: "Rachel Green", customerEmail: "rachel@email.com", customerPhone: "(555) 777-8888", date: "2025-01-14", time: "14:00", duration: 75, status: "confirmed", paymentStatus: "paid", createdAt: "2025-01-07" },
//   { id: "a5", tenantId: "apt-001", serviceId: "s1", serviceName: "Signature Hair Color", servicePrice: 145, customerName: "Monica Patel", customerEmail: "monica@email.com", customerPhone: "(555) 999-0000", date: "2025-01-10", time: "09:00", duration: 120, status: "completed", paymentStatus: "paid", depositPaid: 30, createdAt: "2025-01-02" },
//   { id: "a6", tenantId: "apt-001", serviceId: "s3", serviceName: "Luxury Manicure", servicePrice: 55, customerName: "Diana Prince", customerEmail: "diana@email.com", customerPhone: "(555) 123-9999", date: "2025-01-15", time: "10:30", duration: 60, status: "pending", paymentStatus: "unpaid", createdAt: "2025-01-09" },
//   { id: "a7", tenantId: "apt-002", serviceId: "s6", serviceName: "Classic Haircut", servicePrice: 35, customerName: "James Wilson", customerEmail: "james@email.com", customerPhone: "(555) 221-3300", date: "2025-01-13", time: "09:00", duration: 45, status: "confirmed", paymentStatus: "paid", createdAt: "2025-01-10" },
//   { id: "a8", tenantId: "apt-002", serviceId: "s8", serviceName: "Cut + Beard Combo", servicePrice: 55, customerName: "Marcus Lee", customerEmail: "mlee@email.com", customerPhone: "(555) 440-5500", date: "2025-01-13", time: "11:00", duration: 60, status: "pending", paymentStatus: "unpaid", createdAt: "2025-01-11" },
//   { id: "a9", tenantId: "apt-002", serviceId: "s7", serviceName: "Beard Trim & Shape", servicePrice: 25, customerName: "Tyler Brooks", customerEmail: "tyler@email.com", customerPhone: "(555) 660-7700", date: "2025-01-14", time: "14:00", duration: 30, status: "confirmed", paymentStatus: "paid", createdAt: "2025-01-09" },
// ];

// // ─────────────────────────────────────────────────────────────
// // ORDERS
// // ─────────────────────────────────────────────────────────────
// export const mockOrders: Order[] = [
//   {
//     id: "o1", tenantId: "ord-001", orderNumber: "EO-1001", customerName: "James Wilson",
//     customerEmail: "james@email.com", customerPhone: "(555) 222-3333",
//     items: [
//       { id: "oi1", productId: "p2", productName: "Oak Burger", productImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&q=60", quantity: 2, price: 18.99 },
//       { id: "oi2", productId: "p4", productName: "Truffle Mac & Cheese", productImage: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=100&q=60", quantity: 1, price: 11.99 },
//     ],
//     status: "preparing", paymentStatus: "paid", totalAmount: 49.97, pickupTime: "12:30", createdAt: "2025-01-10T11:45:00",
//   },
//   {
//     id: "o2", tenantId: "ord-001", orderNumber: "EO-1002", customerName: "Priya Shah",
//     customerEmail: "priya@email.com", customerPhone: "(555) 444-5555",
//     items: [
//       { id: "oi3", productId: "p3", productName: "Wood-Fired Salmon", productImage: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=100&q=60", quantity: 1, price: 26.99 },
//       { id: "oi4", productId: "p5", productName: "Craft Lemonade", productImage: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=100&q=60", quantity: 2, price: 5.99 },
//     ],
//     status: "confirmed", paymentStatus: "paid", totalAmount: 38.97, createdAt: "2025-01-10T12:15:00",
//   },
//   {
//     id: "o3", tenantId: "ord-001", orderNumber: "EO-1003", customerName: "Tom Bradley",
//     customerEmail: "tom@email.com", customerPhone: "(555) 666-7777",
//     items: [
//       { id: "oi5", productId: "p1", productName: "Ember Chicken Wings", productImage: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=100&q=60", quantity: 2, price: 14.99 },
//       { id: "oi6", productId: "p6", productName: "Ember Brownie", productImage: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=100&q=60", quantity: 1, price: 9.99 },
//     ],
//     status: "pending", paymentStatus: "paid", totalAmount: 39.97, createdAt: "2025-01-10T13:00:00",
//   },
//   {
//     id: "o4", tenantId: "ord-001", orderNumber: "EO-1000", customerName: "Emily Chen",
//     customerEmail: "emily@email.com", customerPhone: "(555) 888-9999",
//     items: [{ id: "oi7", productId: "p2", productName: "Oak Burger", productImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&q=60", quantity: 1, price: 18.99 }],
//     status: "delivered", paymentStatus: "paid", totalAmount: 18.99, createdAt: "2025-01-09T18:30:00",
//   },
//   {
//     id: "o5", tenantId: "ord-002", orderNumber: "BB-201", customerName: "Sarah Davis",
//     customerEmail: "sarah@email.com", customerPhone: "(555) 101-2020",
//     items: [
//       { id: "oi8", productId: "p7", productName: "Sourdough Loaf", productImage: "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=100&q=60", quantity: 2, price: 12.00 },
//       { id: "oi9", productId: "p8", productName: "Butter Croissant", productImage: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=100&q=60", quantity: 3, price: 4.50 },
//     ],
//     status: "confirmed", paymentStatus: "paid", totalAmount: 37.50, createdAt: "2025-01-10T08:00:00",
//   },
//   {
//     id: "o6", tenantId: "ord-002", orderNumber: "BB-202", customerName: "Mike Johnson",
//     customerEmail: "mike@email.com", customerPhone: "(555) 303-4040",
//     items: [{ id: "oi10", productId: "p10", productName: "Custom Birthday Cake", productImage: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=100&q=60", quantity: 1, price: 65.00 }],
//     status: "pending", paymentStatus: "unpaid", totalAmount: 65.00, notes: "Chocolate sponge, vanilla buttercream. Write 'Happy 30th Emma'", createdAt: "2025-01-09T14:00:00",
//   },
// ];

// // ─────────────────────────────────────────────────────────────
// // ANALYTICS
// // ─────────────────────────────────────────────────────────────
// export const mockAnalytics: Record<string, AnalyticsSummary> = {
//   "apt-001": {
//     totalRevenue: 4820, totalActivity: 42, newCustomers: 18, avgOrderValue: 114.76,
//     revenueChange: 12.4, activityChange: 8.2,
//     topItems: [
//       { name: "Balayage & Highlights", count: 14, revenue: 3080 },
//       { name: "Signature Hair Color", count: 12, revenue: 1740 },
//       { name: "Hydrating Facial", count: 9, revenue: 855 },
//       { name: "Luxury Manicure", count: 7, revenue: 385 },
//     ],
//     revenueData: [
//       { date: "Jan 1", revenue: 320, count: 3 }, { date: "Jan 2", revenue: 580, count: 5 },
//       { date: "Jan 3", revenue: 420, count: 4 }, { date: "Jan 4", revenue: 690, count: 6 },
//       { date: "Jan 5", revenue: 510, count: 5 }, { date: "Jan 6", revenue: 740, count: 7 },
//       { date: "Jan 7", revenue: 380, count: 4 }, { date: "Jan 8", revenue: 620, count: 6 },
//       { date: "Jan 9", revenue: 260, count: 2 }, { date: "Jan 10", revenue: 300, count: 0 },
//     ],
//   },
//   "apt-002": {
//     totalRevenue: 2340, totalActivity: 67, newCustomers: 31, avgOrderValue: 34.93,
//     revenueChange: 5.1, activityChange: 12.0,
//     topItems: [
//       { name: "Cut + Beard Combo", count: 28, revenue: 1540 },
//       { name: "Classic Haircut", count: 24, revenue: 840 },
//       { name: "Hot Shave", count: 8, revenue: 320 },
//       { name: "Beard Trim", count: 7, revenue: 175 },
//     ],
//     revenueData: [
//       { date: "Jan 1", revenue: 175, count: 5 }, { date: "Jan 2", revenue: 280, count: 8 },
//       { date: "Jan 3", revenue: 245, count: 7 }, { date: "Jan 4", revenue: 315, count: 9 },
//       { date: "Jan 5", revenue: 260, count: 7 }, { date: "Jan 6", revenue: 350, count: 10 },
//       { date: "Jan 7", revenue: 215, count: 6 }, { date: "Jan 8", revenue: 290, count: 8 },
//       { date: "Jan 9", revenue: 120, count: 4 }, { date: "Jan 10", revenue: 90, count: 3 },
//     ],
//   },
//   "ord-001": {
//     totalRevenue: 12480, totalActivity: 312, newCustomers: 89, avgOrderValue: 40.00,
//     revenueChange: 22.1, activityChange: 15.3,
//     topItems: [
//       { name: "Oak Burger", count: 98, revenue: 1861 },
//       { name: "Wood-Fired Salmon", count: 72, revenue: 1943 },
//       { name: "Ember Chicken Wings", count: 61, revenue: 914 },
//       { name: "Ember Brownie", count: 55, revenue: 549 },
//     ],
//     revenueData: [
//       { date: "Jan 1", revenue: 980, count: 24 }, { date: "Jan 2", revenue: 1240, count: 31 },
//       { date: "Jan 3", revenue: 1100, count: 27 }, { date: "Jan 4", revenue: 1380, count: 34 },
//       { date: "Jan 5", revenue: 1420, count: 36 }, { date: "Jan 6", revenue: 1580, count: 39 },
//       { date: "Jan 7", revenue: 1640, count: 41 }, { date: "Jan 8", revenue: 1320, count: 33 },
//       { date: "Jan 9", revenue: 960, count: 24 }, { date: "Jan 10", revenue: 860, count: 23 },
//     ],
//   },
//   "ord-002": {
//     totalRevenue: 6720, totalActivity: 148, newCustomers: 52, avgOrderValue: 45.41,
//     revenueChange: 18.5, activityChange: 9.8,
//     topItems: [
//       { name: "Custom Birthday Cake", count: 32, revenue: 2080 },
//       { name: "Sourdough Loaf", count: 58, revenue: 696 },
//       { name: "Butter Croissant", count: 112, revenue: 504 },
//       { name: "Seasonal Fruit Tart", count: 44, revenue: 286 },
//     ],
//     revenueData: [
//       { date: "Jan 1", revenue: 480, count: 12 }, { date: "Jan 2", revenue: 720, count: 16 },
//       { date: "Jan 3", revenue: 650, count: 14 }, { date: "Jan 4", revenue: 810, count: 18 },
//       { date: "Jan 5", revenue: 760, count: 17 }, { date: "Jan 6", revenue: 920, count: 20 },
//       { date: "Jan 7", revenue: 680, count: 15 }, { date: "Jan 8", revenue: 740, count: 16 },
//       { date: "Jan 9", revenue: 510, count: 11 }, { date: "Jan 10", revenue: 450, count: 9 },
//     ],
//   },
// };

// // ─────────────────────────────────────────────────────────────
// // HELPERS
// // ─────────────────────────────────────────────────────────────
// export const getServicesByTenant    = (id: string) => mockServices.filter(s => s.tenantId === id);
// export const getProductsByTenant    = (id: string) => mockProducts.filter(p => p.tenantId === id);
// export const getCategoriesByTenant  = (id: string) => mockCategories.filter(c => c.tenantId === id);
// export const getAppointmentsByTenant = (id: string) => mockAppointments.filter(a => a.tenantId === id);
// export const getOrdersByTenant      = (id: string) => mockOrders.filter(o => o.tenantId === id);
// export const getUsersByTenant       = (id: string) => mockUsers.filter(u => u.tenantId === id);
// export const getTenantById          = (id: string) => mockTenants.find(t => t.id === id);
// export const getTenantBySlug        = (slug: string) => mockTenants.find(t => t.slug === slug);



































import type { Tenant, User, Service, Product, Category, Appointment, Order, AnalyticsSummary } from "../types/index";

export const mockTenants: Tenant[] = [
  {
    id: "apt-001", name: "Luxe Beauty Studio", slug: "luxe-beauty", businessType: "appointment",
    logo: "LB", logoBg: "#c084fc",
    description: "Premium hair, nails & skincare services in the heart of the city. Walk-ins welcome, appointments preferred.",
    phone: "(555) 234-5678", email: "hello@luxebeauty.com", address: "142 Bloom Street", city: "Miami, FL",
    coverImage: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80",
    businessHours: [
      { day: "Monday", open: "09:00", close: "18:00", closed: false },
      { day: "Tuesday", open: "09:00", close: "18:00", closed: false },
      { day: "Wednesday", open: "09:00", close: "20:00", closed: false },
      { day: "Thursday", open: "09:00", close: "20:00", closed: false },
      { day: "Friday", open: "09:00", close: "18:00", closed: false },
      { day: "Saturday", open: "10:00", close: "16:00", closed: false },
      { day: "Sunday", open: "", close: "", closed: true },
    ],
    socialLinks: { instagram: "@luxebeautystudio", facebook: "luxebeautystudio" },
    primaryColor: "#c084fc", accentColor: "#f0abfc",
    createdAt: "2024-01-15", isActive: true, plan: "pro", stripeConnected: true,
    subscriptionStatus: "active", monthlyRevenue: 4820,
  },
  {
    id: "apt-002", name: "Iron Edge Barbershop", slug: "iron-edge", businessType: "appointment",
    logo: "IE", logoBg: "#34d399",
    description: "Classic cuts, modern styles. Premium grooming for the modern gentleman.",
    phone: "(555) 876-5432", email: "book@ironedge.com", address: "88 Kings Avenue", city: "Atlanta, GA",
    coverImage: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&q=80",
    businessHours: [
      { day: "Monday", open: "08:00", close: "19:00", closed: false },
      { day: "Tuesday", open: "08:00", close: "19:00", closed: false },
      { day: "Wednesday", open: "08:00", close: "19:00", closed: false },
      { day: "Thursday", open: "08:00", close: "19:00", closed: false },
      { day: "Friday", open: "08:00", close: "19:00", closed: false },
      { day: "Saturday", open: "09:00", close: "17:00", closed: false },
      { day: "Sunday", open: "", close: "", closed: true },
    ],
    socialLinks: { instagram: "@ironedgebarber", twitter: "@ironedgebarber" },
    primaryColor: "#34d399", accentColor: "#6ee7b7",
    createdAt: "2024-02-20", isActive: true, plan: "starter", stripeConnected: true,
    subscriptionStatus: "active", monthlyRevenue: 2340,
  },
  {
    id: "ord-001", name: "Ember & Oak Kitchen", slug: "ember-oak", businessType: "ordering",
    logo: "EO", logoBg: "#fb923c",
    description: "Wood-fired comfort food made fresh daily. Order online for pickup or delivery.",
    phone: "(555) 321-7890", email: "orders@emberoakkitchen.com", address: "500 Flame Road", city: "Austin, TX",
    coverImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
    businessHours: [
      { day: "Monday", open: "11:00", close: "21:00", closed: false },
      { day: "Tuesday", open: "11:00", close: "21:00", closed: false },
      { day: "Wednesday", open: "11:00", close: "21:00", closed: false },
      { day: "Thursday", open: "11:00", close: "22:00", closed: false },
      { day: "Friday", open: "11:00", close: "22:00", closed: false },
      { day: "Saturday", open: "10:00", close: "22:00", closed: false },
      { day: "Sunday", open: "10:00", close: "20:00", closed: false },
    ],
    socialLinks: { instagram: "@emberoakkitchen", facebook: "emberoakkitchen" },
    primaryColor: "#fb923c", accentColor: "#fdba74",
    createdAt: "2024-03-05", isActive: true, plan: "pro", stripeConnected: true,
    subscriptionStatus: "active", monthlyRevenue: 12480,
  },
  {
    id: "ord-002", name: "Blossom Bakehouse", slug: "blossom-bakehouse", businessType: "ordering",
    logo: "BB", logoBg: "#f472b6",
    description: "Artisan pastries, custom cakes, and fresh-baked breads. Pre-order for best selection.",
    phone: "(555) 456-7890", email: "hello@blossombakehouse.com", address: "27 Petal Lane", city: "Portland, OR",
    coverImage: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=1200&q=80",
    businessHours: [
      { day: "Monday", open: "07:00", close: "17:00", closed: false },
      { day: "Tuesday", open: "07:00", close: "17:00", closed: false },
      { day: "Wednesday", open: "07:00", close: "17:00", closed: false },
      { day: "Thursday", open: "07:00", close: "17:00", closed: false },
      { day: "Friday", open: "07:00", close: "18:00", closed: false },
      { day: "Saturday", open: "08:00", close: "16:00", closed: false },
      { day: "Sunday", open: "", close: "", closed: true },
    ],
    socialLinks: { instagram: "@blossombakehouse", facebook: "blossombakehouse" },
    primaryColor: "#f472b6", accentColor: "#f9a8d4",
    createdAt: "2024-04-12", isActive: true, plan: "pro", stripeConnected: false,
    subscriptionStatus: "trial", trialEndsAt: "2025-02-12", monthlyRevenue: 6720,
  },
];

export const mockUsers: User[] = [
  { id: "sa1", tenantId: null, name: "Alex Rivera", email: "admin@localspace.io", role: "superadmin", avatar: "AR", createdAt: "2024-01-01", lastLogin: "2025-01-10" },
  { id: "u1", tenantId: "apt-001", name: "Serena Williams", email: "serena@luxebeauty.com", role: "owner", avatar: "SW", createdAt: "2024-01-15", lastLogin: "2025-01-10" },
  { id: "u2", tenantId: "apt-001", name: "Maya Johnson", email: "maya@luxebeauty.com", role: "admin", avatar: "MJ", createdAt: "2024-01-20", lastLogin: "2025-01-09" },
  { id: "u3", tenantId: "apt-001", name: "Zoe Chen", email: "zoe@luxebeauty.com", role: "staff", avatar: "ZC", createdAt: "2024-02-01", lastLogin: "2025-01-08" },
  { id: "u4", tenantId: "apt-002", name: "Marcus Thompson", email: "marcus@ironedge.com", role: "owner", avatar: "MT", createdAt: "2024-02-20", lastLogin: "2025-01-10" },
  { id: "u5", tenantId: "apt-002", name: "Derek Smith", email: "derek@ironedge.com", role: "admin", avatar: "DS", createdAt: "2024-03-01", lastLogin: "2025-01-07" },
  { id: "u6", tenantId: "ord-001", name: "Isabella Garcia", email: "isabella@emberoakkitchen.com", role: "owner", avatar: "IG", createdAt: "2024-03-05", lastLogin: "2025-01-10" },
  { id: "u7", tenantId: "ord-001", name: "Carlos Rivera", email: "carlos@emberoakkitchen.com", role: "admin", avatar: "CR", createdAt: "2024-03-10", lastLogin: "2025-01-10" },
  { id: "u8", tenantId: "ord-002", name: "Lily Parker", email: "lily@blossombakehouse.com", role: "owner", avatar: "LP", createdAt: "2024-04-12", lastLogin: "2025-01-09" },
  { id: "u9", tenantId: "ord-002", name: "Sam Reed", email: "sam@blossombakehouse.com", role: "admin", avatar: "SR", createdAt: "2024-04-20", lastLogin: "2025-01-08" },
];

export const demoAccounts = [
  { label: "Super Admin", email: "admin@localspace.io", password: "admin123", role: "superadmin" as const, tenantId: null },
  { label: "Luxe Beauty Studio", email: "serena@luxebeauty.com", password: "password123", role: "owner" as const, tenantId: "apt-001" },
  { label: "Iron Edge Barbershop", email: "marcus@ironedge.com", password: "password123", role: "owner" as const, tenantId: "apt-002" },
  { label: "Ember & Oak Kitchen", email: "isabella@emberoakkitchen.com", password: "password123", role: "owner" as const, tenantId: "ord-001" },
  { label: "Blossom Bakehouse", email: "lily@blossombakehouse.com", password: "password123", role: "owner" as const, tenantId: "ord-002" },
];

export const mockServices: Service[] = [
  { id: "s1", tenantId: "apt-001", name: "Signature Hair Color", description: "Full color with premium products, toning & style finish.", duration: 120, price: 145, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=70", category: "Hair", isActive: true, requiresDeposit: true, depositAmount: 30, depositType: "fixed", createdAt: "2024-01-15" },
  { id: "s2", tenantId: "apt-001", name: "Balayage & Highlights", description: "Hand-painted balayage for a natural sun-kissed look.", duration: 180, price: 220, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=70", category: "Hair", isActive: true, requiresDeposit: true, depositAmount: 50, depositType: "fixed", createdAt: "2024-01-15" },
  { id: "s3", tenantId: "apt-001", name: "Luxury Manicure", description: "Gel polish, cuticle care, hand massage & nail art.", duration: 60, price: 55, image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=70", category: "Nails", isActive: true, requiresDeposit: false, createdAt: "2024-01-16" },
  { id: "s4", tenantId: "apt-001", name: "Hydrating Facial", description: "Deep cleanse, exfoliation, mask & serum treatment.", duration: 75, price: 95, image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=70", category: "Skincare", isActive: true, requiresDeposit: false, createdAt: "2024-01-17" },
  { id: "s5", tenantId: "apt-001", name: "Haircut & Style", description: "Precision cut, blow dry & styling finish.", duration: 60, price: 75, image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&q=70", category: "Hair", isActive: false, requiresDeposit: false, createdAt: "2024-01-18" },
  { id: "s6", tenantId: "apt-002", name: "Classic Haircut", description: "Scissor or clipper cut, hot towel & style.", duration: 45, price: 35, image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&q=70", category: "Cuts", isActive: true, requiresDeposit: false, createdAt: "2024-02-20" },
  { id: "s7", tenantId: "apt-002", name: "Beard Trim & Shape", description: "Full beard shaping, trimming & hot towel finish.", duration: 30, price: 25, image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&q=70", category: "Beard", isActive: true, requiresDeposit: false, createdAt: "2024-02-21" },
  { id: "s8", tenantId: "apt-002", name: "Cut + Beard Combo", description: "Full haircut and beard grooming package.", duration: 60, price: 55, image: "https://images.unsplash.com/photo-1559479946-3fd82b9d8a35?w=400&q=70", category: "Packages", isActive: true, requiresDeposit: false, createdAt: "2024-02-22" },
  { id: "s9", tenantId: "apt-002", name: "Hot Shave", description: "Traditional straight razor shave with hot towel.", duration: 30, price: 40, image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&q=70", category: "Shave", isActive: true, requiresDeposit: false, createdAt: "2024-02-23" },
];

export const mockCategories: Category[] = [
  { id: "c1", tenantId: "ord-001", name: "Starters", sortOrder: 1 },
  { id: "c2", tenantId: "ord-001", name: "Mains", sortOrder: 2 },
  { id: "c3", tenantId: "ord-001", name: "Sides", sortOrder: 3 },
  { id: "c4", tenantId: "ord-001", name: "Drinks", sortOrder: 4 },
  { id: "c5", tenantId: "ord-001", name: "Desserts", sortOrder: 5 },
  { id: "c6", tenantId: "ord-002", name: "Breads", sortOrder: 1 },
  { id: "c7", tenantId: "ord-002", name: "Pastries", sortOrder: 2 },
  { id: "c8", tenantId: "ord-002", name: "Cakes", sortOrder: 3 },
  { id: "c9", tenantId: "ord-002", name: "Beverages", sortOrder: 4 },
];

export const mockProducts: Product[] = [
  { id: "p1", tenantId: "ord-001", name: "Ember Chicken Wings", description: "Wood-smoked wings with house dry rub and dipping sauce.", price: 14.99, image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&q=70", categoryId: "c1", categoryName: "Starters", isActive: true, inventory: 50, tags: ["popular", "spicy"], createdAt: "2024-03-05" },
  { id: "p2", tenantId: "ord-001", name: "Oak Burger", description: "8oz smashed patty, aged cheddar, caramelized onions, brioche bun.", price: 18.99, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=70", categoryId: "c2", categoryName: "Mains", isActive: true, inventory: 30, tags: ["bestseller"], createdAt: "2024-03-05" },
  { id: "p3", tenantId: "ord-001", name: "Wood-Fired Salmon", description: "Cedar plank salmon, lemon herb butter, seasonal veggies.", price: 26.99, image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=70", categoryId: "c2", categoryName: "Mains", isActive: true, inventory: 20, tags: ["healthy"], createdAt: "2024-03-06" },
  { id: "p4", tenantId: "ord-001", name: "Truffle Mac & Cheese", description: "Creamy three-cheese sauce, truffle oil, crispy breadcrumbs.", price: 11.99, image: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400&q=70", categoryId: "c3", categoryName: "Sides", isActive: true, inventory: 40, tags: ["vegetarian"], createdAt: "2024-03-06" },
  { id: "p5", tenantId: "ord-001", name: "Craft Lemonade", description: "House-made lemonade with fresh mint and lavender.", price: 5.99, image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&q=70", categoryId: "c4", categoryName: "Drinks", isActive: true, inventory: 100, tags: [], createdAt: "2024-03-07" },
  { id: "p6", tenantId: "ord-001", name: "Ember Brownie", description: "Warm chocolate brownie, vanilla bean ice cream, caramel.", price: 9.99, image: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&q=70", categoryId: "c5", categoryName: "Desserts", isActive: true, inventory: 25, tags: ["popular"], createdAt: "2024-03-08" },
  { id: "p7", tenantId: "ord-002", name: "Sourdough Loaf", description: "48-hour fermented sourdough with a crispy crust.", price: 12.00, image: "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=400&q=70", categoryId: "c6", categoryName: "Breads", isActive: true, inventory: 15, tags: ["bestseller"], createdAt: "2024-04-12" },
  { id: "p8", tenantId: "ord-002", name: "Butter Croissant", description: "Flaky, buttery croissant baked fresh every morning.", price: 4.50, image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=70", categoryId: "c7", categoryName: "Pastries", isActive: true, inventory: 30, tags: ["popular"], createdAt: "2024-04-12" },
  { id: "p9", tenantId: "ord-002", name: "Seasonal Fruit Tart", description: "Almond cream, fresh seasonal berries, vanilla glaze.", price: 6.50, image: "https://images.unsplash.com/photo-1484308788776-90d7db1e6e22?w=400&q=70", categoryId: "c7", categoryName: "Pastries", isActive: true, inventory: 20, tags: ["seasonal"], createdAt: "2024-04-13" },
  { id: "p10", tenantId: "ord-002", name: "Custom Birthday Cake", description: "Made to order — choose flavor, filling & design. 48hr notice.", price: 65.00, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=70", categoryId: "c8", categoryName: "Cakes", isActive: true, inventory: 5, tags: ["custom", "preorder"], createdAt: "2024-04-14" },
  { id: "p11", tenantId: "ord-002", name: "Lavender Latte", description: "Oat milk latte with house-made lavender syrup.", price: 6.00, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=70", categoryId: "c9", categoryName: "Beverages", isActive: true, inventory: 100, tags: [], createdAt: "2024-04-15" },
];

export const mockAppointments: Appointment[] = [
  { id: "a1", tenantId: "apt-001", serviceId: "s1", serviceName: "Signature Hair Color", servicePrice: 145, customerName: "Alicia Banks", customerEmail: "alicia@email.com", customerPhone: "(555) 111-2222", date: "2025-01-13", time: "10:00", duration: 120, status: "confirmed", paymentStatus: "partial", depositPaid: 30, notes: "Prefers cooler tones", createdAt: "2025-01-05" },
  { id: "a2", tenantId: "apt-001", serviceId: "s2", serviceName: "Balayage & Highlights", servicePrice: 220, customerName: "Jennifer Torres", customerEmail: "j.torres@email.com", customerPhone: "(555) 333-4444", date: "2025-01-13", time: "13:00", duration: 180, status: "confirmed", paymentStatus: "partial", depositPaid: 50, createdAt: "2025-01-06" },
  { id: "a3", tenantId: "apt-001", serviceId: "s3", serviceName: "Luxury Manicure", servicePrice: 55, customerName: "Sandra Kim", customerEmail: "sandra@email.com", customerPhone: "(555) 555-6666", date: "2025-01-14", time: "11:00", duration: 60, status: "pending", paymentStatus: "unpaid", createdAt: "2025-01-08" },
  { id: "a4", tenantId: "apt-001", serviceId: "s4", serviceName: "Hydrating Facial", servicePrice: 95, customerName: "Rachel Green", customerEmail: "rachel@email.com", customerPhone: "(555) 777-8888", date: "2025-01-14", time: "14:00", duration: 75, status: "confirmed", paymentStatus: "paid", createdAt: "2025-01-07" },
  { id: "a5", tenantId: "apt-001", serviceId: "s1", serviceName: "Signature Hair Color", servicePrice: 145, customerName: "Monica Patel", customerEmail: "monica@email.com", customerPhone: "(555) 999-0000", date: "2025-01-10", time: "09:00", duration: 120, status: "completed", paymentStatus: "paid", depositPaid: 30, createdAt: "2025-01-02" },
  { id: "a6", tenantId: "apt-001", serviceId: "s3", serviceName: "Luxury Manicure", servicePrice: 55, customerName: "Diana Prince", customerEmail: "diana@email.com", customerPhone: "(555) 123-9999", date: "2025-01-15", time: "10:30", duration: 60, status: "pending", paymentStatus: "unpaid", createdAt: "2025-01-09" },
  { id: "a7", tenantId: "apt-002", serviceId: "s6", serviceName: "Classic Haircut", servicePrice: 35, customerName: "James Wilson", customerEmail: "james@email.com", customerPhone: "(555) 221-3300", date: "2025-01-13", time: "09:00", duration: 45, status: "confirmed", paymentStatus: "paid", createdAt: "2025-01-10" },
  { id: "a8", tenantId: "apt-002", serviceId: "s8", serviceName: "Cut + Beard Combo", servicePrice: 55, customerName: "Marcus Lee", customerEmail: "mlee@email.com", customerPhone: "(555) 440-5500", date: "2025-01-13", time: "11:00", duration: 60, status: "pending", paymentStatus: "unpaid", createdAt: "2025-01-11" },
  { id: "a9", tenantId: "apt-002", serviceId: "s7", serviceName: "Beard Trim & Shape", servicePrice: 25, customerName: "Tyler Brooks", customerEmail: "tyler@email.com", customerPhone: "(555) 660-7700", date: "2025-01-14", time: "14:00", duration: 30, status: "confirmed", paymentStatus: "paid", createdAt: "2025-01-09" },
];

export const mockOrders: Order[] = [
  { id: "o1", tenantId: "ord-001", orderNumber: "EO-1001", customerName: "James Wilson", customerEmail: "james@email.com", customerPhone: "(555) 222-3333", items: [{ id: "oi1", productId: "p2", productName: "Oak Burger", productImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&q=60", quantity: 2, price: 18.99 }, { id: "oi2", productId: "p4", productName: "Truffle Mac & Cheese", productImage: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=100&q=60", quantity: 1, price: 11.99 }], status: "preparing", paymentStatus: "paid", totalAmount: 49.97, pickupTime: "12:30", createdAt: "2025-01-10T11:45:00" },
  { id: "o2", tenantId: "ord-001", orderNumber: "EO-1002", customerName: "Priya Shah", customerEmail: "priya@email.com", customerPhone: "(555) 444-5555", items: [{ id: "oi3", productId: "p3", productName: "Wood-Fired Salmon", productImage: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=100&q=60", quantity: 1, price: 26.99 }, { id: "oi4", productId: "p5", productName: "Craft Lemonade", productImage: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=100&q=60", quantity: 2, price: 5.99 }], status: "confirmed", paymentStatus: "paid", totalAmount: 38.97, createdAt: "2025-01-10T12:15:00" },
  { id: "o3", tenantId: "ord-001", orderNumber: "EO-1003", customerName: "Tom Bradley", customerEmail: "tom@email.com", customerPhone: "(555) 666-7777", items: [{ id: "oi5", productId: "p1", productName: "Ember Chicken Wings", productImage: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=100&q=60", quantity: 2, price: 14.99 }, { id: "oi6", productId: "p6", productName: "Ember Brownie", productImage: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=100&q=60", quantity: 1, price: 9.99 }], status: "pending", paymentStatus: "paid", totalAmount: 39.97, createdAt: "2025-01-10T13:00:00" },
  { id: "o4", tenantId: "ord-001", orderNumber: "EO-1000", customerName: "Emily Chen", customerEmail: "emily@email.com", customerPhone: "(555) 888-9999", items: [{ id: "oi7", productId: "p2", productName: "Oak Burger", productImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&q=60", quantity: 1, price: 18.99 }], status: "delivered", paymentStatus: "paid", totalAmount: 18.99, createdAt: "2025-01-09T18:30:00" },
  { id: "o5", tenantId: "ord-002", orderNumber: "BB-201", customerName: "Sarah Davis", customerEmail: "sarah@email.com", customerPhone: "(555) 101-2020", items: [{ id: "oi8", productId: "p7", productName: "Sourdough Loaf", productImage: "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=100&q=60", quantity: 2, price: 12.00 }, { id: "oi9", productId: "p8", productName: "Butter Croissant", productImage: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=100&q=60", quantity: 3, price: 4.50 }], status: "confirmed", paymentStatus: "paid", totalAmount: 37.50, createdAt: "2025-01-10T08:00:00" },
  { id: "o6", tenantId: "ord-002", orderNumber: "BB-202", customerName: "Mike Johnson", customerEmail: "mike@email.com", customerPhone: "(555) 303-4040", items: [{ id: "oi10", productId: "p10", productName: "Custom Birthday Cake", productImage: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=100&q=60", quantity: 1, price: 65.00 }], status: "pending", paymentStatus: "unpaid", totalAmount: 65.00, notes: "Chocolate sponge, vanilla buttercream. Write 'Happy 30th Emma'", createdAt: "2025-01-09T14:00:00" },
];

export const mockAnalytics: Record<string, AnalyticsSummary> = {
  "apt-001": { totalRevenue: 4820, totalActivity: 42, newCustomers: 18, avgOrderValue: 114.76, revenueChange: 12.4, activityChange: 8.2, topItems: [{ name: "Balayage & Highlights", count: 14, revenue: 3080 }, { name: "Signature Hair Color", count: 12, revenue: 1740 }, { name: "Hydrating Facial", count: 9, revenue: 855 }, { name: "Luxury Manicure", count: 7, revenue: 385 }], revenueData: [{ date: "Jan 1", revenue: 320, count: 3 }, { date: "Jan 2", revenue: 580, count: 5 }, { date: "Jan 3", revenue: 420, count: 4 }, { date: "Jan 4", revenue: 690, count: 6 }, { date: "Jan 5", revenue: 510, count: 5 }, { date: "Jan 6", revenue: 740, count: 7 }, { date: "Jan 7", revenue: 380, count: 4 }, { date: "Jan 8", revenue: 620, count: 6 }, { date: "Jan 9", revenue: 260, count: 2 }, { date: "Jan 10", revenue: 300, count: 0 }] },
  "apt-002": { totalRevenue: 2340, totalActivity: 67, newCustomers: 31, avgOrderValue: 34.93, revenueChange: 5.1, activityChange: 12.0, topItems: [{ name: "Cut + Beard Combo", count: 28, revenue: 1540 }, { name: "Classic Haircut", count: 24, revenue: 840 }, { name: "Hot Shave", count: 8, revenue: 320 }, { name: "Beard Trim", count: 7, revenue: 175 }], revenueData: [{ date: "Jan 1", revenue: 175, count: 5 }, { date: "Jan 2", revenue: 280, count: 8 }, { date: "Jan 3", revenue: 245, count: 7 }, { date: "Jan 4", revenue: 315, count: 9 }, { date: "Jan 5", revenue: 260, count: 7 }, { date: "Jan 6", revenue: 350, count: 10 }, { date: "Jan 7", revenue: 215, count: 6 }, { date: "Jan 8", revenue: 290, count: 8 }, { date: "Jan 9", revenue: 120, count: 4 }, { date: "Jan 10", revenue: 90, count: 3 }] },
  "ord-001": { totalRevenue: 12480, totalActivity: 312, newCustomers: 89, avgOrderValue: 40.00, revenueChange: 22.1, activityChange: 15.3, topItems: [{ name: "Oak Burger", count: 98, revenue: 1861 }, { name: "Wood-Fired Salmon", count: 72, revenue: 1943 }, { name: "Ember Chicken Wings", count: 61, revenue: 914 }, { name: "Ember Brownie", count: 55, revenue: 549 }], revenueData: [{ date: "Jan 1", revenue: 980, count: 24 }, { date: "Jan 2", revenue: 1240, count: 31 }, { date: "Jan 3", revenue: 1100, count: 27 }, { date: "Jan 4", revenue: 1380, count: 34 }, { date: "Jan 5", revenue: 1420, count: 36 }, { date: "Jan 6", revenue: 1580, count: 39 }, { date: "Jan 7", revenue: 1640, count: 41 }, { date: "Jan 8", revenue: 1320, count: 33 }, { date: "Jan 9", revenue: 960, count: 24 }, { date: "Jan 10", revenue: 860, count: 23 }] },
  "ord-002": { totalRevenue: 6720, totalActivity: 148, newCustomers: 52, avgOrderValue: 45.41, revenueChange: 18.5, activityChange: 9.8, topItems: [{ name: "Custom Birthday Cake", count: 32, revenue: 2080 }, { name: "Sourdough Loaf", count: 58, revenue: 696 }, { name: "Butter Croissant", count: 112, revenue: 504 }, { name: "Seasonal Fruit Tart", count: 44, revenue: 286 }], revenueData: [{ date: "Jan 1", revenue: 480, count: 12 }, { date: "Jan 2", revenue: 720, count: 16 }, { date: "Jan 3", revenue: 650, count: 14 }, { date: "Jan 4", revenue: 810, count: 18 }, { date: "Jan 5", revenue: 760, count: 17 }, { date: "Jan 6", revenue: 920, count: 20 }, { date: "Jan 7", revenue: 680, count: 15 }, { date: "Jan 8", revenue: 740, count: 16 }, { date: "Jan 9", revenue: 510, count: 11 }, { date: "Jan 10", revenue: 450, count: 9 }] },
};

export const getServicesByTenant = (id: string) => mockServices.filter(s => s.tenantId === id);
export const getProductsByTenant = (id: string) => mockProducts.filter(p => p.tenantId === id);
export const getCategoriesByTenant = (id: string) => mockCategories.filter(c => c.tenantId === id);
export const getAppointmentsByTenant = (id: string) => mockAppointments.filter(a => a.tenantId === id);
export const getOrdersByTenant = (id: string) => mockOrders.filter(o => o.tenantId === id);
export const getUsersByTenant = (id: string) => mockUsers.filter(u => u.tenantId === id);
export const getTenantById = (id: string) => mockTenants.find(t => t.id === id);
export const getTenantBySlug = (slug: string) => mockTenants.find(t => t.slug === slug);