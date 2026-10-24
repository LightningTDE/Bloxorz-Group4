/**
 * @file MainMenu.js
 * @description Quản lý màn hình Menu chính của trò chơi (Start New Game, Resume Game, Load Stage, Sound Toggle, Credits),
 * điều khiển MovieClip lib.Menu(), kiểm tra tiến trình lưu trữ để kích hoạt nút Resume,
 * định vị và căn chỉnh responsive cho ô nhập Passcode HTML, xử lý kiểm tra mã 6 chữ số và điều hướng trạng thái.
 */

export class MainMenu {
    /**
     * Nhãn mốc khung hình quan trọng trên timeline của MovieClip lib.Menu.
     * Tác dụng: Điều hướng các hoạt cảnh chuyển tiếp giữa menu chính và các màn hình phụ.
     * @readonly
     */
    static LABELS = Object.freeze({
        SKIPPED: "skipped",             // Nhảy nhanh vào menu chính, bỏ qua hoạt cảnh tiêu đề giới thiệu
        MAIN: "main",                   // Khung hình hiển thị menu chính đầy đủ các nút bấm
        START_NEW_GAME: "startNewGame", // Hoạt cảnh chuyển tiếp khi chọn Bắt đầu chơi mới
        RESUME_GAME: "resumeGame",       // Hoạt cảnh chuyển tiếp khi chọn Tiếp tục chơi từ màn đã lưu
        LOAD_STAGE: "loadStage",         // Hoạt cảnh chuyển vào màn hình nhập mã Passcode
        CREDITS: "credits"              // Hoạt cảnh chuyển vào màn hình hiển thị thông tin tác giả
    });

    /**
     * Khởi tạo đối tượng quản lý Menu chính.
     * Tác dụng: Kết nối các service dữ liệu, âm thanh, lưu trữ và thiết lập các sự kiện tương tác cho các nút bấm.
     *
     * @param {Object} [options={}]
     * @param {createjs.MovieClip|null} [options.clip=null] - Instance MovieClip lib.Menu có sẵn nếu có.
     * @param {import("../services/StorageService.js").StorageService} [options.storageService=null] - Dịch vụ lưu trữ.
     * @param {import("../services/AudioService.js").AudioService} [options.audioService=null] - Dịch vụ âm thanh.
     * @param {import("../data/LevelRepository.js").LevelRepository} [options.levelRepository=null] - Kho dữ liệu màn chơi.
     */
    constructor(options = {}) {
        /**
         * Instance MovieClip CreateJS của Menu chính.
         * @private
         * @type {createjs.MovieClip|null}
         */
        this._clip = options.clip || this._createDefaultClip();

        /**
         * Dịch vụ lưu trữ cục bộ.
         * @private
         * @type {import("../services/StorageService.js").StorageService|null}
         */
        this._storageService = options.storageService || null;

        /**
         * Dịch vụ âm thanh.
         * @private
         * @type {import("../services/AudioService.js").AudioService|null}
         */
        this._audioService = options.audioService || null;

        /**
         * Kho lưu trữ và tra cứu màn chơi.
         * @private
         * @type {import("../data/LevelRepository.js").LevelRepository|null}
         */
        this._levelRepository = options.levelRepository || null;

        /**
         * Phần tử thẻ <input> HTML để người chơi gõ passcode 6 chữ số.
         * @private
         * @type {HTMLInputElement|null}
         */
        this._passcodeInputElem = null;

        /**
         * Bộ xử lý sự kiện resize cửa sổ để đồng bộ lại tọa độ ô nhập passcode.
         * @private
         * @type {(() => void)|null}
         */
        this._onResizeHandler = null;

        /**
         * Bộ lắng nghe khung hình chờ hoạt cảnh chuyển cảnh sang màn hình Load Stage (frame 220) hoàn tất.
         * @private
         * @type {(() => void)|null}
         */
        this._loadStageTickListener = null;

        /**
         * Danh sách các hàm callback xử lý tương tác của người chơi.
         * @private
         */
        this._callbacks = {
            startNewGame: null,
            resumeGame: null,
            loadPasscode: null,
            toggleSound: null
        };

        this._setupMenu();
    }

