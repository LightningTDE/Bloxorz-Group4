/**
 * @file Board.js
 * @description Thực thể logic đại diện cho toàn bộ bàn cờ của màn chơi,
 * quản lý ma trận các ô sàn (tiles), bảng băm tra cứu tọa độ nhanh (spatial hash map),
 * khởi tạo bàn cờ từ dữ liệu JSON, kiểm tra va chạm tiếp đất của khối hộp,
 * điều khiển kích hoạt các công tắc cầu và cập nhật bóng đổ.
 */

import { Tile } from "./Tile.js";
import { GRID_CONFIG, FALL_MAP } from "../utils/Constants.js";

export class Board {
    /**
     * Khởi tạo bàn cờ trống với danh sách ô sàn và bảng tra cứu tọa độ.
     */
    constructor() {
        /**
         * Danh sách toàn bộ các thực thể ô sàn hợp lệ có mặt trên bàn cờ.
         * @type {Tile[]}
         */
        this.tiles = [];

        /**
         * Bảng băm tra cứu nhanh ô sàn theo chuỗi tọa độ "x,y" để đạt độ phức tạp O(1).
         * @type {Map<string, Tile>}
         */
        this.tilesByCoords = new Map();

        /**
         * Tọa độ xuất phát ban đầu của khối hộp trong màn chơi [x, y].
         * @type {number[]}
         */
        this.startPosition = [0, 0];

        /**
         * Mật mã passcode 6 chữ số định danh cho màn chơi này.
         * @type {string}
         */
        this.passcode = "";

        /**
         * Cờ đánh dấu màn chơi này có chứa công tắc phân tách khối 'v' hay không.
         * @type {boolean}
         */
        this.hasSplitSwitch = false;
    }

    // =========================================================================
    // 1. KHỞI TẠO BÀN CỜ TỪ CẤU HÌNH DỮ LIỆU JSON (LEVEL MATRIX INITIALIZATION)
    // =========================================================================

    /**
     * Khởi tạo toàn bộ cấu trúc bàn cờ từ dữ liệu cấu hình màn chơi JSON.
     * Tác dụng: Phân tích lưới ma trận ký tự, tạo thực thể Tile cho từng ô hợp lệ,
     * thiết lập các liên kết công tắc điều khiển cầu và tọa độ phân tách khối.
     *
     * @param {{
     *   level: number,
     *   code: string,
     *   start: number[],
     *   grid: string[],
     *   swatches: Object.<string, Array<[number, number, string]>>,
     *   splits: Object.<string, number[]>
     * }} levelData - Dữ liệu màn chơi đọc từ LevelRepository.
     * @param {((type: string, x: number, y: number) => import("./TileView.js").TileView|null)|null} [tileViewFactory=null] - Hàm tạo View hiển thị cho từng ô sàn.
     * @returns {void}
     */
    initFromLevelData(levelData, tileViewFactory = null) {
        this.clear();

        this.passcode = levelData.code;
        this.startPosition = [...levelData.start];

        const swatches = levelData.swatches || {};
        const splits = levelData.splits || {};

        const rawDoors = [];
        const rawSplits = [];

        // Duyệt toàn bộ lưới 15 cột x 10 hàng từ trên xuống dưới, từ phải sang trái
        for (let y = 0; y < GRID_CONFIG.ROWS; y++) {
            for (let x = GRID_CONFIG.COLS - 1; x >= 0; x--) {
                const type = levelData.grid[y] ? levelData.grid[y][x] : " ";

                // Bỏ qua các vị trí ô trống không có gạch (vực thẳm)
                if (!type || type === " ") continue;

                const tile = new Tile(type, x, y);

                // Gắn View hiển thị đồ họa nếu có factory được cung cấp
                if (tileViewFactory) {
                    const view = tileViewFactory(type, x, y);
                    if (view) {
                        tile.attachView(view);
                    }
                }

                this.tiles.push(tile);
                this.tilesByCoords.set(`${x},${y}`, tile);

                // Lưu tạm các liên kết công tắc để gắn kết tham chiếu ở bước sau
                const swatchKey = `swatch${x}${y}`;
                if (swatches[swatchKey]) {
                    rawDoors.push({ x, y, connections: swatches[swatchKey] });
                }
                if (splits[swatchKey]) {
                    rawSplits.push({ x, y, splitCoords: splits[swatchKey] });
                }
            }
        }

        // Thiết lập tham chiếu targetTile cho các công tắc cầu
        rawDoors.forEach((item) => {
            const switchTile = this.getTileAt(item.x, item.y);
            if (!switchTile) return;

            switchTile.linkedDoors = item.connections.map(([targetX, targetY, actionType]) => {
                const targetTile = this.getTileAt(targetX, targetY);
                return {
                    targetTile: targetTile,
                    type: actionType // 'onoff': đảo trạng thái, 'on': chỉ mở, 'off': chỉ đóng
                };
            });
        });

        // Thiết lập tọa độ sinh khối mới cho công tắc phân tách ('v')
        rawSplits.forEach((item) => {
            const splitTile = this.getTileAt(item.x, item.y);
            if (splitTile) {
                splitTile.linkedSplits = item.splitCoords; // [x1, y1, x2, y2]
                this.hasSplitSwitch = true;
            }
        });
    }

