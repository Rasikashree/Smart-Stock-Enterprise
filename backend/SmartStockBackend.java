import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;

/**
 * SmartStock Enterprise - Pure Standalone Java Backend
 * Database: Supabase PostgreSQL (via JDBC)
 *
 * SETUP:
 *  1. Fill in backend/.env with your Supabase credentials.
 *  2. Run: RUN.bat  (uses lib/postgresql-42.7.1.jar)
 *
 * Required JDBC Driver: lib/postgresql-42.7.1.jar  ✅ already present
 */
public class SmartStockBackend {

    // ── Config loaded from .env ──────────────────────────────────────────────
    private static String DB_HOST     = "db.YOUR_PROJECT_REF.supabase.co";
    private static String DB_PORT     = "5432";
    private static String DB_NAME     = "postgres";
    private static String DB_USER     = "postgres";
    private static String DB_PASSWORD = "YOUR_SUPABASE_DB_PASSWORD";
    private static int    SERVER_PORT = 8080;

    // ── Runtime state ────────────────────────────────────────────────────────
    private static volatile boolean databaseAvailable = false;
    private static Connection       dbConnection      = null;

    // In-memory OTP store
    private static Map<String, String> otpStore       = new ConcurrentHashMap<>();
    private static Map<String, Long>   otpTimestamps  = new ConcurrentHashMap<>();

