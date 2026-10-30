# Event Tracking QA — HAR dự phòng

Bản web dùng được ngay trên Chrome/Edge, không cần cài Node, Python hoặc extension trên máy sử dụng. Dữ liệu HAR và đặc tả được xử lý trong tab trình duyệt; ứng dụng không gửi file lên backend và không có API key.

## Mở và sử dụng

- Dùng link website được bàn giao, hoặc mở **Event_Tracking_QA_Standalone.html** bằng Chrome/Edge. Bản HTML độc lập đã nhúng toàn bộ CSS/JS và có thể dùng offline.
- Nếu dùng thư mục `dist/`, cần đưa lên HTTP(S) static hosting; không double-click `dist/index.html` vì các ES module sẽ bị giới hạn bởi `file://`.
- Bấm **Thử dữ liệu mẫu** để thử bảng event, sai lệch, payload và xuất báo cáo. Dữ liệu mẫu luôn được ghi nhãn.
- Thu HAR trên website thật: F12 → Network → Preserve log → xóa log cũ → thực hiện luồng → Export HAR (sanitized).
- Vào Tổng quan → chọn HAR → chọn Excel/CSV/JSON đặc tả nếu có → Bắt đầu kiểm tra.
- Đóng hoặc tải lại tab sẽ mất phiên. Tải báo cáo trước khi đóng. Phiên không lưu localStorage.

## Deploy riêng công cụ HAR lên Render

Mã nguồn đã nằm trong `web/` của repository [tuananhhday/Event](https://github.com/tuananhhday/Event). Bản deploy trên Render là website tĩnh, truy cập qua URL công khai, không dùng cổng đăng nhập ChatGPT.

**Luồng web live hiện nằm ở `cloud/`, dùng Docker Web Service theo [README_LIVE.md](../README_LIVE.md). File `render.yaml` ở gốc đã đổi sang live.** Phần dưới chỉ áp dụng nếu muốn giữ một Static Site HAR riêng.

### Cách 2 — Tạo Static Site thủ công

Chọn **New → Static Site**, kết nối repository trên và nhập:

| Trường | Giá trị |
|---|---|
| Branch | `main` |
| Root Directory | `web` |
| Build Command | `echo ready` |
| Publish Directory | `dist` |
| Environment variable | `SKIP_INSTALL_DEPS=true` |

Không tạo Node Web Service cho bản này và không đặt Start Command. Không cần database hoặc API key. Chọn Create Static Site, chờ deploy xong rồi chia sẻ URL Render. Người truy cập chỉ cần Chrome/Edge hiện đại.

Mỗi người có phiên độc lập trong tab của họ; dữ liệu file không được gửi lên server. Không có cơ chế chia sẻ report giữa các tab/người dùng hoặc lưu phiên sau reload.

Nếu chuyển sang hosting khác, chỉ cần publish toàn bộ `web/dist/`. Chưa deploy vào tài khoản Render của người dùng; repository và cấu hình đã sẵn sàng để người dùng triển khai.

Tài liệu chính thức: [Render Static Sites](https://render.com/docs/static-sites), [Blueprint YAML](https://render.com/docs/blueprint-spec), [Chrome HAR](https://developer.chrome.com/docs/devtools/network/reference/#save-as-har).

## Tính năng hoạt động

- Đọc nhiều HAR; loại request tài nguyên và API thông thường; nhận diện endpoint GA4, Insider, Meta, TikTok, Ads, Clarity và endpoint tùy biến trông giống tracking.
- GA4: query string, form/batch, `ep.*`, `epn.*`, các trường item phổ biến `pr1`, `pr2`.
- Insider: JSON events và base64 JSON. Các định dạng nhị phân/mã hóa không được suy đoán.
- Excel XLSX: shared/inline strings, số, ô gộp, chọn sheet. Dùng DecompressionStream của Chrome/Edge hiện đại, không CDN. File quá lớn hoặc mã hóa bị từ chối.
- CSV hoặc JSON đặc tả, hỗ trợ JSON cases/rules của repo gốc. Sample là dữ liệu, không thực thi JavaScript.
- Tìm event/payload/endpoint, lọc nền tảng, HTTP lỗi, nghi ngờ trùng, xem chi tiết từng trường và evidence.
- Xuất XLSX 4 sheet, HTML độc lập, JSON, CSV và bug Markdown.

## Cách đọc đối chiếu

| Trạng thái | Ý nghĩa |
|---|---|
| Khớp | Các phép kiểm được hỗ trợ đã đạt. Với sample Excel, chỉ là khớp cấu trúc/kiểu, không xác nhận giá trị nghiệp vụ. |
| Sai lệch | Thiếu trường, sai kiểu/giá trị, sai count hoặc HTTP lỗi. |
| Chưa thấy | Chưa quan sát trong HAR. Không tự báo bug nếu chưa xác nhận đã chạy luồng. |
| Cần xem lại | Không đủ dữ liệu, sample không đọc được, chưa duyệt, JS_QUEUE hoặc phép kiểm chưa hỗ trợ. |
| Ngoài đặc tả | Event chưa có dòng tương ứng trong đặc tả đã nhập. |

Rule JSON hỗ trợ `eq`, `exists`, `not_exists`, `type`, `one_of`, `range`, `subset`, `ignore`. `ref`, `regex`, `after`, `within_ms` yêu cầu kiểm tra thủ công trong bản web. Quy tắc không có field chỉ xác nhận tên event và trả Cần xem lại. Nếu cùng tên event thuộc nhiều luồng mà không phân biệt được thì không tự cho PASS.

## Giới hạn cần giữ đúng

Đây là chế độ **phân tích HAR**, không phải thay thế CDP realtime. Website không đọc được Network/dataLayer của tab khác, không dùng phiên đăng nhập Chrome trên máy công ty, không tự mở trình duyệt công ty từ server và không kiểm chứng vendor ingestion chỉ từ HTTP 200.

Endpoint tùy biến có thể không được nhận diện nếu tên không gợi ý tracking. Event chỉ tồn tại trong JS queue hoặc request chưa gửi không có trong HAR. Tên event so khớp chính xác; cần thống nhất tên nghiệp vụ với tên gửi thực tế. Những phép biến đổi vendor chưa hỗ trợ phải review thủ công.

Request headers/cookies không được đưa vào model event. Các khóa nhạy cảm phổ biến được che, nhưng dữ liệu có thể xuất hiện dưới khóa khác hoặc trong chuỗi; cần xem lại báo cáo trước khi chia sẻ. Không có backend, AI/OpenRouter, session server hoặc cơ chế giữ phiên sau reload.

Giới hạn mỗi HAR 60 MB, đặc tả 20 MB; workbook có giới hạn giải nén. File lớn có thể mất thời gian xử lý trên máy RAM thấp.

## Mã nguồn và kiểm tra cho người phát triển

`dist/index.html` là giao diện, `app.mjs` điều khiển UI, `core.mjs` phân tích/đối chiếu, `sheets.mjs` đọc/ghi XLSX, `demo.mjs` chứa dữ liệu minh họa. Không cần cài dependency.

Nếu máy phát triển có Node: `npm test` chạy kiểm thử parser/rules; `npm run bundle` tạo lại HTML độc lập. Node chỉ dành cho người phát triển, không phải điều kiện sử dụng web.

Bản web dùng schema và cách giải mã tương thích với các trường phổ biến trong bản gốc Event-Tracking. Các chế độ local ở thư mục gốc vẫn cần Node. Bản live mới trong `cloud/` đưa collector lên máy chủ Docker; Render Static Site không thực thi các collector đó.
