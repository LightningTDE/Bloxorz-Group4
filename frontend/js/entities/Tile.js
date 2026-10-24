/**
 * @file Tile.js
 * @description Thực thể logic đại diện cho một ô sàn trên bàn cờ,
 * quản lý loại ô (đá thường, công tắc nhẹ/nặng, cầu nối, ô giòn vỡ, lỗ đích, phân tách khối),
 * kiểm tra tính hợp lệ khi khối tiếp đất và phản hồi hiệu ứng cơ học/âm thanh tương ứng.
 */

import { TILE_TYPES, INITIAL_DOOR_STATES, BLOCK_STATE } from "../utils/Constants.js";

export class Tile {
    /**
     * Khởi tạo thực thể ô sàn với loại ô và tọa độ ma trận.
     * Tác dụng: Lưu trữ thuộc tính vật lý và trạng thái liên kết công tắc của từng viên gạch trên bàn cờ.
     *
     * @param {string} type - Ký tự mã hóa loại ô ('b', 's', 'h', 'l', 'k', 'r', 'q', 'e', 'v', 'f').
     * @param {number} x - Tọa độ cột trên lưới (0 đến 14).
     * @param {number} y - Tọa độ hàng trên lưới (0 đến 9).
     */
    constructor(type, x, y) {
        /**
         * Loại ô sàn.
         * @type {string}
         */
        this.type = type;

        /**
         * Tọa độ cột logic.
         * @type {number}
         */
        this.x = x;

        /**
         * Tọa độ hàng logic.
         * @type {number}
         */
        this.y = y;

        /**
         * Đối tượng hiển thị đồ họa gắn kèm (TileView).
         * @type {import("./TileView.js").TileView|null}
         */
        this.view = null;

        /**
         * Danh sách các ô cầu nối chịu sự điều khiển của công tắc này (dành cho ô 's' hoặc 'h').
         * @type {Array<{ targetTile: Tile, type: string }>}
         */
        this.linkedDoors = [];

        /**
         * Tọa độ xuất phát mới khi phân tách khối [x1, y1, x2, y2] (dành cho ô 'v').
         * @type {number[]|null}
         */
        this.linkedSplits = null;

        /**
         * Trạng thái đóng/mở hiện tại nếu ô này là một cây cầu (true: mở/có thể đi, false: đóng/vô hình).
         * @type {boolean|null}
         */
        this.isDoorOpen = INITIAL_DOOR_STATES.hasOwnProperty(type)
            ? INITIAL_DOOR_STATES[type]
            : null;
    }

    // =========================================================================
    // 1. KIỂM TRA ĐIỀU KIỆN TIẾP ĐẤT HỢP LỆ (WALKABILITY)
    // =========================================================================

    /**
     * Kiểm tra xem khối hộp có thể tiếp đất an toàn trên ô sàn này hay không.
     * Tác dụng: Phục vụ tính toán va chạm vật lý:
     * - Trả về true: Ô sàn kiên cố, khối hộp đứng an toàn.
     * - Trả về false: Vực thẳm hoặc cầu đang đóng, khối hộp sẽ bị ngã rơi.
     * - Trả về chuỗi "square": Ô màu cam bị sập vỡ khi khối đứng thẳng (UP), kích hoạt hoạt cảnh gãy sập.
     *
     * @param {string} blockPosition - Tư thế hiện tại của khối ('up', 'long', 'far').
     * @param {boolean} isSmall - True nếu là khối nhỏ 1x1 sau khi phân thân.
     * @returns {boolean|string} Kết quả kiểm tra khả năng đi qua.
     */
    checkWalkable(blockPosition, isSmall) {
        // 1. Ô màu cam giòn ('f'): Chỉ sập vỡ nếu khối lớn kích thước đầy đủ đứng thẳng đứng (tư thế UP)
        if (this.type === TILE_TYPES.FRAGILE) {
            if (blockPosition === BLOCK_STATE.UP && !isSmall) {
                if (this.view) this.view.triggerFragileBreak();
                return "square"; // Chuỗi định danh kích hoạt hoạt cảnh rơi sập ô giòn
            }
            return true; // Khối nằm ngang/dọc hoặc khối nhỏ 1x1 thì tải trọng phân tán an toàn
        }

        // 2. Ô cầu nối kim loại ('l', 'k', 'r', 'q'): Phụ thuộc vào trạng thái đóng hoặc mở của cầu
        if (this.isDoor()) {
            if (!this.isDoorOpen) return false;
            return this.view ? this.view.isDoorPassable() : true;
        }

        // 3. Các ô kiên cố còn lại ('b', 's', 'h', 'e', 'v'): Luôn an toàn cho mọi tư thế
        return true;
    }

    // =========================================================================
    // 2. TÍNH TOÁN PHẢN ỨNG TIẾP ĐẤT (LANDING RESPONSE)
    // =========================================================================

