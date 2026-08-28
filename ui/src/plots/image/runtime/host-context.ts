import { createContext } from "react";

export interface ImageHostRuntime {
  readonly enlargeControl?: {
    readonly enlarged: boolean;
    readonly setEnlarged: (value: boolean) => void;
  };
}

/** Transient host services kept outside semantic image presentation. */
export const ImageHostRuntimeContext = createContext<ImageHostRuntime>({});
