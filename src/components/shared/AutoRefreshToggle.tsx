import { useAutoRefresh } from "../../AutoRefreshContext";
import Icon from "../ui/Icon";
import "./AutoRefreshToggle.css";

export default function AutoRefreshToggle() {
  const { enabled, setEnabled } = useAutoRefresh();

  return (
    <div className="auto-refresh">
      <label className="auto-refresh-label" htmlFor="autoRefreshToggle">
        <Icon name="arrow-repeat" size={17} className="auto-refresh-icon" />
        Auto Refresh
        <span className={`auto-refresh-status ${enabled ? "on" : ""}`}>{enabled ? "ON" : "OFF"}</span>
      </label>
      <input
        id="autoRefreshToggle"
        className="auto-refresh-switch"
        type="checkbox"
        role="switch"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
      />
    </div>
  );
}
