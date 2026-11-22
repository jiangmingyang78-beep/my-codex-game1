import { GameCanvas } from "./game/GameCanvas";
import { GameUi } from "./game/ui/GameUi";

export default function App() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-night">
      <GameCanvas />
      <GameUi />
    </main>
  );
}
