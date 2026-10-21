/**
 * @file EventBus.js
 * @description Hệ thống truyền thông tin hướng sự kiện (Publish-Subscribe Pattern) phân tán,
 * giúp các module (GameEngine, Renderer, AudioService, InputService, UI) giao tiếp độc lập,
 * giảm thiểu sự phụ thuộc lẫn nhau (decoupling) và dễ dàng mở rộng.
 */

/**
 * Danh mục toàn bộ các sự kiện chuẩn hóa trong trò chơi.
 * Tác dụng: Cung cấp hằng số định danh duy nhất cho các sự kiện của khối hộp, bàn cờ, tiến trình và giao diện.
 * @readonly
 */
export const GAME_EVENTS = Object.freeze({
    // 1. SỰ KIỆN KHỐI HỘP (BLOCK)
    BLOCK_ROLL_START: "block:roll_start",     // Khối bắt đầu thực hiện bước lăn theo hướng chỉ định
    BLOCK_MOVED: "block:moved",               // Khối vừa hoàn thành 1 bước lăn và cập nhật tọa độ logic
    BLOCK_LANDED: "block:landed",             // Khối tiếp đất an toàn trên bề mặt các ô sàn
    BLOCK_FALL: "block:fall",                 // Khối bị mất thăng bằng hoặc hụt chân rơi khỏi bàn cờ
    BLOCK_SPLIT: "block:split",               // Khối bị phân tách thành 2 khối lập phương nhỏ 1x1
    BLOCK_JOIN: "block:join",                 // 2 khối nhỏ đứng cạnh nhau nhập lại thành khối chữ nhật nguyên vẹn
    BLOCK_FOCUS_SWITCH: "block:focus_switch", // Người chơi chuyển đổi quyền điều khiển giữa 2 khối nhỏ (phím Space)

    // 2. SỰ KIỆN BÀN CỜ VÀ Ô SÀN (BOARD & TILES)
    DOORS_SWITCHED: "board:doors_switched",   // Các ô cầu sắt chuyển đổi trạng thái đóng hoặc mở
    TILE_CRUMBLED: "board:tile_crumbled",     // Ô sàn màu cam bị nứt vỡ khi khối đứng thẳng lên

    // 3. SỰ KIỆN TIẾN TRÌNH MÀN CHƠI (LEVEL & GAME STATE)
    LEVEL_INIT: "level:init",                 // Bắt đầu chuẩn bị nạp dữ liệu màn chơi mới
    LEVEL_READY: "level:ready",               // Hoạt cảnh giới thiệu màn chạy xong, bắt đầu cho phép người chơi điều khiển
    LEVEL_WIN: "level:win",                   // Khối hộp rơi thẳng đứng vào lỗ đích thành công
    LEVEL_LOSE: "level:lose",                 // Khối hộp ngã rơi khỏi sàn, chuẩn bị đặt lại màn chơi
    GAME_COMPLETE: "game:complete",           // Người chơi đã hoàn thành xuất sắc toàn bộ 33 màn chơi

    // 4. SỰ KIỆN GIAO DIỆN & CÀI ĐẶT (UI & SETTINGS)
    PAUSE_MENU_OPEN: "ui:pause_open",         // Người chơi mở Menu tạm dừng
    PAUSE_MENU_CLOSE: "ui:pause_close",       // Đóng Menu tạm dừng và quay lại màn chơi
    SOUND_TOGGLED: "settings:sound_toggled"   // Người chơi chuyển đổi trạng thái bật hoặc tắt âm thanh
});

/**
 * Trục điều phối sự kiện trung tâm (Event Bus).
 * Tác dụng: Quản lý việc đăng ký, hủy đăng ký và phát sự kiện giữa các thành phần trong trò chơi.
 */
export class EventBus {
    /**
     * Khởi tạo bộ lưu trữ các listener theo tên sự kiện.
     */
    constructor() {
        /**
         * Bản đồ lưu trữ danh sách các hàm lắng nghe của từng sự kiện.
         * Khóa: Tên sự kiện (string), Giá trị: Tập hợp Set chứa thông tin callback.
         * @private
         * @type {Map<string, Set<{ callback: Function, once: boolean, context: Object|null }>>}
         */
        this._listeners = new Map();
    }

