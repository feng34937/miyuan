import { languageReady } from './language';
import { Component } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./original.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="error-overlay">
          <div>
            <h1>LET’S RECONNECT.</h1>
            <p>
              The arena ran into an unexpected problem. Your saved career is
              safe.
            </p>
            <button
              className="primary-button"
              onClick={() => location.reload()}
            >
              RELOAD WINDWARD
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

void languageReady.then(() => { createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
); });

import './language.css';
