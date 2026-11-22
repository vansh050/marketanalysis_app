// Broker picker tiles: 4 per row, 3 on narrow phones. Tile height follows its
// content (logo box + up to two lines of name), so nothing spills out of the
// card whatever the screen width or the phone's font size (2026-11-22: the old
// fixed square tiles pushed logos out on 360–393dp phones).
export const GRID_SIDE_PADDING = 20;
export const GRID_GAP = 10;

export const brokerGridLayout = windowWidth => {
    const columns = windowWidth < 380 ? 3 : 4;
    const inner = windowWidth - GRID_SIDE_PADDING * 2;
    const tileWidth = Math.floor((inner - GRID_GAP * (columns - 1)) / columns);
    return { columns, tileWidth };
};
