import React from 'react';
import {
    Button,
    Typography,
    Divider,
    Tooltip,
} from '@mui/material';
import { Chapter } from '@mui/icons-material';
import { Agent } from 'code/Visualizer/stores/Agent';
import { useChapterForm } from './hooks/useChapterForm';
import { BasicInfoSection } from './components/BasicInfoSection';
import { LocationSection } from './components/LocationSection';
import { TimeRangeSection } from './components/TimeRangeSection';
import { ChildrenSection } from './components/ChildrenSection';
import { SFormContainer, SHeader, SFormContent, SButtonRow } from './styles';

type Props = {
    onChapterCreated?: (chapterId: string) => void;
    onCancel?: () => void;
    agent: Agent;
};

export const ChapterCreationForm = ({ onChapterCreated, onCancel, agent }: Props) => {
    const {
        formData,
        chapterId,
        existingChapterIds,
        isSubmitting,
        setChapterId,
        handleInputChange,
        handleTimeRangeChange,
        handleSubmit,
        handleReset,
    } = useChapterForm(agent);

    return (
        <SFormContainer>
            <SHeader>
                <Tooltip title="Chapters are containers for passages and define game timeline" arrow>
                    <Typography variant="h6" component="h2" sx={{ cursor: 'help', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chapter fontSize="small" />
                        {_('Create New Chapter')}
                    </Typography>
                </Tooltip>
            </SHeader>

            <SFormContent>
                <BasicInfoSection
                    chapterId={chapterId}
                    setChapterId={setChapterId}
                    formData={formData}
                    handleInputChange={handleInputChange}
                    existingChapterIds={existingChapterIds}
                />

                <Divider sx={{ my: 2 }} />

                <LocationSection
                    value={formData.location}
                    onChange={(location) => handleInputChange('location', location)}
                />

                <Divider sx={{ my: 2 }} />

                <TimeRangeSection
                    value={formData.timeRange}
                    onChange={handleTimeRangeChange}
                />

                <Divider sx={{ my: 2 }} />

                <ChildrenSection
                    value={formData.children}
                    onChange={(children) => handleInputChange('children', children)}
                    existingChapterIds={existingChapterIds}
                />

                <SButtonRow>
                    <Button
                        variant="outlined"
                        onClick={handleReset}
                        disabled={isSubmitting}
                        size="small"
                        sx={{ fontSize: '0.8rem' }}
                    >
                        {_('Reset')}
                    </Button>
                    {onCancel && (
                        <Button
                            variant="outlined"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            size="small"
                            sx={{ fontSize: '0.8rem' }}
                        >
                            {_('Cancel')}
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        onClick={() => handleSubmit(onChapterCreated)}
                        disabled={isSubmitting}
                        color="primary"
                        size="small"
                        sx={{ fontSize: '0.8rem' }}
                    >
                        {isSubmitting ? _('Creating...') : _('Create Chapter')}
                    </Button>
                </SButtonRow>
            </SFormContent>
        </SFormContainer>
    );
};
