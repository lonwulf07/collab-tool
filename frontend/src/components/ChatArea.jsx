import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { getAvatarColor } from "../utils/helpers";

// --- SUB-COMPONENT: Renders the rich preview card for referenced messages ---
const MessageReference = ({ msgId, socket, isMe }) => {
  const [refData, setRefData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    socket.emit("fetch_single_message", msgId, (data) => {
      setRefData(data);
      setIsLoading(false);
    });
  }, [msgId, socket]);

  if (isLoading)
    return (
      <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
        Loading reference...
      </div>
    );
  if (!refData)
    return (
      <div
        style={{
          fontSize: "0.8rem",
          color: isMe ? "#ffcccc" : "#ef4444",
          fontStyle: "italic",
        }}
      >
        [Original message deleted]
      </div>
    );

  const accentColor = isMe ? "rgba(255, 255, 255, 0.8)" : "var(--accent-solid)";
  const mutedText = isMe ? "rgba(255, 255, 255, 0.7)" : "var(--text-muted)";
  const strongText = isMe ? "#ffffff" : "var(--text-main)";

  return (
    <div
      style={{
        borderLeft: `4px solid ${accentColor}`,
        padding: "10px 14px",
        margin: "8px 0 12px 0",
        background: "rgba(0, 0, 0, 0.2)",
        borderRadius: "4px 8px 8px 4px",
      }}
    >
      <div
        style={{ fontSize: "0.85rem", color: mutedText, marginBottom: "6px" }}
      >
        <span
          style={{ color: accentColor, fontWeight: "bold", marginRight: "6px" }}
        >
          ↳
        </span>
        Replying to{" "}
        <span style={{ color: strongText, fontWeight: "600" }}>
          {refData.senderId}
        </span>{" "}
        in{" "}
        <span style={{ color: strongText, fontWeight: "600" }}>
          #{refData.room}
        </span>
      </div>
      <div
        style={{
          fontSize: "0.9rem",
          color: strongText,
          fontStyle: "italic",
          lineHeight: "1.4",
        }}
      >
        {refData.text.length > 100
          ? refData.text.substring(0, 100) + "..."
          : refData.text}
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const ChatArea = ({
  socket,
  username,
  currentRoom,
  chatFeed,
  activeUsers,
  typingUsers,
  setIsMobileMenuOpen,
}) => {
  // Input States
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // File Upload & Preview States
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Edit States
  const [editingId, setEditingId] = useState(null);
  const [editMessageText, setEditMessageText] = useState("");

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  let typingTimeout = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatFeed]);

  // --- ACTIONS ---

  const handleTyping = (e) => {
    setMessage(e.target.value);
    socket.emit("typing", { username, room: currentRoom });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(
      () => socket.emit("stop_typing", { username, room: currentRoom }),
      2000,
    );
  };

  const onEmojiClick = (emojiObject) => {
    setMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // NEW: Handle File Selection (Generates Local Preview Only)
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file)); // Create a fast, local preview link

    // Reset the input value so the user can select the same file again if they cancel
    if (fileInputRef.current) fileInputRef.current.value = "";
    inputRef.current?.focus(); // Bring focus back to the text area
  };

  // NEW: Cancel Upload
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // UPDATED: Send Message now handles both text and the pending file
  const sendMessage = async () => {
    // Prevent sending if everything is empty
    if (message.trim() === "" && !selectedFile) return;

    let uploadedImageUrl = null;

    // If there is an image in the preview, upload it to Cloudinary first
    if (selectedFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("image", selectedFile);

      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
        const res = await fetch(`${BACKEND_URL}/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (data.imageUrl) {
          uploadedImageUrl = data.imageUrl;
        }
      } catch (err) {
        alert("Image upload failed. Please try again.");
        setIsUploading(false);
        return; // Stop the send process if upload fails
      }
    }

    // Now send the socket message with the text AND the new image URL (if one exists)
    const messageData = {
      text: message.trim(),
      imageUrl: uploadedImageUrl,
      senderId: username,
      room: currentRoom,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    socket.emit("send_message", messageData);
    socket.emit("stop_typing", { username, room: currentRoom });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    // Clear everything out
    setMessage("");
    setShowEmojiPicker(false);
    clearSelectedFile();
    setIsUploading(false);
  };

  const startEditing = (msg) => {
    setEditingId(msg.id);
    setEditMessageText(msg.text);
  };

  const submitEdit = () => {
    if (editMessageText.trim() !== "") {
      socket.emit("edit_message", {
        id: editingId,
        newText: editMessageText,
        room: currentRoom,
      });
      setEditingId(null);
    }
  };

  const deleteMessage = (id) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      socket.emit("delete_message", { id, room: currentRoom });
    }
  };

  const copyMessageLink = (roomId, msgId) => {
    const refString = `ref:${roomId}:${msgId}`;
    navigator.clipboard
      .writeText(refString)
      .then(() =>
        alert(
          "Message link copied! Paste it in any channel to reference this message.",
        ),
      );
  };

  // --- RENDER ---
  return (
    <div className="chat-area">
      <div className="chat-header">
        <button
          className="mobile-menu-btn"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          ☰
        </button>
        <h2># {currentRoom}</h2>
      </div>

      <div className="chat-feed">
        {chatFeed.map((msg, index) => {
          const isMe = msg.senderId === username;
          const isSenderOnline = activeUsers.some(
            ([id, name]) => name === msg.senderId,
          );

          return (
            <div
              key={index}
              className={`message-wrapper ${isMe ? "sent" : "received"}`}
            >
              <div className="message-info">
                {!isMe && (
                  <div
                    className="avatar"
                    style={{
                      width: "20px",
                      height: "20px",
                      fontSize: "0.6rem",
                      backgroundColor: getAvatarColor(msg.senderId),
                    }}
                  >
                    {msg.senderId.charAt(0).toUpperCase()}
                    {isSenderOnline && (
                      <div
                        className="online-indicator"
                        style={{ width: "6px", height: "6px" }}
                      ></div>
                    )}
                  </div>
                )}
                {isMe ? "You" : msg.senderId} • {msg.timestamp}
              </div>

              <div
                className="message-bubble"
                style={{ position: "relative" }}
                onMouseEnter={(e) => {
                  const actions = e.currentTarget.querySelector(".msg-actions");
                  if (actions) actions.style.display = "flex";
                }}
                onMouseLeave={(e) => {
                  const actions = e.currentTarget.querySelector(".msg-actions");
                  if (actions) actions.style.display = "none";
                }}
              >
                {editingId === msg.id ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <textarea
                      value={editMessageText}
                      onChange={(e) => setEditMessageText(e.target.value)}
                      className="chat-input"
                      style={{ minHeight: "60px", padding: "8px" }}
                      autoFocus
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          background: "transparent",
                          color: "var(--text-muted)",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitEdit}
                        style={{
                          background: "var(--success)",
                          color: "white",
                          border: "none",
                          padding: "4px 12px",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.imageUrl && (
                      <div style={{ marginTop: msg.text ? "10px" : "0" }}>
                        <img
                          src={msg.imageUrl}
                          alt="Uploaded content"
                          style={{
                            maxWidth: "100%",
                            maxHeight: "300px",
                            borderRadius: "8px",
                            cursor: "pointer",
                          }}
                          onClick={() => window.open(msg.imageUrl, "_blank")}
                        />
                      </div>
                    )}

                    {msg.text &&
                      msg.text
                        .split(/(ref:[a-zA-Z0-9_-]+:[a-zA-Z0-9]+)/)
                        .map((part, i) => {
                          if (part.startsWith("ref:")) {
                            const [, , referencedId] = part.split(":");
                            return (
                              <MessageReference
                                key={i}
                                msgId={referencedId}
                                socket={socket}
                                isMe={isMe}
                              />
                            );
                          }

                          return part.trim() ? (
                            <ReactMarkdown
                              key={i}
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({
                                  node,
                                  inline,
                                  className,
                                  children,
                                  ...props
                                }) {
                                  const match = /language-(\w+)/.exec(
                                    className || "",
                                  );
                                  return !inline && match ? (
                                    <SyntaxHighlighter
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, "")}
                                    </SyntaxHighlighter>
                                  ) : (
                                    <code
                                      style={{
                                        background: "rgba(0,0,0,0.1)",
                                        padding: "2px 4px",
                                        borderRadius: "4px",
                                        fontFamily: "monospace",
                                      }}
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                },
                              }}
                            >
                              {part}
                            </ReactMarkdown>
                          ) : null;
                        })}

                    {msg.isEdited && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: isMe
                            ? "rgba(255,255,255,0.6)"
                            : "var(--text-muted)",
                          display: "block",
                          marginTop: "4px",
                          fontStyle: "italic",
                        }}
                      >
                        (edited)
                      </span>
                    )}

                    <div
                      className="msg-actions"
                      style={{
                        display: "none",
                        position: "absolute",
                        top: "-15px",
                        right: "10px",
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        padding: "4px",
                        gap: "8px",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.5)",
                        zIndex: 10,
                      }}
                    >
                      <button
                        onClick={() => copyMessageLink(currentRoom, msg.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                        title="Copy Link"
                      >
                        🔗
                      </button>
                      {isMe && (
                        <>
                          <button
                            onClick={() => startEditing(msg)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.9rem",
                            }}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.9rem",
                            }}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area" style={{ position: "relative" }}>
        {typingUsers.length > 0 && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#94a3b8",
              marginBottom: "10px",
              fontStyle: "italic",
              animation: "fadeIn 0.3s",
            }}
          >
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.join(", ")} are typing...`}
          </div>
        )}

        {/* NEW: Image Preview Box */}
        {previewUrl && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: "20px",
              marginBottom: "15px",
              background: "var(--bg-panel)",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              zIndex: 10,
            }}
          >
            <div style={{ position: "relative" }}>
              <img
                src={previewUrl}
                alt="Preview"
                style={{ maxHeight: "150px", borderRadius: "4px" }}
              />
              <button
                onClick={clearSelectedFile}
                style={{
                  position: "absolute",
                  top: "-10px",
                  right: "-10px",
                  background: "var(--bg-dark)",
                  color: "white",
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                }}
                title="Remove Image"
              >
                ✕
              </button>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedFile.name}
            </span>
          </div>
        )}

        {showEmojiPicker && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              right: "20px",
              marginBottom: "10px",
              zIndex: 100,
            }}
          >
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme={Theme.DARK}
              searchDisabled={false}
            />
          </div>
        )}

        <div
          className="input-container"
          style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}
        >
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileSelect} // UPDATED: Now triggers preview instead of upload
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.4rem",
              cursor: isUploading ? "wait" : "pointer",
              padding: "10px 5px",
              color: "var(--text-muted)",
            }}
            title="Attach Image"
          >
            📎
          </button>

          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={`Message as ${username}... (Shift + Enter for new line)`}
            value={message}
            onChange={handleTyping}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(); // Now handles both text and images seamlessly
              }
            }}
            autoFocus
            rows={1}
            style={{ flexGrow: 1 }}
            disabled={isUploading}
          />

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "10px",
              color: "var(--text-muted)",
            }}
          >
            😀
          </button>

          <button
            className="btn-primary"
            onClick={sendMessage}
            disabled={isUploading}
            style={{ opacity: isUploading ? 0.7 : 1 }}
          >
            {isUploading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
