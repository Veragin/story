import { useState } from 'react';
import { AddButton } from '../../../../components/buttons/AddButton';
import { isCode, type TLinkDto, type TMaybeCode } from '@story/protocol';
import { CodeBlock } from '../CodeBlock';
import { DiagnosticsList } from '../../../../components/feedback/DiagnosticsList';
import { FormSection } from '../../../../components/form/FormSection';
import { LinkEditor } from './LinkEditor';
import { linkHasDiagnostics } from './linkSummary';
import { LinkSummary } from './LinkSummary';
import { replaceAt } from './listUtils';
import { SLink } from './styles';
import type { TDiag, TOptionsProps } from './types';

type TProps = TOptionsProps & {
    value: TMaybeCode<TLinkDto[]> | undefined;
    onChange: (value: TMaybeCode<TLinkDto[]> | undefined) => void;
    path: string;
    diag: TDiag;
};

export const Links = ({
    value,
    onChange,
    path,
    diag,
    passageOptions,
    itemOptions,
}: TProps) => {
    const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
    if (value === undefined) {
        return (
            <AddButton
                label={_('Links')}
                tone="inherit"
                onClick={() => onChange([])}
                sx={{ alignSelf: 'flex-start' }}
            />
        );
    }
    if (isCode(value)) {
        return (
            <FormSection title={_('Links (code)')}>
                <CodeBlock
                    code={value.code}
                    onChange={(code) => onChange({ code })}
                    diagnostics={diag(path)}
                    ariaLabel={_('Links code')}
                />
            </FormSection>
        );
    }
    const add = () => {
        setOpen((o) => new Set(o).add(value.length));
        onChange([
            ...value,
            { text: '', passageId: passageOptions[0]?.id ?? '' },
        ]);
    };
    const remove = (j: number) => {
        // the open set is keyed by index: the links after `j` move up by one
        setOpen(
            (o) =>
                new Set(
                    [...o]
                        .filter((k) => k !== j)
                        .map((k) => (k > j ? k - 1 : k))
                )
        );
        onChange(value.filter((_x, k) => k !== j));
    };
    const toggle = (j: number) =>
        setOpen((o) => {
            const next = new Set(o);
            if (!next.delete(j)) next.add(j);
            return next;
        });
    return (
        <FormSection title={_('Links')}>
            <DiagnosticsList diagnostics={diag(path)} />
            {value.map((link, j) => {
                const linkPath = `${path}.${j}`;
                const hasError = linkHasDiagnostics(diag, linkPath);
                const expanded = hasError || open.has(j);
                return (
                    <SLink
                        key={j}
                        data-expanded={expanded ? 'true' : undefined}
                    >
                        <LinkSummary
                            link={link}
                            itemOptions={itemOptions}
                            expanded={expanded}
                            hasError={hasError}
                            onToggle={() => toggle(j)}
                            onRemove={() => remove(j)}
                        />
                        {expanded && (
                            <LinkEditor
                                link={link}
                                path={linkPath}
                                onChange={(next) =>
                                    onChange(replaceAt(value, j, next))
                                }
                                diag={diag}
                                passageOptions={passageOptions}
                                itemOptions={itemOptions}
                            />
                        )}
                    </SLink>
                );
            })}
            <AddButton
                label={_('Add link')}
                tone="inherit"
                onClick={add}
                sx={{ alignSelf: 'flex-start' }}
            />
        </FormSection>
    );
};
