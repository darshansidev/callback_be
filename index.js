import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as UberStrategy } from 'passport-uber-v2';
import path from 'path';
import { fileURLToPath } from 'url';

const CLIENT_ID = 'bJi7BpHf7SJN6_ajVrRNA9nRaeOchgK7';
const CLIENT_SECRET = 'yH_ri27R4yeVUA_JySVlVE2UaAkvdCTvfIB3O-oQ';
const CALLBACK_URL = 'http://localhost:3005/callback';

const app = express();
const PORT = process.env.PORT || 3005;

// Session middleware
app.use(session({ secret: 'your_session_secret', resave: false, saveUninitialized: true }));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport Uber Strategy
passport.use(new UberStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['profile'],
},
    function (accessToken, refreshToken, profile, done) {
        // Attach tokens to user profile
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        return done(null, profile);
    }
));

// Serialize/deserialize user
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Uber Auth endpoint
app.get('/auth/uber', passport.authenticate('uber'));

// Uber Callback endpoint
app.get('/callback',
    passport.authenticate('uber', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication
        // You now have access to req.user.accessToken and req.user.refreshToken
        res.json({
            message: `Hello, ${req.user.displayName || 'user'}!`,
            accessToken: req.user.accessToken,
            refreshToken: req.user.refreshToken,
            profile: req.user
        });
    }
);

// Optional: Login failure endpoint
app.get('/login', (req, res) => {
    res.send('Uber login failed or was cancelled. ' + JSON.stringify(req.query));
});

// EJS setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// UI route for displaying OAuth code (Uber/DoorDash)
app.get('/show-code', (req, res) => {
    const { code, provider } = req.query;
    res.render('show-code', { code, provider });
});

// Privacy Policy route
app.get('/privacy-policy', (req, res) => {
    res.render('privacy-policy');
});

// Sample API route for backend health check
app.get('/', (req, res) => {
    res.json({ success: true, message: 'Backend is working!' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 