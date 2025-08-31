const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    message: { text: { type: String, required: false } }, // can be empty for attachments
    users: Array, // [from, to]
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    encryptionKey: String,
    attachments: [
      {
        url: String,
        originalName: String,
        mimeType: String,
        size: Number,
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Messages", messageSchema);
