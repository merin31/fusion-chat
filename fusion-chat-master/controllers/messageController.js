const path = require("path");
const Messages = require("../models/messageModel");

// Add message (text and/or attachments)
exports.addMessage = async (req, res) => {
  try {
    const { from, to, message = "" } = req.body;

    if (!from || !to) {
      return res.status(400).json({ error: "Missing sender or receiver ID" });
    }

    let attachments = [];

    // ✅ Handle uploaded files
    if (req.file) {
      attachments.push({
        url: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    }

    if (req.files && req.files.length > 0) {
      attachments = req.files.map((file) => ({
        url: `/uploads/${file.filename}`,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      }));
    }

    // ✅ If frontend also sent attachments as JSON (e.g., existing file URLs)
    if (req.body.attachments) {
      const bodyAttachments = Array.isArray(req.body.attachments)
        ? req.body.attachments
        : [req.body.attachments];

      bodyAttachments.forEach((att) => {
        if (typeof att === "string") {
          attachments.push({ url: `/uploads/${att}` });
        } else {
          attachments.push(att);
        }
      });
    }

    const newMsg = await Messages.create({
      message: { text: message },
      users: [from, to],
      sender: from,
      attachments,
    });

    res.status(201).json(newMsg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all messages between two users
exports.getMessages = async (req, res) => {
  try {
    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({ error: "Missing sender or receiver ID" });
    }

    const messages = await Messages.find({
      users: { $all: [from, to] },
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
