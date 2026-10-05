import { useState, type ReactNode } from 'react';
import { StructureContext, type IStructureContext } from '../structureContext';
import { sampleStructure } from '../playground/sampleStructure';

export const InStructure = ({
    structure = sampleStructure(),
    children,
}: {
    structure?: IStructureContext;
    children: ReactNode;
}) => (
    <StructureContext.Provider value={structure}>
        {children}
    </StructureContext.Provider>
);

type THarnessProps<T> = {
    initial: T;
    onChange: (value: T) => void;
    children: (value: T, onChange: (value: T) => void) => ReactNode;
};

/** Holds the value like a form would, and reports every change. */
export const Controlled = <T,>({
    initial,
    onChange,
    children,
}: THarnessProps<T>) => {
    const [value, setValue] = useState(initial);
    return children(value, (next) => {
        onChange(next);
        setValue(next);
    });
};
