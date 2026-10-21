/**
 * @file Isometric.js
 * @description Hệ thống tính toán phép chiếu phối cảnh đẳng cự (Isometric 2.5D),
 * chuyển đổi tọa độ ma trận lưới sang tọa độ pixel hiển thị trên canvas và tính toán thứ tự chiều sâu (Z-order).
 */

export class Isometric {
    /**
     * Chuyển đổi tọa độ logic trên lưới bàn cờ (x, y) sang tọa độ pixel 2D trên khung nhìn (screenX, screenY).
     * Tác dụng: Định vị chính xác các ô sàn, khối hộp và bóng đổ trên không gian hiển thị của Canvas.
     *
     * Phép biến đổi ma trận đẳng cự:
     * - screenX = x * 30 + y * 10 + 30
     * - screenY = y * 16 - x * 5 + 130
     *
     * @param {number} x - Tọa độ cột trên lưới (0 đến 14).
     * @param {number} y - Tọa độ hàng trên lưới (0 đến 9).
     * @returns {[number, number] & { x: number, y: number }} Mảng tọa độ [screenX, screenY] kèm thuộc tính .x, .y.
     */
    static toScreen(x, y) {
        const sx = x * 30 + y * 10 + 30;
        const sy = y * 16 - x * 5 + 130;
        const pt = [sx, sy];
        pt.x = sx;
        pt.y = sy;
        return pt;
    }

    /**
     * Tính toán chỉ số chiều sâu (Depth Index) dùng để sắp xếp thứ tự hiển thị (Z-Index).
     * Tác dụng: Đảm bảo các đối tượng ở phía trước không bị đối tượng ở phía sau vẽ đè lên.
     *
     * @param {number} x - Tọa độ cột trên lưới.
     * @param {number} y - Tọa độ hàng trên lưới.
     * @param {number} [depthNudge=0] - Hệ số bù dịch chuyển chiều sâu khi khối đang lăn hoặc rơi.
     * @returns {number} Giá trị độ sâu tương đối (giá trị càng lớn càng nằm phía trước).
     */
    static getDepth(x, y, depthNudge = 0) {
        return y - x + depthNudge;
    }

    /**
     * Bảng tra cứu độ lệch tọa độ ảo (depthNudge) khi khối hộp ngã rơi khỏi mép bàn cờ.
     * Tác dụng: Ngăn chặn hiện tượng giật hiển thị hoặc xuyên thấu đồ họa khi khối lật qua mép sàn.
     *
     * @param {string} direction - Hướng ngã của khối ("up", "down", "left", "right").
     * @param {string} blockPosition - Tư thế khối trước khi ngã ("up", "long", "far").
     * @returns {[number, number]} Độ lệch [dx, dy] tương ứng để tính toán thứ tự vẽ.
     */
    static getFallDepthNudge(direction, blockPosition) {
        const nudgeTable = {
            upup: [0, 0],
            upfar: [0, -1],
            uplong: [0, 0],
            downup: [0, 1],
            downfar: [0, 0],
            downlong: [0, 0],
            leftup: [-1, 0],
            leftfar: [-1, 0],
            leftlong: [-1, 0],
            rightup: [0, 0],
            rightfar: [0, 0],
            rightlong: [0, 0]
        };
        return nudgeTable[`${direction}${blockPosition}`] || [0, 0];
    }

    /**
     * Kiểm tra xem một ô sàn có nằm khuất phía sau khối hộp hay không.
     * Tác dụng: Phục vụ giải thuật phân chia layer khi khối ngã rơi, giúp khối hộp rơi che khuất các ô sàn
     * nằm phía sau nó một cách tự nhiên và chính xác theo luật phối cảnh 2.5D.
     *
     * @param {number} tileX - Tọa độ cột của ô sàn.
     * @param {number} tileY - Tọa độ hàng của ô sàn.
     * @param {number} blockX - Tọa độ cột gốc của khối hộp.
     * @param {number} blockY - Tọa độ hàng gốc của khối hộp.
     * @returns {boolean} True nếu ô sàn nằm ở phía sau khối hộp.
     */
    static isTileBehindBlock(tileX, tileY, blockX, blockY) {
        return tileY <= blockY && tileX >= blockX;
    }
}
