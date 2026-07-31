import "./Spinner.css";

interface SpinnerProps {
  show: boolean;
  withCard?: boolean;   // true = زي epSpinner (كارت + نص)
  text?: string;
}

export default function Spinner({
  show,
  withCard = false,
  text = "Please wait…",
}: SpinnerProps) {
  if (!show) return null;

  if (withCard) {
    return (
      <div className="spinner-u-overlay card">
        <div className="spinner-u-card">
          <div className="spinner-u-ring" />
          <p className="spinner-u-card-text">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="spinner-u-overlay plain">
      <div className="spinner-u-ring" />
    </div>
  );
}