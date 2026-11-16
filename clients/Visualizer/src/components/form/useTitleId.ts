import { useState } from 'react';
import { idFromTitle } from '../../idFromTitle';

export type TTitleId = {
    title: string;
    setTitle: (title: string) => void;
    id: string;
    customId: string | null;
    setCustomId: (id: string | null) => void;
};

export const useTitleId = (fallback: string, isTaken?: (id: string) => boolean): TTitleId => {
    const [title, setTitle] = useState('');
    const [customId, setCustomId] = useState<string | null>(null);
    const generated = title.trim() === '' ? '' : idFromTitle(title, fallback, isTaken);
    return { title, setTitle, id: customId?.trim() ?? generated, customId, setCustomId };
};
