/**
 * @file InstructionsModal.js
 * @description Quản lý màn hình hướng dẫn luật chơi (Instructions Modal),
 * điều khiển MovieClip lib.Instructions(), chuyển trang qua lại giữa 9 trang hướng dẫn,
 * nút bỏ qua nhanh (Skip) và nút bắt đầu chơi (Start Game) kèm hiệu ứng âm thanh.
 */

export class InstructionsModal {
    /**
     * Danh mục các nhãn và mốc khung hình quan trọng trên timeline của MovieClip lib.Instructions.
     * Tác dụng: Định vị các trang hướng dẫn và nhánh chuyển cảnh.
     * @readonly
     */
    static LABELS = Object.freeze({
        START: 0,       // Khung hình bắt đầu hiệu ứng mở bảng hướng dẫn
        PAGE_1: 13,     // Trang hướng dẫn đầu tiên (mục tiêu trò chơi)
        PAGE_LAST: 173, // Trang hướng dẫn cuối cùng (nút Start Game)
        SKIP: "skip"    // Nhãn nhảy nhanh bỏ qua toàn bộ các trang hướng dẫn
    });

    /**
     * Khởi tạo đối tượng quản lý màn hình hướng dẫn.
     * Tác dụng: Tạo instance MovieClip và đăng ký các sự kiện tương tác cho các nút điều hướng.
     *
     * @param {Object} [options={}]
     * @param {createjs.MovieClip|null} [options.clip=null] - Instance lib.Instructions có sẵn nếu có.
     * @param {import("../services/AudioService.js").AudioService} [options.audioService=null] - Dịch vụ âm thanh.
     */
    constructor(options = {}) {
        /**
         * Instance MovieClip đồ họa của màn hình hướng dẫn.
         * @private
         * @type {createjs.MovieClip|null}
         */
        this._clip = options.clip || this._createDefaultClip();

        /**
         * Dịch vụ âm thanh phát tiếng click/latch.
         * @private
         * @type {import("../services/AudioService.js").AudioService|null}
         */
        this._audioService = options.audioService || null;

        /**
         * Danh sách các hàm callback xử lý khi người chơi tương tác với các nút điều hướng.
         * @private
         */
        this._callbacks = {
            start: null,
            back: null,
            skip: null
        };

        this._setupListeners();
    }

    /**
     * Tạo mới instance MovieClip lib.Instructions từ namespace CreateJS lib.
     * Tác dụng: Khởi tạo đối tượng đồ họa hiển thị cho các trang hướng dẫn.
     *
     * @private
     * @returns {createjs.MovieClip|null}
     */
    _createDefaultClip() {
        if (typeof window !== "undefined" && window.lib && typeof window.lib.Instructions === "function") {
            return new window.lib.Instructions();
        }
        return null;
    }

    /**
     * Gắn các bộ lắng nghe sự kiện tương tác và âm thanh cho toàn bộ các nút điều hướng trên các trang.
     * Tác dụng: Xử lý nút Back về Menu, nút Skip bỏ qua, nút Next/Prev chuyển trang và nút Start bắt đầu chơi.
     *
     * @private
     * @returns {void}
     */
    _setupListeners() {
        if (!this._clip) return;

        const _ = this._clip;

        // 1. Nút Back quay về Menu chính (nằm ở trang 1)
        if (_.backButton) {
            this._bindButtonSound(_.backButton);
            _.backButton.addEventListener("click", () => {
                if (this._callbacks.back) {
                    this._callbacks.back();
                } else if (_.parent && typeof _.parent.gotoAndStop === "function") {
                    _.parent.gotoAndStop("menu");
                }
            });
        }

        // 2. Nút Bỏ qua toàn bộ hướng dẫn (skipButton)
        if (_.skipButton) {
            this._bindButtonSound(_.skipButton);
            _.skipButton.addEventListener("click", () => {
                if (this._callbacks.skip) {
                    this._callbacks.skip();
                } else {
                    _.gotoAndPlay(InstructionsModal.LABELS.SKIP);
                }
            });
        }

        // 3. Nút Chuyển trang kế tiếp (nextButton ở trang 1)
        if (_.nextButton) {
            this._bindButtonSound(_.nextButton);
            _.nextButton.addEventListener("click", () => {
                _.play();
            });
        }

        // 4. Nút Chuyển trang tiếp theo ở các trang từ 2 đến 8 (nextButton2)
        if (_.nextButton2) {
            this._bindButtonSound(_.nextButton2);
            _.nextButton2.addEventListener("click", () => {
                _.play();
            });
        }

        // 5. Nút Quay lại trang trước (prevButton)
        if (_.prevButton) {
            this._bindButtonSound(_.prevButton);
            _.prevButton.addEventListener("click", () => {
                // Nhảy lùi 30 khung hình để chạy hoạt cảnh quay lại trang trước
                _.gotoAndPlay(_.currentFrame - 30);
            });
        }

        // 6. Nút Bắt đầu chơi ở trang cuối cùng (startButton)
        if (_.startButton) {
            this._bindButtonSound(_.startButton);
            _.startButton.addEventListener("click", () => {
                if (this._callbacks.start) {
                    this._callbacks.start();
                } else {
                    _.play();
                }
            });
        }
    }

