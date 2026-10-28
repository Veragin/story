import AddIcon from '@mui/icons-material/Add';
import { ActionButton, type TActionButtonProps } from './ActionButton';

type TProps = Omit<TActionButtonProps, 'label'> & { label?: string };

export const AddButton = ({ label = _('Add'), ...rest }: TProps) => (
    <ActionButton {...rest} label={label} icon={AddIcon} />
);