    /**
     * Tạo mới instance lib.Menu từ namespace CreateJS lib.
     * Tác dụng: Khởi tạo đối tượng đồ họa hiển thị cho Menu chính.
     *
     * @private
     * @returns {createjs.MovieClip|null}
     */
    _createDefaultClip() {
        if (typeof window !== "undefined" && window.lib && typeof window.lib.Menu === "function") {
            return new window.lib.Menu();
        }
        return null;
    }

    /**
     * Khởi tạo các sự kiện click, hiệu ứng âm thanh và trạng thái nút bấm trên Menu.
     * Tác dụng: Gắn kết logic cho các nút Bắt đầu, Tiếp tục, Nhập mã, Bật/Tắt âm thanh, Thông tin tác giả và Quay lại.
     *
     * @private
     * @returns {void}
     */
    _setupMenu() {
        if (!this._clip) return;

        // 1. Kiểm tra tiến trình lưu để bật/tắt nút Resume
        this.updateResumeState();

        // 2. Vô hiệu hóa các phương thức can thiệp DOM tự động của an_TextInput
        // Ngăn chặn Adobe Animate tính toán lại CSS Transform làm ô nhập Passcode bị co giãn, nhảy vị trí hoặc mất hiển thị.
        if (typeof window !== "undefined" && window.lib && window.lib.an_TextInput) {
            // noinspection JSUnusedGlobalSymbols
            window.lib.an_TextInput.prototype._handleDrawEnd = function () {};
            // noinspection JSUnusedGlobalSymbols
            window.lib.an_TextInput.prototype._updateVisibility = function () {};
        }
        if (this._clip && this._clip.loadLevelTextInput) {
            this._clip.loadLevelTextInput._handleDrawEnd = function () {};
            this._clip.loadLevelTextInput._updateVisibility = function () {};
        }

        // 3. Gắn sự kiện các nút chính
        this._bindButton(this._clip.startNewGame, () => {
            this._teardownPasscodeInput();
            // Đặt lại màn 1 khi chọn Bắt đầu chơi mới
            if (this._storageService) {
                this._storageService.saveLevel(1);
            }
            if (typeof window !== "undefined" && window.stage) {
                if (window.stage.localSave) window.stage.localSave.save(1);
                window.stage.levelNumber = 1;
            }
            this.stop();

            if (this._callbacks.startNewGame) {
                this._callbacks.startNewGame();
            } else {
                this._clip.gotoAndPlay(MainMenu.LABELS.START_NEW_GAME);
            }
        });

        this._bindButton(this._clip.resumeGame, () => {
            this._teardownPasscodeInput();
            const savedLevel = this._storageService ? this._storageService.getSavedLevel() : -1;
            if (savedLevel > 0) {
                this.stop();
                if (this._callbacks.resumeGame) {
                    this._callbacks.resumeGame(savedLevel);
                } else {
                    this._clip.gotoAndPlay(MainMenu.LABELS.RESUME_GAME);
                }
            }
        });

        this._bindButton(this._clip.loadStage, () => {
            this._teardownPasscodeInput();
            this._clip.gotoAndPlay(MainMenu.LABELS.LOAD_STAGE);

            // Chờ hoạt cảnh chuyển cảnh từ menu chính sang Load Stage (frame 198 -> 220) hoàn tất
            const onTransitionTick = () => {
                if (!this._clip) return;
                if (this._clip.currentFrame >= 220) {
                    this._clip.removeEventListener("tick", onTransitionTick);
                    this._loadStageTickListener = null;

                    // Chỉ hiển thị ô nhập nếu vẫn đang dừng ở màn hình Load Stage (frame 220)
                    if (this._clip.currentFrame >= 220 && this._clip.currentFrame < 268) {
                        this._setupPasscodeInput();
                    }
                }
            };

            this._loadStageTickListener = onTransitionTick;
            this._clip.addEventListener("tick", onTransitionTick);
        });

        this._bindButton(this._clip.toggleSound, () => {
            if (this._audioService) {
                this._audioService.toggleSound();
            }
            if (this._callbacks.toggleSound) {
                this._callbacks.toggleSound();
            }
        });

        this._bindButton(this._clip.credits, () => {
            this._teardownPasscodeInput();
            this._clip.gotoAndPlay(MainMenu.LABELS.CREDITS);
        });

        // Nút quay lại từ màn hình Credits
        this._bindButton(this._clip.creditback, () => {
            this._clip.play();
        });

        // Nút quay lại từ màn hình nhập Passcode (bback)
        this._bindButton(this._clip.bback, () => {
            this._teardownPasscodeInput();
            this._clip.gotoAndPlay(MainMenu.LABELS.SKIPPED);
        });
    }

