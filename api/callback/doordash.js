module.exports = (req, res) => {
    const { code } = req.query;
    console.log('DoorDash OAuth code:', code);
    res.status(200).json({ code });
}; 