import { createRoot } from "react-dom/client";
import App from "./App";
import { initSentry, initCspReporter } from "./lib/sentry";
import "./index.css";

initSentry("ashford-admin");
initCspReporter("ashford-admin");

createRoot(document.getElementById("root")!).render(<App />);
