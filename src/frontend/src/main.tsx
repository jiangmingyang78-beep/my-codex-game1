import ReactDOM from "react-dom/client";
import App from "./App";
import { loadGameData } from "./core/gameData";
import "./index.css";

loadGameData();
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
