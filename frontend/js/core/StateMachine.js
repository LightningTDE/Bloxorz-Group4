/**
 * @file StateMachine.js
 * @description Quản lý máy trạng thái hữu hạn (Finite State Machine - FSM) của trò chơi,
 * kiểm soát các pha chuyển đổi trạng thái hợp lệ (Menu, Hướng dẫn, Giới thiệu màn, Chơi, Tạm dừng, Thắng, Thua, Phá đảo),
 * ngăn chặn các bước nhảy trạng thái phi logic và thực thi vòng đời (lifecycle hooks onEnter/onExit).
 */

import { GAME_EVENTS } from "./EventBus.js";

/**
 * Danh mục toàn bộ các trạng thái khả dụng trong trò chơi.
 * Tác dụng: Định danh các pha hoạt động độc lập của luồng game.
 * @readonly
 */
export const GAME_STATES = Object.freeze({
    MENU: "MENU",                   // Menu chính (Bắt đầu, Tiếp tục, Mật mã, Thông tin tác giả)
    INSTRUCTIONS: "INSTRUCTIONS",   // Màn hình xem bảng hướng dẫn luật chơi
    STAGE_INTRO: "STAGE_INTRO",     // Hoạt cảnh giới thiệu màn chơi (STAGE XX) và hiệu ứng xuất hiện sàn gạch
    PLAYING: "PLAYING",             // Người chơi đang điều khiển khối hộp di chuyển giải đố trên bàn cờ
    PAUSED: "PAUSED",               // Menu tạm dừng mở ra, đồng hồ ngưng đếm và bàn phím bị khóa
    LEVEL_WIN: "LEVEL_WIN",         // Khối hộp lọt lỗ đích, hoạt cảnh xoáy hút gạch chuyển sang màn mới
    LEVEL_LOSE: "LEVEL_LOSE",       // Khối hộp trượt ngã rơi khỏi sàn, chuẩn bị đặt lại vị trí xuất phát
    VICTORY: "VICTORY"              // Hoàn thành xuất sắc toàn bộ 33 màn chơi (Màn hình tổng kết Congratulations)
});

/**
 * Máy trạng thái hữu hạn điều khiển luồng hoạt động của trò chơi.
 */
export class StateMachine {
    /**
     * Ma trận định nghĩa các bước chuyển đổi trạng thái hợp lệ.
     * Tác dụng: Ngăn chặn các bước nhảy trạng thái phi logic (ví dụ: từ MENU không thể nhảy ngay sang LEVEL_WIN).
     * @private
     * @readonly
     */
    static VALID_TRANSITIONS = Object.freeze({
        [GAME_STATES.MENU]: [
            GAME_STATES.INSTRUCTIONS,
            GAME_STATES.STAGE_INTRO
        ],
        [GAME_STATES.INSTRUCTIONS]: [
            GAME_STATES.STAGE_INTRO,
            GAME_STATES.MENU
        ],
        [GAME_STATES.STAGE_INTRO]: [
            GAME_STATES.STAGE_INTRO,
            GAME_STATES.PLAYING,
            GAME_STATES.MENU
        ],
        [GAME_STATES.PLAYING]: [
            GAME_STATES.STAGE_INTRO,
            GAME_STATES.PAUSED,
            GAME_STATES.LEVEL_WIN,
            GAME_STATES.LEVEL_LOSE,
            GAME_STATES.MENU
        ],
        [GAME_STATES.PAUSED]: [
            GAME_STATES.STAGE_INTRO,
            GAME_STATES.PLAYING,
            GAME_STATES.MENU
        ],
        [GAME_STATES.LEVEL_WIN]: [
            GAME_STATES.STAGE_INTRO,
            GAME_STATES.VICTORY,
            GAME_STATES.MENU
        ],
        [GAME_STATES.LEVEL_LOSE]: [
            GAME_STATES.STAGE_INTRO,
            GAME_STATES.PLAYING,
            GAME_STATES.MENU
        ],
        [GAME_STATES.VICTORY]: [
            GAME_STATES.MENU
        ]
    });

