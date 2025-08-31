const express = require('express');
const router = express.Router();
const { aesEncrypt, aesDecrypt } = require('../utils/aes128');

const key = "thisis16bytekey"; // 16-byte secret key

// Send message (encrypt)
router.post('/sendMessage', (req, res) => {
    const { message } = req.body;
    if(!message) return res.status(400).json({ error: "Message is required" });

    const encrypted = aesEncrypt(message, key);
    res.json({ encrypted });
});

// Receive message (decrypt)
router.post('/receiveMessage', (req, res) => {
    const { encrypted } = req.body;
    if(!encrypted) return res.status(400).json({ error: "Encrypted message is required" });

    const decrypted = aesDecrypt(encrypted, key);
    res.json({ decrypted });
});

module.exports = router;
