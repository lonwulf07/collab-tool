const mongoose = require("mongoose");

// Define the structure of a chat message
const messageSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: false,
    },
    imageUrl: {
      type: String,
      required: false,
    },
    senderId: {
      type: String,
      required: true,
    },
    room: {
      type: String,
      default: "general",
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  // This automatically adds 'createdAt' and 'updatedAt' timestamps to every document
  { timestamps: true },
);

module.exports = mongoose.model("Message", messageSchema);
