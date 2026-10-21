/**
 * @file LevelRepository.js
 * @description Kho lưu trữ và quản lý dữ liệu các màn chơi, bao gồm mã passcode 6 chữ số,
 * nạp cấu trúc bản đồ JSON từ tài nguyên, lưu đệm (cache) bộ nhớ và tra cứu màn chơi.
 */

/**
 * Tổng số lượng màn chơi trong trò chơi.
 * Tác dụng: Giới hạn phạm vi hợp lệ của số thứ tự màn chơi từ 1 đến 33.
 * @type {number}
 */
export const TOTAL_LEVELS = 33;

/**
 * Lớp quản lý dữ liệu màn chơi, cung cấp các phương thức bất đồng bộ nạp cấu hình màn chơi,
 * tra cứu theo số thứ tự hoặc mã passcode bảo mật.
 */
export class LevelRepository {
    /**
     * Bộ nhớ đệm (Cache) lưu trữ dữ liệu các màn chơi đã nạp để tối ưu tốc độ truy xuất.
     * @private
     * @type {Map<number, Object>}
     */
    static #cache = new Map();

    /**
     * Danh sách 33 mã passcode 6 chữ số đại diện cho 33 màn chơi.
     * Tác dụng: Cho phép người chơi bỏ qua hoặc quay lại màn chơi đã lưu thông qua tính năng Load Stage.
     * @type {string[]}
     */
    static LEVEL_CODES = [
        "780464", // Stage 1
        "290299", // Stage 2
        "918660", // Stage 3
        "520967", // Stage 4
        "028431", // Stage 5
        "524383", // Stage 6
        "189493", // Stage 7
        "499707", // Stage 8
        "074355", // Stage 9
        "300590", // Stage 10
        "291709", // Stage 11
        "958640", // Stage 12
        "448106", // Stage 13
        "210362", // Stage 14
        "098598", // Stage 15
        "000241", // Stage 16
        "683596", // Stage 17
        "284933", // Stage 18
        "119785", // Stage 19
        "543019", // Stage 20
        "728724", // Stage 21
        "987319", // Stage 22
        "293486", // Stage 23
        "088198", // Stage 24
        "250453", // Stage 25
        "426329", // Stage 26
        "660141", // Stage 27
        "769721", // Stage 28
        "691859", // Stage 29
        "280351", // Stage 30
        "138620", // Stage 31
        "879021", // Stage 32
        "614955"  // Stage 33
    ];

    /**
     * Nạp dữ liệu cấu hình của một màn chơi cụ thể từ tệp JSON.
     * Tác dụng: Tải thông tin ma trận sàn, vị trí xuất phát, công tắc, cửa cầu và phân tách khối.
     *
     * @param {number} levelNum - Số thứ tự màn chơi (từ 1 đến 33).
     * @param {string} [basePath="../resources/levels/"] - Đường dẫn tương đối đến thư mục chứa tệp JSON.
     * @returns {Promise<{level: number, code: string, start: number[], grid: string[], swatches: Object, splits: Object}>} Dữ liệu màn chơi.
     * @throws {Error} Ném ngoại lệ nếu số màn chơi vượt quá khoảng [1, 33] hoặc không tải được tệp.
     */
    static async getLevel(levelNum, basePath = "../resources/levels/") {
        if (levelNum < 1 || levelNum > TOTAL_LEVELS) {
            throw new Error(`Màn chơi ${levelNum} không hợp lệ (từ 1 đến ${TOTAL_LEVELS})`);
        }

        // Tối ưu hóa: Trả về trực tiếp từ Cache nếu màn chơi đã từng được nạp
        if (this.#cache.has(levelNum)) {
            return this.#cache.get(levelNum);
        }
        const fileName = `level_${String(levelNum).padStart(2, "0")}.json`;
        const response = await fetch(`${basePath}${fileName}`);

        if (!response.ok) {
            throw new Error(`Không thể tải ${fileName} (Status: ${response.status})`);
        }

        const levelData = await response.json();
        this.#cache.set(levelNum, levelData);
        return levelData;
    }

    /**
     * Tra cứu nhanh số thứ tự màn chơi dựa vào mã passcode 6 chữ số.
     * Tác dụng: Kiểm tra tính hợp lệ của passcode người dùng nhập vào trong màn hình Menu Load Stage.
     *
     * @param {string} code - Chuỗi mã passcode cần tìm kiếm.
     * @returns {{ level: number, code: string } | null} Đối tượng thông tin màn chơi hoặc null nếu mã không tồn tại.
     */
    static findLevelByPasscode(code) {
        if (!code) return null;
        const clean = String(code).trim();
        const index = this.LEVEL_CODES.indexOf(clean);
        if (index !== -1) {
            return {
                level: index + 1,
                code: clean
            };
        }
        return null;
    }

    /**
     * Nạp toàn bộ dữ liệu cấu hình màn chơi dựa vào chuỗi mã passcode.
     * Tác dụng: Phục vụ chuyển thẳng vào màn chơi tương ứng khi người chơi nhập passcode thành công.
     *
     * @param {string} code - Mã passcode 6 chữ số.
     * @returns {Promise<Object|null>} Dữ liệu màn chơi đã tải hoặc null nếu mã không khớp.
     */
    static async getLevelByCode(code) {
        if (!code) return null;
        const cleanCode = String(code).trim();
        const found = this.findLevelByPasscode(cleanCode);
        if (found) {
            return this.getLevel(found.level);
        }
        return null;
    }

    /**
     * Lấy toàn bộ danh sách mã passcode của 33 màn chơi.
     * Tác dụng: Phục vụ kiểm tra toàn diện hoặc hỗ trợ các công cụ kiểm thử tự động.
     *
     * @returns {Promise<string[]>} Bản sao danh sách mã passcode.
     */
    static async getAllCodes() {
        return [...this.LEVEL_CODES];
    }

    // =========================================================================
    // CÁC PHƯƠNG THỨC THỂ HIỆN (INSTANCE METHODS) ĐỂ HỖ TRỢ DEPENDENCY INJECTION
    // =========================================================================

    /**
     * Phương thức thể hiện gọi getLevel.
     * @param {number} levelNum
     * @param {string} [basePath]
     * @returns {Promise<Object>}
     */
    async getLevel(levelNum, basePath = "../resources/levels/") {
        return LevelRepository.getLevel(levelNum, basePath);
    }

    /**
     * Phương thức thể hiện gọi findLevelByPasscode.
     * @param {string} code
     * @returns {{ level: number, code: string } | null}
     */
    findLevelByPasscode(code) {
        return LevelRepository.findLevelByPasscode(code);
    }

    /**
     * Phương thức thể hiện gọi getLevelByCode.
     * @param {string} code
     * @returns {Promise<Object|null>}
     */
    async getLevelByCode(code) {
        return LevelRepository.getLevelByCode(code);
    }

    /**
     * Phương thức thể hiện gọi getAllCodes.
     * @returns {Promise<string[]>}
     */
    async getAllCodes() {
        return LevelRepository.getAllCodes();
    }
}
