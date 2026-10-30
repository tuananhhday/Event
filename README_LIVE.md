# Event QA Live — mở website và thu event trên web

Bản này thêm backend điều khiển Chromium trên máy chủ. Người kiểm thử mở URL Render, nhập website, thao tác ngay trên màn hình website trong công cụ và xem event bên cạnh. Máy công ty không cần cài Node, Python, extension hoặc mở F12.

**Mã nguồn đã được sửa; chưa được push/deploy thay cho bạn. Cần chạy smoke test sau deploy trước khi dùng thật.**

## 1. Cập nhật repository

Giải nén `Event_QA_Live_Update.zip`, mở `UPLOAD_UPDATE`. Trên repo `tuananhhday/Event`, chọn **Add file → Upload files**, kéo **toàn bộ nội dung bên trong `UPLOAD_UPDATE`** vào trang rồi commit. File trùng đường dẫn sẽ được cập nhật.

Không kéo chính thư mục `UPLOAD_UPDATE`, `FULL_SOURCE` hoặc file ZIP vào gốc repo. Sau commit, gốc repo phải có `Dockerfile`, `render.yaml`, `cloud/`, `src/` và `web/`. `FULL_SOURCE` là bản nguồn đầy đủ để giữ lại hoặc tạo repo khác; không upload cả hai thư mục vào cùng repo.

Nếu GitHub bỏ qua `.dockerignore`, có thể tạo bằng **Add file → Create new file**; việc thiếu file này không ngăn luồng chạy chính của repo hiện tại. Không đưa `.env`, API key, dependency đã cài, profile hoặc dữ liệu test riêng lên GitHub.

## 2. Deploy Render

Luồng live cần **Docker Web Service**. Static Site đang phân tích HAR không chạy được backend này. Tạo service mới từ cùng repo, giữ service cũ cho tới khi service mới qua smoke test.

Chọn **New → Web Service**, kết nối `tuananhhday/Event`, rồi đặt:

| Trường | Giá trị |
|---|---|
| Branch | Nhánh vừa cập nhật, thường là `main` |
| Language / Runtime | **Docker** |
| Root Directory | Để trống |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context | `.` |
| Health Check Path | `/health` |

Giữ lệnh chạy mặc định của Dockerfile. Không đặt Publish Directory `web/dist` cho luồng live. Dockerfile cài Chromium và mitmproxy trên máy chủ; backend lắng nghe `0.0.0.0` và biến `PORT` của Render.

Hoặc chọn **New → Blueprint**, dùng `render.yaml` ở gốc; file đã khai báo `runtime: docker` và một phiên trình duyệt đồng thời. Mở URL `onrender.com` do service mới cấp và chạy smoke test bên dưới.

### Biến môi trường

| Biến | Công dụng |
|---|---|
| `MAX_SESSIONS=1` | Một phiên Chromium đồng thời để thử ban đầu. Khi đủ phiên, người khác nhận thông báo chờ. |
| `SESSION_IDLE_MINUTES=15` | Đóng trình duyệt khi không có thao tác trong khoảng thời gian này. |
| `ACCESS_CODE` | Tùy chọn: mã chung giới hạn người được mở phiên. Để trống nếu cho mọi người sử dụng. |
| `ALLOWED_HOSTS` | Tùy chọn: domain được test, ngăn cách bằng dấu phẩy, không kèm `https://`. Bao gồm domain tài nguyên/tracking cần tải; domain con được chấp nhận. |
| `OPENROUTER_API_KEY` | Chỉ cần cho CDP + AI; nhập tại Environment của Render. |
| `OPENROUTER_MODEL` | Tùy chọn; mặc định `openrouter/free`. Quyền truy cập và hạn mức phụ thuộc tài khoản OpenRouter. |

Không cần AI để mở website hoặc thu event. Chromium/mitmproxy dùng nhiều bộ nhớ hơn website tĩnh. Cấu hình miễn phí trong Blueprint dùng thử ban đầu, chưa bảo đảm đủ tài nguyên cho mọi website; nếu hết bộ nhớ, kiểm tra log và tài nguyên trước khi thay đổi gói hoặc số phiên.

