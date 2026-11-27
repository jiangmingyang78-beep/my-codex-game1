import ReactDOM from "react-dom/client";
import App from "./App";
import { loadGameData } from "./core/gameData";
import "./index.css";

import { loadSurvivalTuning } from "./systems/survivalTuning";
loadGameData().balance.survival = await loadSurvivalTuning();
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
