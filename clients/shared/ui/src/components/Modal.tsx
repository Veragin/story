import {
    Modal as MuiModal,
    ModalProps,
    styled,
    IconButton,
} from '@mui/material';
import { Column, Row } from './Basic';
import { Close } from '@mui/icons-material';
import { spacingCss } from './css';

type Props = Omit<ModalProps, 'onClose'> & {
    title: string;
    onClose: () => void;
};

export const Modal = ({ title, onClose, children, ...rest }: Props) => {
    return (
        <MuiModal {...rest} onClose={onClose}>
            <SCont>
                <SHeader>
                    <STitle>{title}</STitle>
                    <IconButton
                        onClick={onClose}
                        component="button"
                        size="small"
                        color="inherit"
                    >
                        <Close />
                    </IconButton>
                </SHeader>
                <SBody>{children}</SBody>
            </SCont>
        </MuiModal>
    );
};

const SCont = styled(Column)`
    position: absolute;
    overflow: hidden;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(800px, 92vw);
    max-height: 85vh;
    background-color: #2a2a2a;
    border-radius: 12px;
    gap: ${spacingCss(2)};
    align-items: stretch;
    border: 1px solid #1b5e20;
`;

const SHeader = styled(Row)`
    flex-shrink: 0;
    background-color: #1b5e20;
    padding: ${spacingCss(1.5)} ${spacingCss(2)};
    justify-content: space-between;
    align-items: center;
    color: white;
`;

const STitle = styled('span')`
    font-size: 26px;
    font-weight: 500;
    line-height: 1.2;
`;

const SBody = styled(Column)`
    padding: ${spacingCss(2)};
    gap: ${spacingCss(1)};
    flex: 1;
    min-height: 0;
    overflow: auto;
`;
