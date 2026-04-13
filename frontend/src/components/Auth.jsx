import { useState } from "react";

const Auth = ({ socket, setUsername, setHasJoined }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState({ type: "", text: "" });

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthMessage({ type: "", text: "" });

    if (!authUsername.trim() || !authPassword.trim()) {
      return setAuthMessage({
        type: "error",
        text: "Please fill in all fields.",
      });
    }

    const endpoint = isLoginMode ? "/login" : "/register";

    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return setAuthMessage({
          type: "error",
          text: data.message || data.error,
        });
      }

      if (isLoginMode) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);

        socket.auth = { token: data.token };
        socket.connect();

        socket.emit("join_room", "general");

        setUsername(data.username);
        setHasJoined(true);

        if ("Notification" in window) Notification.requestPermission();
      } else {
        setIsLoginMode(true);
        setAuthPassword("");
        setAuthMessage({
          type: "success",
          text: "Account created! Please log in.",
        });
      }
    } catch (err) {
      setAuthMessage({ type: "error", text: "Server connection failed." });
    }
  };

  return (
    <div className="join-container">
      <form className="join-card" onSubmit={handleAuth}>
        <h1>{isLoginMode ? "Welcome Back" : "Create Account"}</h1>

        {authMessage.text && (
          <div
            className={
              authMessage.type === "error" ? "auth-error" : "auth-success"
            }
          >
            {authMessage.text}
          </div>
        )}

        <input
          type="text"
          placeholder="Username"
          value={authUsername}
          onChange={(e) => setAuthUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={authPassword}
          onChange={(e) => setAuthPassword(e.target.value)}
        />

        <button type="submit" className="btn-primary">
          {isLoginMode ? "Secure Login" : "Register"}
        </button>

        <div className="auth-toggle">
          {isLoginMode
            ? "Don't have an account? "
            : "Already have an account? "}
          <span
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setAuthMessage({ type: "", text: "" });
            }}
          >
            {isLoginMode ? "Register" : "Login"}
          </span>
        </div>
      </form>
    </div>
  );
};

export default Auth;
