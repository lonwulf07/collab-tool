# Collab Tool 💬

A full-stack, real-time communication platform engineered with the MERN stack and Socket.io. Designed with a focus on low-latency bidirectional messaging, robust state management, and a highly polished, responsive UI.

**[🚀 View Live Project](https://collab-tool-ten.vercel.app/)** | **[🔗 API Endpoint](https://collab-tool-tr6b.onrender.com)**

## 🏗️ Architecture & Tech Stack

**Frontend:**
* **React (Vite):** Optimized for fast HMR and lightweight bundle sizes.
* **Socket.io-client:** Handles real-time event listening and optimistic UI updates.
* **CSS3:** Custom, dependency-free styling featuring a refined dark-mode aesthetic and fully responsive mobile layouts.
* **React Markdown & Syntax Highlighter:** Parses code blocks and markdown for developer-friendly communication.

**Backend:**
* **Node.js & Express:** RESTful architecture for authentication and media upload routes.
* **Socket.io:** Manages WebSocket connections, room segmentation, and real-time broadcasting.
* **MongoDB & Mongoose:** NoSQL database modeling for users, persistent chat histories, and mutable messages.
* **Cloudinary & Multer:** Secure middleware for parsing, uploading, and serving user-generated images.
* **JWT & Bcrypt:** Stateless, encrypted authentication flow.

## ✨ Core Features

* **Real-Time WebSocket Rooms:** Users can instantly join segmented channels (`#general`, `#frontend`, etc.) without dropping connection or refreshing.
* **Message Mutability:** Complete CRUD capabilities on live messages. Users can edit or delete their sent messages, broadcasting the changes to all active clients instantly.
* **Cross-Channel Referencing:** Users can generate unique "magic links" for messages. Pasting these links dynamically fetches and renders a rich preview card of the original message across any channel.
* **Cloud Asset Management:** Direct image uploads to Cloudinary, rendering secure URLs seamlessly into the chat feed alongside markdown text.
* **Rich UI/UX:** Features include live typing indicators, online/offline user status tracking, dynamic emoji pickers, and local image previews prior to upload.

## 🚀 Local Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/lonwulf07/collab-tool.git
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   ```
   *Create a `.env` file in the backend directory:*
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_string
   JWT_SECRET=your_jwt_secret
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
   *Start the server:*
   ```bash
   npm run dev
   ```

3. **Frontend Setup:**
   ```bash
   cd ../frontend
   npm install
   ```
   *Create a `.env` file in the frontend directory:*
   ```env
   VITE_BACKEND_URL=http://localhost:5000
   ```
   *Start the client:*
   ```bash
   npm run dev
   ```

## 🧠 Technical Challenges Solved

* **Race Conditions in State:** Handled complex React state updates where real-time socket events (edits/deletions) clashed with asynchronous database fetches, ensuring the UI remained perfectly synchronized with the server truth.
* **Mobile-First Real-Time UI:** Built a custom sidebar overlay system that handles viewport constraints without disrupting the active WebSocket connection or losing chat scroll position.