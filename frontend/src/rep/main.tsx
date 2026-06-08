import { createRoot } from "react-dom/client";
import App from "./App";
import { initSentry, initCspReporter } from "./lib/sentry";
import "./index.css";

initSentry("ashford-rep");
initCspReporter("ashford-rep");

createRoot(document.getElementById("root")!).render(<App />);
