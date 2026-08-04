require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const db = require("./db");

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


app.use(express.static(
    path.join(__dirname,"../frontend")
));


// image folder access

app.use(
    "/uploads",
    express.static(
        path.join(__dirname,"uploads")
    )
);



app.get("/",(req,res)=>{

    res.redirect("/home.html");

});




// ======================
// IMAGE UPLOAD
// ======================


const storage = multer.diskStorage({

    destination:function(req,file,cb){

       cb(null, path.join(__dirname, "uploads"));

    },


    filename:function(req,file,cb){

        cb(
            null,
            Date.now()+"-"+file.originalname
        );

    }


});


const upload = multer({
    storage:storage
});





// ======================
// LOGIN
// ======================


app.post("/api/login",(req,res)=>{


const {
email,
password
}=req.body;



const user = db
.prepare(
"SELECT * FROM users WHERE email=?"
)
.get(email);



if(!user){

return res.status(401).json({

success:false,

message:"Email not found"

});

}




const match = bcrypt.compareSync(
password,
user.password
);



if(!match){

return res.status(401).json({

success:false,

message:"Wrong password"

});

}



res.json({

success:true,

message:"Login successful",
email:user.email,
name:user.name

});


});






// ======================
// SIGNUP
// ======================


app.post("/api/signup",(req,res)=>{


const {
name,
email,
password
}=req.body;



const exist = db
.prepare(
"SELECT * FROM users WHERE email=?"
)
.get(email);



if(exist){

return res.status(400).json({

success:false,

message:"Email already exists"

});

}



const hash = bcrypt.hashSync(
password,
10
);



db.prepare(`

INSERT INTO users
(name,email,password)

VALUES(?,?,?)

`).run(
name,
email,
hash
);



res.json({

success:true,

message:"Account created"

});


});







// ======================
// PRODUCTS
// ======================


// GET PRODUCTS

app.get("/api/products",(req,res)=>{


const products = db
.prepare(
"SELECT * FROM products"
)
.all();


res.json(products);


});





// GET SINGLE PRODUCT

app.get(
"/api/products/:id",
(req,res)=>{


const product = db
.prepare(
"SELECT * FROM products WHERE id=?"
)
.get(req.params.id);



res.json(product);


});

// ======================
// ADD PRODUCT WITH IMAGE
// ======================


app.post(
"/api/products",
upload.single("image"),
(req,res)=>{


const {

name,
supplier,
price,
quantity,
category,
description

}=req.body;



const image = req.file
? req.file.filename
: "default.jpg";



const result = db.prepare(`

INSERT INTO products

(
name,
supplier,
price,
quantity,
category,
description,
image
)

VALUES(?,?,?,?,?,?,?)

`).run(

name,
supplier,
price,
quantity,
category,
description,
image

);



res.json({

success:true,

productId: result.lastInsertRowid

});


});

// ======================
// UPDATE PRODUCT (NO IMAGE)
// ======================

app.put(
"/api/products/:id",
upload.single("image"),
(req,res)=>{


const {

name,
supplier,
price,
quantity,
category,
description

}=req.body;



const oldProduct = db.prepare(
"SELECT image FROM products WHERE id=?"
)
.get(req.params.id);



const image = req.file
? req.file.filename
: oldProduct.image;



db.prepare(`

UPDATE products

SET

name=?,
supplier=?,
price=?,
quantity=?,
category=?,
description=?,
image=?

WHERE id=?

`).run(

name,
supplier,
price,
quantity,
category,
description,
image,
req.params.id

);



res.json({

success:true,

message:"Product updated"

});


});








// DELETE PRODUCT


app.delete(
"/api/products/:id",
(req,res)=>{


db.prepare(

"DELETE FROM products WHERE id=?"

)
.run(req.params.id);



res.json({

success:true,

message:"Deleted"

});


});







// GET ALL SUPPLIERS
app.get("/api/suppliers", (req, res) => {

const suppliers = db.prepare(`
SELECT
s.*,
COUNT(p.id) AS products
FROM suppliers s
LEFT JOIN products p
ON s.name = p.supplier
GROUP BY s.id
`).all();

res.json(suppliers);

});

