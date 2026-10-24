import time
from collections import deque

from app.pathfinder.base import BaseSolver, SearchOutcome
from app.core.interfaces import IGameEngine
from app.core.models import BloxorzState

class BFSSolver(BaseSolver):
    """Thuat toan tim kiem theo chieu rong (Breadth-First Search).

    Parameters
    ----------
    measure_memory : bool, optional, default: True
        Co quyet dinh co do dinh RAM hay khong.

    Attributes
    ----------
    algorithm_name : str
        Ten dinh danh ("BFS").
    """
    algorithm_name: str = "BFS"

    def __init__(self, measure_memory: bool = True):
        super().__init__(measure_memory=measure_memory)

    def _search(
        self,
        engine: IGameEngine,
        start_state: BloxorzState,
        deadline: float
    ) -> SearchOutcome:
        """Thuc thi duyet theo chieu rong bang hang doi FIFO deque.

        Moi trang thai BloxorzState tuong duong voi bo
        (pos1, pos2, bridge_states, is_split) theo dac ta giai thuat:
          - pos1, pos2  : toa do khoi da duoc BloxorzState luu san.
          - bridge_states : tuple bool trang thai cau (doors_state).
          - is_split    : True neu dang phan than thanh 2 khoi don.
        Chuan hoa thu tu pos1 <= pos2 (khi khong phan than) va
        hash / so sanh bang duoc BloxorzState dam nhan qua StateKey.

        Quy tac dem node (de so sanh cong bang giua cac thuat toan):
          - expanded_nodes  : so node POP ra va goi get_successors
                              (khong tinh node dich).
          - generated_nodes : tong so trang thai con hop le tu get_successors.

        Parameters
        ----------
        engine : IGameEngine
            Dong co mo phong game Bloxorz cung cap get_successors va is_goal.
        start_state : BloxorzState
            Trang thai bat dau tim kiem.
        deadline : float
            Moc thoi gian gioi han tinh bang time.perf_counter().

        Returns
        -------
        SearchOutcome
            Ket qua tho sau luot tim kiem.
        """
        # ----------------------------------------------------------------
        # Khoi tao
        # visited / parent_map: BloxorzState -> (parent_state, action) | None
        # Gan None cho start_state de _reconstruct_path nhan biet diem goc.
        # Cau truc nay dong thoi la da tham
        # ----------------------------------------------------------------
        parent_map: dict[BloxorzState, tuple[BloxorzState, str] | None] = {
            start_state: None
        }
        queue: deque = deque([start_state])

        expanded_nodes: int = 0
        generated_nodes: int = 0

        # ----------------------------------------------------------------
        # Vong lap chinh BFS
        # ----------------------------------------------------------------
        while queue:
            # Buoc 4: Lay trang thai dau hang doi
            curr_state: BloxorzState = queue.popleft()

            # Buoc 4 - Kiem tra dieu kien dich (check-on-pop)
            # Dam bao expanded_nodes so sanh cong bang giua cac thuat toan.
            if engine.is_goal(curr_state):
                actions, states_path = self._reconstruct_path(parent_map, curr_state)
                return SearchOutcome(
                    is_solved=True,
                    timed_out=False,
                    actions=actions,
                    states_path=states_path,
                    total_cost=float(len(actions)),
                    expanded_nodes=expanded_nodes,
                    generated_nodes=generated_nodes,
                )

            # Mo rong node: dem va kiem tra deadline dinh ky moi ~1000 node
            expanded_nodes += 1
            if expanded_nodes % 1000 == 0 and time.perf_counter() >= deadline:
                return SearchOutcome(
                    is_solved=False,
                    timed_out=True,
                    actions=(),
                    states_path=(),
                    total_cost=0.0,
                    expanded_nodes=expanded_nodes,
                    generated_nodes=generated_nodes,
                )

            # Sinh cac buoc di tiep theo qua engine.
            # engine.get_successors() xu ly toan bo logic:
            #   - 4 huong (up/down/left/right) cho ca khoi lon lan khoi phan than
            #   - hanh dong 'swap' khi is_split == True
            #   - Buoc 4.1: loc bo nuoc di khong hop le (roi vuc, cau dong, gach cam)
            #   - Buoc 4.2: cap nhat trang thai tach / gop khoi (next_split)
            #   - Buoc 4.3: cap nhat trang thai cau (Soft Switch, Hard Switch)
            #   - Chuan hoa thu tu pos1 <= pos2 khi is_split == False
            successors = engine.get_successors(curr_state)
            generated_nodes += len(successors)

            # Buoc 4.4: Dua cac trang thai moi chua tham vao hang doi
            for action, next_state, _cost in successors:
                if next_state not in parent_map:
                    parent_map[next_state] = (curr_state, action)
                    queue.append(next_state)

        # Khong con trang thai de duyet - khong co loi giai
        return SearchOutcome(
            is_solved=False,
            timed_out=False,
            actions=(),
            states_path=(),
            total_cost=0.0,
            expanded_nodes=expanded_nodes,
            generated_nodes=generated_nodes,
        )
