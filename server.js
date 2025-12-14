const express = require('express');
const mysql = require('mysql2'); 
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(session({
    secret: 'secret_key',
    resave: false,
    saveUninitialized: true
}));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'aditya2022@', // ✅ Apka password
    database: 'college_bookstore'
});

db.connect((err) => {
    if (err) console.error(err);
    else console.log("✅ MySQL Connected...");
});

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ROUTES

app.get('/login', (req, res) => res.render('login'));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, result) => {
        if (result.length > 0) {
            req.session.userId = result[0].id;
            req.session.userName = result[0].name;
            res.redirect('/');
        } else {
            res.send("❌ Wrong Email/Password <a href='/login'>Try Again</a>");
        }
    });
});

app.post('/signup', (req, res) => {
    const { name, email, password } = req.body;
    db.query("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, password], (err) => res.redirect('/login'));
});

// 🔥 HOME PAGE WITH FILTER LOGIC
app.get('/', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    let sql = "SELECT * FROM books";
    let queryParams = [];

    // Filter by Search OR Category (Branch)
    if (req.query.search) {
        sql += " WHERE name LIKE ? OR author LIKE ?";
        queryParams = [`%${req.query.search}%`, `%${req.query.search}%`];
    } else if (req.query.category) {
        // Agar Category button dabaya hai
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
            currentCategory: req.query.category || 'All' // Taaki button active dikhe
        });
    });
});

app.get('/profile', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    db.query("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, user) => {
        db.query("SELECT * FROM books WHERE user_id = ?", [req.session.userId], (err, books) => {
            res.render('profile', { user: user[0], books: books });
        });
    });
});

app.get('/add', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('add-book');
});

// 🔥 SAVE BOOK (Added Branch)
app.post('/save-book', upload.single('image'), (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { name, author, price, contact, branch } = req.body; // Branch bhi liya
    const image = req.file ? req.file.filename : null;
    
    const sql = "INSERT INTO books (name, author, price, contact_number, image, user_id, status, branch) VALUES (?, ?, ?, ?, ?, ?, 'available', ?)";
    db.query(sql, [name, author, price, contact, image, req.session.userId, branch], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Edit & Delete...
app.get('/edit/:id', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    db.query("SELECT * FROM books WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId], (err, result) => {
        if (result.length > 0) res.render('edit-book', { book: result[0] });
        else res.send("⛔ Permission Denied");
    });
});

app.post('/update/:id', (req, res) => {
    const { name, author, price, contact } = req.body;
    db.query("UPDATE books SET name=?, author=?, price=?, contact_number=? WHERE id=?", [name, author, price, contact, req.params.id], (err) => res.redirect('/'));
});

app.post('/delete/:id', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    db.query("DELETE FROM books WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId], (err) => res.redirect('back'));
});

app.post('/mark-sold/:id', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    db.query("UPDATE books SET status = 'sold' WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId], (err) => res.redirect('back'));
});

app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));