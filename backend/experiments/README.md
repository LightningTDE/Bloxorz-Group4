# Chạy experiments

Chạy lệnh từ thư mục `backend`:

```bash
python -m experiments.run_benchmarks \
  --algorithms BFS IDS \
  --levels 1 3 6 8 \
  --timeout 60
```

Nếu bỏ `--levels`, runner dùng 12 level cố định của mục 3.6:

- Basic: 1, 3, 6
- Fragile tiles: 4, 13, 27
- Switches & bridges: 2, 5, 18
- Combined & split: 8, 10, 23

Kết quả được ghi thành `benchmark_results.csv` và `benchmark_results.md` trong
`backend/experiments/results/`. Thư mục kết quả được Git bỏ qua để tránh commit dữ
liệu sinh tự động.

Runner hỗ trợ `BFS`, `IDS`, `UCS` và `ASTAR`. Hiện tại chỉ nên dùng kết quả BFS/IDS;
UCS và A* trên nhánh `main` chưa được triển khai. Sau khi hai solver đó hoàn thành,
có thể bỏ `--algorithms` để chạy đủ bốn thuật toán.
