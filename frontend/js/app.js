// 1. Data & Utils
import { AssetManifest } from "./data/AssetManifest.js";
import { AtlasMetadata } from "./data/AtlasMetadata.js";
import { LevelRepository } from "./data/LevelRepository.js";

// 2. Services
import { AudioService } from "./services/AudioService.js";
import { InputService } from "./services/InputService.js";
import { StorageService } from "./services/StorageService.js";
import { TimerService } from "./services/TimerService.js";

// 3. UI Components
import { Renderer } from "./ui/Renderer.js";
import { Hud } from "./ui/Hud.js";
import { OnScreenControls } from "./ui/OnScreenControls.js";
import { PauseMenu } from "./ui/PauseMenu.js";
import { MainMenu } from "./ui/MainMenu.js";
import { InstructionsModal } from "./ui/InstructionsModal.js";
import { VictoryModal } from "./ui/VictoryModal.js";
import { StageTitle } from "./ui/StageTitle.js";

// 4. Core Engine
import { EventBus } from "./core/EventBus.js";
import { StateMachine } from "./core/StateMachine.js";
import { GameEngine } from "./core/GameEngine.js";

class App {
    /**
     * Khởi động ứng dụng khi trang web đã tải xong DOM.
     */
    static async bootstrap() {
        console.log("%c[Bloxorz] Đang khởi động hệ thống...", "color: #00bcd4; font-weight: bold;");

        const canvas = document.getElementById("canvas") || document.getElementById("gameCanvas");
        const container = document.getElementById("animation_container") || document.getElementById("canvas-container");
        const preloader = document.getElementById("_preload_div_") || document.getElementById("preloader");
        const progressBar = document.getElementById("progress-bar");

        if (!canvas) {
            console.error("[Bloxorz] Không tìm thấy thẻ <canvas>.");
            return;
        }

        // 1. Kiểm tra hỗ trợ cảm ứng
        const isTouch = OnScreenControls.isTouchDevice();

        // 2. Khởi tạo Stage CreateJS và gán các thuộc tính tương thích cho Animate MovieClip
        const stage = new createjs.Stage(canvas);
        window.stage = stage;
        stage.touchMode = isTouch;
        stage.doneIntro = false;

        // Vô hiệu hóa _handleDrawEnd legacy của Adobe Animate can thiệp làm co giãn/nhảy ô nhập Passcode
        if (typeof window !== "undefined" && window.lib && window.lib.an_TextInput) {
            window.lib.an_TextInput.prototype._handleDrawEnd = function () {};
            window.lib.an_TextInput.prototype._updateVisibility = function () {};
        }
        stage.localSave = {
            get: () => {
                try {
                    const saved = localStorage.getItem("level");
                    return saved !== null ? parseInt(saved, 10) : -1;
                } catch (e) {
                    return -1;
                }
            },
            save: (level) => {
                try {
                    localStorage.setItem("level", String(level));
                } catch (e) {}
            }
        };
        stage.levelCodes = LevelRepository.LEVEL_CODES;
        window.getLevelCodes = () => LevelRepository.LEVEL_CODES;
        stage.soundSave = {
            get: () => true,
            save: () => {}
        };
        stage.toggleSound = () => {
            createjs.Sound.muted = !createjs.Sound.muted;
        };

        window.buttonsWithSounds = window.buttonsWithSounds || [];
        window.addButtonSounds = function (btn) {
            if (!btn || window.buttonsWithSounds.indexOf(btn) !== -1) return;
            window.buttonsWithSounds.push(btn);
            btn.addEventListener("mouseover", function () {
                if (window.createjs && createjs.Sound) {
                    createjs.Sound.play("Click");
                }
            });
        };

        if (isTouch) {
            createjs.Touch.enable(stage);
        }
        stage.enableMouseOver(isTouch ? 0 : 10);

        // Thiết lập tốc độ khung hình tiêu chuẩn (36 FPS để đồng bộ chính xác với chu kỳ vật lý)
        createjs.Ticker.framerate = 36;
        createjs.Ticker.timingMode = createjs.Ticker.RAF_SYNCHED;

        // 3. Khởi tạo hàng đợi tải tài nguyên (PreloadJS & SoundJS)
        createjs.Sound.registerPlugins([createjs.WebAudioPlugin, createjs.HTMLAudioPlugin]);
        const queue = new createjs.LoadQueue(true);
        queue.installPlugin(createjs.Sound);

        // Theo dõi tiến trình tải (Progress Bar)
        queue.on("progress", (evt) => {
            const pct = Math.floor(evt.progress * 100);
            if (progressBar) {
                progressBar.style.width = `${pct}%`;
            }
        });

        // Xử lý lỗi nạp file
        queue.on("error", (err) => {
            console.warn("[Bloxorz Preloader] Lỗi khi tải tài nguyên:", err);
        });

        // Khi toàn bộ tài nguyên đã tải xong
        queue.on("complete", () => {
            console.log("%c[Bloxorz] Tải tài nguyên hoàn tất 100%!", "color: #4caf50; font-weight: bold;");

            // 4. Đăng ký Atlas Frames vào CreateJS SpriteSheet
            App._setupSpriteSheets(queue);

            // Ẩn preloader, hiện Canvas & Overlay container
            if (preloader) preloader.style.display = "none";
            canvas.style.display = "block";
            const domOverlay = document.getElementById("dom_overlay_container");
            if (domOverlay) domOverlay.style.display = "block";

            // Đảm bảo window.lib được sẵn sàng
            if (typeof window !== "undefined" && window.AdobeAn && !window.lib) {
                const comp = window.AdobeAn.getComposition("FE31B685947E79408F0C8768D6EC8517");
                if (comp && comp.getLibrary) {
                    window.lib = comp.getLibrary();
                }
            }

            // 5. Khởi tạo Dependency Injection Container
            const engine = App._buildGameEngine({ stage, canvas, container, isTouch });

            // 6. Kích hoạt Game
            engine.init();
        });

        // Bắt đầu nạp toàn bộ ảnh và 40 file âm thanh
        const manifest = AssetManifest.getManifest();
        queue.loadManifest(manifest);
    }

