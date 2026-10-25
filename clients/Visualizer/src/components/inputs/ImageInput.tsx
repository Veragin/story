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
import DeleteIcon from '@mui/icons-material/Delete';
import NotesIcon from '@mui/icons-material/Notes';
import ImageIcon from '@mui/icons-material/Image';
import {
    MAX_IMAGE_BYTES,
    type TImageDto,
    type TImageOwner,
    type TMaybeCode,
} from '@story/protocol';
import { spacingCss } from '@story/ui';
import { api as defaultApi, ApiError, type TVisualizerApi } from '../../api';
import { modals } from '../../shell';
import { StringInput } from './StringInput';

type TProps = {
    owner: TImageOwner;
    id: string;
    description?: TMaybeCode<string>;
    onDescriptionChange?: (value: string) => void;
    onChange?: (image: TImageDto) => void;
    hasError?: boolean;
    disabled?: boolean;
    api?: TVisualizerApi;
};

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
    onChange,
    hasError,
    disabled,
    api = defaultApi,
}: TProps) => {
    const [image, setImage] = useState<TImageDto | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDescription, setShowDescription] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    // a late response for a previous owner is dropped
    const current = useRef({ owner, id });
    current.current = { owner, id };

    useEffect(() => {
        let alive = true;
        setImage(null);
        setError(null);
        setBusy(false);
        setShowDescription(false);
        const load = async () => {
            try {
                const dto = await api.getImage(owner, id);
                if (alive) setImage(dto);
            } catch (e) {
                if (alive) setError(e instanceof Error ? e.message : String(e));
            }
        };
        void load();
        return () => {
            alive = false;
        };
    }, [api, owner, id]);

    const save = async (
        send: () => Promise<TImageDto>,
        staleMessage: string
    ) => {
        const alive = () =>
            current.current.owner === owner && current.current.id === id;
        setBusy(true);
        try {
            const saved = await send();
            if (alive()) {
                setImage(saved);
                setShowDescription(false);
                onChange?.(saved);
            }
        } catch (e) {
            if (!alive()) return;
            if (e instanceof ApiError && e.isStale && e.current) {
                setImage(e.current as TImageDto);
                setError(staleMessage);
            } else {
                setError(e instanceof Error ? e.message : String(e));
            }
        } finally {
            if (alive()) setBusy(false);
        }
    };

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
        await save(
            async () =>
                api.uploadImage(owner, id, {
                    version: image?.version ?? '',
                    data: await readBase64(file),
                }),
            _('The image changed on disk. Upload again to replace it.')
        );
    };

    const remove = async () => {
        if (!image?.url) return;
        const confirmed = await modals.confirm({
            title: _('Remove image?'),
            message: _('This deletes %s.', image.file),
            danger: true,
            confirmLabel: _('Remove'),
        });
        if (!confirmed) return;
        setError(null);
        await save(
            () => api.deleteImage(owner, id, { version: image.version }),
            _(
                'The image changed on disk. Remove it again if you still want to.'
            )
        );
    };

    const pick = () => input.current?.click();
    const text = typeof description === 'string' ? description : '';
    const loading = !image && !error;

    const descriptionEditor = onDescriptionChange && (
        <StringInput
            value={description ?? ''}
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
            {loading ? (
                <Typography variant="body2" color="text.secondary">
                    {_('Loading…')}
                </Typography>
            ) : image?.url ? (
                <SFrame data-view={showDescription ? 'description' : 'image'}>
                    {showDescription && descriptionEditor ? (
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
                        <Tooltip title={_('Remove image')}>
                            <span>
                                <SOverlayButton
                                    size="small"
                                    aria-label={_('Remove image')}
                                    data-action="remove-image"
                                    disabled={disabled || busy}
                                    onClick={() => void remove()}
                                >
                                    <DeleteIcon fontSize="small" />
                                </SOverlayButton>
                            </span>
                        </Tooltip>
                        {descriptionEditor && (
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
                                    onClick={() =>
                                        setShowDescription((v) => !v)
                                    }
                                >
                                    {showDescription ? (
                                        <ImageIcon fontSize="small" />
                                    ) : (
                                        <NotesIcon fontSize="small" />
                                    )}
                                </SOverlayButton>
                            </Tooltip>
                        )}
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
        </SField>
    );
};

const SField = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    width: 100%;
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
