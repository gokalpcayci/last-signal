/**
 * When the layout switches from the overlay dashboard to the stacked, scrollable
 * one. Keep in sync with the matching @media rule in index.css.
 * Phones, short landscape screens and portrait tablets get the stacked layout.
 */
export const STACKED_QUERY = '(max-width: 760px), (max-height: 520px), (orientation: portrait) and (max-width: 1100px)'