    // =========================================================================
    // 2. TRUY VẤN VÀ KIỂM TRA VA CHẠM TRÊN LƯỚI (SPATIAL QUERIES)
    // =========================================================================

    /**
     * Tra cứu thực thể ô sàn tại tọa độ logic (x, y) trên lưới.
     * Tác dụng: Cung cấp phương thức truy xuất nhanh O(1) qua Map để kiểm tra sàn tại một điểm.
     *
     * @param {number} x - Tọa độ cột trên lưới.
     * @param {number} y - Tọa độ hàng trên lưới.
     * @returns {Tile|null} Trả về đối tượng Tile hoặc null nếu vị trí đó là vực thẳm.
     */
    getTileAt(x, y) {
        return this.tilesByCoords.get(`${x},${y}`) || null;
    }

    /**
     * Kiểm tra xem ô sàn tại tọa độ (x, y) có cho phép khối hộp đứng lên an toàn hay không.
     * Tác dụng: Phục vụ kiểm tra va chạm bước đi, nhận diện vực thẳm hoặc ô cam bị vỡ.
     *
     * @param {number} x - Tọa độ cột.
     * @param {number} y - Tọa độ hàng.
     * @param {string} blockPosition - Tư thế khối ('up', 'long', 'far').
     * @param {boolean} isSmall - True nếu là khối nhỏ 1x1.
     * @returns {boolean|string} True nếu đi được, False nếu vực thẳm/cầu đóng, "square" nếu ô cam vỡ.
     */
    checkTileWalkable(x, y, blockPosition, isSmall) {
        const tile = this.getTileAt(x, y);
        if (!tile) {
            return false; // Ngoài mép sàn -> vực thẳm
        }
        return tile.checkWalkable(blockPosition, isSmall);
    }

    /**
     * Tạo bảng tra cứu ánh xạ các ô sàn phục vụ hệ thống cập nhật mặt nạ bóng đổ (Shadow Mask).
     * Tác dụng: Cung cấp danh sách tọa độ các ô có bề mặt cứng để vẽ bóng đổ đa giác chính xác.
     *
     * @returns {Map<string, { type: string, x: number, y: number, isPassable: boolean }>}
     */
    getTilesMap() {
        const map = new Map();
        for (const [key, tile] of this.tilesByCoords.entries()) {
            map.set(key, {
                type: tile.type,
                x: tile.x,
                y: tile.y,
                isPassable: tile.isDoorOpen !== null ? tile.isDoorOpen : true
            });
        }
        return map;
    }

    /**
     * Lấy danh sách các đối tượng hiển thị kèm tọa độ để phục vụ giải thuật phân chia chiều sâu (Z-order).
     * Tác dụng: Cung cấp thông tin vị trí cho Renderer.sortBlockDepthAmongTiles khi sắp xếp layer khối hộp và các ô sàn.
     *
     * @returns {Array<{ tileClip: createjs.DisplayObject, pos: { x: number, y: number } }>}
     */
    getAllTileViewItems() {
        const items = [];
        for (const tile of this.tiles) {
            if (tile.view && tile.view.tileClip) {
                items.push({
                    tileClip: tile.view.tileClip,
                    pos: { x: tile.x, y: tile.y }
                });
            }
        }
        return items;
    }

