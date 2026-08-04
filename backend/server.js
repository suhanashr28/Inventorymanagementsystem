require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { get, all, run, init } = require("./db");

// make sure the uploads folder exists before multer tries to write to it
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

const PORT = process.env.PORT || 3000;

// ======================
// MIDDLEWARE
// ======================

app.use(express.json());

// allow requests from any origin (fixes silent failures if frontend
// is opened as a file:// page or served from a different port)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.static(path.join(__dirname, "../frontend")));

// image folder access
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.redirect("/home.html");
});

// ======================
// IMAGE UPLOAD
// ======================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage: storage });

// ======================
// LOGIN
// ======================

app.post("/api/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await get("SELECT * FROM users WHERE email=?", [email]);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email not found"
      });
    }

    const match = bcrypt.compareSync(password, user.password);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Wrong password"
      });
    }

    res.json({
      success: true,
      message: "Login successful",
      email: user.email,
      name: user.name
    });
  } catch (err) {
    next(err);
  }
});

// ======================
// SIGNUP
// ======================

app.post("/api/signup", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const exist = await get("SELECT * FROM users WHERE email=?", [email]);

    if (exist) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    const hash = bcrypt.hashSync(password, 10);

    await run(
      `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
      [name, email, hash]
    );

    res.json({
      success: true,
      message: "Account created"
    });
  } catch (err) {
    next(err);
  }
});

// ======================
// PRODUCTS
// ======================

// GET PRODUCTS
app.get("/api/products", async (req, res, next) => {
  try {
    const products = await all("SELECT * FROM products");
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// GET SINGLE PRODUCT
app.get("/api/products/:id", async (req, res, next) => {
  try {
    const product = await get(
      "SELECT * FROM products WHERE id=?",
      [req.params.id]
    );
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// ======================
// ADD PRODUCT WITH IMAGE
// ======================

app.post("/api/products", upload.single("image"), async (req, res, next) => {
  try {
    const { name, supplier, price, quantity, category, description } = req.body;

    const image = req.file ? req.file.filename : "default.jpg";

    const result = await run(
      `INSERT INTO products
        (name, supplier, price, quantity, category, description, image)
       VALUES (?,?,?,?,?,?,?)`,
      [name, supplier, price, quantity, category, description, image]
    );

    res.json({
      success: true,
      productId: result.lastInsertRowid
    });
  } catch (err) {
    next(err);
  }
});

// ======================
// UPDATE PRODUCT (NO IMAGE)
// ======================

app.put("/api/products/:id", upload.single("image"), async (req, res, next) => {
  try {
    const { name, supplier, price, quantity, category, description } = req.body;

    const oldProduct = await get(
      "SELECT image FROM products WHERE id=?",
      [req.params.id]
    );

    const image = req.file ? req.file.filename : oldProduct.image;

    await run(
      `UPDATE products
       SET name=?, supplier=?, price=?, quantity=?, category=?, description=?, image=?
       WHERE id=?`,
      [name, supplier, price, quantity, category, description, image, req.params.id]
    );

    res.json({
      success: true,
      message: "Product updated"
    });
  } catch (err) {
    next(err);
  }
});

// DELETE PRODUCT
app.delete("/api/products/:id", async (req, res, next) => {
  try {
    await run("DELETE FROM products WHERE id=?", [req.params.id]);

    res.json({
      success: true,
      message: "Deleted"
    });
  } catch (err) {
    next(err);
  }
});

// GET ALL SUPPLIERS
app.get("/api/suppliers", async (req, res, next) => {
  try {
    const suppliers = await all(`
      SELECT
        s.*,
        COUNT(p.id) AS products
      FROM suppliers s
      LEFT JOIN products p
        ON s.name = p.supplier
      GROUP BY s.id
    `);
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

// GET SINGLE SUPPLIER
app.get("/api/suppliers/:id", async (req, res, next) => {
  try {
    const supplier = await get(
      `
      SELECT
        s.*,
        COUNT(p.id) AS products
      FROM suppliers s
      LEFT JOIN products p
        ON s.name = p.supplier
      WHERE s.id = ?
      GROUP BY s.id
    `,
      [req.params.id]
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

    res.json(supplier);
  } catch (err) {
    next(err);
  }
});

// ADD SUPPLIER
app.post("/api/suppliers", upload.single("image"), async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body;

    const image = req.file ? req.file.filename : "default.jpg";

    const result = await run(
      `INSERT INTO suppliers (name, email, phone, address, image)
       VALUES (?,?,?,?,?)`,
      [name, email, phone, address, image]
    );

    res.json({
      success: true,
      supplierId: result.lastInsertRowid
    });
  } catch (err) {
    next(err);
  }
});

// UPDATE SUPPLIER
app.put("/api/suppliers/:id", upload.single("image"), async (req, res, next) => {
  try {
    const supplierId = Number(req.params.id);

    const { name, email, phone, address } = req.body;

    // make sure the supplier actually exists first
    const existing = await get(
      "SELECT * FROM suppliers WHERE id=?",
      [supplierId]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found (id " + supplierId + ")"
      });
    }

    const image = req.file ? req.file.filename : existing.image;

    await run(
      `UPDATE suppliers
       SET name=?, email=?, phone=?, address=?, image=?
       WHERE id=?`,
      [name, email, phone, address, image, supplierId]
    );

    res.json({
      success: true,
      message: "Supplier Updated Successfully"
    });
  } catch (err) {
    next(err);
  }
});

// DELETE SUPPLIER
app.delete("/api/suppliers/:id", async (req, res, next) => {
  try {
    await run("DELETE FROM suppliers WHERE id=?", [req.params.id]);

    res.json({
      success: true,
      message: "Supplier Deleted Successfully"
    });
  } catch (err) {
    next(err);
  }
});

// GET SETTINGS
app.get("/api/settings", async (req, res, next) => {
  try {
    const settings = await get("SELECT * FROM settings WHERE id=1");
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// UPDATE SETTINGS
app.put("/api/settings", async (req, res, next) => {
  try {
    const { store_name, email, phone } = req.body;

    await run(
      `UPDATE settings
       SET store_name=?, email=?, phone=?
       WHERE id=1`,
      [store_name, email, phone]
    );

    res.json({
      success: true,
      message: "Settings Updated Successfully"
    });
  } catch (err) {
    next(err);
  }
});

// ======================
// UPDATE USER PROFILE
// ======================

app.put("/api/user/:email", async (req, res, next) => {
  try {
    const { name, email } = req.body;

    const existing = await get(
      "SELECT * FROM users WHERE email=?",
      [req.params.email]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await run(
      `UPDATE users
       SET name=?, email=?
       WHERE email=?`,
      [name, email, req.params.email]
    );

    res.json({
      success: true,
      message: "Profile updated successfully"
    });
  } catch (err) {
    next(err);
  }
});

// GET USER PROFILE
app.get("/api/user/:email", async (req, res, next) => {
  try {
    const user = await get(
      "SELECT id,name,email FROM users WHERE email=?",
      [req.params.email]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// CHANGE PASSWORD
app.put("/api/change-password/:email", async (req, res, next) => {
  try {
    const { newPassword } = req.body;

    const hash = bcrypt.hashSync(newPassword, 10);

    await run(
      `UPDATE users
       SET password=?
       WHERE email=?`,
      [hash, req.params.email]
    );

    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (err) {
    next(err);
  }
});

// ======================
// ERROR HANDLER (catches multer/db errors so the client gets JSON, not an HTML crash page)
// ======================

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Something went wrong"
  });
});

// ======================
// START SERVER
// ======================

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database init failed:", err);
    process.exit(1);
  });