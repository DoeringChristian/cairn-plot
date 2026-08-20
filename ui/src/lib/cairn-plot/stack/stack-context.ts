import { createContext } from "react";

/**
 * `true` for a subtree rendered inside a STACKED grid. A compare cell reads this
 * to move its slide-flip onto Shift+←/→ (and Shift+h/l), so plain arrows/hjkl
 * stay reserved for the stack's tab navigation — no key collision.
 */
export const InStackedGridContext = createContext(false);

/**
 * `true` for a subtree rendered inside a STACKED grid whose children ALSO include
 * a `compare` node (a mixed `[image, diff]`-style stack). A plain IMAGE leaf reads
 * this to RESERVE the compare chrome slots (the MODE menu, the second-row EV/OFF
 * sliders, the caption/metrics chip containers) so that flipping the stacked tab
 * image↔diff — which reuses ONE pane — never mounts/unmounts chrome (the residual
 * popping the present-coherency guard did not cover). A compare child ignores it
 * (it renders the real chrome). Default `false` outside such a stack — plain
 * images then keep today's chrome exactly.
 */
export const StackHasCompareContext = createContext(false);
