module.exports = (req, res) => {
    const { code } = req.query;
    console.log('Uber OAuth code:', code);
    res.status(200).json({ code });
}; 