export const characterColor = (characterId: string) => {
    let h = 0;
    for (const c of characterId) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h}, 65%, 62%)`;
};