    /**
     * Gắn âm thanh hover và âm thanh khi nhấn chuột cho nút bấm.
     * Tác dụng: Tạo phản hồi âm thanh sống động khi người chơi tương tác với các nút trên Menu.
     *
     * @private
     * @param {createjs.DisplayObject} btn - Nút bấm cần gắn sự kiện.
     * @param {() => void} onClick - Hàm thực thi khi nhấp chuột.
     * @returns {void}
     */
    _bindButton(btn, onClick) {
        if (!btn) return;

        btn.addEventListener("click", onClick);

        btn.addEventListener("mouseover", () => {
            if (this._audioService) this._audioService.playAction("click");
        });

        btn.addEventListener("click", () => {
            if (this._audioService) this._audioService.playAction("latch");
        });
    }

    /**
     * Dừng timeline của MovieClip Menu.
     * Tác dụng: Đóng băng hoạt cảnh tại khung hình hiện tại.
     *
     * @returns {void}
     */
    stop() {
        if (this._clip && typeof this._clip.stop === "function") {
            this._clip.stop();
        }
    }

    /**
     * Cập nhật trạng thái hiển thị của nút Resume dựa trên dữ liệu lưu trữ trong LocalStorage.
     * Tác dụng: Nếu có dữ liệu màn chơi đã lưu (> 0), nút Resume sẽ sáng và có thể bấm được.
     * Nếu chưa từng chơi, nút Resume sẽ bị làm mờ, hiện gạch chéo và khóa không cho bấm.
     *
     * @returns {void}
     */
    updateResumeState() {
        if (!this._clip) return;

        const hasSaved = this._storageService ? this._storageService.hasSavedProgress() : false;

        if (this._clip.resumestrip) {
            // Có tiến trình lưu thì ẩn thanh gạch chéo đi, chưa có thì hiện thanh gạch chéo
            this._clip.resumestrip.visible = !hasSaved;
        }

        if (this._clip.resumeGame) {
            this._clip.resumeGame.mouseEnabled = hasSaved;
            this._clip.resumeGame.mouseChildren = hasSaved;
            this._clip.resumeGame.alpha = hasSaved ? 1.0 : 0.5;
        }
    }

