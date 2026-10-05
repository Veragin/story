import { styled, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { ComponentProps } from 'react';
import type { TDiagnosticDto } from '@story/visualizer-protocol';
import { ImageInput } from '../ImageInput';
import { FormLabel } from './FormLabel';

type TProps = Omit<ComponentProps<typeof ImageInput>, 'hasError'> & {
    diagnostics?: TDiagnosticDto[];
};

export const FormImageInput = ({ diagnostics = [], ...props }: TProps) => (
    <FormLabel
        label={_('Image')}
        diagnostics={diagnostics}
        actions={
            <Tooltip
                title={_(
                    'An upload is written right away. The description is written on Save.'
                )}
            >
                <SInfo
                    tabIndex={0}
                    aria-hidden={false}
                    aria-label={_('About saving the image')}
                />
            </Tooltip>
        }
    >
        <ImageInput {...props} hasError={diagnostics.length > 0} />
    </FormLabel>
);

const SInfo = styled(InfoOutlinedIcon)`
    color: ${({ theme }) => theme.palette.text.secondary};
    font-size: 14px;
    cursor: help;
`;
