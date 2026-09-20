import { createWorldState } from 'code/utils/createWorldState';
import { register } from 'data/register';
import { itemInfo } from 'data/items/itemInfo';

/** The SingleEngine app's world state instance. Other apps build their own. */
export const { s, e } = createWorldState(register, itemInfo);

window.s = s;
window.e = e;

void e.handleAutoStart();
