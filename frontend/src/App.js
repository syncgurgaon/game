import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import Room from "@/pages/Room";
import { AudioProvider } from "@/context/AudioContext";
import AudioToggle from "@/components/AudioToggle";

function App() {
  return (
    <AudioProvider>
      <div className="App min-h-screen">
        <BrowserRouter>
          <AudioToggle />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:code" element={<Room />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#FFFDF9",
              border: "3px solid #1A1A1A",
              borderRadius: "12px",
              boxShadow: "4px 4px 0px #1A1A1A",
              fontFamily: "Nunito, sans-serif",
              fontWeight: 700,
              color: "#1A1A1A",
            },
          }}
        />
      </div>
    </AudioProvider>
  );
}

export default App;
