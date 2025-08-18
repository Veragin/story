export const isPointInside = (point: TPoint, areaPos: TPoint, areaSize: TSize): boolean => {
    return (
        point.x >= areaPos.x &&
        point.x <= areaPos.x + areaSize.width &&
        point.y >= areaPos.y &&
        point.y <= areaPos.y + areaSize.height
    );
};
