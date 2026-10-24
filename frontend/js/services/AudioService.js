/**
 * @file AudioService.js
 * @description Quản lý hệ thống âm thanh trò chơi bằng CreateJS SoundJS,
 * bao gồm phát hiệu ứng âm thanh va chạm gạch, công tắc, kết thúc màn chơi,
 * giải thuật chọn biến thể ngẫu nhiên chống lặp âm và điều khiển nhạc nền ambient.
 */

export class AudioService {
    /**
     * Bảng ánh xạ nhãn logic của hành động trong game sang Sound ID thực tế nạp trong SoundJS.
     * Tác dụng: Phân tách logic gameplay khỏi tên tệp âm thanh cụ thể, giúp dễ bảo trì và thay đổi tài nguyên.
     * @private
     * @readonly
     */
    static SOUND_MAP = Object.freeze({
        // Biến thể gạch lớn lăn trên sàn đá thường (6 âm khác nhau)
        clonk0: "blox004wav",
        clonk1: "blox005wav",
        clonk2: "blox006wav",
        clonk3: "blox007wav",
        clonk4: "blox008wav",
        clonk5: "blox009wav",

        // Biến thể gạch nhỏ lăn trên sàn đá thường (6 âm khác nhau)
        half0: "blox010wav",
        half1: "blox011wav",
        half2: "blox012wav",
        half3: "blox013wav",
        half4: "blox014wav",
        half5: "blox015wav",

        // Biến thể gạch lớn lăn trên cầu sắt (3 âm đanh giòn)
        metal0: "blox016wav",
        metal1: "blox017wav",
        metal2: "blox018wav",

        // Biến thể gạch nhỏ lăn trên cầu sắt (3 âm đanh giòn)
        halfmetal0: "blox019wav",
        halfmetal1: "blox020wav",
        halfmetal2: "blox021wav",

        // Biến thể gạch cam mỏng giòn (3 âm rỗng)
        hollow0: "blox022wav",
        hollow1: "blox023wav",
        hollow2: "blox024wav",

        // Âm thanh kích hoạt công tắc
        smallswitch: "blox025wav",
        bigswitch: "blox026wav",

        // Kết thúc màn chơi (thắng hoặc thua)
        lose: "mech5wav",
        win: "blox003wav",

        // Tương tác nút bấm Menu & thao tác khối
        tick: "Click",
        click: "Click",
        join: "Latch",
        latch: "Latch",

        // Hiệu ứng âm thanh đặc biệt
        stageDrop: "blox2wav",
        unsplit: "unsplitwav",
        music: "Music"
    });

    /**
     * Khởi tạo dịch vụ âm thanh, đồng bộ cài đặt âm lượng từ LocalStorage và đăng ký hook phát âm thanh toàn cục.
     */
    constructor() {
        /**
         * Lưu chỉ số biến thể vừa phát gần nhất của từng thể loại để ngăn chặn phát trùng 2 âm thanh giống nhau liên tiếp.
         * @private
         * @type {Map<string, number>}
         */
        this._lastVariations = new Map();

        /**
         * Instance nhạc nền đang phát (Menu hoặc màn hình Victory).
         * @private
         * @type {createjs.AbstractSoundInstance|null}
         */
        this._bgmInstance = null;

        /**
         * Trạng thái bật hoặc tắt âm thanh của trò chơi (true: bật, false: tắt).
         * @private
         * @type {boolean}
         */
        this._soundEnabled = true;

        this._initStorageAndMute();
        this._registerGlobalHook();
    }

    /**
     * Khởi tạo và đồng bộ trạng thái âm thanh từ kho lưu trữ LocalStorage.
     * Tác dụng: Phục hồi cài đặt âm lượng người chơi đã chọn trong các phiên chơi trước.
     *
     * @private
     * @returns {void}
     */
    _initStorageAndMute() {
        try {
            const saved = window.localStorage ? window.localStorage.getItem("soundEnabled") : null;
            if (saved === null || saved === undefined) {
                this._soundEnabled = true;
            } else {
                this._soundEnabled = saved === "1" || saved === "true";
            }
        } catch {
            this._soundEnabled = true;
        }

        this.setSoundEnabled(this._soundEnabled);
    }

    /**
     * Đăng ký hàm phát âm thanh toàn cục `window.playSound` để các MovieClip và hoạt cảnh có thể phát âm thanh thuận tiện.
     * Tác dụng: Cung cấp cầu nối phát âm thanh cho các animation nhúng sẵn trong SpriteSheet hoặc CreateJS stage.
     *
     * @private
     * @returns {void}
     */
    _registerGlobalHook() {
        if (typeof window !== "undefined") {
            window.playSound = (id, loop = 0) => {
                return this.playDirect(id, loop);
            };
        }
    }

