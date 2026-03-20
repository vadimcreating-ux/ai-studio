import { Outlet } from "react-router-dom";
import TopNav from "./TopNav";

export default function AppLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base text-white">
      <div className="shrink-0">
        <TopNav />
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
