import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as UberStrategy } from 'passport-uber-v2';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import path from 'path';
import { fileURLToPath } from 'url';

const CLIENT_ID = 'bJi7BpHf7SJN6_ajVrRNA9nRaeOchgK7';
const CLIENT_SECRET = 'yH_ri27R4yeVUA_JySVlVE2UaAkvdCTvfIB3O-oQ';
// Set callback URL based on environment
const isProd = true;
const CALLBACK_URL = isProd
    ? 'https://callback-thirdparty.vercel.app/api/callback/uber'
    : 'http://localhost:3005/api/callback/uber';

// DoorDash credentials (replace with your real values)
const DOORDASH_CLIENT_ID = 'YOUR_DOORDASH_CLIENT_ID';
const DOORDASH_CLIENT_SECRET = 'YOUR_DOORDASH_CLIENT_SECRET';
const DOORDASH_CALLBACK_URL = 'http://localhost:3005/api/callback/doordash';

const app = express();
const PORT = process.env.PORT || 3005;

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (Object.keys(req.query).length > 0) {
        console.log('Query params:', req.query);
    }
    next();
});

// Session middleware with proper configuration
app.use(session({
    secret: 'uber-oauth-session-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport Uber Strategy with enhanced error handling
passport.use(new UberStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['eats.deliveries'],
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('OAuth callback successful:');
        console.log('Access Token:', accessToken ? 'Present' : 'Missing');
        console.log('Refresh Token:', refreshToken ? 'Present' : 'Missing');
        console.log('Profile:', profile);

        // Attach tokens to user profile
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;

        return done(null, profile);
    } catch (error) {
        console.error('Error in OAuth strategy callback:', error);
        return done(error, null);
    }
}));

// DoorDash Strategy (OAuth2)
passport.use('doordash', new OAuth2Strategy({
    authorizationURL: 'https://doordash.com/oauth/v2/authorize',
    tokenURL: 'https://doordash.com/oauth/v2/token',
    clientID: DOORDASH_CLIENT_ID,
    clientSecret: DOORDASH_CLIENT_SECRET,
    callbackURL: DOORDASH_CALLBACK_URL,
    scope: ['profile'], // adjust as needed
}, (accessToken, refreshToken, profile, done) => {
    const user = { accessToken, refreshToken };
    return done(null, user);
}));

// Serialize/deserialize user
passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id || user.uuid);
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    console.log('Deserializing user');
    done(null, obj);
});

// EJS setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Health check route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Uber OAuth Server is running!',
        timestamp: new Date().toISOString()
    });
});

// Uber Auth endpoint with enhanced error handling
app.get('/auth/uber', (req, res, next) => {
    console.log('Initiating Uber OAuth flow...');
    passport.authenticate('uber', {
        scope: ['profile', 'history_lite', 'places', 'request']
    })(req, res, next);
});

// Enhanced Uber Callback endpoint with comprehensive error handling
app.get('/api/callback/uber', (req, res, next) => {
    console.log('Uber callback received');
    console.log('Callback query params:', req.query);

    // Check for error in callback
    if (req.query.error) {
        console.error('OAuth error in callback:', req.query.error);
        console.error('Error description:', req.query.error_description);
        return res.status(400).json({
            error: 'OAuth Error',
            details: req.query.error,
            description: req.query.error_description
        });
    }

    // Check for authorization code
    if (!req.query.code) {
        console.error('No authorization code received');
        return res.status(400).json({
            error: 'Missing Authorization Code',
            message: 'No authorization code was provided in the callback'
        });
    }

    console.log('Authorization code received:', req.query.code.substring(0, 10) + '...');

    passport.authenticate('uber', {
        failureRedirect: '/login',
        failureFlash: false
    }, (err, user, info) => {
        if (err) {
            console.error('Passport authentication error:', err);
            return res.status(500).json({
                error: 'Authentication Error',
                message: err.message || 'Unknown authentication error',
                details: err
            });
        }

        if (!user) {
            console.error('Authentication failed - no user returned');
            console.error('Info:', info);
            return res.status(401).json({
                error: 'Authentication Failed',
                message: 'User authentication was unsuccessful',
                info: info
            });
        }

        // Log in the user
        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error('Login error:', loginErr);
                return res.status(500).json({
                    error: 'Login Error',
                    message: loginErr.message
                });
            }

            console.log('User successfully authenticated and logged in');

            // Successful authentication
            return res.json({
                success: true,
                message: `Hello, ${user.displayName || user.first_name || 'User'}!`,
                user: {
                    id: user.id || user.uuid,
                    name: user.displayName || `${user.first_name} ${user.last_name}`,
                    email: user.email,
                    picture: user.picture
                },
                tokens: {
                    accessToken: user.accessToken ? 'Present' : 'Missing',
                    refreshToken: user.refreshToken ? 'Present' : 'Missing'
                }
            });
        });
    })(req, res, next);
});

// DoorDash Auth endpoint
app.get('/auth/doordash', passport.authenticate('doordash'));

// DoorDash Callback endpoint
app.get('/api/callback/doordash',
    passport.authenticate('doordash', { failureRedirect: '/login' }),
    (req, res) => {
        const { accessToken } = req.user;
        res.redirect(`/show-code?code=${encodeURIComponent(accessToken || '')}&provider=doordash`);
    }
);

// Login failure endpoint with better error information
app.get('/login', (req, res) => {
    console.log('Login failure endpoint hit');
    console.log('Query params:', req.query);

    res.status(400).json({
        error: 'Login Failed',
        message: 'Uber login failed or was cancelled',
        details: req.query
    });
});

// UI route for displaying OAuth code (for testing purposes)
app.get('/show-code', (req, res) => {
    const { code, provider } = req.query;
    res.render('show-code', { code, provider });
});

// Privacy Policy route
app.get('/privacy-policy', (req, res) => {
    res.render('privacy-policy');
});

// Test endpoint to check current session
app.get('/test-session', (req, res) => {
    res.json({
        authenticated: req.isAuthenticated(),
        session: req.session,
        user: req.user || 'No user in session'
    });
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);

    // Check if it's an OAuth-related error
    if (err.name === 'AuthorizationError' || err.name === 'TokenError') {
        return res.status(401).json({
            error: 'OAuth Error',
            type: err.name,
            message: err.message,
            details: {
                description: 'This usually means invalid client credentials or callback URL mismatch',
                suggestions: [
                    'Verify CLIENT_ID and CLIENT_SECRET are correct',
                    'Check that callback URL matches exactly in Uber app settings',
                    'Ensure Uber app is in development mode and properly configured'
                ]
            }
        });
    }

    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Handle 404s
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});
app.get('/auth/linkedin/callback', async (req, res) => {
    const { code, state } = req.query;
    res.json({ code, state });
});



app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Available routes:');
    console.log('  GET  /                     - Health check');
    console.log('  GET  /auth/uber           - Start Uber OAuth');
    console.log('  GET  /api/callback/uber   - Uber OAuth callback');
    console.log('  GET  /test-session        - Check session status');
    console.log('');
    console.log('OAuth Configuration:');
    console.log('  Client ID:', CLIENT_ID);
    console.log('  Callback URL:', CALLBACK_URL);
    console.log('');
    console.log('To test: Visit http://localhost:3005/auth/uber');
});