    /**
     * Lấy toàn bộ các MovieClip CreateJS của tất cả các ô sàn đang có trên bàn cờ.
     * Tác dụng: Cho phép Renderer thêm hàng loạt ô sàn vào container hiển thị trên Stage.
     *
     * @returns {createjs.DisplayObject[]}
     */
    getAllTileClips() {
        const clips = [];
        for (const tile of this.tiles) {
            if (tile.view && tile.view.tileClip) {
                clips.push(tile.view.tileClip);
            }
        }
        return clips;
    }

    // =========================================================================
    // 3. XỬ LÝ KÍCH HOẠT CÔNG TẮC ĐIỀU KHIỂN CẦU (SWITCH MECHANICS)
    // =========================================================================

    /**
     * Kích hoạt chuyển đổi trạng thái đóng hoặc mở cho toàn bộ các cầu nối liên kết với công tắc.
     * Tác dụng: Thay đổi giá trị boolean `isDoorOpen`, kích hoạt hoạt cảnh animation mở/đóng cầu,
     * đổi màu đèn flasher và gọi callback vẽ lại bóng đổ bàn cờ.
     *
     * @param {Array<{ targetTile: Tile, type: string }>} linkedDoors - Danh sách các ô cầu chịu ảnh hưởng.
     * @param {(() => void)|null} [onShadowUpdateCallback=null] - Callback cập nhật lại mặt nạ bóng đổ.
     * @returns {void}
     */
    triggerSwitches(linkedDoors, onShadowUpdateCallback = null) {
        if (!linkedDoors || linkedDoors.length === 0) return;

        linkedDoors.forEach(({ targetTile, type }) => {
            if (!targetTile) return;

            const currentState = Boolean(targetTile.isDoorOpen);
            let shouldToggle = false;

            // Quy tắc xử lý loại hành động công tắc:
            // 'onoff': Đảo trạng thái hiện tại (đang mở thì đóng, đang đóng thì mở)
            // 'on': Chỉ mở nếu cầu đang ở trạng thái đóng
            // 'off': Chỉ đóng nếu cầu đang ở trạng thái mở
            if (type === "onoff") {
                shouldToggle = true;
            } else if (type === "on" && !currentState) {
                shouldToggle = true;
            } else if (type === "off" && currentState) {
                shouldToggle = true;
            }

            if (shouldToggle) {
                targetTile.isDoorOpen = !currentState;

                // Đồng bộ hóa hoạt cảnh đồ họa của ô cầu và đèn báo flasher
                if (targetTile.view) {
                    targetTile.view.toggleDoorAnimation();
                    targetTile.view.setFlasherState(targetTile.isDoorOpen);
                    if (targetTile.view.tileClip && targetTile.view.tileClip.door) {
                        targetTile.view.tileClip.door.state = targetTile.isDoorOpen;
                        if (!targetTile.isDoorOpen) {
                            targetTile.view.tileClip.door.passable = false;
                        }
                    }
                }
            }
        });

        // Vẽ lại mặt nạ bóng đổ vì hình dạng bàn cờ đã thay đổi sau khi đóng/mở cầu
        if (onShadowUpdateCallback) {
            onShadowUpdateCallback();
        }
    }