    /**
     * Gắn âm thanh hover (tiếng click nhẹ) và âm thanh khi nhấn chuột (tiếng latch) cho nút bấm.
     * Tác dụng: Tạo phản hồi xúc giác âm thanh trực quan cho mọi nút bấm điều hướng.
     *
     * @private
     * @param {createjs.DisplayObject} btn - Nút bấm cần gắn âm thanh.
     * @returns {void}
     */
    _bindButtonSound(btn) {
        if (!btn) return;

        if (typeof window !== "undefined" && typeof window.addButtonSounds === "function") {
            window.addButtonSounds(btn);
            return;
        }

        btn.addEventListener("mouseover", () => {
            if (this._audioService) this._audioService.playAction("click");
        });

        btn.addEventListener("click", () => {
            if (this._audioService) this._audioService.playAction("latch");
        });
    }

    /**
     * Hiển thị bảng hướng dẫn và bắt đầu phát từ khung hình đầu tiên.
     * Tác dụng: Mở màn hình hướng dẫn luật chơi cho người mới.
     *
     * @returns {void}
     */
    show() {
        if (this._clip) {
            this._clip.gotoAndPlay(InstructionsModal.LABELS.START);
        }
    }

    /**
     * Kích hoạt nhánh hoạt cảnh bỏ qua nhanh toàn bộ hướng dẫn.
     * Tác dụng: Cho phép người chơi quen thuộc chuyển thẳng vào màn chơi 1 mà không phải bấm lật từng trang.
     *
     * @returns {void}
     */
    skip() {
        if (this._clip) {
            this._clip.gotoAndPlay(InstructionsModal.LABELS.SKIP);
        }
    }

    /**
     * Lấy đối tượng DisplayObject CreateJS để thêm vào Stage.
     * Tác dụng: Cho phép Renderer quản lý lớp hiển thị của bảng hướng dẫn.
     *
     * @returns {createjs.MovieClip|null}
     */
    getDisplayObject() {
        return this._clip;
    }

    /**
     * Đăng ký callback khi người chơi nhấn nút Bắt đầu chơi (Start Game) ở trang cuối.
     * Tác dụng: Chuyển sang trạng thái STAGE_INTRO để bắt đầu chơi.
     *
     * @param {() => void} cb
     * @returns {void}
     */
    onStart(cb) {
        this._callbacks.start = cb;
    }

    /**
     * Đăng ký callback khi người chơi nhấn nút Back quay lại Menu chính.
     * Tác dụng: Đóng bảng hướng dẫn và trả về trạng thái MENU.
     *
     * @param {() => void} cb
     * @returns {void}
     */
    onBack(cb) {
        this._callbacks.back = cb;
    }

    /**
     * Đăng ký callback khi người chơi nhấn nút Skip bỏ qua hướng dẫn.
     * Tác dụng: Chuyển thẳng vào màn 1.
     *
     * @param {() => void} cb
     * @returns {void}
     */
    onSkip(cb) {
        this._callbacks.skip = cb;
    }

    /**
     * Dọn dẹp tài nguyên và gỡ bỏ MovieClip khỏi cây hiển thị.
     * Tác dụng: Ngăn chặn rò rỉ bộ nhớ khi chuyển màn hình.
     *
     * @returns {void}
     */
    destroy() {
        if (this._clip) {
            this._clip.stop();
            if (this._clip.parent) {
                this._clip.parent.removeChild(this._clip);
            }
        }
        this._clip = null;
    }
}
