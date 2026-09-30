import { useEffect, useRef, useState } from 'react';
import {
    Button,
    CircularProgress,
    IconButton,
    styled,
    Tooltip,
    Typography,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import NotesIcon from '@mui/icons-material/Notes';
import ImageIcon from '@mui/icons-material/Image';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
    MAX_IMAGE_BYTES,
    type TDiagnosticDto,
    type TImageDto,
    type TImageOwner,
    type TMaybeCode,
} from '@story/visualizer-protocol';
import { spacingCss } from '@story/ui';
import { api as defaultApi, ApiError, type TVisualizerApi } from '../api';
import { FieldDiagnostics } from './CodeField';
import { PlainTextInput } from './PlainTextField';

type TProps = {
    owner: TImageOwner;
    /** A full passage id, or a character / npc id. */
    id: string;
    /** The owner's `image` field: a text description of the picture (its alt text too). */
    description: TMaybeCode<string> | undefined;
    onDescriptionChange: (value: string) => void;
    /** Diagnostics of the `image` field. */
    diagnostics?: TDiagnosticDto[];
    disabled?: boolean;
    api?: TVisualizerApi;
};

/** A file's content, base64 without the `data:…;base64,` prefix. */
const readBase64 = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
            resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
        reader.onerror = () =>
            reject(reader.error ?? new Error('Could not read the file'));
        reader.readAsDataURL(file);
    });

export const ImageInput = ({
    owner,
    id,
    description,
    onDescriptionChange,
    diagnostics = [],
    disabled,
    api = defaultApi,
}: TProps) => {
    const [image, setImage] = useState<TImageDto | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDescription, setShowDescription] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    /** The owner shown now: a late upload response for another one is dropped. */
    const current = useRef({ owner, id });
    current.current = { owner, id };

    useEffect(() => {
        let alive = true;
        setImage(null);
        setError(null);
        setBusy(false);
        setShowDescription(false);
        api.getImage(owner, id).then(
            (dto) => alive && setImage(dto),
            (e) => alive && setError((e as Error).message)
        );
        return () => {
            alive = false;
        };
    }, [api, owner, id]);

    const upload = async (file: File) => {
        setError(null);
        if (file.type !== 'image/png') {
            setError(_('Only PNG images can be uploaded.'));
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setError(
                _(
                    'The image is larger than %s MB.',
                    String(MAX_IMAGE_BYTES / 1024 / 1024)
                )
            );
            return;
        }
        const alive = () =>
            current.current.owner === owner && current.current.id === id;
        setBusy(true);
        try {
            const data = await readBase64(file);
            const saved = await api.uploadImage(owner, id, {
                version: image?.version ?? '',
                data,
            });
            if (alive()) {
                setImage(saved);
                setShowDescription(false);
            }
        } catch (e) {
            if (!alive()) return;
            if (e instanceof ApiError && e.isStale && e.current) {
                // someone replaced it meanwhile: show theirs, let the author decide again
                setImage(e.current as TImageDto);
                setError(
                    _('The image changed on disk. Upload again to replace it.')
                );
            } else {
                setError((e as Error).message);
            }
        } finally {
            if (alive()) setBusy(false);
        }
    };

    const pick = () => input.current?.click();
    const hasError = diagnostics.length > 0;
    const text = typeof description === 'string' ? description : '';
    const loading = !image && !error;

    const descriptionEditor = (
        <PlainTextInput
            value={description}
            onChange={onDescriptionChange}
            multiline
            hasError={hasError}
            disabled={disabled}
            placeholder={_('What the picture shows')}
            ariaLabel={_('Image description')}
            dataField="image-description"
        />
    );

    const uploadIcon = busy ? <CircularProgress size={14} /> : <UploadIcon />;

    return (
        <SField>
            <SHeader>
                <Typography
                    variant="caption"
                    color={hasError ? 'error' : 'text.secondary'}
                >
                    {_('Image')}
                </Typography>
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
            </SHeader>

            {loading ? (
                <Typography variant="body2" color="text.secondary">
                    {_('Loading…')}
                </Typography>
            ) : image?.url ? (
                <SFrame data-view={showDescription ? 'description' : 'image'}>
                    {showDescription ? (
                        descriptionEditor
                    ) : (
                        <SImg
                            src={image.url}
                            alt={text || _('Image of %s', id)}
                            title={image.file}
                        />
                    )}
                    <SOverlay data-overlay>
                        <Tooltip title={_('Replace image (PNG only)')}>
                            <span>
                                <SOverlayButton
                                    size="small"
                                    aria-label={_('Replace image')}
                                    data-action="replace-image"
                                    disabled={disabled || busy}
                                    onClick={pick}
                                >
                                    {busy ? (
                                        <CircularProgress size={16} />
                                    ) : (
                                        <UploadIcon fontSize="small" />
                                    )}
                                </SOverlayButton>
                            </span>
                        </Tooltip>
                        <Tooltip
                            title={
                                showDescription
                                    ? _('Show image')
                                    : _('Show description')
                            }
                        >
                            <SOverlayButton
                                size="small"
                                aria-label={
                                    showDescription
                                        ? _('Show image')
                                        : _('Show description')
                                }
                                aria-pressed={showDescription}
                                data-action="toggle-description"
                                onClick={() => setShowDescription((v) => !v)}
                            >
                                {showDescription ? (
                                    <ImageIcon fontSize="small" />
                                ) : (
                                    <NotesIcon fontSize="small" />
                                )}
                            </SOverlayButton>
                        </Tooltip>
                    </SOverlay>
                </SFrame>
            ) : (
                <>
                    {descriptionEditor}
                    <SRow>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={uploadIcon}
                            disabled={disabled || busy || !image}
                            data-action="upload-image"
                            onClick={pick}
                        >
                            {_('Upload image')}
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                            {image
                                ? _('PNG only (%s)', image.file)
                                : _('PNG only')}
                        </Typography>
                    </SRow>
                </>
            )}

            <input
                ref={input}
                type="file"
                accept="image/png"
                hidden
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void upload(file);
                }}
            />
            {error && (
                <Typography variant="caption" color="error">
                    {error}
                </Typography>
            )}
            <FieldDiagnostics diagnostics={diagnostics} />
        </SField>
    );
};

