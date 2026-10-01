import { beforeEach } from 'vitest';
import { installLocalStorageStub } from './support/localStorage';

// a leaked save would silently resume the previous test's game
beforeEach(() => {
    installLocalStorageStub();
});