    /**
     * @public
     * @api
     * Lấy trạng thái âm thanh hiện tại của hệ thống.
     * Tác dụng: Cung cấp thông tin để hiển thị biểu tượng âm thanh bật/tắt trên giao diện.
     *
     * @returns {boolean} True nếu âm thanh đang được bật, False nếu đang tắt.
     */
    // noinspection JSUnusedGlobalSymbols
    isSoundEnabled() {
        return this._soundEnabled;
    }

    /**
     * Đặt trạng thái bật hoặc tắt âm thanh cho toàn bộ trò chơi và ghi nhớ vào LocalStorage.
     * Tác dụng: Điều chỉnh âm lượng CreateJS Sound (volume = 1 hoặc 0) và lưu lại tùy chọn của người dùng.
     *
     * @param {boolean} enabled - Trạng thái âm thanh mới.
     * @returns {void}
     */
    setSoundEnabled(enabled) {
        this._soundEnabled = Boolean(enabled);

        if (typeof createjs !== "undefined" && createjs.Sound) {
            createjs.Sound.volume = this._soundEnabled ? 1 : 0;
        }

        try {
            if (window.localStorage) {
                window.localStorage.setItem("soundEnabled", this._soundEnabled ? "1" : "0");
            }
        } catch {
            // Bỏ qua lỗi nếu LocalStorage bị giới hạn trên trình duyệt
        }
    }

    /**
     * Chuyển đổi trạng thái âm thanh giữa Bật và Tắt.
     * Tác dụng: Phục vụ khi người chơi nhấn nút Mute/Unmute trên giao diện hoặc menu cài đặt.
     *
     * @returns {boolean} Trạng thái mới sau khi chuyển đổi.
     */
    toggleSound() {
        this.setSoundEnabled(!this._soundEnabled);
        return this._soundEnabled;
    }

    /**
     * Thuật toán chọn ngẫu nhiên biến thể âm thanh đảm bảo không bị lặp lại âm vừa phát trước đó.
     * Tác dụng: Tạo âm thanh bước đi đa dạng, tự nhiên và sống động, tránh cảm giác đơn điệu khi khối lăn liên tục.
     *
     * @private
     * @param {string} category - Nhóm loại âm thanh (ví dụ: "clonk", "half", "metal", "halfmetal", "hollow").
     * @param {number} variations - Tổng số lượng biến thể có sẵn trong nhóm.
     * @returns {number} Chỉ số biến thể tiếp theo (chắc chắn khác chỉ số trước đó).
     */
    _getNextVariation(category, variations) {
        if (variations <= 1) {
            return 0;
        }

        const prev = this._lastVariations.has(category) ? this._lastVariations.get(category) : -1;
        let next = prev;

        // Vòng lặp đảm bảo biến thể tiếp theo luôn khác biến thể vừa phát
        while (next === prev) {
            next = Math.floor(Math.random() * variations);
        }

        this._lastVariations.set(category, next);
        return next;
    }

    /**
     * Phát âm thanh trực tiếp bằng Sound ID đã đăng ký trong CreateJS Sound.
     * Tác dụng: Phát một hiệu ứng âm thanh cụ thể với cờ ngắt sớm (INTERRUPT_EARLY) để tránh nghẽn kênh âm thanh.
     *
     * @param {string} soundId - Tên định danh của âm thanh (ví dụ: "blox004wav", "mech5wav", "Click").
     * @param {number} [loop=0] - Số lần lặp lại (0: phát 1 lần rồi dừng, -1: lặp vô hạn).
     * @returns {createjs.AbstractSoundInstance|null} Đối tượng âm thanh đang phát hoặc null nếu không thành công.
     */
    playDirect(soundId, loop = 0) {
        if (typeof createjs === "undefined" || !createjs.Sound) {
            return null;
        }

        try {
            return createjs.Sound.play(
                soundId,
                createjs.Sound.INTERRUPT_EARLY,
                0,
                0,
                loop
            );
        } catch {
            return null;
        }
    }

    /**
     * Phát âm thanh theo tên nhóm và nhãn biến thể có chọn lọc ngẫu nhiên.
     * Tác dụng: Tự động ghép nhãn và chỉ số biến thể (ví dụ: "clonk" + 2 -> "clonk2") rồi phát âm thanh tương ứng.
     *
     * @param {string} name - Tên nhóm âm thanh ("clonk", "end", "join").
     * @param {string} label - Nhãn biến thể cơ sở (ví dụ: "clonk", "half", "metal", "win", "lose").
     * @param {number} [variations=0] - Số lượng biến thể trong nhóm (0 nếu là âm đơn lẻ).
     * @returns {createjs.AbstractSoundInstance|null} Instance âm thanh vừa kích hoạt.
     */
    play(name, label, variations = 0) {
        let finalLabel = label;

        if (variations > 0) {
            const nextIndex = this._getNextVariation(label, variations);
            finalLabel = `${label}${nextIndex}`;
        }

        const soundId = AudioService.SOUND_MAP[finalLabel] || finalLabel;
        return this.playDirect(soundId);
    }

