import { useState } from 'react';
import { errorMessage } from '../../api/errorMessage';

type TOptions = {
    canSubmit?: boolean;
    toError?: (e: unknown) => string;
};

export const useDialogSubmit = (
    action: () => Promise<void>,
    { canSubmit = true, toError = errorMessage }: TOptions = {}
) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [touched, setTouched] = useState(false);

    const submit = async () => {
        setTouched(true);
        if (!canSubmit || busy) return;
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (e) {
            setError(toError(e));
        } finally {
            setBusy(false);
        }
    };

    return { busy, error, touched, submit, setError };
};