    /**
     * Kiểm tra trạng thái tiếp đất toàn diện của khối hộp sau khi hoàn tất một bước lăn.
     * Tác dụng: Phân tích diện tích tiếp xúc của khối với các ô sàn bên dưới:
     * - Xác định xem khối an toàn hay bị rơi vực (ngã hướng nào theo FALL_MAP).
     * - Phát hiện sập ô giòn cam (fallType = "square").
     * - Phát hiện kích hoạt công tắc cầu, công tắc phân tách hoặc hoàn thành màn chơi (lọt hố đích).
     * - Lựa chọn hiệu ứng âm thanh tiếp đất phù hợp.
     *
     * @param {import("./Block.js").Block} block - Thực thể khối hộp đang kiểm tra.
     * @param {string} [rollDirection="up"] - Hướng khối vừa lăn tới.
     * @returns {{
     *   safe: boolean,
     *   fallDirection?: string,
     *   fallType?: string,
     *   position?: string,
     *   sound?: { name: string, label: string, variations?: number },
     *   soundVariation?: string,
     *   variations?: number,
     *   switchDoors?: boolean,
     *   linkedDoors?: Array<{ targetTile: Tile, type: string }>,
     *   split?: boolean,
     *   linkedSplits?: number[],
     *   win?: boolean
     * }}
     */
    checkLand(block, rollDirection = "up") {
        const pos = block.state || block.position || "up";
        const isSmall = Boolean(block.isSmall);
        const x = block.x;
        const y = block.y;

        const tile1 = this.getTileAt(x, y);
        let tile2 = null;

        const land1 = tile1 ? tile1.checkWalkable(pos, isSmall) : false;
        let land2 = false;

        // Nếu chân 1 đứng trên ô cam giòn ở tư thế UP -> ô bị sập vỡ
        if (land1 === "square") {
            return { safe: false, fallType: "square", position: pos };
        }

        // Kiểm tra chân thứ 2 đối với khối lớn ở tư thế nằm (FAR hoặc LONG)
        if (pos === "far" && !isSmall) {
            tile2 = this.getTileAt(x, y - 1);
            land2 = tile2 ? tile2.checkWalkable(pos, isSmall) : false;
        } else if (pos === "long" && !isSmall) {
            tile2 = this.getTileAt(x + 1, y);
            land2 = tile2 ? tile2.checkWalkable(pos, isSmall) : false;
        }

        if (land2 === "square") {
            return { safe: false, fallType: "square", position: pos };
        }

        // Tra cứu hướng ngã rơi theo bảng ma trận FALL_MAP
        const key = `${pos}${land1 ? "1" : "0"}${land2 ? "1" : "0"}`;
        const rawFallDir = FALL_MAP[key];
        const fallDir = rawFallDir === "rollDirection" ? rollDirection : rawFallDir;

        if (fallDir) {
            return {
                safe: false,
                fallDirection: fallDir,
                position: pos
            };
        }

        // Khối hộp tiếp đất an toàn trên mặt sàn kiên cố
        const res1 = tile1 ? tile1.getLandingResponse(pos, isSmall) : null;
        const res2 = tile2 ? tile2.getLandingResponse(pos, isSmall) : null;

        const win = Boolean((res1 && res1.triggerWin) || (res2 && res2.triggerWin));
        const split = Boolean((res1 && res1.triggerSplit) || (res2 && res2.triggerSplit));
        const linkedSplits = (res1 && res1.triggerSplit ? tile1.linkedSplits : null) || (res2 && res2.triggerSplit ? tile2.linkedSplits : null);
        const switchDoors = Boolean((res1 && res1.triggerSwitch) || (res2 && res2.triggerSwitch));
        const linkedDoors = (res1 && res1.triggerSwitch ? tile1.linkedDoors : null) || (res2 && res2.triggerSwitch ? tile2.linkedDoors : null);

        let chosenSound = (res1 && res1.sound) || (res2 && res2.sound) || {
            name: "clonk",
            label: isSmall ? "half" : "clonk",
            variations: 6
        };
        if (res2 && (res2.triggerSwitch || res2.triggerWin || res2.triggerSplit)) {
            chosenSound = res2.sound;
        } else if (res1 && (res1.triggerSwitch || res1.triggerWin || res1.triggerSplit)) {
            chosenSound = res1.sound;
        }

        return {
            safe: true,
            win,
            split,
            linkedSplits,
            switchDoors,
            linkedDoors,
            sound: chosenSound,
            soundVariation: chosenSound.label,
            variations: chosenSound.variations || 0
        };
    }

    /**
     * Kích hoạt chuyển đổi trạng thái của các cây cầu liên kết.
     * Tác dụng: Cung cấp phương thức thuận tiện để GameEngine yêu cầu lật trạng thái cầu.
     *
     * @param {Array<{ targetTile: Tile, type: string }>} linkedDoors
     * @returns {void}
     */
    switchDoors(linkedDoors) {
        this.triggerSwitches(linkedDoors);
    }

    // =========================================================================
    // 4. DỌN DẸP BÀN CỜ (BOARD CLEANUP)
    // =========================================================================

    /**
     * Xóa sạch toàn bộ danh sách ô sàn và bảng băm tọa độ.
     * Tác dụng: Giải phóng bộ nhớ của màn chơi cũ trước khi nạp dữ liệu màn chơi mới.
     *
     * @returns {void}
     */
    clear() {
        this.tiles = [];
        this.tilesByCoords.clear();
        this.hasSplitSwitch = false;
    }
}
