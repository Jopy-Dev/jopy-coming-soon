// Route inventory: every SCREEN-### defined exactly once, with states and evidence method.
export interface RouteEntry {
  readonly screenId: `SCREEN-${string}`;
  readonly path: string;
  readonly expectedStatus: number;
  readonly roles: readonly string[];
  readonly deniedRoles: readonly string[];
  readonly states: readonly string[];
  readonly criticality: "standard" | "critical";
  readonly evidence: "automated" | "manual";
}

export const ROUTES: readonly RouteEntry[] = [
  {
    screenId: "SCREEN-001",
    path: "/",
    expectedStatus: 200,
    roles: ["Visitor"],
    deniedRoles: [],
    states: ["default", "js-disabled", "reduced-motion", "mobile-375", "tablet-768", "desktop-1280"],
    criticality: "critical",
    evidence: "automated",
  },
  {
    screenId: "SCREEN-002",
    path: "/this-page-does-not-exist",
    expectedStatus: 404,
    roles: ["Visitor"],
    deniedRoles: [],
    states: ["default"],
    criticality: "standard",
    evidence: "automated",
  },
];

/** Primary journey: visitor lands, reads hero, reaches portfolio/social links. Runs on chromium + firefox + webkit (tag @critical). */
export const criticalJourneys = ["landing renders + outbound links reachable"] as const;

export const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 667 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
] as const;

export const routeFor = (screenId: RouteEntry["screenId"]): RouteEntry => {
  const route = ROUTES.find((r) => r.screenId === screenId);
  if (!route) throw new Error(`No route for ${screenId}`);
  return route;
};
