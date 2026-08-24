import { createContext } from "react";

/**
 * `true` for a subtree rendered inside a STACKED grid. A compare cell reads this
 * to move its slide-flip onto Shift+←/→ (and Shift+h/l), so plain arrows/hjkl
 * stay reserved for the stack's tab navigation — no key collision.
 */
export const InStackedGridContext = createContext(false);
