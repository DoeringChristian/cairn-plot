import { createContext, useContext } from "react";

import type { PlotSessionController } from "./PlotSessionController.ts";

export const PlotSessionContext = createContext<PlotSessionController | null>(null);

export function usePlotSessionController(): PlotSessionController | null {
  return useContext(PlotSessionContext);
}
