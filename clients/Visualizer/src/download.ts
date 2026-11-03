import { baseName } from '@story/shared';

export const downloadFile = (url: string, file: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = baseName(file);
    anchor.click();
};
