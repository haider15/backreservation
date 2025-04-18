require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
// const bcrypt = require('bcryptjs');
// bcrypt.hash('admin123', 10).then(console.log);


// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true // permet l'envoi des cookies (sessions)
}));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Init Passport
app.use(passport.initialize());
app.use(passport.session());

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: err.message || err });
});

// Connexion MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  user: 'root',
  password: 'root',
  database: 'users_db',
  waitForConnections: true,
  connectionLimit: 10
});

// Middleware vérification rôle
const checkRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role === role) {
      return next();
    } else {
      return res.status(403).json({ message: 'Access forbidden' });
    }
  };
};

// Sérialisation/désérialisation utilisateur
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return done(new Error('User not found'));
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

// Stratégie Google
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL || "http://localhost:3001/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const googleId = profile.id;
    const adminEmail = 'admin@gmail.com';
    const adminGoogleId = 'google-id-123';

    const [users] = await pool.execute(
      'SELECT * FROM users WHERE google_id = ?',
      [googleId]
    );

    if (users.length > 0) {
      return done(null, users[0]);
    }

    const role = (email === adminEmail && googleId === adminGoogleId) ? 'admin' : 'visitor';

    const [result] = await pool.execute(
      'INSERT INTO users (email, google_id, auth_provider, role) VALUES (?, ?, ?, ?)',
      [email, googleId, 'google', role]
    );

    const newUser = {
      id: result.insertId,
      email,
      google_id: googleId,
      role
    };

    return done(null, newUser);
  } catch (err) {
    return done(err);
  }
}
));

// Routes
app.get('/', (req, res) => {
  res.send('User Service - <a href="/auth/google">Login with Google</a>');
});

// Auth Google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback Google
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const user = req.user;

    if (!user || !user.email || !user.role) {
      return res.redirect('/login'); // sécurité supplémentaire
    }

    // Encode pour éviter les problèmes d’URL
    const email = encodeURIComponent(user.email);
    const role = encodeURIComponent(user.role);
    const userId = encodeURIComponent(user.id); // Récupérer l'ID
    console.log(userId)

    const redirectUrl = `http://localhost:3000/login-success?email=${email}&role=${role}&id=${userId}`;
    res.redirect(redirectUrl);
  }
);



// Profil utilisateur
app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Not authenticated');
  }
  res.json({
    email: req.user.email,
    role: req.user.role
  });
});

// Déconnexion
app.get('/logout', (req, res) => {
  if (req.isAuthenticated()) {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed', error: err });
      }
      res.redirect('/');
    });
  } else {
    res.status(400).json({ message: 'No active session to logout' });
  }
});

// MAJ rôle (admin only)
app.put('/update-role/:id', checkRole('admin'), async (req, res) => {
  const { role } = req.body;
  const userId = req.params.id;

  if (!['admin', 'employee', 'visitor'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    await pool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    );
    res.status(200).json({ message: 'Role updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating role', error: err.message });
  }
});



/////////////////////////
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND auth_provider = "local"',
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Email incorrect ou utilisateur inexistant' });
    }

    const user = rows[0];

    // Comparaison du mot de passe
    if (password !== user.password) {
      return res.status(401).json({ message: 'Mot de passe incorrect' });
    }

    // Authentifié avec succès
    req.login(user, (err) => {
      if (err) return res.status(500).json({ message: 'Erreur session', error: err });
      return res.status(200).json({ user });
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// Lancement serveur
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
});
