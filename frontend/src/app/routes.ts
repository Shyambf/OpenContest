import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Dashboard } from "./components/Dashboard";
import { ProblemView } from "./components/ProblemView";
import { Standings } from "./components/Standings";
import { Profile } from "./components/Profile";
import { Gym } from "./components/Gym";
import { Auth } from "./components/Auth";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminOverview } from "./components/admin/AdminOverview";
import { ContestList } from "./components/admin/ContestList";
import { HybridContestEditor } from "./components/admin/HybridContestEditor";
import { EnhancedProblemBank } from "./components/admin/EnhancedProblemBank";
import { AdvancedProblemEditor } from "./components/admin/AdvancedProblemEditor";
import { SubmissionControl } from "./components/admin/SubmissionControl";
import { Clarifications } from "./components/admin/Clarifications";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Auth,
  },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "contests", Component: Dashboard },
      { path: "gym", Component: Gym },
      { path: "problem/:contestId/:problemId", Component: ProblemView },
      { path: "standings/:contestId", Component: Standings },
      { path: "profile/:username", Component: Profile },
    ],
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: AdminOverview },
      { path: "contests", Component: ContestList },
      { path: "contests/new", Component: HybridContestEditor },
      { path: "contests/:id/edit", Component: HybridContestEditor },
      { path: "problems", Component: EnhancedProblemBank },
      { path: "problems/new", Component: AdvancedProblemEditor },
      { path: "problems/:id/edit", Component: AdvancedProblemEditor },
      { path: "submissions", Component: SubmissionControl },
      { path: "clarifications", Component: Clarifications },
    ],
  },
]);
