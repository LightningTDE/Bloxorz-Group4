/**
 * @file Block.js
 * @description Thực thể logic đại diện cho khối hộp di chuyển trên bàn cờ,
 * quản lý tọa độ tâm lưới (x, y), tư thế không gian (đứng UP, nằm ngang LONG, nằm dọc FAR),
 * tính toán các ô sàn đang tiếp xúc, áp dụng bước lăn, phát hiện mất thăng bằng ngã rơi và cơ chế hợp nhất 2 khối nhỏ.
 */

import { BLOCK_STATE, FALL_MAP } from "../utils/Constants.js";

export class Block {
    /**
     * Khởi tạo thực thể khối hộp với tọa độ và tư thế ban đầu.
     * Tác dụng: Quản lý trạng thái hình học và động học của khối hộp trên lưới tọa độ ma trận.
     *
     * @param {number|{ x?: number, y?: number, position?: string, state?: string, isSmall?: boolean }} startXOrOptions - Tọa độ x ban đầu hoặc đối tượng cấu hình.
     * @param {number} [startY] - Tọa độ hàng y ban đầu trên lưới.
     * @param {string} [initialState=BLOCK_STATE.UP] - Tư thế ban đầu của khối ('up', 'long', 'far').
     * @param {boolean} [isSmall=false] - True nếu là khối lập phương nhỏ 1x1 (sau khi kích hoạt công tắc phân tách).
     */
    constructor(startXOrOptions, startY, initialState = BLOCK_STATE.UP, isSmall = false) {
        if (typeof startXOrOptions === "object" && startXOrOptions !== null) {
            this.x = startXOrOptions.x ?? 0;
            this.y = startXOrOptions.y ?? 0;
            this.state = startXOrOptions.position || startXOrOptions.state || BLOCK_STATE.UP;
            this.isSmall = Boolean(startXOrOptions.isSmall);
        } else {
            this.x = startXOrOptions;
            this.y = startY;
            this.state = initialState;
            this.isSmall = Boolean(isSmall);
        }

        // noinspection JSUnusedGlobalSymbols
        /**
         * Đối tượng hiển thị đồ họa gắn kèm (BlockView).
         * @type {import("./BlockView.js").BlockView|null}
         */
        this.view = null;
    }

    /**
     * Lấy tư thế hiện tại của khối hộp.
     * @returns {string} 'up', 'long', hoặc 'far'.
     */
    get position() {
        return this.state;
    }

    /**
     * Cập nhật tư thế của khối hộp.
     * @param {string} val
     */
    set position(val) {
        this.state = val;
    }

    // =========================================================================
    // 1. TÍNH TOÁN CÁC Ô SÀN TIẾP XÚC (OCCUPIED TILES)
    // =========================================================================

    /**
     * @public
     * @api
     * Lấy danh sách tọa độ các ô sàn mà khối hộp đang chiếm giữ trên mặt bàn cờ.
     * Tác dụng: Xác định các điểm tiếp xúc vật lý để kiểm tra va chạm, sàn giòn vỡ hoặc kích hoạt công tắc:
     * - Tư thế đứng UP hoặc khối nhỏ 1x1: Chiếm đúng 1 ô duy nhất [x, y].
     * - Tư thế nằm dọc FAR: Chiếm 2 ô theo chiều dọc: ô gốc [x, y] và ô liền kề phía trên [x, y - 1].
     * - Tư thế nằm ngang LONG: Chiếm 2 ô theo chiều ngang: ô gốc [x, y] và ô liền kề bên phải [x + 1, y].
     *
     * @returns {Array<{x: number, y: number}>} Mảng tọa độ các ô sàn tiếp xúc.
     */
    // noinspection JSUnusedGlobalSymbols
    getOccupiedTiles() {
        if (this.isSmall || this.state === BLOCK_STATE.UP) {
            return [{ x: this.x, y: this.y }];
        }
        if (this.state === BLOCK_STATE.FAR) {
            return [
                { x: this.x, y: this.y },
                { x: this.x, y: this.y - 1 }
            ];
        }
        if (this.state === BLOCK_STATE.LONG) {
            return [
                { x: this.x, y: this.y },
                { x: this.x + 1, y: this.y }
            ];
        }
        return [{ x: this.x, y: this.y }];
    }

    // =========================================================================
    // 2. CẬP NHẬT TỌA ĐỘ VÀ TƯ THẾ SAU KHI LĂN XONG (ROLL KINEMATICS)
    // =========================================================================

    /**
     * @public
     * @api
     * Áp dụng bước di chuyển logic sau khi hoạt cảnh lăn tiếp đất hoàn tất.
     * Tác dụng: Đồng bộ hóa tọa độ ma trận và tư thế mới của khối hộp sau mỗi bước lăn thành công.
     *
     * @param {"x"|"y"} axis - Trục tọa độ thay đổi ('x' hoặc 'y').
     * @param {number} change - Độ dời tọa độ tương đối (-2, -1, 1, hoặc 2).
     * @param {string} nextState - Tư thế mới của khối ('up', 'long', hoặc 'far').
     * @returns {void}
     */
    //noinspection JSUnusedGlobalSymbols
    applyRollStep(axis, change, nextState) {
        if (axis === "x") {
            this.x += change;
        } else if (axis === "y") {
            this.y += change;
        }
        this.state = nextState;
    }