    /**
     * Tính toán phản hồi sự kiện khi khối hộp tiếp đất lên ô sàn.
     * Tác dụng: Xác định loại âm thanh phát ra (đá, kim loại, rỗng, công tắc),
     * đồng thời kiểm tra kích hoạt công tắc cầu, tách khối hoặc điều kiện hoàn thành màn chơi.
     *
     * @param {string} blockPosition - Tư thế khối ('up', 'long', 'far').
     * @param {boolean} isSmall - True nếu là khối nhỏ 1x1.
     * @returns {{
     *   sound: { name: string, label: string, variations?: number },
     *   triggerSwitch?: boolean,
     *   triggerSplit?: boolean,
     *   triggerWin?: boolean
     * }} Gói dữ liệu phản hồi tiếp đất để GameEngine xử lý.
     */
    getLandingResponse(blockPosition, isSmall) {
        const isUpAndFull = blockPosition === BLOCK_STATE.UP && !isSmall;

        // 1. Ô lỗ đích ('e'): Hoàn thành màn chơi khi khối lớn đứng thẳng lọt vào lỗ
        if (this.type === TILE_TYPES.EXIT) {
            if (isUpAndFull) {
                return {
                    sound: { name: "clonk", label: isSmall ? "half" : "clonk", variations: 6 },
                    triggerWin: true
                };
            }
            return {
                sound: { name: "clonk", label: isSmall ? "half" : "clonk", variations: 6 }
            };
        }

        // 2. Công tắc tròn nhẹ ('s'): Kích hoạt khi bất kỳ phần nào của khối chạm vào
        if (this.type === TILE_TYPES.SOFT_SWITCH) {
            return {
                sound: { name: "clonk", label: "smallswitch" },
                triggerSwitch: true
            };
        }

        // 3. Công tắc chữ X nặng ('h'): Chỉ kích hoạt khi khối lớn đứng thẳng (tư thế UP)
        if (this.type === TILE_TYPES.HEAVY_SWITCH) {
            if (isUpAndFull) {
                return {
                    sound: { name: "clonk", label: "bigswitch" },
                    triggerSwitch: true
                };
            }
            // Khối nằm đè lên chỉ phát ra tiếng gõ nhẹ mà không làm đổi trạng thái cầu
            return {
                sound: { name: "clonk", label: "smallswitch" },
                triggerSwitch: false
            };
        }

        // 4. Công tắc phân tách ('v'): Tách khối lớn thành 2 khối nhỏ khi đứng thẳng lên ô
        if (this.type === TILE_TYPES.SPLIT) {
            return {
                sound: { name: "clonk", label: "smallswitch" },
                triggerSplit: isUpAndFull
            };
        }

        // 5. Ô màu cam giòn ('f'): Phát âm thanh rỗng đặc trưng của chất liệu mỏng
        if (this.type === TILE_TYPES.FRAGILE) {
            return {
                sound: { name: "clonk", label: "hollow", variations: 3 }
            };
        }

        // 6. Ô cầu kim loại ('l', 'k', 'r', 'q'): Phát âm thanh đanh giòn của thép
        if (this.isDoor()) {
            return {
                sound: { name: "clonk", label: isSmall ? "halfmetal" : "metal", variations: 3 }
            };
        }

        // 7. Ô đá kiên cố mặc định ('b'): Phát âm thanh gõ đá tự nhiên
        return {
            sound: { name: "clonk", label: isSmall ? "half" : "clonk", variations: 6 }
        };
    }

    // =========================================================================
    // 3. CÁC HÀM TIỆN ÍCH KIỂM TRA PHÂN LOẠI
    // =========================================================================

    /**
     * Kiểm tra xem ô sàn có phải là một cây cầu đóng/mở hay không.
     * Tác dụng: Phân biệt các ô cầu kim loại ('l', 'k', 'r', 'q') với các ô cố định khác.
     *
     * @returns {boolean} True nếu là ô cầu.
     */
    isDoor() {
        return "lkrq".indexOf(this.type) !== -1;
    }

    /**
     * @public
     * @api
     * Kiểm tra xem ô sàn có phải là một công tắc điều khiển cầu hay không.
     * Tác dụng: Nhận diện các ô công tắc tròn nhẹ ('s') và công tắc chữ X nặng ('h').
     *
     * @returns {boolean} True nếu là công tắc.
     */
    // noinspection JSUnusedGlobalSymbols
    isSwitch() {
        return this.type === TILE_TYPES.SOFT_SWITCH || this.type === TILE_TYPES.HEAVY_SWITCH;
    }

    /**
     * Gắn kết đối tượng hiển thị đồ họa (TileView) với thực thể logic này.
     * Tác dụng: Đồng bộ hóa trạng thái logic của ô sàn với hoạt cảnh hiển thị trên canvas.
     *
     * @param {import("./TileView.js").TileView} view
     * @returns {void}
     */
    attachView(view) {
        this.view = view;
    }
}
