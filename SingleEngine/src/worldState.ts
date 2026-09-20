import { createWorldState } from '@story/core';
import { itemInfo, register } from '@story/data';

/** The SingleEngine app's world state instance. Other apps build their own. */
export const { s, e } = createWorldState(register, itemInfo);

window.s = s;
window.e = e;

void e.handleAutoStart();
