const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const http = require("http");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

// Routes
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");

// Models
const Messages = require("./models/messageModel");

const app = express();
const server = http.createServer(app);

// --- Middleware ---
app.use(cors({
  origin: "*",
  credentials: true,
}));
app.use(express.json());

// --- Upload folder setup ---
const UPLOAD_DIR = path.join(__dirname, "upload");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/upload", express.static(UPLOAD_DIR));

// --- MongoDB connection ---
mongoose.connect(process.env.MONGO_URL || "mongodb://127.0.0.1:27017/chat", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Error:", err.message));

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// --- Multer setup for /api/upload ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "-"))
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|xls|xlsx|ppt|pptx|mp3|mp4|mov|webm/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.test(ext)) cb(null, true);
    else cb(new Error("Unsupported file type: " + ext));
  }
});

// --- File upload endpoint ---
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/upload/${req.file.filename}`;
  res.json({
    filename: req.file.filename,
    url: fileUrl,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

// --- Socket.io Setup ---
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

// Map of online users
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  // Register user
  socket.on("add-user", (userId) => {
    if (!userId) return console.warn("⚠️ add-user: missing userId");
    onlineUsers.set(userId, socket.id);
    console.log(`➕ User added: ${userId} -> ${socket.id}`);
  });

  // Send message with optional attachments
  socket.on("msg-send", async ({ from, to, msgText, attachments }) => {
  if (!from || !to || (!msgText && (!attachments || attachments.length === 0))) {
    return console.warn("⚠️ Missing message data");
  }

  try {
    // Normalize attachments: ensure each has url and name
    const normalizedAttachments = (attachments || []).map((att) => {
      if (typeof att === "string") {
        // If string, assume it's a filename, build url and name
        return {
          url: `/upload/${att}`,
          name: att,
        };
      } else if (att && att.url) {
        // If object with url, ensure url starts with /upload/
        let url = att.url;
        if (!url.startsWith("http") && !url.startsWith("/upload/")) {
          url = `/upload/${url}`;
        }
        return {
          url,
          name: att.name || url.split("/").pop(),
        };
      }
      // Fallback empty object if invalid
      return {};
    }).filter(att => att.url && att.name); // filter out invalid

    const messageData = {
      users: [from, to],
      sender: from,
      message: { text: msgText || "" },
      attachments: normalizedAttachments,
    };

    const savedMsg = await Messages.create(messageData);

    // Send message to receiver
    const receiverSocket = onlineUsers.get(to);
    if (receiverSocket) {
      io.to(receiverSocket).emit("msg-receive", {
        from: savedMsg.sender,
        msgText: savedMsg.message.text,
        attachments: savedMsg.attachments,
      });
    }

    // Confirm to sender
    socket.emit("msg-sent", savedMsg);
  } catch (err) {
    console.error("❌ Error saving message:", err);
  }
});
  // --- WebRTC signaling ---
  socket.on("webrtc-offer", ({ from, to, offer, isVideoCall, callerName }) => {
  const targetSocket = onlineUsers.get(to);
  if (targetSocket) {
    io.to(targetSocket).emit("webrtc-offer", { 
      from, 
      to, 
      offer, 
      isVideoCall: isVideoCall || false,
      callerName: callerName || "Unknown"
    });
    console.log(`📡 Forwarded ${isVideoCall ? 'video' : 'audio'} call offer from ${from} -> ${to}`);
  } else {
    console.warn(`⚠️ Offer target ${to} not online`);
    socket.emit("webrtc-error", { type: "offer", to, message: "User not available" });
  }
});

socket.on("webrtc-answer", ({ from, to, answer }) => {
  const targetSocket = onlineUsers.get(to);
  if (targetSocket) {
    io.to(targetSocket).emit("webrtc-answer", { from, to, answer });
    console.log(`📡 Forwarded answer from ${from} -> ${to}`);
  } else {
    console.warn(`⚠️ Answer target ${to} not online`);
    socket.emit("webrtc-error", { type: "answer", to, message: "User not available" });
  }
});

socket.on("webrtc-ice", ({ from, to, candidate }) => {
  const targetSocket = onlineUsers.get(to);
  if (targetSocket) {
    io.to(targetSocket).emit("webrtc-ice", { from, to, candidate });
    console.log(`📡 Forwarded ICE candidate from ${from} -> ${to}`);
  } else {
    console.warn(`⚠️ ICE target ${to} not online`);
    socket.emit("webrtc-error", { type: "ice", to, message: "User not available" });
  }
});

socket.on("webrtc-end", ({ from, to }) => {
  const targetSocket = onlineUsers.get(to);
  if (targetSocket) {
    io.to(targetSocket).emit("webrtc-end", { from, to });
    console.log(`📡 Call ended from ${from} -> ${to}`);
  } else {
    console.warn(`⚠️ End target ${to} not online`);
    socket.emit("webrtc-error", { type: "end", to, message: "User not available" });
  }
});
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on PORT ${PORT}`));
