from typing import Any
from app.core.interfaces import IGameEngine
from app.core.models import (
    STANDING,
    HORIZONTAL_X,
    HORIZONTAL_Y,
    GRID_CONFIG,
    BloxorzState,
    BASIC_MOVES
)

class BloxorzEngine(IGameEngine):
    """Động cơ mô phỏng toàn diện thế giới vật lý và luật chơi của game Bloxorz.

    Quản lý bản đồ lưới, tư thế khối gạch 1x2 và 1x1 khi phân thân, hệ thống công tắc
    đóng mở cầu (switches), sàn gạch cam dễ vỡ và hố đích.

    Parameters
    ----------
    level_dict : dict of {str: Any}
        Cấu hình màn chơi nạp từ file JSON (gồm level, code, grid, start, swatches, splits).

    Attributes
    ----------
    level_number : int
        Số thứ tự màn chơi.
    code : str
        Mật mã passcode của màn chơi.
    grid : list of str
        Lưới ký tự đại diện cho sàn chơi và các loại gạch đặc biệt.
    start : tuple of (int, int)
        Tọa độ xuất phát (x, y) của khối gạch.
    swatches : dict of {str: Any}
        Danh sách liên kết giữa công tắc và các cây cầu tương ứng.
    splits : dict of {str: Any}
        Tọa độ vị trí hạ cánh của 2 khối nhỏ khi kích hoạt công tắc phân thân.
    rows : int
        Số hàng tối đa của lưới (10 hàng).
    cols : int
        Số cột tối đa của lưới (15 cột).
    door_coords : list of tuple of (int, int)
        Danh sách tọa độ của tất cả các ô cầu trên sàn.
    initial_doors_state : tuple of bool
        Trạng thái đóng/mở mặc định ban đầu của các cây cầu.
    door_index_map : dict of {tuple of (int, int): int}
        Bảng ánh xạ tọa độ ô cầu sang chỉ số thứ tự trong tuple doors_state.
    """
    def __init__(self, level_dict: dict[str, Any]):
        self.level_number = level_dict.get("level", 1)
        self.code = level_dict.get("code", "")
        self.grid: list[str] = level_dict.get("grid", [])
        self.start: tuple[int, int] = tuple(level_dict.get("start", [0, 0]))
        self.swatches: dict[str, Any] = level_dict.get("swatches", {})
        self.splits: dict[str, Any] = level_dict.get("splits", {})

        self.rows = GRID_CONFIG["rows"]
        self.cols = GRID_CONFIG["cols"]

        # Lập chỉ mục các ô cầu mở/đóng (door blocks)
        self.door_coords: list[tuple[int, int]] = []
        initial_doors = []
        for r in range(self.rows):
            row_str = self.grid[r]
            for c in range(len(row_str)):
                char = row_str[c]
                if char in ('l', 'r'):
                    # Cầu gập trái/phải, mặc định đóng (False)
                    self.door_coords.append((c, r))
                    initial_doors.append(False)
                elif char in ('k', 'q'):
                    # Cầu gập trái/phải, mặc định mở (True)
                    self.door_coords.append((c, r))
                    initial_doors.append(True)

        self.initial_doors_state = tuple(initial_doors)
        self.door_index_map = {coord: idx for idx, coord in enumerate(self.door_coords)}

    def get_initial_state(self) -> BloxorzState:
        """Lấy trạng thái xuất phát mặc định của màn chơi hiện tại.

        Returns
        -------
        BloxorzState
            Trạng thái khối gạch đứng thẳng (STANDING) tại điểm start với trạng thái cầu ban đầu.
        """
        return BloxorzState(
            pos_type=STANDING,
            x=self.start[0],
            y=self.start[1],
            doors_state=self.initial_doors_state,
            is_split=False
        )

    def is_cell_passable(self, x: int, y: int, doors_state: tuple[bool, ...]) -> bool:
        """Kiểm tra một ô tọa độ có phải là bề mặt sàn vững chắc để khối gạch đứng lên hay không.

        Parameters
        ----------
        x : int
            Tọa độ cột x cần kiểm tra.
        y : int
            Tọa độ hàng y cần kiểm tra.
        doors_state : tuple of bool
            Trạng thái hiện thời của các cây cầu.

        Returns
        -------
        bool
            True nếu ô tọa độ hợp lệ và có sàn (hoặc cầu đang mở), False nếu là vực thẳm hoặc cầu đóng.
        """
        if not (0 <= y < self.rows and 0 <= x < len(self.grid[y])):
            return False
        char = self.grid[y][x]
        if char == ' ':
            return False
        if (x, y) in self.door_index_map:
            idx = self.door_index_map[(x, y)]
            return doors_state[idx]
        return True

    @staticmethod
    def roll_normal(p: int, x: int, y: int, move: str) -> tuple[int, int, int] | None:
        """Tính toán quy tắc hình học 3D khi lật khối 1x2 theo 4 hướng cơ bản.

        Parameters
        ----------
        p : int
            Tư thế hiện tại (STANDING=0, HORIZONTAL_X=1, HORIZONTAL_Y=2).
        x : int
            Tọa độ cột x gốc của khối.
        y : int
            Tọa độ hàng y gốc của khối.
        move : str
            Hướng lăn ('up', 'down', 'left', 'right').

        Returns
        -------
        tuple of (int, int, int) or None
            (tư thế mới, tọa độ x mới, tọa độ y mới) hoặc None nếu hướng lăn không hợp lệ.
        """
        if p == STANDING:
            if move == 'left':  return HORIZONTAL_X, x - 2, y
            if move == 'right': return HORIZONTAL_X, x + 1, y
            if move == 'up':    return HORIZONTAL_Y, x, y - 1
            if move == 'down':  return HORIZONTAL_Y, x, y + 2
        elif p == HORIZONTAL_X:
            if move == 'left':  return STANDING, x - 1, y
            if move == 'right': return STANDING, x + 2, y
            if move == 'up':    return HORIZONTAL_X, x, y - 1
            if move == 'down':  return HORIZONTAL_X, x, y + 1
        elif p == HORIZONTAL_Y:
            if move == 'left':  return HORIZONTAL_Y, x - 1, y
            if move == 'right': return HORIZONTAL_Y, x + 1, y
            if move == 'up':    return STANDING, x, y - 2
            if move == 'down':  return STANDING, x, y + 1
        return None

    def trigger_switches(
        self,
        occupied_cells: list[tuple[int, int]],
        is_standing_full: bool,
        current_doors: tuple[bool, ...]
    ) -> tuple[bool, ...]:
        """Kích hoạt và cập nhật trạng thái đóng/mở của các cây cầu khi khối gạch đè lên công tắc.

        Parameters
        ----------
        occupied_cells : list of tuple of (int, int)
            Các ô lưới mà khối gạch đang tiếp xúc.
        is_standing_full : bool
            Cờ xác định khối có đang đứng thẳng 2 ô lên sàn hay không (yêu cầu đối với công tắc nặng 'h').
        current_doors : tuple of bool
            Trạng thái hiện tại của tất cả cây cầu.

        Returns
        -------
        tuple of bool
            Trạng thái mới của các cây cầu sau khi xử lý các công tắc liên kết.
        """
        new_doors = list(current_doors)
        changed = False

        for cx, cy in occupied_cells:
            if not (0 <= cy < self.rows and 0 <= cx < self.cols):
                continue
            char = self.grid[cy][cx]
            swatch_key = f"swatch{cx}{cy}"
            linked = self.swatches.get(swatch_key, [])

            should_trigger = (char == 's') or (char == 'h' and is_standing_full)
            if should_trigger and linked:
                for target_x, target_y, mode in linked:
                    target_coord = (target_x, target_y)
                    if target_coord in self.door_index_map:
                        door_idx = self.door_index_map[target_coord]
                        curr_val = new_doors[door_idx]
                        if mode == "onoff":
                            new_doors[door_idx] = not curr_val
                            changed = True
                        elif mode == "on" and not curr_val:
                            new_doors[door_idx] = True
                            changed = True
                        elif mode == "off" and curr_val:
                            new_doors[door_idx] = False
                            changed = True

        return tuple(new_doors) if changed else current_doors

    def transition(self, state: BloxorzState, move: str) -> tuple[BloxorzState | None, str, str]:
        """Thực hiện một bước di chuyển từ trạng thái hiện tại và kiểm tra kết quả vật lý.

        Parameters
        ----------
        state : BloxorzState
            Trạng thái khối gạch trước khi di chuyển.
        move : str
            Hành động thực hiện ('up', 'down', 'left', 'right', 'swap').

        Returns
        -------
        tuple of (BloxorzState or None, str, str)
            Bộ ba (next_state, status, message) trong đó status thuộc
            {'active', 'win', 'fall', 'invalid'}.
        """
        # /**
        #  * TRƯỜNG HỢP 1: KHỐI ĐANG BỊ TÁCH (SPLIT)
        #  */
        if state.is_split:
            if move == 'swap':
                next_active = (state.active_index + 1) % 2
                next_state = BloxorzState(
                    doors_state=state.doors_state,
                    is_split=True,
                    blocks=state.blocks,
                    active_index=next_active
                )
                return next_state, 'active', 'Đổi khối điều khiển'

            if move not in BASIC_MOVES:
                return None, 'invalid', f'Nước đi không hợp lệ: {move}'

            curr_idx = state.active_index
            bx, by = state.blocks[curr_idx]
            if move == 'left':
                nbx, nby = bx - 1, by
            elif move == 'right':
                nbx, nby = bx + 1, by
            elif move == 'up':
                nbx, nby = bx, by - 1
            elif move == 'down':
                nbx, nby = bx, by + 1
            else:
                return None, 'invalid', 'Nước đi không hợp lệ'

            # Kiểm tra ô mới có hợp lệ không
            if not self.is_cell_passable(nbx, nby, state.doors_state):
                return None, 'fall', 'Khối nhỏ rơi khỏi bàn cờ'

            new_blocks = list(state.blocks)
            new_blocks[curr_idx] = (nbx, nby)

            # Cập nhật công tắc nhẹ 's' (khối nhỏ đè lên 's' vẫn kích hoạt được)
            new_doors = self.trigger_switches([(nbx, nby)], is_standing_full=False, current_doors=state.doors_state)

            # Kiểm tra cả 2 khối nhỏ có còn đứng trên sàn hợp lệ không (tránh lỗi lơ lửng khi cầu bị rút)
            for b_idx, (b_x, b_y) in enumerate(new_blocks):
                if not self.is_cell_passable(b_x, b_y, new_doors):
                    return None, 'fall', f'Cầu bị đóng dưới chân khối {b_idx + 1}, rơi xuống vực'

            # Kiểm tra tái hợp nhất (Join) thành khối 1x2
            p1, p2 = new_blocks[0], new_blocks[1]
            # TH 1: Cùng cột x, kề nhau theo y
            if p1[0] == p2[0] and abs(p1[1] - p2[1]) == 1:
                ymax = max(p1[1], p2[1])
                joined_state = BloxorzState(
                    pos_type=HORIZONTAL_Y,
                    x=p1[0],
                    y=ymax,
                    doors_state=new_doors,
                    is_split=False
                )
                return joined_state, 'active', 'Hai khối nhỏ đã hợp nhất thành khối dọc'

            # TH 2: Cùng dòng y, kề nhau theo x
            if p1[1] == p2[1] and abs(p1[0] - p2[0]) == 1:
                xmin = min(p1[0], p2[0])
                joined_state = BloxorzState(
                    pos_type=HORIZONTAL_X,
                    x=xmin,
                    y=p1[1],
                    doors_state=new_doors,
                    is_split=False
                )
                return joined_state, 'active', 'Hai khối nhỏ đã hợp nhất thành khối ngang'

            # Nếu chưa hợp nhất, giữ nguyên trạng thái split
            next_state = BloxorzState(
                doors_state=new_doors,
                is_split=True,
                blocks=new_blocks,
                active_index=curr_idx
            )
            return next_state, 'active', 'Di chuyển khối nhỏ thành công'

        # /**
        #  * TRƯỜNG HỢP 2: KHỐI NGUYÊN BẢN (KHÔNG SPLIT)
        #  */
        if move == 'swap':
            return None, 'invalid', 'Không thể dùng lệnh swap khi khối chưa bị tách'

        if move not in BASIC_MOVES:
            return None, 'invalid', f'Nước đi không hợp lệ: {move}'

        res = self.roll_normal(state.pos_type, state.x, state.y, move)
        if not res:
            return None, 'invalid', 'Lỗi tính toán chuyển động'

        next_p, next_x, next_y = res
        temp_state = BloxorzState(next_p, next_x, next_y, state.doors_state)
        occupied = temp_state.get_occupied_cells()

        # 1. Kiểm tra toàn bộ các ô chiếm giữ có nằm trên sàn hợp lệ không
        for cx, cy in occupied:
            if not self.is_cell_passable(cx, cy, state.doors_state):
                return None, 'fall', 'Khối rơi khỏi bàn cờ'

        # 2. Kiểm tra gạch cam dễ vỡ 'f' (chỉ vỡ khi đứng thẳng 2 ô)
        if next_p == STANDING and self.grid[next_y][next_x] == 'f':
            return None, 'fall', 'Gạch cam bị vỡ vụn do khối đứng thẳng'

        # 3. Kiểm tra điều kiện THẮNG: đứng thẳng trên ô 'e'
        if next_p == STANDING and self.grid[next_y][next_x] == 'e':
            return temp_state, 'win', 'Vào hố đích thành công!'

        # 4. Kiểm tra công tắc tách khối 'v' (chỉ tách khi đứng thẳng)
        if next_p == STANDING and self.grid[next_y][next_x] == 'v':
            split_key = f"swatch{next_x}{next_y}"
            split_coords = self.splits.get(split_key)
            if split_coords:
                x1, y1, x2, y2 = split_coords
                split_state = BloxorzState(
                    doors_state=state.doors_state,
                    is_split=True,
                    blocks=[(x1, y1), (x2, y2)],
                    active_index=0
                )
                return split_state, 'active', 'Khối đã bị tách thành 2 khối nhỏ'

        # 5. Kích hoạt công tắc thường 's' và công tắc nặng 'h'
        new_doors = self.trigger_switches(
            occupied,
            is_standing_full=(next_p == STANDING),
            current_doors=state.doors_state
        )

        # Kiểm tra sau khi công tắc đổi trạng thái, các ô khối đang đứng có còn sàn hợp lệ không
        for cx, cy in occupied:
            if not self.is_cell_passable(cx, cy, new_doors):
                return None, 'fall', 'Cầu bị đóng dưới chân khối, rơi xuống vực'

        final_state = BloxorzState(next_p, next_x, next_y, new_doors, is_split=False)
        return final_state, 'active', 'Hợp lệ'

    def is_touching_fragile(self, state: BloxorzState) -> bool:
        """Kiểm tra xem khối có đang đứng trên ô dễ vỡ hay không, phục vụ tính cost cho UCS Solver"""
        
        cells_occupied = state.get_occupied_cells()
        for cell in cells_occupied:
            x, y = cell[0], cell[1]
            if self.grid[y][x] == 'f':
                return True
        return False

    def is_goal(self, state: BloxorzState | None) -> bool:
        """Kiểm tra khối gạch đã đứng thẳng an toàn vào ô hố đích 'e' hay chưa.

        Parameters
        ----------
        state : BloxorzState or None
            Trạng thái khối gạch cần kiểm tra.

        Returns
        -------
        bool
            True nếu khối đứng thẳng (STANDING) đúng tọa độ ô 'e', False nếu ngược lại.
        """
        if not state or state.is_split:
            return False
        return (
            state.pos_type == STANDING
            and 0 <= state.y < self.rows
            and 0 <= state.x < len(self.grid[state.y])
            and self.grid[state.y][state.x] == 'e'
        )

    def get_valid_actions(self, state: BloxorzState) -> list[str]:
        """Trả về danh sách các nước đi hợp lệ (không bị rơi vực) từ trạng thái hiện tại.

        Parameters
        ----------
        state : BloxorzState
            Trạng thái hiện tại của khối gạch.

        Returns
        -------
        list of str
            Danh sách các hành động hợp lệ ('up', 'down', 'left', 'right', 'swap').
        """
        actions = []
        available = BASIC_MOVES + (['swap'] if state.is_split else [])
        for act in available:
            next_state, status, _ = self.transition(state, act)
            if next_state is not None and status not in ('fall', 'invalid'):
                actions.append(act)
        return actions

    def get_successors(self, state: BloxorzState) -> list[tuple[str, BloxorzState, float]]:
        """Sinh danh sách các trạng thái kế tiếp hợp lệ kèm hành động và chi phí di chuyển.
        Cài đặt theo phương thức trừu tượng theo giao diện IGameEngine phục vụ các thuật toán tìm kiếm.

        Parameters
        ----------
        state : BloxorzState
            Trạng thái hiện tại của khối gạch.

        Returns
        -------
        list of tuple of (str, BloxorzState, float)
            Danh sách gồm bộ ba (action, next_state, cost) với cost mặc định là 1.0 cho mỗi bước lật.
        """
        successors: list[tuple[str, BloxorzState, float]] = []
        available = BASIC_MOVES + (['swap'] if state.is_split else [])
        for act in available:
            next_state, status, _ = self.transition(state, act)
            if next_state is not None and status not in ('fall', 'invalid'):
                successors.append((act, next_state, 1.0))
        return successors
