require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));


const contactHandler = require('./api/contact');
const registerHandler = require('./api/register');
app.post('/api/contact', contactHandler);
app.post('/api/register', registerHandler);

// Serve individual HTML files for each route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/about.html'));
});

app.get('/programs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/programs.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/register.html'));
});

// app.get('/schedule', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public/schedule.html'));
// });

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/contact.html'));
});


app.get('/team', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/team.html'));
});

// app.get('/profile', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public/profile.html'));
// });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
