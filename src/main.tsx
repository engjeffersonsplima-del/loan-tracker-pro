import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize app
const rootEl = document.getElementById("root")!;
const root = createRoot(rootEl);
root.render(<App />);
