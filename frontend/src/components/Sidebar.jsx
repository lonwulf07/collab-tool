import { getAvatarColor } from "../utils/helpers";

const Sidebar = ({
  username,
  activeUsers,
  currentRoom,
  switchRoom,
  handleLogout,
  isMobileMenuOpen,
  channels,
}) => {
  return (
    <div className={`sidebar ${isMobileMenuOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <h2>Collab Space</h2>
        <div className="status-badge">🟢 {activeUsers.length} Online</div>
        <button className="btn-logout" onClick={handleLogout}>
          Log Out
        </button>
      </div>

      <div className="channel-list">
        <h3>Channels</h3>
        {channels.map((channel) => (
          <div
            key={channel}
            className={`channel-item ${currentRoom === channel ? "active" : ""}`}
            onClick={() => switchRoom(channel)}
          >
            # {channel}
          </div>
        ))}
      </div>

      <div className="user-list">
        <h3>Active Members</h3>
        {activeUsers.map(([id, name], index) => (
          <div key={index} className="user-item">
            <div
              className="avatar"
              style={{ backgroundColor: getAvatarColor(name) }}
            >
              {name.charAt(0).toUpperCase()}
              <div className="online-indicator"></div>
            </div>
            {name === username ? `${name} (You)` : name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