const SField = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    width: 100%;
`;

const SHeader = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(0.5)};
    min-height: 28px;
`;

const SInfo = styled(InfoOutlinedIcon)`
    color: ${({ theme }) => theme.palette.text.secondary};
    font-size: 14px;
    cursor: help;
`;

const SRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
`;

const SOverlay = styled('div')`
    position: absolute;
    top: ${spacingCss(0.5)};
    right: ${spacingCss(0.5)};
    display: flex;
    gap: ${spacingCss(0.5)};
    opacity: 0;
    transition: opacity 120ms;
`;

/**
 * The image (or the description in its place) with the overlay buttons in the top-right
 * corner. They show on hover, on keyboard focus inside the frame, always on touch devices
 * (no hover there), and always in the description view (the way back to the image).
 */
const SFrame = styled('div')`
    position: relative;
    align-self: flex-start;
    max-width: 100%;
    &[data-view='description'] {
        align-self: stretch;
        padding-top: 36px;
    }
    &:hover > [data-overlay],
    &:focus-within > [data-overlay],
    &[data-view='description'] > [data-overlay] {
        opacity: 1;
    }
    @media (hover: none) {
        & > [data-overlay] {
            opacity: 1;
        }
    }
`;

const SOverlayButton = styled(IconButton)`
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    &:hover {
        background: rgba(0, 0, 0, 0.8);
    }
`;

const SImg = styled('img')`
    display: block;
    max-width: 100%;
    max-height: 240px;
    object-fit: contain;
    border-radius: 4px;
`;
