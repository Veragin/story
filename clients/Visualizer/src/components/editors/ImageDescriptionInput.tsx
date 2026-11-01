import { useRef, useState, type KeyboardEvent } from 'react';
import {
    MenuItem,
    MenuList,
    Paper,
    Popper,
    styled,
    TextField,
} from '@mui/material';
import { IMAGE_LINK_PREFIX, imageLinkPath, relativePath } from '@story/shared';
import { spacingCss } from '@story/ui';
import type { TStoryImageFile } from '../../api';
import { INPUT_DEFAULTS } from '../inputs/inputDefaults';
import { inputSlotProps } from '../inputs/inputSlotProps';
import type { TInputProps } from '../inputs/inputTypes';

type TProps = TInputProps<string> & {
    files: readonly TStoryImageFile[];
    fromDir: string;
    placeholder?: string;
};

type THint = { link: string; url: string };

const hintsFor = (
    files: readonly TStoryImageFile[],
    fromDir: string,
    value: string
): THint[] => {
    const query = imageLinkPath(value)?.toLowerCase();
    if (query === undefined) return [];
    return files
        .map(({ file, url }) => ({ path: relativePath(fromDir, file), url }))
        .filter(({ path }) => path.toLowerCase().includes(query))
        .map(({ path, url }) => ({ link: `${IMAGE_LINK_PREFIX}${path}`, url }));
};

export const ImageDescriptionInput = ({
    value,
    onChange,
    files,
    fromDir,
    placeholder,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => {
    const field = useRef<HTMLDivElement>(null);
    const [focused, setFocused] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [highlighted, setHighlighted] = useState(0);

    const hints = hintsFor(files, fromDir, value);
    const exact = hints.length === 1 && hints[0].link === value;
    const open = focused && !dismissed && hints.length > 0 && !exact;
    const active = Math.min(highlighted, hints.length - 1);

    const pick = (link: string) => {
        onChange(link);
        setDismissed(true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (!open) return;
        const move = (by: number) => {
            e.preventDefault();
            setHighlighted((active + by + hints.length) % hints.length);
        };
        if (e.key === 'ArrowDown') move(1);
        else if (e.key === 'ArrowUp') move(-1);
        else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            pick(hints[active].link);
        } else if (e.key === 'Escape') {
            // the hints consume Escape, so an enclosing dialog stays open
            e.stopPropagation();
            setDismissed(true);
        }
    };

    return (
        <>
            <TextField
                {...INPUT_DEFAULTS}
                ref={field}
                multiline
                minRows={2}
                value={value}
                error={hasError}
                disabled={disabled}
                placeholder={placeholder}
                slotProps={inputSlotProps(
                    { ariaLabel, dataField },
                    { 'aria-autocomplete': 'list', 'aria-expanded': open }
                )}
                onChange={(e) => {
                    onChange(e.target.value);
                    setDismissed(false);
                    setHighlighted(0);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={onKeyDown}
            />
            <SPopper
                open={open}
                anchorEl={field.current}
                placement="bottom-start"
                style={{ width: field.current?.clientWidth }}
            >
                <Paper elevation={8}>
                    <SList dense>
                        {hints.map(({ link, url }, i) => (
                            <SHint
                                key={link}
                                selected={i === active}
                                data-option={link}
                                // keeps the focus in the field, so it does not blur and close the hints
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pick(link)}
                            >
                                <SThumb src={url} alt="" />
                                {link}
                            </SHint>
                        ))}
                    </SList>
                </Paper>
            </SPopper>
        </>
    );
};

const SPopper = styled(Popper)`
    z-index: ${({ theme }) => theme.zIndex.modal + 1};
`;

const SList = styled(MenuList)`
    max-height: 320px;
    overflow: auto;
`;

const SHint = styled(MenuItem)`
    gap: ${spacingCss(1)};
    white-space: normal;
    word-break: break-all;
`;

const SThumb = styled('img')`
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 2px;
`;
