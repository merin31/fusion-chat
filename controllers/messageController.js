const Messages = require("../models/messageModel");
const crypto = require("crypto");

const encryptionsKey = process.env.ENCRYPTION_KEY;

module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to } = req.body;

    // Retrieve messages from the database
    const messages = await Messages.find({
      users: {
        $all: [from, to],
      },
    }).sort({ updatedAt: 1 });

    // Decrypt and project messages
    const decryptedMessages = [];
    const decryptionKeyMap = new Map(); // Map to store decryption keys

    // Decrypt each message
    for (const msg of messages) {
      // Retrieve the encryption key for this message
      const encryptionKey = msg.encryptionKey;

      // Create an AES decipher with the encryption key
      const decipher = crypto.createDecipher(
        "aes-128-cbc",
        Buffer.from(encryptionKey, "base64")
      );

      // Decrypt the message text
      let decryptedMessage = decipher.update(
        msg.message.text,
        "base64",
        "utf8"
      );
      decryptedMessage += decipher.final("utf8");

      // Add the decrypted message to the result
      decryptedMessages.push({
        fromSelf: msg.sender.toString() === from,
        message: decryptedMessage,
      });
    }

    res.json(decryptedMessages);
  } catch (ex) {
    next(ex);
  }
};

module.exports.addMessage = async (req, res, next) => {
  try {
    const { from, to, message } = req.body;

    // Generate a random encryption key (you may want to store and manage these keys securely)
    const encryptionKey = crypto.randomBytes(16); // 128-bit key for AES-128

    // Create an AES cipher with the generated key
    const cipher = crypto.createCipher("aes-128-cbc", encryptionKey);

    // Encrypt the message text
    let encryptedMessage = cipher.update(message, "utf8", "base64");
    encryptedMessage += cipher.final("base64");

    const data = await Messages.create({
      message: { text: encryptedMessage },
      users: [from, to],
      sender: from,
      encryptionKey: encryptionKey.toString("base64"), // Store the key (base64 encoded) for decryption
    });

    if (data) return res.json({ msg: "Message added successfully." });
    else return res.json({ msg: "Failed to add message to the database" });
  } catch (ex) {
    next(ex);
  }
};

module.exports.showEncryptedMessages = async (req, res, next) => {
  try {
    const { from, to } = req.body;

    // Retrieve encrypted messages from the database
    const messages = await Messages.find({
      users: {
        $all: [from, to],
      },
    }).sort({ updatedAt: 1 });

    // Project only the encrypted messages
    const encryptedMessages = messages.map((msg) => {
      return {
        fromSelf: msg.sender.toString() === from,
        message: msg.message.text,
        encryptionKey: msg.encryptionKey,
      };
    });

    res.json(encryptedMessages);
  } catch (ex) {
    next(ex);
  }
};