    /**
     * Cập nhật vị trí và kích thước responsive của ô nhập Passcode khớp hoàn hảo với khung Canvas.
     * Tác dụng: Tính toán tỷ lệ co giãn theo chiều ngang (scaleX) và chiều dọc (scaleY) dựa trên không gian logic chuẩn 550x300
     * (tọa độ gốc: x=97, y=134, width=348, height=58), giúp ô nhập luôn nằm đúng khung viền trên mọi kích thước màn hình.
     *
     * @private
     * @returns {void}
     */
    _updatePasscodeInputLayout() {
        if (!this._passcodeInputElem) return;

        const canvas = document.getElementById("canvas");
        if (!canvas) return;

        const canvasRect = canvas.getBoundingClientRect();
        const scaleY = canvasRect.height / 300;
        const scaleX = canvasRect.width / 550;

        // Định vị chính xác ô input khớp với khung hình 550x300 chuẩn (x=97, y=134, w=348, h=58)
        const container = this._passcodeInputElem.parentElement || document.getElementById("dom_overlay_container") || canvas.parentElement;
        const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
        const leftOffset = canvasRect.left - containerRect.left;
        const topOffset = canvasRect.top - containerRect.top;

        const w = Math.round(348 * scaleX);
        const h = Math.round(58 * scaleY);
        const l = Math.round(leftOffset + 97 * scaleX);
        const t = Math.round(topOffset + 134 * scaleY);

        this._passcodeInputElem.style.position = "absolute";
        this._passcodeInputElem.style.setProperty("transform", "none", "important");
        this._passcodeInputElem.style.left = `${l}px`;
        this._passcodeInputElem.style.top = `${t}px`;
        this._passcodeInputElem.style.width = `${w}px`;
        this._passcodeInputElem.style.maxWidth = `${w}px`;
        this._passcodeInputElem.style.minWidth = `${w}px`;
        this._passcodeInputElem.style.height = `${h}px`;
        this._passcodeInputElem.style.maxHeight = `${h}px`;
        this._passcodeInputElem.style.minHeight = `${h}px`;
        this._passcodeInputElem.style.fontSize = `${Math.max(16, Math.round(26 * scaleY))}px`;
        this._passcodeInputElem.style.letterSpacing = `${Math.max(2, Math.round(4 * scaleX))}px`;
        this._passcodeInputElem.style.lineHeight = `${h}px`;
        this._passcodeInputElem.style.padding = "0px";
        this._passcodeInputElem.style.margin = "0px";
    }

    /**
     * Thiết lập và lắng nghe ô nhập Passcode 6 chữ số trên DOM.
     * Tác dụng: Tự động tạo phần tử <input> nếu chưa có, căn chỉnh vị trí khớp với Canvas,
     * lọc bỏ các ký tự không phải số và tự động kích hoạt kiểm tra khi người chơi nhập đủ 6 chữ số hoặc nhấn Enter.
     *
     * @private
     * @returns {void}
     */
    _setupPasscodeInput() {
        this._isSubmittingPasscode = false;

        // Vô hiệu hóa legacy draw handler để anwidget không can thiệp làm sai lệch layout
        if (typeof window !== "undefined" && window.lib && window.lib.an_TextInput) {
            // noinspection JSUnusedGlobalSymbols
            window.lib.an_TextInput.prototype._handleDrawEnd = function () {};
            // noinspection JSUnusedGlobalSymbols
            window.lib.an_TextInput.prototype._updateVisibility = function () {};
        }
        if (this._clip && this._clip.loadLevelTextInput) {
            this._clip.loadLevelTextInput._handleDrawEnd = function () {};
            this._clip.loadLevelTextInput._updateVisibility = function () {};
        }

        // Tìm element input trên DOM hoặc tự động tạo nếu chưa có
        let elem = document.getElementById("loadLevelTextInput");
        const domOverlay = document.getElementById("dom_overlay_container");
        const animContainer = document.getElementById("animation_container") || document.body;

        if (!elem) {
            elem = document.createElement("input");
            elem.id = "loadLevelTextInput";
            elem.type = "text";
            elem.maxLength = 6;
            if (domOverlay) {
                domOverlay.appendChild(elem);
            } else {
                animContainer.appendChild(elem);
            }
        }

        // Giữ ẩn trong quá trình áp dụng vị trí và kích thước để tránh hiện tượng nhấp nháy / lag-back
        elem.style.visibility = "hidden";
        elem.style.display = "block";
        elem.readOnly = false;
        elem.disabled = false;
        if (elem.value === undefined || elem.value === null) {
            elem.value = "";
        }
        this._passcodeInputElem = elem;

        // Tính toán và áp dụng tọa độ chuẩn đồng bộ ngay lập tức
        this._updatePasscodeInputLayout();

        // Hiển thị ô nhập sau khi đã định vị hoàn tất
        elem.style.visibility = "visible";

        // Gắn listener cập nhật tọa độ khi cửa sổ thay đổi kích thước
        if (!this._onResizeHandler) {
            this._onResizeHandler = () => this._updatePasscodeInputLayout();
            window.addEventListener("resize", this._onResizeHandler);
        }

        const handleInput = (e) => {
            const raw = e.target.value || "";
            const sanitized = raw.replace(/\D/g, "").slice(0, 6);
            if (elem.value !== sanitized) {
                elem.value = sanitized;
            }

            if (sanitized.length === 6) {
                this._validateAndSubmitPasscode(sanitized);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Enter" && elem.value.length === 6) {
                this._validateAndSubmitPasscode(elem.value);
            }
        };

        // Gỡ bỏ listener cũ nếu có trước khi gắn mới
        if (this._passcodeHandlers) {
            elem.removeEventListener("input", this._passcodeHandlers.input);
            elem.removeEventListener("keydown", this._passcodeHandlers.keydown);
        }

        elem.addEventListener("input", handleInput);
        elem.addEventListener("keydown", handleKeyDown);

        this._passcodeHandlers = { input: handleInput, keydown: handleKeyDown };

        elem.focus();
        if (elem.select) {
            elem.select();
        }
    }

