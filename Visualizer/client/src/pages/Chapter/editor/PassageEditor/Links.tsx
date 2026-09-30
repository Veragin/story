import { useState } from 'react';
import { Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import {
    isCode,
    type TLinkDto,
    type TMaybeCode,
} from '@story/visualizer-protocol';
import { CodeBlock } from '../CostField';
import { ItemDiagnostics } from './ItemDiagnostics';
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

/**
 * A body item's links: a "+ Links" button when there are none, a code block, or the list. Each
 * link is a `LinkSummary` line, expanded to its `LinkEditor` on demand (local state keyed by
 * index); a new link starts expanded and a link with diagnostics is always expanded.
 */
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
            <Button
                size="small"
                color="inherit"
                startIcon={<AddIcon fontSize="small" />}
                onClick={() => onChange([])}
                sx={{ alignSelf: 'flex-start' }}
            >
                {_('Links')}
            </Button>
        );
    }
    if (isCode(value)) {
        return (
            <>
                <Typography variant="caption" color="text.secondary">
                    {_('Links (code)')}
                </Typography>
                <CodeBlock
                    code={value.code}
                    onChange={(code) => onChange({ code })}
                    diagnostics={diag(path)}
                />
            </>
        );
    }
    const add = () => {
        setOpen((o) => new Set(o).add(value.length)); // a new link starts expanded
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
        <>
            <ItemDiagnostics diagnostics={diag(path)} />
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
            <Button
                size="small"
                color="inherit"
                startIcon={<AddIcon fontSize="small" />}
                onClick={add}
                sx={{ alignSelf: 'flex-start' }}
            >
                {_('Add link')}
            </Button>
        </>
    );
};
