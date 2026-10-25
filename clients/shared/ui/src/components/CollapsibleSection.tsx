import { useState, type ReactNode } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Stack,
    Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';

type TProps = {
    title: string;
    summary?: ReactNode;
    children: ReactNode;
    expanded?: boolean;
    defaultExpanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
};

export const CollapsibleSection = ({
    title,
    summary,
    children,
    expanded,
    defaultExpanded = false,
    onExpandedChange,
}: TProps) => {
    const [ownExpanded, setOwnExpanded] = useState(defaultExpanded);
    const isExpanded = expanded ?? ownExpanded;

    const toggle = (_event: unknown, next: boolean) => {
        setOwnExpanded(next);
        onExpandedChange?.(next);
    };

    return (
        <Accordion
            expanded={isExpanded}
            onChange={toggle}
            disableGutters
            variant="outlined"
        >
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack
                    direction="row"
                    spacing={2}
                    alignItems="baseline"
                    sx={{ minWidth: 0 }}
                >
                    <Typography sx={{ flexShrink: 0 }}>{title}</Typography>
                    {!isExpanded && summary && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            noWrap
                        >
                            {summary}
                        </Typography>
                    )}
                </Stack>
            </AccordionSummary>
            <AccordionDetails>{children}</AccordionDetails>
        </Accordion>
    );
};
