import { useEffect, useState } from "react";
import { useInjectedWallet } from "./lib/wallet";
import { WalletContext } from "./lib/wallet-context";
import { Footer, Header } from "./components/Shell";
import Home from "./views/Home";
import Missions from "./views/Missions";
import MissionDetail from "./views/MissionDetail";
import OpenMission from "./views/OpenMission";
import Workbench from "./views/Workbench";
import Certificates from "./views/Certificates";
import Protocol from "./views/Protocol";

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, "") || "/");
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.replace(/^#/, "") || "/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export default function App() {
  const wallet = useInjectedWallet();
  const route = useHashRoute();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [route]);

  let view: React.ReactNode;
  if (route.startsWith("/missions/")) {
    view = <MissionDetail id={decodeURIComponent(route.slice("/missions/".length))} />;
  } else if (route.startsWith("/missions")) {
    view = <Missions />;
  } else if (route.startsWith("/open")) {
    view = <OpenMission />;
  } else if (route.startsWith("/workbench")) {
    view = <Workbench />;
  } else if (route.startsWith("/certificates")) {
    view = <Certificates />;
  } else if (route.startsWith("/protocol")) {
    view = <Protocol />;
  } else {
    view = <Home />;
  }

  return (
    <WalletContext.Provider value={wallet}>
      <div className="field" />
      <Header route={route} />
      <main className="min-h-[70vh]">{view}</main>
      <Footer />
    </WalletContext.Provider>
  );
}