    /**
     * Kiểm tra tính hợp lệ của mật mã Passcode 6 chữ số và kích hoạt chuyển màn nếu đúng.
     * Tác dụng:
     * - Nếu mã sai: Kích hoạt hoạt cảnh lắc đầu báo lỗi ("nope") trên MovieClip wrong, phát âm thanh và bôi đen ô nhập.
     * - Nếu mã đúng: Khóa ô nhập, phát hoạt cảnh "Correct passcode" trên timeline Menu và kích hoạt callback chuyển màn.
     *
     * @private
     * @param {string} code - Mã 6 chữ số cần kiểm tra.
     * @returns {void}
     */
    _validateAndSubmitPasscode(code) {
        if (!this._levelRepository || this._isSubmittingPasscode) return;

        const levelData = this._levelRepository.findLevelByPasscode(code);

        if (!levelData) {
            // Mã sai: Kích hoạt hoạt cảnh rung lắc báo lỗi "nope" của clip wrong
            if (this._clip && this._clip.wrong && typeof this._clip.wrong.gotoAndPlay === "function") {
                this._clip.wrong.gotoAndPlay("nope");
            }
            if (this._audioService) {
                this._audioService.playAction("click");
            }
            if (this._passcodeInputElem && typeof this._passcodeInputElem.select === "function") {
                this._passcodeInputElem.select();
            }
            return;
        }

        // Đánh dấu đang submit để chống gọi lặp callback
        this._isSubmittingPasscode = true;

        // Khóa input, giữ nguyên 6 số và khóa chặt kích thước không bị kéo dài
        if (this._passcodeInputElem) {
            this._passcodeInputElem.readOnly = true;
            this._passcodeInputElem.blur();
            this._updatePasscodeInputLayout();
        }

        // Kích hoạt hoạt cảnh hiển thị "Correct passcode" của timeline lib.Menu (chạy từ frame 221 đến frame 268)
        if (this._clip && typeof this._clip.play === "function") {
            this._clip.play();

            const onCorrectAnimTick = () => {
                if (!this._clip) return;
                // Duy trì kích thước cố định, đảm bảo không bị kéo dài suốt animation
                if (this._passcodeInputElem) {
                    this._updatePasscodeInputLayout();
                }
                if (this._clip.currentFrame >= 268) {
                    this._clip.removeEventListener("tick", onCorrectAnimTick);
                    this._clip.stop();
                    // Khi hoạt cảnh hoàn tất chuyển sang StageTitle, tiến hành dọn dẹp ô nhập khỏi DOM
                    this._teardownPasscodeInput();
                    if (this._callbacks.loadPasscode) {
                        this._callbacks.loadPasscode(levelData.level);
                    }
                }
            };
            this._clip.addEventListener("tick", onCorrectAnimTick);
        } else {
            this._teardownPasscodeInput();
            if (this._callbacks.loadPasscode) {
                this._callbacks.loadPasscode(levelData.level);
            }
        }
    }