    /**
     * Đăng ký một hàm lắng nghe cho sự kiện chỉ định.
     * Tác dụng: Cho phép một module phản hồi lại hành động xảy ra từ module khác mà không cần gọi trực tiếp.
     *
     * @param {string} eventName - Tên sự kiện (lấy từ GAME_EVENTS).
     * @param {Function} callback - Hàm thực thi khi sự kiện được phát đi.
     * @param {Object} [context=null] - Ngữ cảnh `this` khi thực thi callback.
     * @returns {() => void} Hàm tiện ích để hủy đăng ký nhanh (unsubscribe).
     * @throws {TypeError} Nếu callback truyền vào không phải là một hàm.
     */
    on(eventName, callback, context = null) {
        if (typeof callback !== "function") {
            throw new TypeError(`[EventBus] Callback của sự kiện "${eventName}" phải là một Function.`);
        }

        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, new Set());
        }

        const subscription = { callback, once: false, context };
        this._listeners.get(eventName).add(subscription);

        return () => this.off(eventName, callback);
    }

    /**
     * Đăng ký lắng nghe sự kiện một lần duy nhất (tự động hủy đăng ký ngay sau khi thực thi lần đầu).
     * Tác dụng: Phù hợp cho các sự kiện chỉ xảy ra một lần như khởi tạo màn chơi hoặc kết thúc game.
     *
     * @param {string} eventName - Tên sự kiện.
     * @param {Function} callback - Hàm thực thi.
     * @param {Object} [context=null] - Ngữ cảnh `this`.
     * @returns {() => void}
     */
    once(eventName, callback, context = null) {
        if (typeof callback !== "function") {
            throw new TypeError(`[EventBus] Callback của sự kiện "${eventName}" phải là một Function.`);
        }

        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, new Set());
        }

        const subscription = { callback, once: true, context };
        this._listeners.get(eventName).add(subscription);

        return () => this.off(eventName, callback);
    }

    /**
     * Hủy đăng ký một hàm lắng nghe cụ thể khỏi sự kiện.
     * Tác dụng: Giải phóng tài nguyên và ngăn chặn việc thực thi các callback không còn cần thiết.
     *
     * @param {string} eventName - Tên sự kiện.
     * @param {Function} callback - Hàm đã đăng ký trước đó.
     * @returns {void}
     */
    off(eventName, callback) {
        const subs = this._listeners.get(eventName);
        if (!subs) return;

        for (const sub of subs) {
            if (sub.callback === callback) {
                subs.delete(sub);
                break;
            }
        }

        if (subs.size === 0) {
            this._listeners.delete(eventName);
        }
    }

    /**
     * Phát một sự kiện cùng với dữ liệu đi kèm tới toàn bộ các hàm lắng nghe đang đăng ký.
     * Tác dụng: Lan tỏa thông tin trạng thái tới tất cả các hệ thống liên quan (vật lý, đồ họa, âm thanh, UI).
     *
     * @param {string} eventName - Tên sự kiện cần phát.
     * @param {*} [data=null] - Dữ liệu truyền kèm theo sự kiện.
     * @returns {void}
     */
    emit(eventName, data = null) {
        const subs = this._listeners.get(eventName);
        if (!subs || subs.size === 0) return;

        // Tạo bản sao mảng listeners trước khi duyệt để chống lỗi biến đổi tập hợp khi có handler gọi hàm off()
        const subsToExecute = Array.from(subs);

        for (const sub of subsToExecute) {
            try {
                if (sub.context) {
                    sub.callback.call(sub.context, data);
                } else {
                    sub.callback(data);
                }
            } catch (err) {
                console.error(`[EventBus] Lỗi phát sinh trong listener của sự kiện "${eventName}":`, err);
            }

            // Tự động gỡ bỏ đối với các listener đăng ký một lần (once)
            if (sub.once) {
                subs.delete(sub);
            }
        }

        if (subs.size === 0) {
            this._listeners.delete(eventName);
        }
    }

    /**
     * Kiểm tra xem một sự kiện có bất kỳ listener nào đang theo dõi hay không.
     * Tác dụng: Giúp tối ưu hóa việc chuẩn bị dữ liệu chỉ khi thực sự có thành phần cần xử lý.
     *
     * @param {string} eventName - Tên sự kiện cần kiểm tra.
     * @returns {boolean} True nếu có ít nhất một listener đang đăng ký.
     */
    has(eventName) {
        const subs = this._listeners.get(eventName);
        return Boolean(subs && subs.size > 0);
    }

    /**
     * Xóa sạch toàn bộ listeners của một sự kiện cụ thể hoặc của tất cả các sự kiện.
     * Tác dụng: Làm mới hoàn toàn hệ thống sự kiện khi tải lại ứng dụng hoặc dọn dẹp game.
     *
     * @param {string} [eventName=null] - Tên sự kiện cần xóa, hoặc null để xóa toàn bộ.
     * @returns {void}
     */
    clear(eventName = null) {
        if (eventName) {
            this._listeners.delete(eventName);
        } else {
            this._listeners.clear();
        }
    }
}
