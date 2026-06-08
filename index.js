require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const connectDB = require('./api/db');

const app = express();
const PORT = process.env.PORT || 3003;

// Connect to MongoDB
connectDB().then(() => {
  // Start Lulu polling after DB is ready (every 1 hour)
  if (process.env.LULU_CLIENT_KEY) {
    const { pollLuluOrders } = require('./api/luluClient');
    setInterval(pollLuluOrders, 60 * 60 * 1000);
  }
}).catch(err => {
  console.error('MongoDB connection failed:', err.message);
});

// Raw-body handlers — register BEFORE express.json()
app.use('/api/payments/webhook',       require('./api/payments'));
app.use('/api/shop/printful-webhook',  require('./api/shopWebhooks'));

app.use(cors());
app.use(express.json());

// Sessions (stored in MongoDB when MONGODB_URI is set)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dotori-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: process.env.MONGODB_URI
    ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, ttl: 7 * 24 * 60 * 60 })
    : undefined,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// Static files
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/auth',    require('./api/auth'));
app.use('/api/family',  require('./api/family'));
app.use('/api/classes', require('./api/classes'));
app.use('/api/payments',require('./api/payments'));
app.use('/api/shop',    require('./api/shop'));
app.use('/api/admin',   require('./api/admin'));

const contactHandler = require('./api/contact');
app.post('/api/contact', contactHandler);

// Page routes
app.get('/',                    (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/about',               (req, res) => res.sendFile(path.join(__dirname, 'public/about.html')));
app.get('/programs',            (req, res) => res.sendFile(path.join(__dirname, 'public/programs.html')));
app.get('/contact',             (req, res) => res.sendFile(path.join(__dirname, 'public/contact.html')));
app.get('/team',                (req, res) => res.sendFile(path.join(__dirname, 'public/team.html')));
app.get('/calendar',            (req, res) => res.sendFile(path.join(__dirname, 'public/calendar.html')));
app.get('/login',               (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/signup',              (req, res) => res.sendFile(path.join(__dirname, 'public/signup.html')));
app.get('/profile',             (req, res) => res.sendFile(path.join(__dirname, 'public/profile.html')));
app.get('/admin',               (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/store',               (req, res) => res.sendFile(path.join(__dirname, 'public/store.html')));
app.get('/shop',                (req, res) => res.redirect('/store'));
app.get('/checkout',            (req, res) => res.sendFile(path.join(__dirname, 'public/checkout.html')));
app.get('/order-confirmation',  (req, res) => res.sendFile(path.join(__dirname, 'public/order-confirmation.html')));
app.get('/order-status',        (req, res) => res.sendFile(path.join(__dirname, 'public/order-status.html')));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
