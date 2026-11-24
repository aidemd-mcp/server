import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App/index.js";

// The observer's HTML shell always carries #root; a page without it is not this page's to render.
const root = document.getElementById("root");
if (root === null) throw new Error("The observer page needs a #root element to mount into.");
createRoot(root).render(<App />);
