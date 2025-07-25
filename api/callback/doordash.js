module.exports = (req, res) => {
    const { code } = req.query;
    console.log('DoorDash OAuth code:', code);
    // Redirect to UI page with code and provider
    res.redirect(`/show-code?code=${encodeURIComponent(code || '')}&provider=doordash`);
}; 