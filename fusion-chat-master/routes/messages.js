const express = require("express");
const router = express.Router();
const path = require("path");
const Message = require("../models/messageModel");
const upload = require("../middlewares/upload");

// Serve uploaded files
router.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// --- Send message (text + optional single attachment) ---
router.post("/send", upload("file", 1), async (req, res) => {
  try {
    const { from, to, message = "" } = req.body;
    if (!from || !to) return res.status(400).json({ msg: "Missing sender or receiver ID" });

    // Attachments array
    const attachments = [];
    if (req.file) {
      attachments.push({
        url: `/uploads/${req.file.filename}`,   // frontend can fetch this
        originalName: req.file.originalname,   // original filename
        mimeType: req.file.mimetype,
        size: req.file.size,
      });
    }

    // Create message document
    const newMessage = await Message.create({
      message: { text: message },
      users: [from, to],
      sender: from,
      attachments,
    });

    res.status(201).json({ status: true, message: newMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, msg: "Internal server error" });
  }
});

// --- Get all messages between two users ---
router.post("/get-messages", async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ msg: "Missing sender or receiver ID" });

    const messages = await Message.find({ users: { $all: [from, to] } }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Internal server error" });
  }
});

module.exports = router;