    /**
     * @public
     * @api
     * Phát hiệu ứng âm thanh khi khối hộp hoàn thành một bước lăn và tiếp đất lên mặt sàn.
     * Tác dụng: Phát ra tiếng gõ đá, tiếng va chạm kim loại hoặc tiếng rỗng tùy theo chất liệu sàn dưới chân khối.
     *
     * @param {string} soundType - Loại chất liệu mặt sàn ("clonk", "half", "metal", "halfmetal", "hollow").
     * @param {number} variations - Số lượng biến thể âm thanh của chất liệu đó (3 hoặc 6).
     * @returns {createjs.AbstractSoundInstance|null}
     */
    // noinspection JSUnusedGlobalSymbols
    playLanding(soundType, variations) {
        return this.play("clonk", soundType, variations);
    }

    /**
     * @public
     * @api
     * Phát âm thanh khi khối hộp lăn đè lên công tắc sàn.
     * Tác dụng: Tạo phản hồi âm thanh xác nhận công tắc đã được kích hoạt thành công (tiếng nhẹ hoặc tiếng nặng).
     *
     * @param {("small"|"big")} switchType - "small" cho công tắc nhẹ/phân thân, "big" cho công tắc nặng chữ X.
     * @returns {createjs.AbstractSoundInstance|null}
     */
    // noinspection JSUnusedGlobalSymbols
    playSwitch(switchType) {
        const label = switchType === "big" ? "bigswitch" : "smallswitch";
        return this.play("clonk", label, 0);
    }

    /**
     * Phát âm thanh kết thúc màn chơi tương ứng với kết quả thắng hoặc thua.
     * Tác dụng: Phát tiếng chuông hoàn thành màn chơi ("win") hoặc tiếng kim loại sập vỡ ("lose") khi rơi vực.
     *
     * @param {("win"|"lose")} outcome - Kết quả của màn chơi ("win" hoặc "lose").
     * @returns {createjs.AbstractSoundInstance|null}
     */
    playOutcome(outcome) {
        const soundId = outcome === "win" ? AudioService.SOUND_MAP.win : AudioService.SOUND_MAP.lose;
        return this.playDirect(soundId);
    }

    /**
     * Phát âm thanh cho các tương tác người dùng hoặc thao tác đặc biệt với khối hộp.
     * Tác dụng: Tạo phản hồi âm thanh khi bấm nút menu ("click"), chốt cửa ("latch"), nhập khối ("join"), gộp khối ("unsplit").
     *
     * @param {("click"|"latch"|"join"|"tick"|"unsplit")} action - Tên hành động tương tác.
     * @returns {createjs.AbstractSoundInstance|null}
     */
    playAction(action) {
        const soundId = AudioService.SOUND_MAP[action] || action;
        return this.playDirect(soundId);
    }

    /**
     * Kiểm tra xem nhạc nền có đang trong trạng thái phát hay không.
     * Tác dụng: Ngăn chặn việc phát lặp hoặc tạo nhiều luồng nhạc nền đè lên nhau.
     *
     * @returns {boolean} True nếu bài nhạc đang phát thành công.
     */
    isMusicPlaying() {
        return Boolean(
            this._bgmInstance &&
            (this._bgmInstance.playState === createjs.Sound.PLAY_SUCCEEDED || this._bgmInstance.playState === "playSucceeded")
        );
    }

    /**
     * Phát nhạc nền không gian ambient của trò chơi (Music.mp3).
     * Tác dụng: Tạo bầu không khí thư giãn, tập trung cho người chơi trên Menu chính và màn hình hoàn thành.
     *
     * @param {number} [loop=-1] - Số lần lặp (-1: lặp vô hạn trên Menu, 0: phát một lần trên màn hình Victory).
     * @returns {createjs.AbstractSoundInstance|null} Instance nhạc nền đang phát.
     */
    playMusic(loop = -1) {
        if (typeof createjs === "undefined" || !createjs.Sound) {
            return null;
        }

        // Nếu nhạc nền đang phát bình thường thì không khởi tạo thêm luồng mới
        if (this.isMusicPlaying()) {
            return this._bgmInstance;
        }

        try {
            this._bgmInstance = createjs.Sound.play("Music", { loop });
            if (this._bgmInstance) {
                this._bgmInstance.on("complete", () => {
                    this._bgmInstance = null;
                });
            }
            return this._bgmInstance;
        } catch {
            return null;
        }
    }

    /**
     * Dừng ngay lập tức bài nhạc nền đang phát.
     * Tác dụng: Tắt nhạc nền khi người chơi bước vào màn chơi chính để tập trung giải câu đố mà không bị xao nhãng.
     *
     * @returns {void}
     */
    stopMusic() {
        if (this._bgmInstance) {
            try {
                this._bgmInstance.stop();
            } catch {
                // Bỏ qua lỗi ngắt luồng audio nếu có
            }
            this._bgmInstance = null;
        }
    }
}
