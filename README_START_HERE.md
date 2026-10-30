# Bắt đầu từ gói mã nguồn đầy đủ

Gói này gồm **toàn bộ 74 file được theo dõi trong bản gốc Event-Tracking**, cộng **bản web mới** và cấu hình deploy Render. Không cần cài Node để upload mã nguồn bằng trình duyệt hoặc sử dụng bản web trên Render.

Nguồn: [tuananhhday/Event-Tracking](https://github.com/tuananhhday/Event-Tracking), commit `c98e0c88795cd07b15988e7de06fd39d80f25451`. Các file tải từ nguồn đã được kiểm tra đúng Git blob SHA. Xem `UPSTREAM_SOURCE.json`.

## 1. Đưa toàn bộ lên repo mới bằng trình duyệt

1. Giải nén ZIP. Mở **bên trong** thư mục `Event-Complete`.
2. Mở repository mới: [tuananhhday/Event](https://github.com/tuananhhday/Event).
3. Với repo trống, chọn **uploading an existing file**. Với repo đã có file, chọn **Add file → Upload files**.
4. Chọn tất cả file/thư mục **bên trong** `Event-Complete`, kéo thả vào trang upload và chờ hoàn tất.
5. Kiểm tra ở gốc repo xuất hiện `README.md`, `render.yaml`, `src/`, `web/`, `solutions/` cùng các file/thư mục còn lại.
6. Nhập commit message, ví dụ `Add original Event Tracking and browser web edition`, rồi commit vào nhánh mặc định.

Gói có ít hơn 100 file nên nằm trong giới hạn 100 file mỗi lượt upload của GitHub web. Mỗi file nhỏ hơn 25 MiB. Đưa **nội dung đã giải nén** lên repo sẽ giữ cấu trúc thư mục để Render tìm thấy `render.yaml` và `web/dist/index.html`.

Tài liệu: [GitHub — Upload files](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

## 2. Deploy web công khai trên Render

### Dùng Blueprint

1. Mở [Render Dashboard](https://dashboard.render.com/), chọn **New → Blueprint**.
2. Kết nối repo mới `tuananhhday/Event` và chọn đúng nhánh chứa mã nguồn.
3. Dùng `render.yaml` ở gốc repo. Cấu hình có `runtime: static` và `staticPublishPath: ./web/dist`.
4. Review cấu hình rồi deploy. Dùng URL `onrender.com` Render trả về để chia sẻ.

### Tạo Static Site thủ công

Chọn **New → Static Site**, kết nối repo mới và nhập:

| Trường | Giá trị |
|---|---|
| Branch | Nhánh chứa code, thường là `main` |
| Root Directory | `web` |
| Build Command | `echo ready` |
| Publish Directory | `dist` |
| Environment variable | `SKIP_INSTALL_DEPS=true` |

Bản web không cần API key, database hoặc Start Command. Người dùng mở URL Render để dùng, không phải đăng nhập ChatGPT. Dữ liệu file được xử lý riêng trong tab mỗi người và không gửi lên backend.

Tài liệu: [Render Static Sites](https://render.com/docs/static-sites), [Blueprint YAML](https://render.com/docs/blueprint-spec).

## 3. Trong gói có những phần nào?

| Vị trí | Nội dung |
|---|---|
| `src/`, `solutions/`, `proxy/`, `scripts/`, `test/`, `tests/` | Mã nguồn và test của bản gốc: CDP không AI, CDP + AI, Proxy. |
| `examples/`, `docs/`, `deep-research-report.md` | Case mẫu và tài liệu gốc. |
| `package.json`, `package-lock.json`, các file `.cmd` | Cấu hình và lệnh chạy ứng dụng gốc trên máy có Node. |
| `web/dist/` | Website để deploy lên Render hoặc static hosting. |
| `web/Event_Tracking_QA_Standalone.html` | Bản web đã nhúng CSS/JS, mở bằng Chrome/Edge để dùng offline. |
| `web/scripts/`, `web/tests/`, `web/package.json` | Công cụ tạo HTML độc lập và 16 kiểm thử cho bản web. |
| `render.yaml` | Cấu hình Render Blueprint cho bản web. |
| `UPSTREAM_SOURCE.json` | Commit nguồn và hash của 74 file gốc. |

## 4. Phạm vi sử dụng

Bản web phân tích HAR, nhập đặc tả Excel/CSV/JSON, xem event và xuất báo cáo. Bản web không tự bắt event từ tab website khác. Các chế độ thu thập CDP/AI/Proxy vẫn cần chạy trên máy có Node và môi trường phù hợp theo README gốc.

Đây là bản chụp mã nguồn để tạo repo mới; không bao gồm lịch sử Git, `node_modules`, môi trường Python, khóa API hay dữ liệu `runs/` không được theo dõi trong repo gốc. Với ứng dụng gốc, cài dependency và cấu hình riêng trước khi chạy; với website trên Render, người truy cập không cần cài các thành phần đó.

Kiểm thử web nếu máy phát triển có Node: `npm --prefix web test`. Tạo lại HTML độc lập: `npm --prefix web run bundle`.
