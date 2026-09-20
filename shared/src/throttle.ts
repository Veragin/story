import { getUniqueId } from './misc';

export const debounce = <T>(cb: (...args: T[]) => void, timeout = 300, callOnStart = false) => {
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;

    return (...args: T[]) => {
        if (timer !== undefined) {
            clearTimeout(timer);
        } else if (callOnStart) {
            cb(...args);
        }

        timer = setTimeout(() => {
            cb(...args);
            timer = undefined;
        }, timeout);
    };
};

export const throttle = <T>(cb: (...args: T[]) => void, delay = 100) => {
    let shouldWait = false;
    let waitingArgs: T[] | null = null;

    const timeoutFunc = () => {
        if (waitingArgs === null) {
            shouldWait = false;
        } else {
            cb(...waitingArgs);
            waitingArgs = null;
            setTimeout(timeoutFunc, delay);
        }
    };

    return (...args: T[]) => {
        if (shouldWait) {
            waitingArgs = args;
            return;
        }

        cb(...args);
        shouldWait = true;

        setTimeout(timeoutFunc, delay);
    };
};

/**
 * This function can synchronize multiple requests to call given function
 * first requests will be called immediately, all next requests, called during processing the first one, will wait until the first finishes.
 *
 * after first requests finishes:
 *
 *  => if there was no other requests called, it will return gained value
 *  => otherwise the first requests is canceled, the last called requests starts the process
 *      and others requests will be canceled
 *
 *
 * requests can be interapted by RequestCanceledError that means that request was canceled
 *
 * @param call async function that needs to be synchronized
 * @param name function name (used in RequestCanceledError)
 * @param destruct function called if call was called but request was canceled on the end
 * @returns output from call function
 */
export const synchronize = <Input extends unknown[], Output>(
    call: (...args: Input) => Promise<Output>,
    name: string = call.name,
    destruct?: (o: Output) => Promise<void> | void
) => {
    let lastId: number | null = null;
    let lastPromise: Promise<Output> | null = null;

    const doSynchronize = async (id: number, ...args: Input): Promise<Output> => {
        if (lastId !== id) {
            throw new RequestCanceledError(name);
        }

        if (lastPromise !== null) {
            await lastPromise;
            return await doSynchronize(id, ...args);
        }

        lastPromise = call(...args);
        const data = await lastPromise;
        lastPromise = null;

        if (lastId !== id) {
            await destruct?.(data);
            throw new RequestCanceledError(name);
        }

        return data;
    };

    return (...args: Input) => {
        const id = getUniqueId();
        lastId = id;

        return doSynchronize(id, ...args);
    };
};

export class RequestCanceledError extends Error {
    constructor(functionName: string) {
        super(`The request to call ${functionName} was terminated.`);
    }
}
