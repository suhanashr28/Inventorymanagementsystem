require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { get, all, run, init } = require("./db");

// A serverless function may receive a request while the database setup is
// still running. Keep one shared promise and wait for it on every request.
const databaseReady = init();

// Vercel functions have a read-only deployment directory. `/tmp` is the
// writable location available during a function instance's lifetime.
const bundledUploadsDir = path.join(__dirname, "uploads");
const uploadsDir = process.env.VERCEL
  ? path.join("/tmp", "inventory-uploads")
  : bundledUploadsDir;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

const PORT = process.env.PORT || 3000;

function passwordError(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter";
  }
  if (!/\d/.test(password)) {
    return "Password must include a number";
  }
  if (!/[#?!@$%^&*-]/.test(password)) {
    return "Password must include a special character, such as #";
  }
  return null;
}

function createTemporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const special = "#?!@$%^&*-";
  const pick = (characters) => characters[crypto.randomInt(characters.length)];

  return `${pick(upper)}${pick(lower)}${pick(numbers)}${pick(special)}${crypto.randomBytes(6).toString("base64url")}`;
}

function getMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("Email delivery is not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS in Vercel.");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

// ======================
// MIDDLEWARE
// ======================

app.use(express.json());

app.use(async (req, res, next) => {
  try {
    await databaseReady;
    next();
  } catch (err) {
    next(err);
  }
});

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

app.use(express.static(path.join(__dirname, "../Frontend")));

// image folder access
app.use("/uploads", express.static(uploadsDir));
if (uploadsDir !== bundledUploadsDir) {
  app.use("/uploads", express.static(bundledUploadsDir));
}

app.get("/", (req, res) => {
  res.redirect("/home.html");
});

// ======================
// IMAGE UPLOAD
// ======================

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

// Vercel's filesystem is temporary. Keep uploaded images in the database
// there; local development continues to write files into backend/uploads.
const storage = process.env.VERCEL ? multer.memoryStorage() : diskStorage;
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files can be uploaded"));
    }
    cb(null, true);
  }
});

async function saveImage(file) {
  if (!file) return null;

  if (process.env.VERCEL) {
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  }

  return file.filename;
}

// ======================
// LOGIN
// ======================

app.post("/api/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const invalidPassword = passwordError(password);
    if (invalidPassword) {
      return res.status(400).json({ success: false, message: invalidPassword });
    }

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

    const invalidPassword = passwordError(password);
    if (invalidPassword) {
      return res.status(400).json({ success: false, message: invalidPassword });
    }

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
// FORGOT PASSWORD
// ======================

app.post("/api/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await get("SELECT * FROM users WHERE email=?", [email]);
    const successMessage = "If an account exists for this email, a temporary password has been sent.";

    // Do not reveal whether an email address is registered.
    if (!user) {
      return res.json({ success: true, message: successMessage });
    }

    const temporaryPassword = createTemporaryPassword();
    const mailer = getMailer();
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: "Your InventoryPro temporary password",
      text: `Hello ${user.name},\n\nYour temporary InventoryPro password is: ${temporaryPassword}\n\nUse it to log in, then change your password from Settings.\n\nIf you did not request this, contact the administrator immediately.`
    });

    await run("UPDATE users SET password=? WHERE email=?", [
      bcrypt.hashSync(temporaryPassword, 10),
      user.email
    ]);

    res.json({ success: true, message: successMessage });
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

    const image = await saveImage(req.file);

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

    const image = req.file ? await saveImage(req.file) : oldProduct.image;

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

    const image = await saveImage(req.file);

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

    const image = req.file ? await saveImage(req.file) : existing.image;

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

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: "Password is required"
            });
        }

        const invalidPassword = passwordError(newPassword);
        if (invalidPassword) {
            return res.status(400).json({
                success: false,
                message: invalidPassword
            });
        }

        const user = await get(
            "SELECT * FROM users WHERE email=?",
            [req.params.email]
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const hash = bcrypt.hashSync(newPassword, 10);

        await run(
            "UPDATE users SET password=? WHERE email=?",
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
  const isEmailAuthError = err && (
    err.responseCode === 535 ||
    /bad credentials|username and password not accepted|invalid login/i.test(err.message || "")
  );

  res.status(500).json({
    success: false,
    message: isEmailAuthError
      ? "Email delivery is unavailable. Please contact the administrator."
      : err.message || "Something went wrong"
  });
});

// ======================
// START SERVER
// ======================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
