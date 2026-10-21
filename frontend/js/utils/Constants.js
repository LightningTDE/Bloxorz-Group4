/**
 * @file Constants.js
 * @description Định nghĩa các hằng số cốt lõi của trò chơi bao gồm kích thước lưới bàn cờ,
 * tư thế khối hộp, các loại ô sàn, bảng tra cứu hướng ngã và ánh xạ phím điều khiển.
 */

/**
 * Cấu hình kích thước lưới bàn cờ tọa độ 2D.
 * Tác dụng: Giới hạn không gian di chuyển của bàn cờ và khối hộp.
 * - COLS: Số cột dọc theo trục hoành X (từ cột 0 đến cột 14).
 * - ROWS: Số hàng dọc theo trục tung Y (từ hàng 0 đến hàng 9).
 */
export const GRID_CONFIG = {
    COLS: 15,
    ROWS: 10
};

/**
 * Các trạng thái tư thế không gian của khối hộp hình chữ nhật (kích thước 1x1x2).
 * Tác dụng: Xác định diện tích tiếp xúc với mặt sàn và cách tính toán va chạm khi di chuyển.
 * - UP: Khối đứng thẳng trên 1 ô vuông (diện tích đáy 1x1, chiều cao 2).
 * - LONG: Khối nằm ngang dọc theo trục X (diện tích đáy 2x1, chiều cao 1).
 * - FAR: Khối nằm dọc theo trục Y (diện tích đáy 1x2, chiều cao 1).
 */
export const BLOCK_STATE = {
    UP: "up",
    LONG: "long",
    FAR: "far"
};

/**
 * Bảng ánh xạ ký tự mã hóa loại ô sàn trong dữ liệu màn chơi sang loại ô tương ứng.
 * Tác dụng: Phân loại cơ chế vật lý và hoạt cảnh hiển thị của từng viên gạch trên bàn cờ.
 */
export const TILE_TYPES = {
    NORMAL: "b",       // Ô đá kiên cố thường, chịu được mọi tư thế của khối
    SOFT_SWITCH: "s",  // Công tắc tròn nhẹ: kích hoạt khi bất kỳ phần nào của khối đè lên
    HEAVY_SWITCH: "h", // Công tắc chữ X nặng: chỉ kích hoạt khi khối đứng thẳng (tư thế UP)
    DOOR_L_OFF: "l",   // Cầu bên trái (trạng thái khởi đầu: ĐÓNG / vô hình)
    DOOR_L_ON: "k",    // Cầu bên trái (trạng thái khởi đầu: MỞ / có thể đi qua)
    DOOR_R_OFF: "r",   // Cầu bên phải (trạng thái khởi đầu: ĐÓNG / vô hình)
    DOOR_R_ON: "q",    // Cầu bên phải (trạng thái khởi đầu: MỞ / có thể đi qua)
    EXIT: "e",         // Lỗ đích: hoàn thành màn chơi khi khối rơi thẳng đứng (tư thế UP) vào đây
    SPLIT: "v",        // Công tắc phân tách: tách khối lớn thành 2 khối nhỏ độc lập
    FRAGILE: "f"       // Ô màu cam giòn: sập vỡ nếu khối đứng thẳng (tư thế UP) lên bề mặt
};

/**
 * Trạng thái đi qua được (passable) ban đầu của các loại cầu đóng/mở.
 * Tác dụng: Khởi tạo giá trị boolean cho các ô cầu khi tải mới một màn chơi.
 */
export const INITIAL_DOOR_STATES = {
    [TILE_TYPES.DOOR_L_OFF]: false,
    [TILE_TYPES.DOOR_L_ON]: true,
    [TILE_TYPES.DOOR_R_OFF]: false,
    [TILE_TYPES.DOOR_R_ON]: true
};

/**
 * Bảng tra cứu hướng ngã rơi khi khối hộp bị hẫng chân ở mép sàn.
 * Tác dụng: Xác định hướng xoay hoạt cảnh khi khối chỉ có một nửa diện tích tiếp xúc với sàn cứng.
 * Cấu trúc khóa: [tư thế khối][chân 1 có sàn? 1:0][chân 2 có sàn? 1:0]
 * - up00: Đứng UP mà phía dưới không có sàn -> ngã theo quán tính hướng vừa lăn tới.
 * - far00: Nằm FAR mà cả 2 điểm tiếp xúc đều không có sàn -> ngã theo hướng lăn.
 * - far01: Nằm FAR, chân trên hẫng, chân dưới có sàn -> chúc đầu lật ngã xuống dưới ("down").
 * - far10: Nằm FAR, chân trên có sàn, chân dưới hẫng -> bập bênh lật ngã lên trên ("up").
 * - long00: Nằm LONG mà cả 2 chân đều hẫng -> ngã theo hướng vừa lăn tới.
 * - long01: Nằm LONG, chân phải có sàn, chân trái hẫng -> mất thăng bằng ngã sang trái ("left").
 * - long10: Nằm LONG, chân trái có sàn, chân phải hẫng -> mất thăng bằng ngã sang phải ("right").
 */
export const FALL_MAP = {
    up00: "rollDirection",
    far00: "rollDirection",
    far01: "down",
    far10: "up",
    long00: "rollDirection",
    long01: "left",
    long10: "right"
};

/**
 * Ánh xạ phím bàn phím sang 4 hướng di chuyển không gian 2.5D.
 * Tác dụng: Hỗ trợ linh hoạt cả 4 phím mũi tên và các phím WASD để điều khiển khối hộp.
 */
export const KEY_DIRECTIONS = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right"
};