// GET SINGLE SUPPLIER
app.get("/api/suppliers/:id", (req, res) => {

const supplier = db.prepare(`
SELECT
s.*,
COUNT(p.id) AS products
FROM suppliers s
LEFT JOIN products p
ON s.name = p.supplier
WHERE s.id = ?
GROUP BY s.id
`).get(req.params.id);

if (!supplier) {
  return res.status(404).json({
    success: false,
    message: "Supplier not found"
  });
}

res.json(supplier);

});

// ADD SUPPLIER
app.post("/api/suppliers", upload.single("image"), (req, res) => {

  const {
    name,
    email,
    phone,
    address
  } = req.body;

  const image = req.file
    ? req.file.filename
    : "default.jpg";

  const result = db.prepare(`
    INSERT INTO suppliers
    (
      name,
      email,
      phone,
      address,
      image
    )
    VALUES (?,?,?,?,?)
  `).run(
    name,
    email,
    phone,
    address,
    image
  );

  res.json({
    success: true,
    supplierId: result.lastInsertRowid
  });

});


// UPDATE SUPPLIER
app.put("/api/suppliers/:id", upload.single("image"), (req, res) => {

  const supplierId = Number(req.params.id);

  const {
    name,
    email,
    phone,
    address
  } = req.body;

  // make sure the supplier actually exists first
  const existing = db
    .prepare("SELECT * FROM suppliers WHERE id=?")
    .get(supplierId);

  if (!existing) {
    return res.status(404).json({
      success: false,
      message: "Supplier not found (id " + supplierId + ")"
    });
  }

  const image = req.file
    ? req.file.filename
    : existing.image;

  db.prepare(`
    UPDATE suppliers
    SET
      name=?,
      email=?,
      phone=?,
      address=?,
      image=?
    WHERE id=?
  `).run(
    name,
    email,
    phone,
    address,
    image,
    supplierId
  );

  res.json({
    success: true,
    message: "Supplier Updated Successfully"
  });

});


// DELETE SUPPLIER
app.delete("/api/suppliers/:id", (req, res) => {

  db.prepare(
    "DELETE FROM suppliers WHERE id=?"
  ).run(req.params.id);

  res.json({
    success: true,
    message: "Supplier Deleted Successfully"
  });

});
// GET SETTINGS
app.get("/api/settings", (req,res)=>{

    const settings = db
    .prepare("SELECT * FROM settings WHERE id=1")
    .get();

    res.json(settings);

});

// UPDATE SETTINGS
app.put("/api/settings", (req,res)=>{

    const {
        store_name,
        email,
        phone
    } = req.body;

    db.prepare(`
        UPDATE settings
        SET
        store_name=?,
        email=?,
        phone=?
        WHERE id=1
    `).run(
        store_name,
        email,
        phone
    );

    res.json({
        success:true,
        message:"Settings Updated Successfully"
    });

});
// ======================
// UPDATE USER PROFILE
// ======================

app.put("/api/user/:email", (req, res) => {

    const {
        name,
        email
    } = req.body;

    const existing = db.prepare(
        "SELECT * FROM users WHERE email=?"
    ).get(req.params.email);

    if (!existing) {
        return res.status(404).json({
            success: false,
            message: "User not found"
        });
    }

    db.prepare(`
        UPDATE users
        SET
            name=?,
            email=?
        WHERE email=?
    `).run(
        name,
        email,
        req.params.email
    );

    res.json({
        success: true,
        message: "Profile updated successfully"
    });

});

// GET USER PROFILE

app.get("/api/user/:email",(req,res)=>{

    const user = db
    .prepare(
        "SELECT id,name,email FROM users WHERE email=?"
    )
    .get(req.params.email);


    if(!user){

        return res.status(404).json({
            success:false,
            message:"User not found"
        });

    }


    res.json(user);

});
// CHANGE PASSWORD

app.put("/api/change-password/:email",(req,res)=>{

    const {
        newPassword
    } = req.body;


    const hash = bcrypt.hashSync(
        newPassword,
        10
    );


    db.prepare(`
        UPDATE users
        SET password=?
        WHERE email=?
    `).run(
        hash,
        req.params.email
    );


    res.json({

        success:true,
        message:"Password changed successfully"

    });


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


app.listen(
PORT,
()=>{

console.log(
`🚀 Server running at http://localhost:${PORT}`
);

}
);