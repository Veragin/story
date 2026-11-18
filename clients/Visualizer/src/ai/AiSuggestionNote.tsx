import { ListItem, ListItemText } from '@mui/material';

type TProps = {
    text: string;
};

export const AiSuggestionNote = ({ text }: TProps) => (
    <ListItem dense role="presentation">
        <ListItemText secondary={text} />
    </ListItem>
);
