import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as UberStrategy } from 'passport-uber-v2';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import path from 'path';
import { fileURLToPath } from 'url';

// Uber credentials
const UBER_CLIENT_ID = 'bJi7BpHf7SJN6_ajVrRNA9nRaeOchgK7';
const UBER_CLIENT_SECRET = 'yH_ri27R4yeVUA_JySVlVE2UaAkvdCTvfIB3O-oQ';
const UBER_CALLBACK_URL = 'https://callback-thirdparty.vercel.app/api/callback/uber';

// DoorDash credentials (replace with your real values)
const DOORDASH_CLIENT_ID = 'YOUR_DOORDASH_CLIENT_ID';
const DOORDASH_CLIENT_SECRET = 'YOUR_DOORDASH_CLIENT_SECRET';
const DOORDASH_CALLBACK_URL = 'https://callback-thirdparty.vercel.app/api/callback/doordash';

const app = express();
const PORT = process.env.PORT || 3005;

// Session middleware
app.use(session({ secret: 'your_session_secret', resave: false, saveUninitialized: true }));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport Uber Strategy
passport.use('uber', new UberStrategy({
    clientID: UBER_CLIENT_ID,
    clientSecret: UBER_CLIENT_SECRET,
    callbackURL: UBER_CALLBACK_URL,
    scope: ['profile'],
},
    function (accessToken, refreshToken, profile, done) {
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        return done(null, profile);
    }
));

// DoorDash Strategy (OAuth2)
passport.use('doordash', new OAuth2Strategy({
    authorizationURL: 'https://doordash.com/oauth/v2/authorize',
    tokenURL: 'https://doordash.com/oauth/v2/token',
    clientID: DOORDASH_CLIENT_ID,
    clientSecret: DOORDASH_CLIENT_SECRET,
    callbackURL: DOORDASH_CALLBACK_URL,
    scope: ['profile'], // adjust as needed
},
    function (accessToken, refreshToken, profile, done) {
        // DoorDash does not provide profile by default, so just return tokens
        const user = { accessToken, refreshToken };
        return done(null, user);
    }
));

// Serialize/deserialize user
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Auth endpoints
app.get('/auth/uber', passport.authenticate('uber'));
app.get('/auth/doordash', passport.authenticate('doordash'));

// Uber callback
app.get('/api/callback/uber',
    passport.authenticate('uber', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication
        const { accessToken, refreshToken } = req.user;
        res.redirect(`/show-code?code=${encodeURIComponent(accessToken || '')}&provider=uber`);
    }
);

// DoorDash callback
app.get('/api/callback/doordash',
    passport.authenticate('doordash', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication
        const { accessToken, refreshToken } = req.user;
        res.redirect(`/show-code?code=${encodeURIComponent(accessToken || '')}&provider=doordash`);
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