Nếu Render báo **memory limit / out of memory**, hãy dùng **CDP không AI** với một phiên trước. Chế độ Proxy chạy thêm mitmproxy nên cần nhiều RAM hơn. Bản Docker giới hạn heap Node ở 128 MiB, ảnh ở mật độ 1× và bộ đệm Network của collector cloud ở 8 MiB; các giới hạn này không giới hạn tổng RAM của Chromium. Website nhiều tab/iframe hoặc nội dung nặng vẫn có thể vượt gói 512 MiB. Khi đó cần gói có nhiều RAM hơn (bắt đầu thử từ 1 GiB) hoặc chạy local; không thể bảo đảm mọi website hoạt động trên gói miễn phí bằng thay đổi giao diện.

Sau deploy, mở `/health`: trường `version` lấy bảy ký tự đầu của `RENDER_GIT_COMMIT` để kiểm tra phiên bản đang chạy. `SIGKILL` của Chromium được ghi vào nhật ký phiên; cần đối chiếu log Render để xác nhận có phải hết bộ nhớ hay không.

## 3. Thao tác hằng ngày

1. Nhập URL đầy đủ, chọn **CDP không AI** và vendor, bấm **Mở trình duyệt test**. Có thể thử **Trang demo** trước.
2. Click vào màn hình website, gõ, dùng Tab/Enter hoặc cuộn. Nút **⛶** phóng to. Với tiếng Việt/nội dung dài, chọn ô nhập trong website rồi dùng ô **Gõ / dán văn bản** bên dưới và bấm **Gửi vào ô đang chọn**. Dùng nút **Tab** để chọn tab website mở thêm.
3. Nếu cần đăng nhập, đăng nhập trong màn hình trình duyệt test. Đây là profile tạm riêng trên máy chủ, không dùng phiên Chrome trên máy của bạn; profile bị xóa khi kết thúc.
4. **Đặt mốc thao tác** trước mỗi bước. Tick **Chỉ xem từ mốc thao tác gần nhất** để giới hạn event và kết quả đối chiếu.
5. Xem event bên phải, bấm để xem payload. Nạp Excel/CSV/JSON đặc tả trước hoặc trong phiên; chọn sheet và tầng đối chiếu.
6. **Kết thúc phiên → Xuất báo cáo** Excel/JSON/CSV hoặc Markdown sai lệch. Không bắt buộc có đặc tả để thu và xuất event.

## 4. Ba cách thu thập

| Phương án | Thu được | Điều kiện |
|---|---|---|
| CDP không AI | dataLayer, InsiderQueue, các nguồn Insider collector gốc hỗ trợ và request thuộc vendor đã chọn | Chromium trên máy chủ |
| CDP + AI | Cùng bộ thu CDP, thêm nút AI giải thích | Chromium và OpenRouter key |
| Proxy không AI | Request của trình duyệt qua mitmproxy, không có JS queue | Chromium và mitmproxy trong Dockerfile |

AI chỉ chạy khi bấm nút và đồng ý nội dung gửi. Yêu cầu gửi tối đa 20 event gần nhất: tên, vendor, tầng, HTTP status và tên trường; không gửi giá trị payload. AI không đổi kết quả đối chiếu.

**Khớp** nghĩa là các phép kiểm được hỗ trợ đạt. Sample Excel chủ yếu kiểm cấu trúc/kiểu; giá trị ví dụ không tự trở thành giá trị nghiệp vụ bắt buộc. **Chưa thấy** cần xác nhận đã thực hiện thao tác; không tự là bug. Sample không đọc được, rule chưa duyệt, request chưa phản hồi hoặc phép kiểm chưa hỗ trợ sẽ **Cần xem lại**. `ref`, `regex`, `after`, `within_ms` cần kiểm thủ công trong bản web.

