import DeleteIcon from '@mui/icons-material/Delete';
import { ActionButton, type TActionButtonProps } from './ActionButton';

type TProps = Omit<TActionButtonProps, 'label'> & { label?: string };

export const DeleteButton = ({ label = _('Delete'), ...rest }: TProps) => (
    <ActionButton {...rest} label={label} icon={DeleteIcon} />
);