    /**
     * Khởi tạo StateMachine với trạng thái ban đầu và EventBus truyền tin.
     *
     * @param {Object} [options={}]
     * @param {string} [options.initialState=GAME_STATES.MENU] - Trạng thái khởi đầu của trò chơi.
     * @param {import("./EventBus.js").EventBus} [options.eventBus=null] - Trục sự kiện để phát thông báo khi đổi trạng thái.
     */
    constructor(options = {}) {
        /**
         * Trạng thái hiện tại của trò chơi.
         * @private
         * @type {string}
         */
        this._currentState = options.initialState || GAME_STATES.MENU;

        /**
         * Trạng thái liền trước của trò chơi trước lần chuyển đổi gần nhất.
         * @private
         * @type {string|null}
         */
        this._previousState = null;

        /**
         * Trục sự kiện truyền tin toàn cục.
         * @private
         * @type {import("./EventBus.js").EventBus|null}
         */
        this._eventBus = options.eventBus || null;

        /**
         * Danh sách các hàm callback kích hoạt khi bước vào một trạng thái mới (onEnter).
         * @private
         * @type {Map<string, Set<Function>>}
         */
        this._enterHooks = new Map();

        /**
         * Danh sách các hàm callback kích hoạt khi rời khỏi một trạng thái (onExit).
         * @private
         * @type {Map<string, Set<Function>>}
         */
        this._exitHooks = new Map();
    }

    /**
     * Lấy trạng thái hiện tại của trò chơi.
     * Tác dụng: Cung cấp thông tin trạng thái cho các hệ thống hiển thị và điều khiển.
     *
     * @returns {string} Trạng thái hiện tại (hằng số từ GAME_STATES).
     */
    getState() {
        return this._currentState;
    }

    /**
     * Lấy trạng thái liền trước của trò chơi.
     * Tác dụng: Cho phép quay trở lại trạng thái cũ (ví dụ: từ PAUSED quay lại PLAYING).
     *
     * @returns {string|null} Trạng thái trước đó hoặc null nếu chưa có chuyển đổi.
     */
    getPreviousState() {
        return this._previousState;
    }

    /**
     * Kiểm tra xem trò chơi có đang ở một trạng thái cụ thể nào đó hay không.
     * Tác dụng: Rút ngắn cú pháp kiểm tra điều kiện trạng thái trong mã nguồn.
     *
     * @param {string} state - Trạng thái cần kiểm tra.
     * @returns {boolean} True nếu trùng khớp với trạng thái hiện tại.
     */
    is(state) {
        return this._currentState === state;
    }

    /**
     * Kiểm tra nhanh xem trò chơi có đang trong pha tương tác bàn cờ (không ở Menu hay Hướng dẫn) hay không.
     * Tác dụng: Bật/tắt các bộ lắng nghe bàn phím điều khiển khối hộp.
     *
     * @returns {boolean} True nếu đang ở một trong các trạng thái PLAYING, PAUSED, LEVEL_WIN, LEVEL_LOSE.
     */
    isInGameplay() {
        return (
            this._currentState === GAME_STATES.PLAYING ||
            this._currentState === GAME_STATES.PAUSED ||
            this._currentState === GAME_STATES.LEVEL_WIN ||
            this._currentState === GAME_STATES.LEVEL_LOSE
        );
    }

    /**
     * Kiểm tra xem việc chuyển từ trạng thái hiện tại sang trạng thái đích có hợp lệ theo ma trận chuyển đổi hay không.
     * Tác dụng: Đảm bảo tính nhất quán của vòng đời trò chơi, ngăn lỗi logic nhảy cóc.
     *
     * @param {string} nextState - Trạng thái dự kiến chuyển tới.
     * @returns {boolean} True nếu chuyển đổi được phép thực hiện.
     */
    canTransitionTo(nextState) {
        if (!nextState || nextState === this._currentState) {
            return false;
        }

        const validTransitions = StateMachine.VALID_TRANSITIONS[this._currentState];
        return Boolean(validTransitions && validTransitions.includes(nextState));
    }

