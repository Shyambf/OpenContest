import { Outlet } from "react-router";
import { Navigation } from "./Navigation";

export function Root() {
  return (
    <div className="min-h-screen bg-[#323437]">
      <Navigation />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
