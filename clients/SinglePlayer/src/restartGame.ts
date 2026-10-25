import type { Engine } from '@story/core';

// the Engine loads the save in its constructor: a fresh start needs a fresh page
export const restartGame = (e: Engine) => {
    if (!window.confirm(_('Start a new game? Your saved game will be lost.'))) return;
    e.clearStateFromLocalStorage();
    window.location.reload();
};