    /**
     * Thực hiện chuyển đổi trạng thái trò chơi nếu bước chuyển được xác nhận hợp lệ.
     * Tác dụng: Kích hoạt lần lượt exit hooks của trạng thái cũ, cập nhật trạng thái,
     * thực thi enter hooks của trạng thái mới và phát sự kiện `state:changed` qua EventBus.
     *
     * @param {string} nextState - Trạng thái mới cần chuyển sang.
     * @param {*} [payload=null] - Dữ liệu truyền kèm bước chuyển đổi (ví dụ: số thứ tự màn chơi).
     * @returns {boolean} True nếu chuyển đổi thành công, False nếu bước chuyển bị từ chối do không hợp lệ.
     */
    transitionTo(nextState, payload = null) {
        if (nextState === this._currentState) {
            return true;
        }
        if (!this.canTransitionTo(nextState)) {
            console.warn(`[StateMachine] Bước chuyển trạng thái từ "${this._currentState}" sang "${nextState}" không hợp lệ.`);
            return false;
        }

        const fromState = this._currentState;
        const toState = nextState;

        // 1. Kích hoạt các hàm xử lý dọn dẹp khi rời khỏi trạng thái cũ (onExit)
        const exitCallbacks = this._exitHooks.get(fromState);
        if (exitCallbacks) {
            exitCallbacks.forEach((cb) => {
                try {
                    cb({ from: fromState, to: toState, payload });
                } catch (err) {
                    console.error(`[StateMachine] Lỗi khi thực thi exit hook của trạng thái "${fromState}":`, err);
                }
            });
        }

        // 2. Cập nhật biến trạng thái
        this._previousState = fromState;
        this._currentState = toState;

        // 3. Kích hoạt các hàm khởi tạo khi bước vào trạng thái mới (onEnter)
        const enterCallbacks = this._enterHooks.get(toState);
        if (enterCallbacks) {
            enterCallbacks.forEach((cb) => {
                try {
                    cb({ from: fromState, to: toState, payload });
                } catch (err) {
                    console.error(`[StateMachine] Lỗi khi thực thi enter hook của trạng thái "${toState}":`, err);
                }
            });
        }

        // 4. Phát sự kiện thông báo toàn cục tới các hệ thống lắng nghe
        if (this._eventBus) {
            this._eventBus.emit("state:changed", {
                from: fromState,
                to: toState,
                payload: payload
            });
        }

        return true;
    }

    /**
     * Đăng ký hàm thực thi khi trò chơi bước vào một trạng thái cụ thể.
     * Tác dụng: Cho phép các module khởi tạo giao diện hoặc tài nguyên khi trạng thái được kích hoạt.
     *
     * @param {string} state - Trạng thái cần theo dõi.
     * @param {Function} callback - Hàm thực thi nhận tham số { from, to, payload }.
     * @returns {() => void} Hàm tiện ích để hủy đăng ký hook.
     */
    onEnter(state, callback) {
        if (!this._enterHooks.has(state)) {
            this._enterHooks.set(state, new Set());
        }
        this._enterHooks.get(state).add(callback);

        return () => {
            const hooks = this._enterHooks.get(state);
            if (hooks) hooks.delete(callback);
        };
    }

    /**
     * Đăng ký hàm thực thi khi trò chơi rời khỏi một trạng thái cụ thể.
     * Tác dụng: Cho phép các module dọn dẹp bộ nhớ hoặc ẩn các bảng điều khiển khi rời trạng thái.
     *
     * @param {string} state - Trạng thái cần theo dõi.
     * @param {Function} callback - Hàm thực thi nhận tham số { from, to, payload }.
     * @returns {() => void} Hàm tiện ích để hủy đăng ký hook.
     */
    onExit(state, callback) {
        if (!this._exitHooks.has(state)) {
            this._exitHooks.set(state, new Set());
        }
        this._exitHooks.get(state).add(callback);

        return () => {
            const hooks = this._exitHooks.get(state);
            if (hooks) hooks.delete(callback);
        };
    }

    /**
     * Đặt lại trạng thái trò chơi về mặc định (MENU).
     * Tác dụng: Phục vụ khi khởi động lại toàn bộ game hoặc quay về màn hình chính.
     *
     * @param {string} [defaultState=GAME_STATES.MENU] - Trạng thái mặc định.
     * @returns {void}
     */
    reset(defaultState = GAME_STATES.MENU) {
        this._currentState = defaultState;
        this._previousState = null;
    }

    /**
     * Giải phóng toàn bộ bộ nhớ và các hooks của máy trạng thái.
     * Tác dụng: Dọn dẹp tài nguyên khi hủy bỏ phiên chơi.
     *
     * @returns {void}
     */
    destroy() {
        this._enterHooks.clear();
        this._exitHooks.clear();
        this._eventBus = null;
    }
}
