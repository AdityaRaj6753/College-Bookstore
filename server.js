// 1. Zaroori Packages Import karna
require('dotenv').config(); // Password chhupane ke liye
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const app = express();

// 2. Settings aur Middleware
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // CSS/JS ke liye
app.use('/uploads', express.static('uploads')); // Photos dikhane ke liye

// Session Setup (Login yaad rakhne ke liye)
app.use(session({
    secret: 'secret_key',
    resave: false,
    saveUninitialized: true
}));

// 3. Database Connection (Secure Mode)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD, // ✅ Ye password ab .env file se lega
    database: 'college_bookstore'
});

db.connect((err) => {
    if (err) {
        console.log("❌ Database Connection Failed!");
        console.error(err);
    } else {
        console.log("✅ MySQL Connected Successfully...");
    }
});

// 4. Photo Upload Setup (Multer)
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Har photo ka naam unique hoga
    }
});
const upload = multer({ storage: storage });

// ================= ROUTES (RAASTE) ================= //

// 🔐 LOGIN & SIGNUP ROUTES
app.get('/login', (req, res) => res.render('login'));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.post('/signup', (req, res) => {
    const { name, email, password } = req.body;
    db.query("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, password], (err) => {
        if (err) console.log(err);
        res.redirect('/login');
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, result) => {
        if (result.length > 0) {
            req.session.userId = result[0].id;
            req.session.userName = result[0].name;
            res.redirect('/');
        } else {
            res.send("❌ Wrong Email or Password. <a href='/login'>Try Again</a>");
        }
    });
});

// 🏠 HOME PAGE (Dashboard with Search & Categories)
app.get('/', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    let sql = "SELECT * FROM books";
    let queryParams = [];

    // Agar Search kiya hai
    if (req.query.search) {
        sql += " WHERE name LIKE ? OR author LIKE ?";
        queryParams = [`%${req.query.search}%`, `%${req.query.search}%`];
    } 
    // Agar Category select ki hai
    else if (req.query.category && req.query.category !== 'All') {
        sql += " WHERE branch = ?";
        queryParams = [req.query.category];
    }

    db.query(sql, queryParams, (err, books) => {
        if (err) throw err;
        res.render('index', { 
            books: books, 
            user: req.session.userName, 
            currentUserId: req.session.userId,
            searchQuery: req.query.search,
            currentCategory: req.query.category || 'All'
        });
    });
});

// 👤 PROFILE PAGE
app.get('/profile', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    // User ki details aur uski upload ki hui books laao
    db.query("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, user) => {
        db.query("SELECT * FROM books WHERE user_id = ?", [req.session.userId], (err, books) => {
            res.render('profile', { user: user[0], books: books });
        });
    });
});

// ➕ ADD BOOK PAGE
app.get('/add', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('add-book');
});

// 💾 SAVE BOOK (Upload Logic)
app.post('/save-book', upload.single('image'), (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    const { name, author, price, contact, branch } = req.body;
    const image = req.file ? req.file.filename : null;

    const sql = "INSERT INTO books (name, author, price, contact_number, image, user_id, status, branch) VALUES (?, ?, ?, ?, ?, ?, 'available', ?)";
    
    db.query(sql, [name, author, price, contact, image, req.session.userId, branch], (err) => {
        if (err) {
            console.log(err);
            res.send("Error uploading book");
        } else {
            res.redirect('/');
        }
    });
});

// 🗑️ DELETE BOOK (Sirf apni book delete kar payega)
app.post('/delete/:id', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    db.query("DELETE FROM books WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId], (err) => {
        if(err) console.log(err);
        res.redirect('back');
    });
});

// ✅ MARK AS SOLD
app.post('/mark-sold/:id', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    db.query("UPDATE books SET status = 'sold' WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId], (err) => {
        if(err) console.log(err);
        res.redirect('back');
    });
});

// 🚀 SERVER START
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});