    // =========================================================================
    // 3. KIỂM TRA ĐIỀU KIỆN RƠI VỰC THEO MA TRẬN HƯỚNG NGÃ (FALL DIRECTION)
    // =========================================================================

    /**
     * @public
     * @api
     * Xác định hướng ngã rơi khi khối có một hoặc cả hai chân tiếp xúc ngoài mép sàn.
     * Tác dụng: Tra cứu bảng FALL_MAP để chọn hoạt ảnh ngã lật tự nhiên nhất theo trọng tâm hình học:
     * - Cả hai chân đều nằm trên sàn hợp lệ -> Trả về null (khối an toàn).
     * - Chỉ một chân có sàn -> Lật ngã sang phía bị hụt chân do trọng lực kéo xuống.
     * - Cả hai chân đều hụt sàn -> Rơi theo quán tính hướng lăn tới.
     *
     * @param {boolean} isFoot1OnLand - Chân thứ nhất (x, y) có điểm tựa trên sàn vững chắc hay không.
     * @param {boolean} isFoot2OnLand - Chân thứ hai có điểm tựa trên sàn vững chắc hay không.
     * @param {string} rollDirection - Hướng vừa lăn tới của khối ('up', 'down', 'left', 'right').
     * @returns {string|null} Hướng ngã rơi ("up", "down", "left", "right") hoặc null nếu khối đứng an toàn.
     */
    // noinspection JSUnusedGlobalSymbols
    checkFallDirection(isFoot1OnLand, isFoot2OnLand, rollDirection) {
        const bit1 = isFoot1OnLand ? "1" : "0";
        const bit2 = isFoot2OnLand ? "1" : "0";
        const key = `${this.state}${bit1}${bit2}`;
        const direction = FALL_MAP[key];

        if (!direction) {
            return null; // Khối tiếp đất an toàn trên các ô sàn kiên cố
        }

        // Nếu cả hai chân đều hụt sàn thì rơi theo quán tính hướng vừa lăn tới
        return direction === "rollDirection" ? rollDirection : direction;
    }

    // =========================================================================
    // 4. KIỂM TRA HỢP NHẤT HAI KHỐI NHỎ (REJOIN LOGIC)
    // =========================================================================

    /**
     * Kiểm tra xem khối lập phương nhỏ này có đang đứng kề sát một khối nhỏ khác để hợp nhất thành khối lớn hay không.
     * Tác dụng: Kích hoạt cơ chế gộp 2 khối nhỏ 1x1 thành khối hộp chữ nhật nguyên vẹn 1x1x2 khi chúng chạm cạnh nhau:
     * - Hai khối cùng cột X và cách nhau đúng 1 hàng Y -> Hợp nhất thành khối nằm dọc (tư thế FAR).
     * - Hai khối cùng hàng Y và cách nhau đúng 1 cột X -> Hợp nhất thành khối nằm ngang (tư thế LONG).
     *
     * @param {Block} otherBlock - Thực thể khối nhỏ còn lại trên bàn cờ.
     * @returns {{ orientation: string, position: string, x: number, y: number } | null} Thông số khối hợp nhất hoặc null nếu chưa liền kề.
     */
    checkRejoinWith(otherBlock) {
        if (!this.isSmall || !otherBlock || !otherBlock.isSmall) {
            return null;
        }

        // Trường hợp 1: Hai khối đứng cùng cột X và kề sát nhau theo trục dọc Y
        if (this.x === otherBlock.x) {
            const ymin = Math.min(this.y, otherBlock.y);
            const ymax = Math.max(this.y, otherBlock.y);
            if (ymin + 1 === ymax) {
                return {
                    orientation: BLOCK_STATE.FAR,
                    position: BLOCK_STATE.FAR,
                    x: this.x,
                    y: ymax
                };
            }
        }

        // Trường hợp 2: Hai khối đứng cùng hàng Y và kề sát nhau theo trục ngang X
        if (this.y === otherBlock.y) {
            const xmin = Math.min(this.x, otherBlock.x);
            const xmax = Math.max(this.x, otherBlock.x);
            if (xmin + 1 === xmax) {
                return {
                    orientation: BLOCK_STATE.LONG,
                    position: BLOCK_STATE.LONG,
                    x: xmin,
                    y: this.y
                };
            }
        }

        return null; // Hai khối chưa đứng sát cạnh nhau
    }

    /**
     * Gắn kết đối tượng hiển thị đồ họa (BlockView) tương ứng với thực thể logic này.
     * Tác dụng: Đồng bộ hóa các thay đổi vị trí logic sang hoạt cảnh hiển thị trên canvas.
     *
     * @param {import("./BlockView.js").BlockView} view
     * @returns {void}
     */
    attachView(view) {
        this.view = view;
    }
}