    /**
     * Ẩn và dọn dẹp ô nhập passcode khỏi DOM và timeline.
     * Tác dụng: Ngăn chặn ô nhập che khuất màn hình chơi và giải phóng các bộ lắng nghe sự kiện.
     *
     * @private
     * @returns {void}
     */
    _teardownPasscodeInput() {
        if (this._loadStageTickListener && this._clip) {
            this._clip.removeEventListener("tick", this._loadStageTickListener);
            this._loadStageTickListener = null;
        }

        if (this._onResizeHandler) {
            window.removeEventListener("resize", this._onResizeHandler);
            this._onResizeHandler = null;
        }

        // Tách element anwidget nếu có một cách an toàn
        try {
            if (this._clip && this._clip.loadLevelTextInput && this._clip.loadLevelTextInput._element && typeof this._clip.loadLevelTextInput._element.detach === "function") {
                this._clip.loadLevelTextInput._element.detach();
            }
        } catch (e) {}

        const elem = this._passcodeInputElem || document.getElementById("loadLevelTextInput");
        if (elem) {
            if (this._passcodeHandlers) {
                elem.removeEventListener("input", this._passcodeHandlers.input);
                elem.removeEventListener("keydown", this._passcodeHandlers.keydown);
                this._passcodeHandlers = null;
            }
            elem.style.display = "none";
            if (elem.parentNode) {
                elem.parentNode.removeChild(elem);
            }
            this._passcodeInputElem = null;
        }
    }

    /**
     * Bỏ qua hoạt cảnh giới thiệu tiêu đề, đưa Menu nhảy thẳng vào khung hình menu chính.
     * Tác dụng: Giúp người chơi quay lại menu nhanh chóng mà không phải xem lại intro dài.
     *
     * @returns {void}
     */
    skipIntro() {
        if (this._clip) {
            this._clip.gotoAndPlay(MainMenu.LABELS.SKIPPED);
        }
    }

    /**
     * Lấy đối tượng DisplayObject CreateJS của Menu để thêm vào Stage.
     *
     * @returns {createjs.MovieClip|null}
     */
    getDisplayObject() {
        return this._clip;
    }

    /**
     * Đăng ký callback khi người chơi nhấp chọn nút "Start New Game".
     * Tác dụng: Bắt đầu chơi mới từ màn 1.
     *
     * @param {() => void} cb
     * @returns {void}
     */
    onStartNewGame(cb) {
        this._callbacks.startNewGame = cb;
    }

    /**
     * Đăng ký callback khi người chơi nhấp chọn nút "Resume Game".
     * Tác dụng: Tiếp tục chơi từ màn chơi đã lưu trong LocalStorage.
     *
     * @param {(savedLevel: number) => void} cb
     * @returns {void}
     */
    onResumeGame(cb) {
        this._callbacks.resumeGame = cb;
    }

    /**
     * Đăng ký callback khi người chơi nhập đúng mã Passcode 6 chữ số.
     * Tác dụng: Chuyển thẳng vào màn chơi tương ứng với passcode đó.
     *
     * @param {(levelNumber: number) => void} cb
     * @returns {void}
     */
    onLoadPasscode(cb) {
        this._callbacks.loadPasscode = cb;
    }

    /**
     * Dọn dẹp toàn bộ tài nguyên của Menu chính.
     * Tác dụng: Gỡ ô nhập khỏi DOM và xóa MovieClip khỏi cây hiển thị để chống rò rỉ bộ nhớ.
     *
     * @returns {void}
     */
    destroy() {
        this._teardownPasscodeInput();
        if (this._clip) {
            this._clip.stop();
            if (this._clip.parent) {
                this._clip.parent.removeChild(this._clip);
            }
        }
        this._clip = null;
    }
}
