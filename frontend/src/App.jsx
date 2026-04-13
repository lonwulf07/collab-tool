import { useState, useEffect } from "react";
import io from "socket.io-client";
import Auth from "./components/Auth";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const socket = io(BACKEND_URL, { autoConnect: false });
const CHANNELS = ["general", "frontend", "backend", "random"];

function App() {
  const [hasJoined, setHasJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [currentRoom, setCurrentRoom] = useState("general");

  const [chatFeed, setChatFeed] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUsername = localStorage.getItem("username");

    const verifySession = async () => {
      if (token && savedUsername) {
        try {
          const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
          const res = await fetch(`${BACKEND_URL}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: savedUsername, token }),
          });

          const data = await res.json();

          if (data.valid) {
            // User exists and token is good! Let them in.
            socket.auth = { token };
            socket.connect();
            setUsername(savedUsername);
            setHasJoined(true);
            socket.emit("join_room", "general");
          } else {
            // User was deleted or token expired. Clear the ghost session.
            handleLogout();
          }
        } catch (err) {
          console.error("Session verification failed", err);
          handleLogout();
        }
      }
    };

    verifySession();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    socket.disconnect();
    setHasJoined(false);
    setChatFeed([]);
    setActiveUsers([]);
  };

  const switchRoom = (roomName) => {
    if (currentRoom === roomName) return;
    setCurrentRoom(roomName);
    setChatFeed([]);
    socket.emit("join_room", roomName);
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    socket.on("chat_history", (history) => setChatFeed(history));

    socket.on("receive_message", (data) => {
      // Note: We don't set local state for our own messages here anymore,
      // they are appended by the server broadcast to ensure order,
      // or you can handle optimistic UI updates in ChatArea.
      setChatFeed((prev) => [...prev, data]);
      if (
        document.hidden &&
        data.senderId !== username &&
        Notification.permission === "granted"
      ) {
        new Notification(`New message from ${data.senderId}`, {
          body: data.text,
        });
      }
    });

    socket.on("message_edited", ({ id, newText }) => {
      setChatFeed((prev) =>
        prev.map((msg) =>
          msg.id === id ? { ...msg, text: newText, isEdited: true } : msg,
        ),
      );
    });

    socket.on("message_deleted", (id) => {
      setChatFeed((prev) => prev.filter((msg) => msg.id !== id));
    });

    socket.on("active_users", (users) => setActiveUsers(users));

    socket.on("user_typing", (user) => {
      setTypingUsers((prev) => (!prev.includes(user) ? [...prev, user] : prev));
    });

    socket.on("user_stopped_typing", (user) => {
      setTypingUsers((prev) => prev.filter((u) => u !== user));
    });

    socket.on("connect_error", (err) => {
      handleLogout();
      alert("Session expired. Please log in again.");
    });

    return () => {
      socket.off("chat_history");
      socket.off("receive_message");
      socket.off("active_users");
      socket.off("user_typing");
      socket.off("user_stopped_typing");
      socket.off("connect_error");
      socket.off("message_edited");
      socket.off("message_deleted");
    };
  }, [username]);

  if (!hasJoined) {
    return (
      <Auth
        socket={socket}
        setUsername={setUsername}
        setHasJoined={setHasJoined}
      />
    );
  }

  return (
    <div className="app-container">
      {isMobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      <Sidebar
        username={username}
        activeUsers={activeUsers}
        currentRoom={currentRoom}
        switchRoom={switchRoom}
        handleLogout={handleLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        channels={CHANNELS}
      />

      <ChatArea
        socket={socket}
        username={username}
        currentRoom={currentRoom}
        chatFeed={chatFeed}
        activeUsers={activeUsers}
        typingUsers={typingUsers}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
    </div>
  );
}

export default App;