JS queue không có HTTP status. Phản hồi mạng cập nhật event hiện có, không đếm đôi. HTTP thành công không chứng minh vendor đã nhận và xử lý dữ liệu.

## 5. Giới hạn

- Website nội bộ/VPN/localhost công ty không được mở qua Render công khai. URL/request chỉ chấp nhận HTTP/HTTPS công khai trên cổng tiêu chuẩn. `/demo/` là ngoại lệ nội bộ dành riêng cho demo.
- Một số website chặn trình duyệt headless/cloud. Upload file vào website test, tải file từ trình duyệt test, kéo thả, camera/microphone chưa được hỗ trợ.
- Mỗi người có cookie phiên và trình duyệt riêng. Cookie chưa thay cho hệ thống tài khoản. Chưa có database/lịch sử lâu dài; tối đa 10.000 event mỗi phiên. Reload cùng tab có thể nối lại cùng máy chủ; máy chủ restart sẽ mất phiên. Xuất báo cáo trước khi rời công cụ.
- Event che các trường nhạy cảm phổ biến; hình màn hình vẫn hiển thị nội dung website. Đặt `ACCESS_CODE`/`ALLOWED_HOSTS` khi cần giới hạn sử dụng.
- Kiểm tra URL ở tầng ứng dụng chưa thay thế cô lập mạng của hạ tầng. Đây chưa phải dịch vụ trình duyệt công khai đã được kiểm định bảo mật. Docker chạy user không đặc quyền; `CHROME_NO_SANDBOX=1` phục vụ container không hỗ trợ sandbox Chromium.
- Bản local gốc vẫn có các chức năng nâng cao như tạo/sửa rule, context và kiểm theo bước; không phải mọi màn hình local đã được chuyển sang web.

## 6. Smoke test sau deploy

1. Mở URL service: phải hiện **Đã kết nối máy chủ**, nút mở phiên được bật, không cảnh báo thiếu Chromium.
2. **Thử trang demo**: website phải hiện. Click tìm kiếm phải có JS queue và request có phản hồi trong danh sách.
3. Đặt mốc, thao tác khác và kiểm bộ lọc; mở payload, phóng to, thử gõ/cuộn.
4. Nạp đặc tả, kiểm hai tầng riêng, xuất Excel/JSON. Kết thúc phải ngừng thao tác được nhưng vẫn xuất dữ liệu được.
5. Cửa sổ ẩn danh không được thấy event cửa sổ đầu. Với `MAX_SESSIONS=1`, mở phiên thứ hai khi phiên đầu đang chạy phải báo đủ số phiên.
6. Thử riêng Proxy. Nếu có key, thử AI; sau đó thử website thật được phép truy cập từ Render.

## 7. Kiểm tra cho người phát triển

Backend cloud chỉ dùng module chuẩn Node và collector gốc; riêng `npm run cloud` không cần `npm install`. Ứng dụng local gốc vẫn dùng dependency trong package.json.

```sh
npm run test:cloud
npm --prefix web run bundle
# Máy phát triển đã có Chromium:
CHROME_PATH=/duong/dan/chromium npm run cloud
# Hoặc máy có Docker:
docker build -t event-qa-live .
docker run --rm -p 10000:10000 event-qa-live
```

Kiểm thử tự động kiểm hợp đồng API với browser giả lập trong test, vòng đời/giới hạn/tách phiên, origin, mã truy cập, lọc URL, cập nhật phản hồi và phân tích/đối chiếu HAR. Test double không tạo dữ liệu live trong sản phẩm. Đã kiểm tra giao diện bằng trình duyệt, nhưng chưa chạy được Chromium trong preview, chưa build Docker và chưa gọi OpenRouter bằng key thật. Smoke test Render ở trên cần hoàn tất trước khi dùng thật.

Tài liệu: [Render Docker](https://render.com/docs/docker), [Render Web Services](https://render.com/docs/web-services), [Render Blueprint](https://render.com/docs/blueprint-spec).