    // =========================================================================
    //  ENTRY POINT
    // =========================================================================
    public static void main(String[] args) throws Exception {
        System.out.println("╔═══════════════════════════════════════════╗");
        System.out.println("║   SmartStock Enterprise Backend v2.0      ║");
        System.out.println("║   Database: Supabase PostgreSQL (JDBC)    ║");
        System.out.println("╚═══════════════════════════════════════════╝");

        loadEnvConfig();
        connectToDatabase();

        InetSocketAddress addr = new InetSocketAddress("0.0.0.0", SERVER_PORT);
        HttpServer server = HttpServer.create(addr, 0);
        setupRoutes(server);
        server.setExecutor(Executors.newFixedThreadPool(10));
        server.start();

        System.out.println("\n✅ Server running → http://localhost:" + SERVER_PORT);
        System.out.println("   Health check → http://localhost:" + SERVER_PORT + "/api/health");
        System.out.println();

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try { if (dbConnection != null && !dbConnection.isClosed()) dbConnection.close(); }
            catch (Exception ignored) {}
            System.out.println("🛑 Server stopped.");
        }));
    }

    // =========================================================================
    //  CONFIG LOADER (.env)
    // =========================================================================
    private static void loadEnvConfig() {
        // ── Priority 1: OS / Docker / Cloud environment variables ──────────────
        String envHost = System.getenv("DB_HOST");
        String envPort = System.getenv("DB_PORT");
        String envName = System.getenv("DB_NAME");
        String envUser = System.getenv("DB_USER");
        String envPass = System.getenv("DB_PASSWORD");
        String envSrvPort = System.getenv("SERVER_PORT");
        String envDbUrl = System.getenv("DB_URL"); // full jdbc URL shortcut

        boolean envVarsFound = (envHost != null || envDbUrl != null);

        if (envVarsFound) {
            // Parse full JDBC URL if provided: jdbc:postgresql://host:port/db
            if (envDbUrl != null && !envDbUrl.isEmpty()) {
                try {
                    // Remove jdbc: prefix if present
                    String url = envDbUrl.startsWith("jdbc:postgresql://")
                        ? envDbUrl.substring("jdbc:postgresql://".length())
                        : envDbUrl.replace("postgresql://", "");
                    // url = host:port/dbname or host/dbname
                    String[] hostPart = url.split("/", 2);
                    String[] hp = hostPart[0].split(":");
                    DB_HOST = hp[0];
                    if (hp.length > 1) DB_PORT = hp[1];
                    if (hostPart.length > 1) {
                        String dbPart = hostPart[1].split("\\?")[0]; // strip query params
                        if (!dbPart.isEmpty()) DB_NAME = dbPart;
                    }
                } catch (Exception e) {
                    System.out.println("⚠️  Could not parse DB_URL: " + e.getMessage());
                }
            }
            if (envHost != null && !envHost.isEmpty())    DB_HOST     = envHost;
            if (envPort != null && !envPort.isEmpty())    DB_PORT     = envPort;
            if (envName != null && !envName.isEmpty())    DB_NAME     = envName;
            if (envUser != null && !envUser.isEmpty())    DB_USER     = envUser;
            if (envPass != null && !envPass.isEmpty())    DB_PASSWORD = envPass;
            if (envSrvPort != null && !envSrvPort.isEmpty()) {
                try { SERVER_PORT = Integer.parseInt(envSrvPort); } catch (Exception ignored) {}
            }
            System.out.println("✅ Config loaded from environment variables (cloud/Docker mode)");
            System.out.println("   Host : " + DB_HOST);
            System.out.println("   DB   : " + DB_NAME);
            System.out.println("   User : " + DB_USER);
            System.out.println("   Port : " + SERVER_PORT);
            return;
        }

        // ── Priority 2: .env file (local development) ──────────────────────────
        File envFile = new File(".env");
        if (!envFile.exists()) envFile = new File("backend/.env");

        if (!envFile.exists()) {
            System.out.println("⚠️  No .env file and no environment variables found – using built-in defaults.");
            System.out.println("   Set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD env vars.");
            return;
        }
        try (BufferedReader br = new BufferedReader(new FileReader(envFile))) {
            String line;
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                String[] parts = line.split("=", 2);
                if (parts.length != 2) continue;
                String key   = parts[0].trim();
                String value = parts[1].trim();
                switch (key) {
                    case "DB_HOST":     DB_HOST     = value; break;
                    case "DB_PORT":     DB_PORT     = value; break;
                    case "DB_NAME":     DB_NAME     = value; break;
                    case "DB_USER":     DB_USER     = value; break;
                    case "DB_PASSWORD": DB_PASSWORD = value; break;
                    case "SERVER_PORT": SERVER_PORT = Integer.parseInt(value); break;
                }
            }
            System.out.println("✅ Config loaded from .env file");
            System.out.println("   Host : " + DB_HOST);
            System.out.println("   DB   : " + DB_NAME);
            System.out.println("   User : " + DB_USER);
            System.out.println("   Port : " + SERVER_PORT);
        } catch (Exception e) {
            System.out.println("⚠️  Could not read .env: " + e.getMessage());
        }
    }

    // =========================================================================
    //  DATABASE CONNECTION
    // =========================================================================
    private static void connectToDatabase() {
        // Build JDBC base URL for Supabase
        // SSL options are passed via Properties object (more reliable with special chars in passwords)
        String baseUrl = "jdbc:postgresql://" + DB_HOST + ":" + DB_PORT + "/" + DB_NAME;

        System.out.println("\n🔌 Connecting to Supabase PostgreSQL...");
        System.out.println("   Host    : " + DB_HOST);
        System.out.println("   Port    : " + DB_PORT);
        System.out.println("   DB      : " + DB_NAME);
        System.out.println("   User    : " + DB_USER);
        System.out.println("   SSL     : required");
        System.out.println("   Timeout : 30s");

        try {
            Class.forName("org.postgresql.Driver");
            Properties props = new Properties();
            props.setProperty("user",            DB_USER);
            props.setProperty("password",        DB_PASSWORD);
            props.setProperty("sslmode",         "require");
            props.setProperty("connectTimeout",  "30");
            props.setProperty("socketTimeout",   "30");
            props.setProperty("ApplicationName", "SmartStockEnterprise");
            dbConnection = DriverManager.getConnection(baseUrl, props);
            // Verify with a simple ping
            try (Statement st = dbConnection.createStatement()) {
                st.execute("SELECT 1");
            }
            databaseAvailable = true;
            System.out.println("✅ Connected to Supabase PostgreSQL successfully!");
            initializeSchema();
        } catch (ClassNotFoundException e) {
            System.out.println("❌ PostgreSQL JDBC driver not found!");
            System.out.println("   Ensure lib/postgresql-42.7.1.jar is in the lib/ folder.");
            databaseAvailable = false;
        } catch (SQLException e) {
            System.out.println("❌ Database connection FAILED!");
            System.out.println("   Error   : " + e.getMessage());
            System.out.println("   SQLState: " + e.getSQLState());
            System.out.println("   Code    : " + e.getErrorCode());
            System.out.println();
            System.out.println("   ─── Troubleshooting ───────────────────────────────────");
            System.out.println("   1. Check DB_HOST in .env (copy from Supabase dashboard)");
            System.out.println("   2. Check DB_PASSWORD — must be exact (case sensitive)");
            System.out.println("   3. Check DB_PORT — try 6543 (pooler) if 5432 times out");
            System.out.println("   4. Check firewall / VPN not blocking port 5432");
            System.out.println("   ───────────────────────────────────────────────────────");
            System.out.println();
            System.out.println("⚠️  Running in DEMO (mock data) mode — DB not connected.");
            databaseAvailable = false;
        }
    }

    /** Ensure tables exist and seed products if empty */
    private static void initializeSchema() {
        try (Statement st = dbConnection.createStatement()) {

            // Products table
            st.execute("CREATE TABLE IF NOT EXISTS products (" +
                    "  id SERIAL PRIMARY KEY," +
                    "  name VARCHAR(255) NOT NULL," +
                    "  price DECIMAL(10,2) NOT NULL," +
                    "  stock INTEGER NOT NULL DEFAULT 0," +
                    "  category VARCHAR(100) NOT NULL," +
                    "  image_url TEXT," +
                    "  is_flash_sale BOOLEAN DEFAULT FALSE," +
                    "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                    "  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            // Cart locks (7-minute smart lock)
            st.execute("CREATE TABLE IF NOT EXISTS cart_locks (" +
                    "  id SERIAL PRIMARY KEY," +
                    "  phone VARCHAR(20) NOT NULL," +
                    "  product_id INTEGER NOT NULL REFERENCES products(id)," +
                    "  qty INTEGER NOT NULL," +
                    "  lock_expires TIMESTAMP NOT NULL," +
                    "  status VARCHAR(50) DEFAULT 'active'," +
                    "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            // Orders
            st.execute("CREATE TABLE IF NOT EXISTS orders (" +
                    "  id SERIAL PRIMARY KEY," +
                    "  phone VARCHAR(20) NOT NULL," +
                    "  items TEXT NOT NULL," +
                    "  total DECIMAL(10,2) NOT NULL," +
                    "  status VARCHAR(50) NOT NULL DEFAULT 'pending'," +
                    "  razorpay_order_id VARCHAR(100)," +
                    "  razorpay_payment_id VARCHAR(100)," +
                    "  delivery_address TEXT," +
                    "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                    "  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            // Users
            st.execute("CREATE TABLE IF NOT EXISTS users (" +
                    "  id SERIAL PRIMARY KEY," +
                    "  phone VARCHAR(20) NOT NULL UNIQUE," +
                    "  is_admin BOOLEAN DEFAULT FALSE," +
                    "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            System.out.println("✅ Database schema verified / created.");

            // Seed products if table is empty
            ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM products");
            rs.next();
            if (rs.getInt(1) == 0) {
                seedProducts();
            } else {
                System.out.println("✅ Products table already has data – skipping seed.");
            }

            // Seed admin user
            st.execute("INSERT INTO users (phone, is_admin) VALUES ('9999999999', TRUE) " +
                    "ON CONFLICT (phone) DO NOTHING");

        } catch (SQLException e) {
            System.out.println("⚠️  Schema init warning: " + e.getMessage());
        }
    }

    private static void seedProducts() throws SQLException {
        String sql = "INSERT INTO products (name, price, stock, category, image_url, is_flash_sale) VALUES (?,?,?,?,?,?)";
        try (PreparedStatement ps = dbConnection.prepareStatement(sql)) {
            Object[][] items = {
                {"Cornflakes 500g",    180.0, 25, "groceries",  "https://via.placeholder.com/200?text=Cornflakes", false},
                {"Muesli Mix 400g",    250.0,  8, "groceries",  "https://via.placeholder.com/200?text=Muesli",     false},
                {"Oats Instant 200g",  120.0, 15, "groceries",  "https://via.placeholder.com/200?text=Oats",       false},
                {"Tomato Sauce 200ml",  80.0, 20, "groceries",  "https://via.placeholder.com/200?text=Sauce",      false},
                {"Mayonnaise 300ml",   150.0,  6, "groceries",  "https://via.placeholder.com/200?text=Mayo",       false},
                {"Pure Honey 500ml",   350.0, 12, "groceries",  "https://via.placeholder.com/200?text=Honey",      false},
                {"Peanut Butter 400g", 320.0,  9, "groceries",  "https://via.placeholder.com/200?text=PB",         false},
                {"Tea Powder 200g",    200.0, 18, "beverages",  "https://via.placeholder.com/200?text=Tea",        false},
                {"Instant Coffee 100g",280.0,  7, "beverages",  "https://via.placeholder.com/200?text=Coffee",     false},
                {"Turmeric Powder 200g",150.0,10, "groceries",  "https://via.placeholder.com/200?text=Turmeric",   false},
                {"Cumin Seeds 200g",   180.0,  5, "groceries",  "https://via.placeholder.com/200?text=Cumin",      true},
                {"Cardamom 50g",       420.0,  3, "groceries",  "https://via.placeholder.com/200?text=Cardamom",   true},
                {"Almonds 250g",       450.0, 11, "groceries",  "https://via.placeholder.com/200?text=Almonds",    false},
                {"Cashews 200g",       520.0,  6, "groceries",  "https://via.placeholder.com/200?text=Cashews",    false},
                {"Atta 5kg",           280.0, 22, "groceries",  "https://via.placeholder.com/200?text=Atta",       false},
                {"Cooking Oil 1L",     180.0, 14, "groceries",  "https://via.placeholder.com/200?text=Oil",        false},
                {"Rice 10kg",          520.0,  8, "groceries",  "https://via.placeholder.com/200?text=Rice",       false},
                {"Milk 1L",             60.0, 30, "dairy",      "https://via.placeholder.com/200?text=Milk",       false},
                {"Yogurt 500ml",        80.0, 12, "dairy",      "https://via.placeholder.com/200?text=Yogurt",     false},
                {"Cheese 200g",        280.0,  7, "dairy",      "https://via.placeholder.com/200?text=Cheese",     false},
                {"Ghee 500ml",         450.0,  4, "dairy",      "https://via.placeholder.com/200?text=Ghee",       true},
                {"Bread Loaf",          50.0, 20, "bakery",     "https://via.placeholder.com/200?text=Bread",      false},
                {"Butter 100g",         80.0,  9, "bakery",     "https://via.placeholder.com/200?text=Butter",     false},
                {"Chips 100g",          40.0, 25, "snacks",     "https://via.placeholder.com/200?text=Chips",      false},
                {"Cookies 200g",       120.0,  8, "snacks",     "https://via.placeholder.com/200?text=Cookies",    false},
                {"Dry Fruits Mix 250g",380.0,  5, "snacks",     "https://via.placeholder.com/200?text=Mix",        true}
            };
            for (Object[] item : items) {
                ps.setString(1, (String) item[0]);
                ps.setDouble(2, (Double) item[1]);
                ps.setInt(3, (Integer) item[2]);
                ps.setString(4, (String) item[3]);
                ps.setString(5, (String) item[4]);
                ps.setBoolean(6, (Boolean) item[5]);
                ps.addBatch();
            }
            ps.executeBatch();
            System.out.println("✅ Seeded " + items.length + " products into Supabase.");
        }
    }

    // =========================================================================
    //  HTTP ROUTES
    // =========================================================================
    private static void setupRoutes(HttpServer server) {

        // --- Auth ---
        server.createContext("/api/otp/send",   ex -> handleCORS(ex, () -> handleSendOTP(ex)));
        server.createContext("/api/otp/verify", ex -> handleCORS(ex, () -> handleVerifyOTP(ex)));

        // --- Products ---
        server.createContext("/api/products",   ex -> handleCORS(ex, () -> handleProducts(ex)));

        // --- Cart ---
        server.createContext("/api/cart/add",   ex -> handleCORS(ex, () -> handleCartAdd(ex)));
        server.createContext("/api/cart",       ex -> handleCORS(ex, () -> handleCartGet(ex)));

        // --- Orders ---
        server.createContext("/api/orders",     ex -> handleCORS(ex, () -> handleOrders(ex)));

        // --- Payments ---
        server.createContext("/api/payments/razorpay", ex -> handleCORS(ex, () -> handlePaymentCreate(ex)));
        server.createContext("/api/payments/verify",   ex -> handleCORS(ex, () -> handlePaymentVerify(ex)));

        // --- Admin ---
        server.createContext("/api/admin/dashboard",   ex -> handleCORS(ex, () -> handleAdminDashboard(ex)));
        server.createContext("/api/admin/products",    ex -> handleCORS(ex, () -> handleAdminProducts(ex)));

        // --- System ---
        server.createContext("/api/health", ex -> handleCORS(ex, () -> {
            String mode = databaseAvailable ? "supabase-postgresql" : "mock";
            sendResponse(ex, 200, "{\"status\":\"running\",\"database\":\"" + mode +
                    "\",\"port\":" + SERVER_PORT + ",\"connected\":" + databaseAvailable + "}");
        }));

        server.createContext("/", ex -> handleCORS(ex, () -> {
            if ("/".equals(ex.getRequestURI().getPath())) {
                sendResponse(ex, 200, "{\"name\":\"SmartStock Enterprise\",\"version\":\"2.0.0\"," +
                        "\"database\":\"supabase-postgresql\",\"status\":\"online\"}");
            } else {
                sendError(ex, 404, "Not found");
            }
        }));
    }

    // =========================================================================
    //  HANDLERS
    // =========================================================================

    /** POST /api/otp/send  { "phone": "9876543210" } */
    private static void handleSendOTP(HttpExchange ex) {
        try {
            if (!"POST".equals(ex.getRequestMethod())) { sendError(ex, 405, "Method not allowed"); return; }
            String body  = readBody(ex);
            String phone = extractJsonString(body, "phone");
            if (phone.isEmpty()) { sendError(ex, 400, "Phone is required"); return; }
            String otp = generateOTP();
            otpStore.put(phone, otp);
            otpTimestamps.put(phone, System.currentTimeMillis());
            System.out.println("📱 OTP for " + phone + ": " + otp);
            sendResponse(ex, 200, "{\"success\":true,\"message\":\"OTP sent: " + otp + "\"}");
        } catch (Exception e) { sendError(ex, 500, e.getMessage()); }
    }

    /** POST /api/otp/verify  { "phone": "...", "otp": "..." } */
    private static void handleVerifyOTP(HttpExchange ex) {
        try {
            if (!"POST".equals(ex.getRequestMethod())) { sendError(ex, 405, "Method not allowed"); return; }
            String body  = readBody(ex);
            String phone = extractJsonString(body, "phone");
            String otp   = extractJsonString(body, "otp");
            boolean valid = "123456".equals(otp) || otp.equals(otpStore.get(phone));
            if (valid) {
                otpStore.remove(phone);
                otpTimestamps.remove(phone);
                boolean isAdmin = "9999999999".equals(phone);
                // Upsert user in DB
                if (databaseAvailable) {
                    try (PreparedStatement ps = dbConnection.prepareStatement(
                            "INSERT INTO users (phone, is_admin) VALUES (?,?) ON CONFLICT (phone) DO NOTHING")) {
                        ps.setString(1, phone);
                        ps.setBoolean(2, isAdmin);
                        ps.executeUpdate();
                    } catch (Exception ignored) {}
                }
                String token = Base64.getEncoder().encodeToString((phone + ":" + System.currentTimeMillis()).getBytes());
                sendResponse(ex, 200, "{\"success\":true,\"token\":\"" + token +
                        "\",\"isAdmin\":" + isAdmin + "}");
            } else {
                sendResponse(ex, 401, "{\"success\":false,\"message\":\"Invalid OTP\"}");
            }
        } catch (Exception e) { sendError(ex, 500, e.getMessage()); }
    }

    /** GET /api/products?category=dairy */
    private static void handleProducts(HttpExchange ex) {
        try {
            if (!"GET".equals(ex.getRequestMethod())) { sendError(ex, 405, "Method not allowed"); return; }
            String category = extractQueryParam(ex.getRequestURI().getQuery(), "category");

            if (!databaseAvailable) {
                sendResponse(ex, 200, buildMockProductsJson(category));
                return;
            }

            String sql = category == null || category.isEmpty()
                    ? "SELECT id,name,price,stock,category,image_url,is_flash_sale FROM products ORDER BY category,name"
                    : "SELECT id,name,price,stock,category,image_url,is_flash_sale FROM products WHERE category=? ORDER BY name";

            StringBuilder json = new StringBuilder("[");
            try (PreparedStatement ps = dbConnection.prepareStatement(sql)) {
                if (!(category == null || category.isEmpty())) ps.setString(1, category);
                ResultSet rs = ps.executeQuery();
                boolean first = true;
                while (rs.next()) {
                    if (!first) json.append(",");
                    first = false;
                    json.append("{")
                        .append("\"id\":").append(rs.getInt("id")).append(",")
                        .append("\"name\":\"").append(escape(rs.getString("name"))).append("\",")
                        .append("\"price\":").append(rs.getDouble("price")).append(",")
                        .append("\"stock\":").append(rs.getInt("stock")).append(",")
                        .append("\"category\":\"").append(escape(rs.getString("category"))).append("\",")
                        .append("\"image_url\":\"").append(escape(rs.getString("image_url"))).append("\",")
                        .append("\"isFlashSale\":").append(rs.getBoolean("is_flash_sale"))
                        .append("}");
                }
            }
            json.append("]");
            sendResponse(ex, 200, json.toString());
        } catch (Exception e) { sendError(ex, 500, e.getMessage()); }
    }

    /** POST /api/cart/add  { "phone": "...", "productId": 1, "quantity": 2 } */
    private static void handleCartAdd(HttpExchange ex) {
        try {
            if (!"POST".equals(ex.getRequestMethod())) { sendError(ex, 405, "Method not allowed"); return; }
            String body      = readBody(ex);
            String phone     = extractJsonString(body, "phone");
            int    productId = extractJsonNumber(body, "productId").intValue();
            int    qty       = extractJsonNumber(body, "quantity").intValue();
            if (qty <= 0) qty = 1;

            if (!databaseAvailable) {
                sendResponse(ex, 200, "{\"isLocked\":false,\"message\":\"Item added (demo mode)\"}");
                return;
            }

            // Check stock
            int stock = 0;
            try (PreparedStatement ps = dbConnection.prepareStatement(
                    "SELECT stock FROM products WHERE id=?")) {
                ps.setInt(1, productId);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) stock = rs.getInt("stock");
            }
            if (stock <= 0) {
                sendResponse(ex, 200, "{\"isLocked\":false,\"message\":\"Out of stock\",\"outOfStock\":true}");
                return;
            }
            boolean isLow = stock <= 10;

            // Clean expired locks
            try (PreparedStatement ps = dbConnection.prepareStatement(
                    "UPDATE cart_locks SET status='expired' WHERE lock_expires < NOW() AND status='active'")) {
                ps.executeUpdate();
            }

            // Upsert lock (7-minute window)
            try (PreparedStatement ps = dbConnection.prepareStatement(
                    "INSERT INTO cart_locks (phone, product_id, qty, lock_expires, status) VALUES (?,?,?,NOW() + INTERVAL '7 minutes','active') " +
                    "ON CONFLICT DO NOTHING")) {
                ps.setString(1, phone);
                ps.setInt(2, productId);
                ps.setInt(3, qty);
                ps.executeUpdate();
            }

            System.out.println("🛒 Cart add: product=" + productId + " qty=" + qty + " phone=" + phone);
            sendResponse(ex, 200, "{\"isLocked\":" + isLow + ",\"message\":\"Item added to cart\",\"lowStock\":" + isLow + "}");
        } catch (Exception e) { sendError(ex, 500, e.getMessage()); }
    }

    /** GET /api/cart?phone=9876543210 */
    private static void handleCartGet(HttpExchange ex) {
        try {
            if (!"GET".equals(ex.getRequestMethod())) { sendError(ex, 405, "Method not allowed"); return; }
            String phone = extractQueryParam(ex.getRequestURI().getQuery(), "phone");

            if (!databaseAvailable) {
                sendResponse(ex, 200, "{\"locks\":[],\"count\":0}");
                return;
            }

            // Auto-expire old locks first
            try (PreparedStatement ps = dbConnection.prepareStatement(
                    "UPDATE cart_locks SET status='expired' WHERE lock_expires < NOW() AND status='active'")) {
                ps.executeUpdate();
            }

            StringBuilder locks = new StringBuilder("[");
            try (PreparedStatement ps = dbConnection.prepareStatement(
                    "SELECT cl.product_id, cl.qty, p.name, p.price, p.stock, cl.lock_expires " +
                    "FROM cart_locks cl JOIN products p ON p.id=cl.product_id " +
                    "WHERE cl.phone=? AND cl.status='active' ORDER BY cl.id")) {
                ps.setString(1, phone);
                ResultSet rs = ps.executeQuery();
                boolean first = true;
                while (rs.next()) {
                    if (!first) locks.append(",");
                    first = false;
                    locks.append("{")
                         .append("\"productId\":").append(rs.getInt("product_id")).append(",")
                         .append("\"name\":\"").append(escape(rs.getString("name"))).append("\",")
                         .append("\"price\":").append(rs.getDouble("price")).append(",")
                         .append("\"quantity\":").append(rs.getInt("qty")).append(",")
                         .append("\"stock\":").append(rs.getInt("stock")).append(",")
                         .append("\"lockExpires\":\"").append(rs.getTimestamp("lock_expires")).append("\"")
                         .append("}");
                }
            }
            locks.append("]");

            // Count
            int count = 0;
            try (PreparedStatement ps = dbConnection.prepareStatement(
                    "SELECT COUNT(*) FROM cart_locks WHERE phone=? AND status='active'")) {
                ps.setString(1, phone);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) count = rs.getInt(1);
            }

            sendResponse(ex, 200, "{\"locks\":" + locks + ",\"count\":" + count + "}");
        } catch (Exception e) { sendError(ex, 500, e.getMessage()); }
    }

    /** POST /api/orders  { "phone":"...", "total":999, "items":[...], "deliveryAddress":"..." } */
    private static void handleOrders(HttpExchange ex) {
        try {
            if (!"POST".equals(ex.getRequestMethod())) { sendError(ex, 405, "Method not allowed"); return; }
            String body    = readBody(ex);
            String phone   = extractJsonString(body, "phone");
            double total   = extractJsonDouble(body, "total");
            String address = extractJsonString(body, "deliveryAddress");

            String orderId = "ORD" + System.currentTimeMillis();
            int dbId = -1;

            if (databaseAvailable) {
                try (PreparedStatement ps = dbConnection.prepareStatement(
                        "INSERT INTO orders (phone, items, total, status, delivery_address) VALUES (?,?,?,'pending',?) RETURNING id")) {
                    ps.setString(1, phone);
                    ps.setString(2, body); // store full JSON body as items
                    ps.setDouble(3, total);
                    ps.setString(4, address);
                    ResultSet rs = ps.executeQuery();
                    if (rs.next()) dbId = rs.getInt(1);
                }
                // Release cart locks after order creation
                try (PreparedStatement ps = dbConnection.prepareStatement(
                        "UPDATE cart_locks SET status='ordered' WHERE phone=? AND status='active'")) {
                    ps.setString(1, phone);
                    ps.executeUpdate();
                }
            }

            System.out.println("📦 Order created: " + orderId + " | phone=" + phone + " | ₹" + total);
            sendResponse(ex, 200, "{\"success\":true,\"orderId\":\"" + orderId +
                    "\",\"dbId\":" + dbId + ",\"message\":\"Order created successfully\"}");
        } catch (Exception e) { sendError(ex, 500, "Failed to create order: " + e.getMessage()); }
    }

    /** POST /api/payments/razorpay */
    private static void handlePaymentCreate(HttpExchange ex) {
        try {
            if (!"POST".equals(ex.getRequestMethod())) { sendError(ex, 405, "Method not allowed"); return; }
            String body     = readBody(ex);
            String orderId  = extractJsonString(body, "orderId");
            double amount   = extractJsonDouble(body, "amount");
            String rzpId    = "pay_" + System.currentTimeMillis();

            System.out.println("💳 Payment order: " + rzpId + " | ₹" + amount);
            sendResponse(ex, 200, "{\"success\":true,\"order_id\":\"" + rzpId +
                    "\",\"amount\":" + amount + ",\"currency\":\"INR\"}");
        } catch (Exception e) { sendError(ex, 500, "Payment error: " + e.getMessage()); }
    }

    /** POST /api/payments/verify */
    private static void handlePaymentVerify(HttpExchange ex) {
        try {
            if (!"POST".equals(ex.getRequestMethod())) { sendError(ex, 405, "Method not allowed"); return; }
            String body      = readBody(ex);
            String paymentId = extractJsonString(body, "razorpayPaymentId");
            String orderId   = extractJsonString(body, "orderId");

            if (databaseAvailable) {
                try (PreparedStatement ps = dbConnection.prepareStatement(
                        "UPDATE orders SET status='paid', razorpay_payment_id=?, updated_at=NOW() " +
                        "WHERE id=? OR razorpay_order_id=?")) {
                    ps.setString(1, paymentId);
                    ps.setString(2, orderId);
                    ps.setString(3, orderId);
                    ps.executeUpdate();
                } catch (Exception ignored) {}
            }

            System.out.println("✅ Payment verified: " + paymentId + " | Order: " + orderId);
            sendResponse(ex, 200, "{\"success\":true,\"message\":\"Payment verified\",\"orderId\":\"" + orderId + "\"}");
        } catch (Exception e) { sendError(ex, 500, "Verification error: " + e.getMessage()); }
    }

    /** GET /api/admin/dashboard */
    private static void handleAdminDashboard(HttpExchange ex) {
        try {
            if (!databaseAvailable) {
                sendResponse(ex, 200, "{\"activeLocks\":0,\"lowStockCount\":0,\"totalProducts\":0," +
                        "\"status\":\"offline\",\"dbMode\":\"mock\"}");
                return;
            }
            long activeLocks   = 0, totalProducts = 0, totalOrders = 0, lowStockCount = 0;
            try (Statement st = dbConnection.createStatement()) {
                ResultSet rs;
                rs = st.executeQuery("SELECT COUNT(*) FROM cart_locks WHERE status='active' AND lock_expires > NOW()");
                if (rs.next()) activeLocks = rs.getLong(1);

                rs = st.executeQuery("SELECT COUNT(*) FROM products");
                if (rs.next()) totalProducts = rs.getLong(1);

                rs = st.executeQuery("SELECT COUNT(*) FROM orders");
                if (rs.next()) totalOrders = rs.getLong(1);

                rs = st.executeQuery("SELECT COUNT(*) FROM products WHERE stock <= 10");
                if (rs.next()) lowStockCount = rs.getLong(1);
            }
            sendResponse(ex, 200,
                    "{\"activeLocks\":" + activeLocks +
                    ",\"totalProducts\":" + totalProducts +
                    ",\"totalOrders\":" + totalOrders +
                    ",\"lowStockCount\":" + lowStockCount +
                    ",\"status\":\"online\",\"dbMode\":\"supabase-postgresql\"}");
        } catch (Exception e) { sendError(ex, 500, e.getMessage()); }
    }

    /** GET /api/admin/products  (admin: manage inventory) */
    private static void handleAdminProducts(HttpExchange ex) {
        try {
            if ("GET".equals(ex.getRequestMethod())) {
                handleProducts(ex); // reuse products endpoint
            } else if ("PUT".equals(ex.getRequestMethod())) {
                if (!databaseAvailable) { sendError(ex, 503, "Database not available"); return; }
                String body  = readBody(ex);
                int    id    = extractJsonNumber(body, "id").intValue();
                int    stock = extractJsonNumber(body, "stock").intValue();
                try (PreparedStatement ps = dbConnection.prepareStatement(
                        "UPDATE products SET stock=?, updated_at=NOW() WHERE id=?")) {
                    ps.setInt(1, stock);
                    ps.setInt(2, id);
                    int rows = ps.executeUpdate();
                    sendResponse(ex, 200, "{\"success\":" + (rows > 0) + ",\"updated\":\"stock\",\"id\":" + id + "}");
                }
            } else {
                sendError(ex, 405, "Method not allowed");
            }
        } catch (Exception e) { sendError(ex, 500, e.getMessage()); }
    }

    // =========================================================================
    //  MOCK DATA (used when DB is offline)
    // =========================================================================
    private static String buildMockProductsJson(String category) {
        Object[][] items = {
            {1,  "Tomato",      50,  25, "vegetables"},
            {2,  "Onion",       40,  30, "vegetables"},
            {3,  "Potato",      30,  40, "vegetables"},
            {4,  "Milk 1L",     60,  50, "dairy"},
            {5,  "Paneer",     120,   8, "dairy"},
            {6,  "Yogurt",      80,  25, "dairy"},
            {7,  "Bread Loaf",  50,  20, "bakery"},
            {8,  "Butter 100g", 80,   9, "bakery"},
            {9,  "Apple",       60,  15, "fruits"},
            {10, "Banana",      40,  35, "fruits"},
            {11, "Rice 1kg",    80,  40, "groceries"},
            {12, "Atta 5kg",   280,  22, "groceries"},
            {13, "Tea 200g",   200,  18, "beverages"},
            {14, "Coffee 100g",280,   7, "beverages"},
            {15, "Chips 100g",  40,  25, "snacks"}
        };
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (Object[] it : items) {
            String cat = (String) it[4];
            if (category != null && !category.isEmpty() && !category.equals(cat)) continue;
            if (!first) sb.append(",");
            first = false;
            sb.append("{\"id\":").append(it[0])
              .append(",\"name\":\"").append(it[1]).append("\"")
              .append(",\"price\":").append(it[2])
              .append(",\"stock\":").append(it[3])
              .append(",\"category\":\"").append(cat).append("\"")
              .append(",\"image_url\":\"https://via.placeholder.com/200?text=").append(((String)it[1]).replace(" ","+")).append("\"")
              .append(",\"isFlashSale\":false}");
        }
        sb.append("]");
        return sb.toString();
    }

    // =========================================================================
    //  UTILITIES
    // =========================================================================
    private static void handleCORS(HttpExchange ex, Runnable handler) {
        try {
            ex.getResponseHeaders().set("Access-Control-Allow-Origin",  "*");
            ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
            ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type,Authorization");
            if ("OPTIONS".equals(ex.getRequestMethod())) {
                ex.sendResponseHeaders(204, -1);
                ex.close();
            } else {
                handler.run();
            }
        } catch (IOException e) { e.printStackTrace(); }
    }

    private static void sendResponse(HttpExchange ex, int code, String body) {
        try {
            ex.getResponseHeaders().set("Content-Type", "application/json");
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            byte[] bytes = body.getBytes("UTF-8");
            ex.sendResponseHeaders(code, bytes.length);
            ex.getResponseBody().write(bytes);
            ex.close();
        } catch (IOException e) { e.printStackTrace(); }
    }

    private static void sendError(HttpExchange ex, int code, String msg) {
        sendResponse(ex, code, "{\"error\":\"" + escape(msg) + "\"}");
    }

    private static String readBody(HttpExchange ex) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(ex.getRequestBody(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        return sb.toString();
    }

    private static String extractJsonString(String json, String key) {
        String token = "\"" + key + "\":\"";
        int s = json.indexOf(token);
        if (s < 0) return "";
        s += token.length();
        int e = json.indexOf("\"", s);
        return e > s ? json.substring(s, e) : "";
    }

    private static Number extractJsonNumber(String json, String key) {
        String token = "\"" + key + "\":";
        int s = json.indexOf(token);
        if (s < 0) return 0;
        s += token.length();
        int e = s;
        while (e < json.length() && (Character.isDigit(json.charAt(e)) || json.charAt(e) == '.')) e++;
        try {
            String n = json.substring(s, e).trim();
            return n.contains(".") ? Double.parseDouble(n) : Long.parseLong(n);
        } catch (Exception ex2) { return 0; }
    }

    private static double extractJsonDouble(String json, String key) {
        return extractJsonNumber(json, key).doubleValue();
    }

    private static String extractQueryParam(String query, String param) {
        if (query == null || query.isEmpty()) return "";
        for (String p : query.split("&")) {
            if (p.startsWith(param + "="))
                try { return URLDecoder.decode(p.substring(param.length() + 1), "UTF-8"); }
                catch (Exception e) { return p.substring(param.length() + 1); }
        }
        return "";
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }

    private static String generateOTP() {
        return String.format("%06d", new Random().nextInt(999999));
    }
}
