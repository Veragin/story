import { useState, type ReactNode } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Stack,
    styled,
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
                <SSummary direction="row" spacing={2} alignItems="baseline">
                    <STitle>{title}</STitle>
                    {!isExpanded && summary && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            noWrap
                        >
                            {summary}
                        </Typography>
                    )}
                </SSummary>
            </AccordionSummary>
            <AccordionDetails>{children}</AccordionDetails>
        </Accordion>
    );
};

const SSummary = styled(Stack)`
    min-width: 0;
`;

const STitle = styled(Typography)`
    flex-shrink: 0;
`;