    /**
     * Đăng ký dữ liệu cắt khung hình từ AtlasMetadata vào SpriteSheet của CreateJS/AdobeAn.
     * Tương đương hàm `handleComplete` trong `index.html#L93-103`.
     * @private
     * @param {createjs.LoadQueue} queue
     */
    static _setupSpriteSheets(queue) {
        if (typeof window === "undefined" || !window.AdobeAn) return;

        const compId = (window.AdobeAn.bootcompsLoaded && window.AdobeAn.bootcompsLoaded[0]) || "FE31B685947E79408F0C8768D6EC8517";
        const comp = window.AdobeAn.getComposition(compId);
        if (!comp) return;

        if (window.AdobeAn.compositionLoaded) {
            window.AdobeAn.compositionLoaded(compId);
        }

        if (!window.lib && comp.getLibrary) {
            window.lib = comp.getLibrary();
        }

        const ss = comp.getSpriteSheet();
        const ssMetadata = AtlasMetadata.METADATA;

        for (let i = 0; i < ssMetadata.length; i++) {
            const meta = ssMetadata[i];
            const imageResult = queue.getResult(meta.name);
            if (imageResult) {
                ss[meta.name] = new createjs.SpriteSheet({
                    images: [imageResult],
                    frames: meta.frames
                });
            }
        }
    }

    /**
     * Khởi tạo toàn bộ các thành phần và lắp ráp vào GameEngine.
     * @private
     * @param {Object} ctx
     * @param {createjs.Stage} ctx.stage
     * @param {HTMLCanvasElement} ctx.canvas
     * @param {HTMLElement} ctx.container
     * @param {boolean} ctx.isTouch
     * @returns {GameEngine}
     */
    static _buildGameEngine(ctx) {
        const { stage, canvas, container, isTouch } = ctx;

        // Core Infrastructure
        const eventBus = new EventBus();
        const stateMachine = new StateMachine({ eventBus });
        const levelRepository = new LevelRepository();

        // Services
        const audioService = new AudioService();
        const inputService = new InputService();
        const storageService = new StorageService();
        const timerService = new TimerService();

        // UI & Graphics
        const renderer = new Renderer({ stage, isTouch });
        const hud = new Hud({ isTouch, audioService });
        const onScreenControls = new OnScreenControls({ inputService });
        const pauseMenu = new PauseMenu({ audioService });
        const mainMenu = new MainMenu({ storageService, audioService, levelRepository });
        const instructionsModal = new InstructionsModal({ audioService });
        const victoryModal = new VictoryModal({ audioService, storageService });
        const stageTitle = new StageTitle({ audioService });

        // Kết nối cơ chế Responsive tự động co giãn Canvas
        const handleResize = () => renderer.resize(canvas, container);
        window.addEventListener("resize", handleResize);
        handleResize();

        // Mở khóa âm thanh WebAudio tự động trên trình duyệt hiện đại theo chính sách autoplay
        let engineRef = null;
        const unlockAudio = () => {
            if (createjs.WebAudioPlugin && createjs.WebAudioPlugin.context) {
                const ctx = createjs.WebAudioPlugin.context;
                if (ctx.state === "suspended") {
                    ctx.resume().then(() => {
                        if (engineRef && typeof engineRef.resumeMenuMusic === "function") {
                            engineRef.resumeMenuMusic();
                        }
                    }).catch(() => {});
                } else if (engineRef && typeof engineRef.resumeMenuMusic === "function") {
                    engineRef.resumeMenuMusic();
                }
            }
            window.removeEventListener("click", unlockAudio);
            window.removeEventListener("touchstart", unlockAudio);
            window.removeEventListener("keydown", unlockAudio);
        };
        window.addEventListener("click", unlockAudio, { passive: true });
        window.addEventListener("touchstart", unlockAudio, { passive: true });
        window.addEventListener("keydown", unlockAudio, { passive: true });

        // Lắp ráp toàn bộ vào GameEngine
        const engine = new GameEngine({
            eventBus,
            stateMachine,
            levelRepository,
            audioService,
            inputService,
            storageService,
            timerService,
            renderer,
            hud,
            onScreenControls,
            pauseMenu,
            mainMenu,
            instructionsModal,
            victoryModal,
            stageTitle
        });
        engineRef = engine;
        return engine;
    }
}

// Khởi chạy ứng dụng ngay khi DOM sẵn sàng
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => App.bootstrap());
} else {
    App.bootstrap();
}