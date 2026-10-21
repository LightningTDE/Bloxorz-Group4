export const CANVAS_CONFIG = {
    COMPOSITION_ID: "FE31B685947E79408F0C8768D6EC8517",
    WIDTH: 550,
    HEIGHT: 300,
    FPS: 36,
    BG_COLOR: "#000000",
    OPACITY: 1.0
};

export const THEMES = {
    ORIGINAL: "original",
    GRAY: "gray",
    HOLIDAY: "holiday"
};

export const THEME_FILES = {
    [THEMES.ORIGINAL]: "bloxorz_atlas_original.png",
    [THEMES.GRAY]: "bloxorz_atlas_gray.png",
    [THEMES.HOLIDAY]: "bloxorz_atlas_holiday.png"
};

export class AssetManifest {
    /**
     * Lấy theme hiện tại từ Query Params (?img=...) hoặc fallback về 'original'
     * @returns {string}
     */
    static getThemeFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const theme = params.get("img");
        return THEME_FILES[theme] ? theme : THEMES.ORIGINAL;
    }

    /**
     * Sinh danh sách 34 file âm thanh lăn khối (blox003wav -> blox036wav)
     * Thay thế 34 dòng copy-paste thủ công của code cũ
     * @param {string} soundPath - Đường dẫn thư mục sounds
     * @returns {Array<{src: string, id: string}>}
     */
    static generateRollingSounds(soundPath) {
        const sounds = [];
        for (let i = 3; i <= 36; i++) {
            const numStr = String(i).padStart(3, "0"); // Tạo chuỗi: "003", "004", ..., "036"
            const id = `blox${numStr}wav`;
            sounds.push({ src: `${soundPath}${id}.mp3`, id: id });
        }
        return sounds;
    }

    /**
     * Tạo mảng Manifest hoàn chỉnh cho createjs.LoadQueue
     * @param {string} theme - Theme đã chọn
     * @param {Object} paths - Đường dẫn tùy biến tới folder resources
     * @returns {Array<{src: string, id: string}>}
     */
    static createManifest(theme = THEMES.ORIGINAL, paths = {}) {
        const assetPath = paths.assets || "../resources/assets/";
        const soundPath = paths.sounds || "../resources/sounds/";
        const themeFileName = THEME_FILES[theme] || THEME_FILES[THEMES.ORIGINAL];
        return [
            // 1. File ảnh Atlas Spritesheet theo theme
            { src: `${assetPath}${themeFileName}`, id: "bloxorz_atlas_" },
            // 2. Các âm thanh hiệu ứng & Giao diện
            { src: `${soundPath}Click.mp3`, id: "Click" },
            { src: `${soundPath}Latch.mp3`, id: "Latch" },
            { src: `${soundPath}Music.mp3`, id: "Music" },
            { src: `${soundPath}blox2wav.mp3`, id: "blox2wav" },       // Âm thanh rơi vực thẳm
            { src: `${soundPath}mech5wav.mp3`, id: "mech5wav" },       // Âm thanh đóng mở cầu
            { src: `${soundPath}unsplitwav.mp3`, id: "unsplitwav" },   // Âm thanh hợp nhất 2 khối nhỏ
            // 3. 34 file âm thanh va chạm khi lăn khối hộp
            ...this.generateRollingSounds(soundPath)
        ];
    }

    /**
     * Lấy Manifest theo theme hiện tại (tương thích app.js)
     * @param {string} [theme]
     * @param {Object} [paths]
     * @returns {Array<{src: string, id: string}>}
     */
    static getManifest(theme, paths) {
        return this.createManifest(theme || this.getThemeFromUrl(), paths);
    }
}
