const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

require("dotenv").config();

const Message = require("./models/Message");

const app = express();

app.use(
  cors({
    origin: "*", // Allows requests from any frontend domain
    methods: ["GET", "POST"],
  }),
);

app.use(express.json());

// Create an HTTP server wrapping the Express app
const server = http.createServer(app);

// Initialize Socket.io and configure CORS for the frontend
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB 🍃"))
  .catch((err) => console.error("MongoDB connection error:", err));

//Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "collab-space", // The folder name inside your Cloudinary account
    allowed_formats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

const upload = multer({ storage: storage });

// --- REST API AUTHENTICATION ROUTES ---

// REGISTER ROUTE
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "Username already taken." });

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save to DB
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User created successfully." });
  } catch (error) {
    res.status(500).json({ error: "Error registering user." });
  }
});

// LOGIN ROUTE
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Invalid credentials." });

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials." });

    // Generate JWT Token
    const token = jwt.sign(
      { username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.status(200).json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: "Error logging in." });
  }
});

// TOKEN VERIFICATION ROUTE
app.post("/verify", async (req, res) => {
  try {
    const { username, token } = req.body;

    // 1. Check if the token is mathematically valid and not expired
    jwt.verify(token, process.env.JWT_SECRET);

    // 2. Check if the user STILL exists in the database
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ valid: false }); // User was deleted!
    }

    res.status(200).json({ valid: true });
  } catch (err) {
    // If token is expired or manipulated, it throws an error and lands here
    res.status(401).json({ valid: false });
  }
});

// --- IMAGE UPLOAD ROUTE ---
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }
  // If successful, Cloudinary puts the secure URL right here in req.file.path
  res.status(200).json({ imageUrl: req.file.path });
});

// Using a Set prevents duplicate socket IDs
const connectedUsers = new Map();

// --- SOCKET.IO AUTHENTICATION MIDDLEWARE ---
io.use((socket, next) => {
  // The frontend will send the token in the socket handshake
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error: No token provided."));
  }

  // Verify the token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error("Authentication error: Invalid token."));
    }

    // If valid, attach the verified username to the socket object!
    socket.username = decoded.username;
    next();
  });
});

// Listen for client connections
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id} as ${socket.username}`);

  // 1. Add to global active users
  connectedUsers.set(socket.id, socket.username);
  io.emit("active_users", Array.from(connectedUsers.entries()));

  // --- NEW: ROOM LOGIC ---
  socket.on("join_room", async (room) => {
    // Leave any previous rooms (except their own default socket ID room)
    Array.from(socket.rooms).forEach((r) => {
      if (r !== socket.id) socket.leave(r);
    });

    // Join the new room
    socket.join(room);
    console.log(`${socket.username} joined room: ${room}`);

    // Fetch chat history ONLY for this specific room
    try {
      const messages = await Message.find({ room })
        .sort({ createdAt: 1 })
        .limit(50);
      const formattedHistory = messages.map((msg) => ({
        id: msg._id,
        text: msg.text,
        imageUrl: msg.imageUrl,
        senderId: msg.senderId,
        isEdited: msg.isEdited,
        timestamp: new Date(msg.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
      socket.emit("chat_history", formattedHistory);
    } catch (err) {
      console.error("Error fetching room history:", err);
    }
  });

  // --- UPDATED: SEND MESSAGES TO SPECIFIC ROOMS ---
  socket.on("send_message", async (data) => {
    try {
      const newMessage = new Message({
        text: data.text || "",
        imageUrl: data.imageUrl,
        senderId: data.senderId,
        room: data.room, // Save the room to the database
      });
      const savedMessage = await newMessage.save();

      const finalMessage = {
        id: savedMessage._id,
        text: savedMessage.text,
        imageUrl: savedMessage.imageUrl,
        senderId: savedMessage.senderId,
        room: savedMessage.room,
        isEdited: savedMessage.isEdited,
        timestamp: new Date(savedMessage.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      io.to(data.room).emit("receive_message", finalMessage);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("edit_message", async ({ id, newText, room }) => {
    try {
      await Message.findByIdAndUpdate(id, { text: newText, isEdited: true });
      io.to(room).emit("message_edited", { id, newText });
    } catch (err) {
      console.error("Error editing message:", err);
    }
  });

  socket.on("delete_message", async ({ id, room }) => {
    try {
      await Message.findByIdAndDelete(id);
      io.to(room).emit("message_deleted", id);
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  });

  // --- FETCH SINGLE MESSAGE FOR REFERENCES ---
  // The frontend provides the ID, and we use a callback function to send the data back immediately
  socket.on("fetch_single_message", async (id, callback) => {
    try {
      const msg = await Message.findById(id);
      if (msg) {
        callback({
          id: msg._id,
          text: msg.text,
          senderId: msg.senderId,
          room: msg.room,
        });
      } else {
        callback(null); // Message might have been deleted!
      }
    } catch (err) {
      console.error("Error fetching single message:", err);
      callback(null);
    }
  });

  // --- UPDATED: TYPING INDICATORS BY ROOM ---
  socket.on("typing", ({ username, room }) => {
    socket.to(room).emit("user_typing", username);
  });

  socket.on("stop_typing", ({ username, room }) => {
    socket.to(room).emit("user_stopped_typing", username);
  });

  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);
    io.emit("active_users", Array.from(connectedUsers.entries()));
  });
});

const PORT = process.env.PORT || 5000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
